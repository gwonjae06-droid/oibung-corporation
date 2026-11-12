const $ = selector => document.querySelector(selector);
const detail = $('#game-dialog');
const account = $('#guide-dialog');
const accountStatus = $('#account-status');
const detailStatus = $('#detail-status');
const imageStatus = $('#image-status');
const reviewStatus = $('#review-status');
const editStatus = $('#edit-status');
const editButton = $('#edit-game');
const imagePanel = $('#image-panel');
const reviewPanel = $('#review-panel');
const gameForm = $('#add-game-form');
const thumbnailInput = gameForm.elements.namedItem('thumbnail');
const removeThumbnail = gameForm.elements.namedItem('removeThumbnail');
const thumbnailPreview = $('#thumbnail-preview');
let thumbnailObjectUrl;
const imageForm = $('#image-form');
const reviewForm = $('#review-form');
const bucket = 'oc-screenshots';
const fileTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const pageSize = 12;
let client;
let guestToken;
let detailRevision = 0;
let viewerRevision = 0;
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

function asCatalogGame({ play_url, development_status, thumbnail_path, ...game }) {
  return {
    ...game,
    playUrl: play_url,
    developmentStatus: development_status,
    thumbnailUrl: thumbnail_path ? client.storage.from(bucket).getPublicUrl(thumbnail_path).data.publicUrl : null
  };
}

async function loadGames() {
  const revision = ++catalogRevision;
  const games = [];
  for (let offset = 0; ; offset += 100) {
    const page = unwrap(await client.from('oc_games').select('id,title,description,genre,play_url,developer,development_status,thumbnail_path')
      .order('created_at').order('id').range(offset, offset + 99));
    games.push(...page);
    if (page.length < 100) break;
  }
  if (revision !== catalogRevision) return;
  window.OIBUNG_CATALOG.setSharedGames(games.map(asCatalogGame));
}

function showParticipation() {
  imagePanel.hidden = !client;
  reviewPanel.hidden = !client;
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
  imagePanel.open = false;
  reviewPanel.open = false;
  reviewPanel.querySelector('summary').textContent = '평가 남기기';
  editStatus.textContent = '';
  imageStatus.textContent = '';
  reviewStatus.textContent = '';
  $('#community-gallery').replaceChildren();
  $('#community-reviews').replaceChildren();
  $('#review-summary').textContent = '';
  $('#more-images').hidden = true;
  $('#more-reviews').hidden = true;
  detailStatus.textContent = client ? '' : '공유 서버 연결 후 스크린샷과 평가를 이용할 수 있어.';
  showParticipation();
  void loadDetails();
  void loadViewer();
});

$('#more-images').addEventListener('click', () => {
  imageLimit += pageSize;
  void loadDetails();
});
$('#more-reviews').addEventListener('click', () => {
  reviewLimit += pageSize;
  void loadDetails();
});

function getStoredGuest() {
  if (guestToken) return guestToken;
  try {
    const token = localStorage.getItem('oibung-corporation:guest');
    if (/^[a-f0-9]{64}$/.test(token || '')) guestToken = token;
  } catch {
    return null;
  }
  return guestToken;
}

async function loadViewer() {
  const gameId = activeGame();
  const revision = ++viewerRevision;
  if (!gameId || !client || !getStoredGuest()) return;
  try {
    const viewer = await guestWrite({ action: 'viewer' }, gameId);
    if (revision !== viewerRevision || activeGame() !== gameId) return;
    if (viewer.review) {
      reviewPanel.querySelector('summary').textContent = '내 평가 수정';
      if (!['nickname', 'stars', 'body'].some(name => textField(reviewForm, name))) {
        for (const name of ['nickname', 'stars', 'body']) {
          reviewForm.elements.namedItem(name).value = viewer.review[name];
        }
      }
    }
  } catch {
    if (revision === viewerRevision && activeGame() === gameId) {
      reviewStatus.textContent = '내 평가를 불러오지 못했어.';
    }
  }
}

function showThumbnailPreview(url) {
  thumbnailPreview.hidden = !url;
  if (url) thumbnailPreview.src = url;
  else thumbnailPreview.removeAttribute('src');
}

function releaseThumbnailPreview() {
  if (thumbnailObjectUrl) URL.revokeObjectURL(thumbnailObjectUrl);
  thumbnailObjectUrl = undefined;
}

