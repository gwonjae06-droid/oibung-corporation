import { createClient } from 'npm:@supabase/supabase-js@2';

const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, secret, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const encoder = new TextEncoder();
const hmac = crypto.subtle.importKey('raw', encoder.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const origin = 'https://gwonjae06-droid.github.io';
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-oibung-guest',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
const bucket = 'oc-screenshots';
const maxImage = 5242880;
const maxReviewImages = 3;
const mimeExtensions = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const gamePattern = /^[a-z0-9-]{1,64}$/;

function reply(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers });
}

async function hash(value: string) {
  const signature = await crypto.subtle.sign('HMAC', await hmac, encoder.encode(value));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

function required(value: unknown, limit: number) {
  return typeof value === 'string' && value.trim() && value.trim().length <= limit;
}

async function detectImage(file: File) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => b[index] === byte)) return 'image/png';
  const ascii = String.fromCharCode(...b);
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  return '';
}

Deno.serve(async req => {
  if (req.headers.get('origin') !== origin) return reply(403, { error: '허용된 사이트에서 이용해 줘.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: '요청 방식이 올바르지 않아.' });
  const token = req.headers.get('x-oibung-guest') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return reply(400, { error: '브라우저를 새로고침한 뒤 다시 시도해 줘.' });

  try {
    const imageRequest = req.headers.get('content-type')?.startsWith('multipart/form-data');
    const length = Number(req.headers.get('content-length'));
    if (length > (imageRequest ? maxReviewImages * maxImage + 32768 : 12000)) return reply(413, { error: '파일이나 글이 너무 커.' });
    const identity = await hash('guest:' + token);
    const author = [identity.slice(0, 8), identity.slice(8, 12), identity.slice(12, 16),
      identity.slice(16, 20), identity.slice(20, 32)].join('-');
    const gameId = new URL(req.url).searchParams.get('game') ?? '';
    const form = imageRequest ? await req.formData() : null;
    const metadata = form?.get('metadata');
    const content = typeof metadata === 'string' ? JSON.parse(metadata) : form ? null : await req.json();
    const action = form && metadata == null ? 'image' : content?.action;
    if (!['game', 'edit_game', 'viewer', 'review', 'image', 'delete_image', 'update_game', 'report'].includes(action) || (action !== 'game' && !gamePattern.test(gameId))) {
      return reply(400, { error: '게임 정보가 올바르지 않아.' });
    }
    if (action === 'viewer') {
      const review = await db.from('oc_reviews').select('nickname,stars,body,image_paths').eq('game_id', gameId)
        .eq('author_id', author).maybeSingle();
      if (review.error) throw review.error;
      return reply(200, { review: review.data });
    }
    if (action === 'delete_image') {
      const path = content?.path;
      if (typeof path !== 'string' || !path || path.length > 180) {
        return reply(400, { error: '스크린샷 정보가 올바르지 않습니다.' });
      }
      const image = await db.from('oc_images').select('path').eq('game_id', gameId)
        .eq('path', path).maybeSingle();
      if (image.error) throw image.error;
      if (!image.data) return reply(200, { deleted: true });
      const removed = await db.storage.from(bucket).remove([image.data.path]);
      if (removed.error) throw removed.error;
      const deleted = await db.from('oc_images').delete().eq('game_id', gameId).eq('path', path);
      if (deleted.error) throw deleted.error;
      return reply(200, { deleted: true });
    }

    const address = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const quota = await db.rpc('oc_guest_quota', { address_hash: await hash('ip:' + address), operation: ['edit_game', 'update_game'].includes(action) ? 'game' : action === 'report' ? 'review' : action });
    if (quota.error) throw quota.error;
    if (!quota.data) return reply(429, { error: '오늘 등록 한도에 도달했어. 내일 다시 시도해 줘.' });

    if (action === 'update_game') {
      const title = content?.title;
      const body = content?.body;
      if (!required(title, 60) || !required(body, 1000)) {
        return reply(400, { error: '소식 제목과 내용을 확인해 주세요.' });
      }
      const result = await db.from('oc_game_updates')
        .insert({ game_id: gameId, title: title.trim(), body: body.trim() })
        .select('id,game_id,title,body,created_at').single();
      if (result.error) throw result.error;
      return reply(201, { update: result.data });
    }
    if (action === 'report') {
      const reason = content?.reason;
      if (!['incorrect','inappropriate','spam','other'].includes(reason)) {
        return reply(400, { error: '신고 사유를 골라 주세요.' });
      }
      const result = await db.from('oc_content_reports')
        .upsert({ game_id: gameId, reason, reporter_hash: identity }, { onConflict: 'game_id,reporter_hash', ignoreDuplicates: true });
      if (result.error) throw result.error;
      return reply(200, { submitted: true });
    }

    if (action === 'game' || action === 'edit_game') {
      const { title, description, genre, play_url, developer, development_status, remove_thumbnail, intro_tone, platform, play_mode } = content;
      if (!required(title, 80) || !required(description, 1000) || !required(genre, 60)
          || (developer != null && developer !== '' && !required(developer, 80))
          || (development_status !== undefined && !['unknown', 'in_development', 'released', 'live_service', 'finished'].includes(development_status))) {
        return reply(400, { error: '게임 이름, 장르, 소개를 확인해 줘.' });
      }
      if (intro_tone !== undefined && !["gallery","burgundy","navy","forest","plum","umber","slate"].includes(intro_tone)) {
        return reply(400, { error: '소개 배경색을 다시 선택해 주세요.' });
      }
      if ((platform !== undefined && !['unknown','web','pc','android','mod','other'].includes(platform))
          || (play_mode !== undefined && !['unknown','single','multi','both'].includes(play_mode))) {
        return reply(400, { error: '플랫폼과 플레이 방식을 확인해 주세요.' });
      }
      let link: URL | null = null;
      if (play_url != null && play_url !== '') {
        if (!required(play_url, 2048)) return reply(400, { error: '플레이 링크를 확인해 줘.' });
        try { link = new URL(play_url); } catch { return reply(400, { error: 'HTTPS 게임 링크를 입력해 줘.' }); }
        if (link.protocol !== 'https:' || link.username || link.password || link.href.length > 2048) {
          return reply(400, { error: 'HTTPS 게임 링크를 확인해 줘.' });
        }
      }
      const fields: Record<string, unknown> = { title: title.trim(), description: description.trim(),
        genre: genre.trim(), play_url: link?.href ?? null };
      if (developer !== undefined) fields.developer = developer?.trim() || null;
      if (development_status !== undefined) fields.development_status = development_status;
      if (intro_tone !== undefined) fields.intro_tone = intro_tone;
      if (platform !== undefined) fields.platform = platform;
      if (play_mode !== undefined) fields.play_mode = play_mode;
      const editing = action === 'edit_game';
      const id = editing ? gameId : crypto.randomUUID();
      let previousThumbnail: string | null = null;
      if (editing) {
        const existing = await db.from('oc_games').select('thumbnail_path')
          .eq('id', id).maybeSingle();
        if (existing.error) throw existing.error;
        if (!existing.data) return reply(404, { error: '게임을 찾을 수 없어.' });
        previousThumbnail = existing.data.thumbnail_path;
      }
      const thumbnail = form?.get('thumbnail');
      const storage = db.storage.from(bucket);
      let uploadedPath: string | null = null;
      if (thumbnail != null) {
        if (!(thumbnail instanceof File) || thumbnail.size === 0 || thumbnail.size > maxImage
            || !mimeExtensions.has(thumbnail.type) || await detectImage(thumbnail) !== thumbnail.type) {
          return reply(400, { error: '썸네일은 5MB 이하 JPG, PNG, WebP를 선택해 줘.' });
        }
        uploadedPath = 'thumbnails/' + id + '/' + crypto.randomUUID() + '.' + mimeExtensions.get(thumbnail.type);
        const upload = await storage.upload(uploadedPath, thumbnail, { contentType: thumbnail.type });
        if (upload.error) throw upload.error;
        fields.thumbnail_path = uploadedPath;
      } else if (editing && remove_thumbnail === true) {
        fields.thumbnail_path = null;
      }
      const games = db.from('oc_games');
      let update = editing
        ? games.update(fields).eq('id', id)
        : games.insert({ id, ...fields, category: 'other', author_id: author });
      if (editing && 'thumbnail_path' in fields) {
        update = previousThumbnail === null
          ? update.is('thumbnail_path', null) : update.eq('thumbnail_path', previousThumbnail);
      }
      const result = await update.select('id,title,description,genre,play_url,developer,development_status,thumbnail_path,intro_tone,platform,play_mode').maybeSingle();
      if (result.error || !result.data) {
        if (uploadedPath) await storage.remove([uploadedPath]);
        if (result.error) throw result.error;
        return reply(409, { error: '게시물이 변경됐어. 다시 열고 저장해 줘.' });
      }
      if (previousThumbnail && 'thumbnail_path' in fields) await storage.remove([previousThumbnail]);
      return reply(editing ? 200 : 201, { game: result.data });
    }

    if (action === 'review') {
      const { nickname, stars, body, keep_paths } = content;
      if (!required(nickname, 30) || !Number.isInteger(stars) || stars < 1 || stars > 5
          || typeof body !== 'string' || body.length > 2000) {
        return reply(400, { error: '닉네임과 별점, 후기 내용을 확인해 줘.' });
      }
      const previous = await db.from('oc_reviews').select('image_paths')
        .eq('game_id', gameId).eq('author_id', author).maybeSingle();
      if (previous.error) throw previous.error;
      const oldPaths: string[] = previous.data?.image_paths || [];
      if (keep_paths !== undefined && (!Array.isArray(keep_paths)
          || keep_paths.some((path: unknown) => typeof path !== 'string' || !oldPaths.includes(path))
          || new Set(keep_paths).size !== keep_paths.length)) {
        return reply(400, { error: '유지할 사진 정보가 올바르지 않아.' });
      }
      const retained: string[] = keep_paths === undefined ? oldPaths : keep_paths;
      const photos = form?.getAll('photos') ?? [];
      if (photos.length > maxReviewImages || photos.length + retained.length > maxReviewImages) {
        return reply(400, { error: '후기 사진은 최대 3장까지 등록할 수 있어.' });
      }
      const verified: File[] = [];
      for (const photo of photos) {
        if (!(photo instanceof File) || !photo.size || photo.size > maxImage
            || !mimeExtensions.has(photo.type) || await detectImage(photo) !== photo.type) {
          return reply(400, { error: '사진은 5MB 이하 JPG, PNG, WebP만 올릴 수 있어.' });
        }
        verified.push(photo);
      }
      const storage = db.storage.from(bucket);
      const uploaded: string[] = [];
      try {
        for (const photo of verified) {
          const path = 'reviews/' + gameId + '/' + author + '/' + crypto.randomUUID()
            + '.' + mimeExtensions.get(photo.type);
          const upload = await storage.upload(path, photo, { contentType: photo.type });
          if (upload.error) throw upload.error;
          uploaded.push(path);
        }
        const nextPaths = [...retained, ...uploaded];
        const result = await db.from('oc_reviews').upsert({
          game_id: gameId, author_id: author, nickname: nickname.trim(),
          stars, body: body.trim(), image_paths: nextPaths
        }, { onConflict: 'game_id,author_id' });
        if (result.error) throw result.error;
        const obsolete = oldPaths.filter(path => !nextPaths.includes(path));
        if (obsolete.length) {
          const removed = await storage.remove(obsolete);
          if (removed.error) console.error('Review photo cleanup failed');
        }
        return reply(200, { saved: true });
      } catch (error) {
        if (uploaded.length) await storage.remove(uploaded);
        throw error;
      }
    }

    const file = form?.get('image');
    if (!(file instanceof File) || file.size > maxImage || file.size === 0
        || !mimeExtensions.has(file.type) || await detectImage(file) !== file.type) {
      return reply(400, { error: '5MB 이하 JPG, PNG, WebP 이미지를 골라 줘.' });
    }
    const game = await db.from('oc_games').select('id').eq('id', gameId).maybeSingle();
    if (game.error) throw game.error;
    if (!game.data) return reply(404, { error: '게임을 찾을 수 없어.' });
    const path = author + '/' + gameId + '/' + crypto.randomUUID() + '.' + mimeExtensions.get(file.type);
    const storage = db.storage.from(bucket);
    const upload = await storage.upload(path, file, { contentType: file.type });
    if (upload.error) throw upload.error;
    const image = await db.from('oc_images').insert({ game_id: gameId, path, author_id: author });
    if (image.error) {
      await storage.remove([path]);
      throw image.error;
    }
    return reply(201, { saved: true });
  } catch (error) {
    console.error('Guest write failed', error instanceof Error ? error.name : 'backend');
    return reply(500, { error: '저장에 실패했어. 잠시 후 다시 시도해 줘.' });
  }
});
