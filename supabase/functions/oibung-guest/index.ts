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
    if (length > (imageRequest ? maxImage + 4096 : 12000)) return reply(413, { error: '파일이나 글이 너무 커.' });
    const identity = await hash('guest:' + token);
    const author = [identity.slice(0, 8), identity.slice(8, 12), identity.slice(12, 16),
      identity.slice(16, 20), identity.slice(20, 32)].join('-');
    const gameId = new URL(req.url).searchParams.get('game') ?? '';
    const content = imageRequest ? null : await req.json();
    const action = imageRequest ? 'image' : content?.action;
    if (!['game', 'review', 'image'].includes(action) || (action !== 'game' && !gamePattern.test(gameId))) {
      return reply(400, { error: '게임 정보가 올바르지 않아.' });
    }
    const address = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const quota = await db.rpc('oc_guest_quota', { address_hash: await hash('ip:' + address), operation: action });
    if (quota.error) throw quota.error;
    if (!quota.data) return reply(429, { error: '오늘 등록 한도에 도달했어. 내일 다시 시도해 줘.' });

    if (action === 'game') {
      const { title, description, genre, category, play_url } = content;
      if (!required(title, 80) || !required(description, 1000) || !required(genre, 60)
          || !['action', 'strategy', 'other'].includes(category)) {
        return reply(400, { error: '게임 이름, 장르, 소개를 확인해 줘.' });
      }
      let link: URL | null = null;
      if (play_url != null && play_url !== '') {
        if (!required(play_url, 2048)) return reply(400, { error: '플레이 링크를 확인해 줘.' });
        try { link = new URL(play_url); } catch { return reply(400, { error: 'HTTPS 게임 링크를 입력해 줘.' }); }
        if (link.protocol !== 'https:' || link.username || link.password || link.href.length > 2048) {
          return reply(400, { error: 'HTTPS 게임 링크를 확인해 줘.' });
        }
      }
      const game = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(),
        genre: genre.trim(), category, play_url: link?.href ?? null };
      const result = await db.from('oc_games').insert({ ...game, author_id: author });
      if (result.error) throw result.error;
      return reply(201, { game });
    }

    if (action === 'review') {
      const { nickname, stars, body } = content;
      if (!required(nickname, 30) || !Number.isInteger(stars) || stars < 1 || stars > 5
          || typeof body !== 'string' || body.length > 500) {
        return reply(400, { error: '닉네임과 별점을 확인해 줘.' });
      }
      const result = await db.from('oc_reviews').upsert({
        game_id: gameId, author_id: author, nickname: nickname.trim(), stars, body: body.trim()
      }, { onConflict: 'game_id,author_id' });
      if (result.error) throw result.error;
      return reply(200, { saved: true });
    }

    const file = (await req.formData()).get('image');
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