thumbnailInput.addEventListener('change', () => {
  releaseThumbnailPreview();
  const file = thumbnailInput.files[0];
  if (file) {
    removeThumbnail.checked = false;
    thumbnailObjectUrl = URL.createObjectURL(file);
  }
  const game = window.OIBUNG_CATALOG.getGame(gameForm.dataset.gameId);
  showThumbnailPreview(thumbnailObjectUrl || (removeThumbnail.checked ? null : game?.thumbnailUrl));
});
removeThumbnail.addEventListener('change', () => {
  const game = window.OIBUNG_CATALOG.getGame(gameForm.dataset.gameId);
  if (removeThumbnail.checked) {
    thumbnailInput.value = '';
    releaseThumbnailPreview();
  }
  showThumbnailPreview(removeThumbnail.checked ? null : game?.thumbnailUrl);
});
account.addEventListener('close', releaseThumbnailPreview);

function openEditor(game) {
  if (gameForm.querySelector('[type="submit"]').disabled) return;
  gameForm.reset();
  releaseThumbnailPreview();
  showThumbnailPreview(game?.thumbnailUrl);
  $('#thumbnail-remove').hidden = !game?.thumbnailUrl;
  gameForm.dataset.gameId = game?.id ?? '';
  $('#guide-title').textContent = game ? '게임 정보 수정' : '새 게임 등록하기';
  gameForm.querySelector('[type="submit"]').textContent = game ? '수정 저장' : '게임 등록하고 상세 열기';
  accountStatus.textContent = client ? '' : '공유 서버를 연결하는 중이야.';
  if (game) {
    for (const name of ['title', 'description', 'developer', 'genre', 'playUrl']) {
      gameForm.elements.namedItem(name).value = game[name] ?? '';
    }
    gameForm.elements.namedItem('developmentStatus').value = game.developmentStatus || 'unknown';
  }
  account.showModal();
  document.body.classList.add('no-scroll');
}

document.querySelectorAll('[data-open-editor]').forEach(button => {
  button.addEventListener('click', () => openEditor());
});
function editGame(id) {
  const game = window.OIBUNG_CATALOG.getGame(id);
  if (game) openEditor(game);
}
editButton.addEventListener('click', () => editGame(activeGame()));
$('#game-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-edit-game]');
  if (button) editGame(button.dataset.editGame);
});

async function guestWrite(data, gameId) {
  if (!getStoredGuest()) {
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    try {
      localStorage.setItem('oibung-corporation:guest', generated);
    } catch {
      // The current page can still use the guest token.
    }
    guestToken = generated;
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
  const gameId = gameForm.dataset.gameId;
  const fieldsToSave = {
    action: gameId ? 'edit_game' : 'game',
    title: textField(gameForm, 'title'),
    developer: textField(gameForm, 'developer'),
    development_status: textField(gameForm, 'developmentStatus'),
    remove_thumbnail: removeThumbnail.checked,
    genre: textField(gameForm, 'genre'),
    description: textField(gameForm, 'description'),
    play_url: link?.href ?? null
  };
  const thumbnail = thumbnailInput.files[0];
  let data = fieldsToSave;
  if (thumbnail) {
    if (!fileTypes.has(thumbnail.type) || thumbnail.size === 0 || thumbnail.size > 5242880) {
      throw new Error('썸네일은 5MB 이하 JPG, PNG, WebP를 선택해 줘.');
    }
    data = new FormData();
    data.set('metadata', JSON.stringify(fieldsToSave));
    data.set('thumbnail', thumbnail);
  }
  const { game } = await guestWrite(data, gameId);
  gameForm.reset();
  ++catalogRevision;
  window.OIBUNG_CATALOG.saveSharedGame(asCatalogGame(game));
  refreshCatalog();
  if (account.open) {
    account.close();
    if (activeGame() !== game.id) window.OIBUNG_CATALOG.openDetail(game.id);
    if (gameId) editStatus.textContent = '게임 정보를 수정했어.';
  }
});

submit(imageForm, imageStatus, async () => {
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
  imageStatus.textContent = saved === files.length ? saved + '장을 올렸어.'
    : saved + '장 등록, ' + (files.length - saved) + '장 실패. 실패한 파일을 다시 선택해 줘.';
  await loadDetails();
});

submit(reviewForm, reviewStatus, async () => {
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
    reviewStatus.textContent = '내 평가를 저장했어.';
    reviewPanel.querySelector('summary').textContent = '내 평가 수정';
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
  accountStatus.textContent = '';
  showParticipation();
  void loadDetails();
  void loadViewer();
  window.addEventListener('focus', () => {
    refreshCatalog();
    void loadDetails();
  });
  refreshCatalog();
}

void connect().catch(() => {
  accountStatus.textContent = '공유 서버에 연결할 수 없어.';
});
