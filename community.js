const $ = selector => document.querySelector(selector);
const detail = $('#game-dialog');
const account = $('#guide-dialog');
const accountStatus = $('#account-status');
const detailStatus = $('#detail-status');
const gameForm = $('#add-game-form');
const imageForm = $('#image-form');
const reviewForm = $('#review-form');
const bucket = 'oc-screenshots';
const fileTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const pageSize = 12;
let client;
let guestToken;
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
  imageForm.hidden = !client;
  reviewForm.hidden = !client;
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

async function loadDetails() {
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
  void loadDetails();
});

$('#more-images').addEventListener('click', () => {
  imageLimit += pageSize;
  void loadDetails();
});
$('#more-reviews').addEventListener('click', () => {
  reviewLimit += pageSize;
  void loadDetails();
});

async function guestWrite(data, gameId) {
  if (!guestToken) {
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    try {
      const previous = localStorage.getItem('oibung-corporation:guest');
      guestToken = /^[a-f0-9]{64}$/.test(previous || '') ? previous : generated;
      localStorage.setItem('oibung-corporation:guest', guestToken);
    } catch {
      guestToken = generated;
    }
  }
  const endpoint = new URL('/functions/v1/oibung-guest', window.OIBUNG_COMMUNITY.url);
  if (gameId) endpoint.searchParams.set('game', gameId);
  const headers = { 'x-oibung-guest': guestToken };
  if (!(data instanceof FormData)) headers['content-type'] = 'application/json';
  const response = await fetch(endpoint, {
    method: 'POST', headers, body: data instanceof FormData ? data : JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '저장에 실패했어.');
  return result;
}

submit(gameForm, accountStatus, async () => {
  const playUrl = textField(gameForm, 'playUrl');
  const link = playUrl ? new URL(playUrl) : null;
  if (link && (link.protocol !== 'https:' || link.username || link.password)) {
    throw new Error('플레이 링크를 넣으려면 HTTPS 주소를 입력해 줘.');
  }
  const fieldsToSave = {
    action: 'game',
    title: textField(gameForm, 'title'),
    category: textField(gameForm, 'category'),
    genre: textField(gameForm, 'genre'),
    description: textField(gameForm, 'description'),
    play_url: link?.href ?? null
  };
  const { game } = await guestWrite(fieldsToSave);
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
  const files = Array.from(imageForm.elements.namedItem('images').files);
  if (!files.length || files.length > 6 || files.some(file => !fileTypes.has(file.type) || file.size > 5242880)) {
    throw new Error('5MB 이하 JPG, PNG, WebP 이미지를 한 번에 최대 6장 골라 줘.');
  }
  let saved = 0;
  for (const file of files) {
    const form = new FormData();
    form.set('image', file);
    try {
      await guestWrite(form, gameId);
    } catch (error) {
      if (files.length === 1) throw error;
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
  await guestWrite({
    action: 'review',
    nickname: displayName,
    stars: Number(textField(reviewForm, 'stars')),
    body: textField(reviewForm, 'body')
  }, gameId);
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
  gameForm.hidden = false;
  accountStatus.textContent = '게임 정보를 입력해 줘.';
  showParticipation();
  void loadDetails();
  window.addEventListener('focus', () => {
    refreshCatalog();
    void loadDetails();
  });
  refreshCatalog();
}

void connect().catch(() => {
  accountStatus.textContent = '공유 서버에 연결할 수 없어.';
});
