const $ = selector => document.querySelector(selector);
const detail = $('#game-dialog');
const account = $('#guide-dialog');
const accountStatus = $('#account-status');
const detailStatus = $('#detail-status');
const loginForm = $('#sign-in-form');
const gameForm = $('#add-game-form');
const imageForm = $('#image-form');
const reviewForm = $('#review-form');
const bucket = 'oc-screenshots';
const fileTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const pageSize = 12;
let client;
let session;
let isMember = false;
let authRevision = 0;
let detailRevision = 0;
let catalogRevision = 0;
let imageLimit = pageSize;
let reviewLimit = pageSize;

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

function textField(form, name) {
  return form.elements.namedItem(name).value.trim();
}

function submit(form, status, run) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    status.textContent = '처리 중…';
    try {
      await run();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '저장에 실패했어. 잠시 후 다시 시도해 줘.';
    } finally {
      button.disabled = false;
    }
  });
}

function activeGame() {
  return detail.open ? detail.dataset.gameId : '';
}

async function loadGames() {
  const revision = ++catalogRevision;
  const games = [];
  for (let offset = 0; ; offset += 100) {
    const page = unwrap(await client.from('oc_games').select('id,title,description,genre,category,play_url')
      .order('created_at').order('id').range(offset, offset + 99));
    games.push(...page);
    if (page.length < 100) break;
  }
  if (revision !== catalogRevision) return;
  window.OIBUNG_CATALOG.setSharedGames(games.map(({play_url, ...game}) => ({
    ...game,
    playUrl: play_url
  })));
}

function showParticipation() {
  imageForm.hidden = !isMember;
  reviewForm.hidden = !isMember;
  $('#detail-sign-in').hidden = !client || isMember;
}

function drawImages(rows) {
  const gallery = $('#community-gallery');
  const links = rows.slice(0, imageLimit).map((row, index) => {
    const link = document.createElement('a');
    link.href = client.storage.from(bucket).getPublicUrl(row.path).data.publicUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.src = link.href;
    image.loading = 'lazy';
    image.alt = '게임 스크린샷 ' + (index + 1);
    link.append(image);
    return link;
  });
  gallery.replaceChildren(...links);
  if (!rows.length) gallery.textContent = '아직 등록된 스크린샷이 없어.';
  $('#more-images').hidden = rows.length <= imageLimit;
}

function drawReviews(rows, summary) {
  $('#review-summary').textContent = summary.total
    ? '★ ' + Number(summary.average).toFixed(1) + ' / 5 · 평가 ' + summary.total + '개'
    : '아직 등록된 평가가 없어.';
  const reviews = rows.slice(0, reviewLimit).map(row => {
    const item = document.createElement('article');
    item.className = 'community-review';
    const author = document.createElement('strong');
    author.textContent = row.nickname + ' · ' + '★'.repeat(row.stars) + '☆'.repeat(5 - row.stars);
    item.append(author);
    if (row.body) {
      const comment = document.createElement('p');
      comment.textContent = row.body;
      item.append(comment);
    }
    return item;
  });
  $('#community-reviews').replaceChildren(...reviews);
  $('#more-reviews').hidden = rows.length <= reviewLimit;
}

async function loadDetails({ fillReview = false } = {}) {
  const gameId = activeGame();
  if (!gameId || !client) return;
  const revision = ++detailRevision;
  try {
    const [images, reviews, summary] = await Promise.all([
      client.from('oc_images').select('path').eq('game_id', gameId)
        .order('created_at', { ascending: false }).order('path').range(0, imageLimit),
      client.from('oc_reviews').select('nickname,stars,body').eq('game_id', gameId)
        .order('created_at', { ascending: false }).order('author_id').range(0, reviewLimit),
      client.rpc('oc_review_summary', { game: gameId }).single()
    ]);
    if (gameId !== activeGame() || revision !== detailRevision) return;
    drawImages(unwrap(images));
    drawReviews(unwrap(reviews), unwrap(summary));
  } catch {
    if (gameId === activeGame() && revision === detailRevision) {
      detailStatus.textContent = '스크린샷과 평가를 불러오지 못했어.';
    }
  }
  if (fillReview && isMember) {
    const userId = session.user.id;
    const result = await client.from('oc_reviews').select('nickname,stars,body')
      .eq('game_id', gameId).eq('author_id', userId).maybeSingle();
    if (!result.error && result.data && gameId === activeGame() && session?.user.id === userId) {
      for (const name of ['nickname', 'stars', 'body']) {
        const field = reviewForm.elements.namedItem(name);
        if (!field.value) field.value = result.data[name];
      }
    }
  }
}

detail.addEventListener('game-opened', () => {
  imageLimit = pageSize;
  reviewLimit = pageSize;
  imageForm.reset();
  reviewForm.reset();
  $('#community-gallery').replaceChildren();
  $('#community-reviews').replaceChildren();
  $('#review-summary').textContent = '';
  $('#more-images').hidden = true;
  $('#more-reviews').hidden = true;
  detailStatus.textContent = client ? '' : '공유 서버 연결 후 스크린샷과 평가를 이용할 수 있어.';
  showParticipation();
  void loadDetails({ fillReview: true });
});

$('#more-images').addEventListener('click', () => {
  imageLimit += pageSize;
  void loadDetails();
});
$('#more-reviews').addEventListener('click', () => {
  reviewLimit += pageSize;
  void loadDetails();
});

async function updateAccount(next) {
  const revision = ++authRevision;
  session = next;
  isMember = false;
  const result = next
    ? await client.from('oc_members').select('user_id').eq('user_id', next.user.id).maybeSingle()
    : null;
  if (revision !== authRevision) return;
  isMember = Boolean(result?.data);
  loginForm.hidden = Boolean(next);
  gameForm.hidden = !isMember;
  $('#sign-out').hidden = !next;
  accountStatus.textContent = isMember ? '게임 정보와 플레이 링크를 입력해 줘.'
    : next ? (result?.error ? '참여 권한을 확인하지 못했어.' : '등록 권한이 없는 계정이야.')
    : '초대받은 친구 계정으로 로그인해 줘.';
  showParticipation();
  void loadDetails({ fillReview: true });
}

submit(loginForm, accountStatus, async () => {
  const result = await client.auth.signInWithPassword({
    email: textField(loginForm, 'email'),
    password: loginForm.elements.namedItem('password').value
  });
  if (result.error) throw new Error('로그인할 수 없어. 이메일과 비밀번호를 확인해 줘.');
  loginForm.reset();
  await updateAccount(result.data.session);
  if (isMember && account.open && account.dataset.returnGame) {
    account.close();
    window.OIBUNG_CATALOG.openDetail(account.dataset.returnGame);
  }
});

$('#sign-out').addEventListener('click', async () => {
  const result = await client.auth.signOut();
  if (result.error) accountStatus.textContent = '로그아웃에 실패했어. 다시 시도해 줘.';
  else await updateAccount(null);
});

submit(gameForm, accountStatus, async () => {
  const link = new URL(textField(gameForm, 'playUrl'));
  if (link.protocol !== 'https:' || link.username || link.password) throw new Error('HTTPS 플레이 링크를 입력해 줘.');
  const game = {
    id: crypto.randomUUID(),
    title: textField(gameForm, 'title'),
    category: textField(gameForm, 'category'),
    genre: textField(gameForm, 'genre'),
    description: textField(gameForm, 'description'),
    play_url: link.href
  };
  unwrap(await client.from('oc_games').insert(game));
  gameForm.reset();
  ++catalogRevision;
  const { play_url, ...fields } = game;
  window.OIBUNG_CATALOG.addSharedGame({ ...fields, playUrl: play_url });
  refreshCatalog();
  accountStatus.textContent = '게임을 등록했어.';
  if (account.open) {
    account.close();
    window.OIBUNG_CATALOG.openDetail(game.id);
  }
});

submit(imageForm, detailStatus, async () => {
  const gameId = activeGame();
  const userId = session.user.id;
  const files = Array.from(imageForm.elements.namedItem('images').files);
  if (!files.length || files.length > 6 || files.some(file => !fileTypes.has(file.type) || file.size > 5242880)) {
    throw new Error('5MB 이하 JPG, PNG, WebP 이미지를 한 번에 최대 6장 골라 줘.');
  }
  let saved = 0;
  const objects = client.storage.from(bucket);
  for (const file of files) {
    const path = userId + '/' + gameId + '/' + crypto.randomUUID() + '.' + fileTypes.get(file.type);
    const upload = await objects.upload(path, file, { contentType: file.type });
    if (upload.error) continue;
    const result = await client.from('oc_images').insert({ game_id: gameId, path });
    if (result.error) {
      await objects.remove([path]);
      continue;
    }
    saved += 1;
  }
  if (gameId !== activeGame()) return;
  imageForm.reset();
  detailStatus.textContent = saved === files.length ? saved + '장을 올렸어.'
    : saved + '장 등록, ' + (files.length - saved) + '장 실패. 실패한 파일을 다시 선택해 줘.';
  await loadDetails();
});

submit(reviewForm, detailStatus, async () => {
  const gameId = activeGame();
  const displayName = textField(reviewForm, 'nickname');
  if (!displayName) throw new Error('닉네임을 입력해 줘.');
  unwrap(await client.rpc('oc_save_review', {
    game: gameId,
    display_name: displayName,
    rating: Number(textField(reviewForm, 'stars')),
    review_text: textField(reviewForm, 'body')
  }));
  if (gameId === activeGame()) {
    detailStatus.textContent = '내 평가를 저장했어.';
    await loadDetails();
  }
});

function refreshCatalog() {
  void loadGames().catch(() => {
    accountStatus.textContent = '공유 게임 목록에 연결하지 못했어. 잠시 후 새로고침해 줘.';
  });
}

async function connect() {
  const config = window.OIBUNG_COMMUNITY;
  if (!config?.url || !config.publishableKey) {
    accountStatus.textContent = '공유 서버 연결 준비 중이야.';
    return;
  }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = createClient(config.url, config.publishableKey);
  const refreshDetails = payload => {
    const game = payload.new?.game_id ?? payload.old?.game_id;
    if (!game || game === activeGame()) void loadDetails();
  };
  client.channel('oibung-community')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_games' }, refreshCatalog)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_images' }, refreshDetails)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_reviews' }, refreshDetails)
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        refreshCatalog();
        void loadDetails();
      }
    });
  client.auth.onAuthStateChange((event, next) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setTimeout(() => void updateAccount(next), 0);
    }
  });
  window.addEventListener('focus', () => {
    refreshCatalog();
    void loadDetails();
  });
  refreshCatalog();
}

void connect().catch(() => {
  accountStatus.textContent = '공유 서버에 연결할 수 없어.';
});
