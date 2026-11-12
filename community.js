const $ = selector => document.querySelector(selector);
const detail = $('#game-dialog');
const account = $('#guide-dialog');
const accountStatus = $('#account-status');
const detailStatus = $('#detail-status');
const imageStatus = $('#image-status');
const reviewStatus = $('#review-status');
const reviewDialog = $('#review-dialog');
const reviewGameFilter = $('#reviews-game-filter');
const reviewFeed = $('#reviews-feed');
const reviewExisting = $('#review-existing');
const editStatus = $('#edit-status');
const editButton = $('#edit-game');
const imagePanel = $('#image-panel');
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
const pendingImageDeletes = new Set();
let reviewLimit = pageSize;
let reviewsRevision = 0;
let reviewViewerFailed = false;
let reviewViewerLoading = false;

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
  syncReviewGames();
}

function showParticipation() {
  imagePanel.hidden = !client;
}

function drawImages(rows, gameId, imageOwner) {
  const gallery = $('#community-gallery');
  const entries = rows.slice(0, imageLimit).map((row, index) => {
    const link = document.createElement('a');
    link.href = client.storage.from(bucket).getPublicUrl(row.path).data.publicUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const image = document.createElement('img');
    image.src = link.href;
    image.loading = 'lazy';
    image.alt = '게임 스크린샷 ' + (index + 1);
    link.append(image);
    const entry = document.createElement('figure');
    entry.className = 'gallery-screenshot';
    entry.append(link);
    if (imageOwner && row.path.startsWith(imageOwner + '/')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'screenshot-delete';
      button.textContent = '삭제';
      button.dataset.screenshotPath = row.path;
      button.setAttribute('aria-label', image.alt + ' 삭제');
      button.disabled = pendingImageDeletes.has(row.path);
      button.addEventListener('click', () => void deleteScreenshot(gameId, row.path, button));
      entry.append(button);
    }
    return entry;
  });
  gallery.replaceChildren(...entries);
  if (!rows.length) gallery.textContent = '등록된 스크린샷이 없습니다.';
  $('#more-images').hidden = rows.length <= imageLimit;
}

async function deleteScreenshot(gameId, path, button) {
  if (pendingImageDeletes.has(path) || !window.confirm('이 스크린샷을 삭제할까요?')) return;
  pendingImageDeletes.add(path);
  button.disabled = true;
  detailStatus.textContent = '스크린샷을 삭제하는 중…';
  try {
    await guestWrite({ action: 'delete_image', path }, gameId);
    if (activeGame() === gameId) {
      detailStatus.textContent = '스크린샷을 삭제했습니다.';
      await loadDetails();
    }
  } catch (error) {
    if (activeGame() === gameId) {
      detailStatus.textContent = error instanceof Error ? error.message : '스크린샷을 삭제하지 못했습니다.';
    }
  } finally {
    pendingImageDeletes.delete(path);
    button.disabled = false;
    if (activeGame() === gameId) {
      for (const item of $('#community-gallery').querySelectorAll('button[data-screenshot-path]')) {
        if (item.dataset.screenshotPath === path) item.disabled = false;
      }
    }
  }
}

function syncReviewGames() {
  const games = window.OIBUNG_CATALOG.listGames().filter(game => game?.id && game?.title);
  const selectors = [reviewGameFilter, reviewForm.elements.namedItem('gameId')];
  for (const select of selectors) {
    const old = select.value;
    const initial = select.options[0]?.cloneNode(true);
    select.replaceChildren(initial);
    for (const game of games) {
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.title;
      select.append(option);
    }
    if ([...select.options].some(option => option.value === old)) select.value = old;
  }
}

function photoUrl(path) {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function reviewCard(row) {
  const item = document.createElement('article');
  item.className = 'review-post';
  const header = document.createElement('div');
  header.className = 'review-post-top';
  const game = document.createElement('button');
  game.type = 'button';
  game.className = 'review-post-game';
  game.textContent = window.OIBUNG_CATALOG.getGame(row.game_id)?.title || '게임 정보 보기';
  game.addEventListener('click', () => window.OIBUNG_CATALOG.openDetail(row.game_id));
  const date = document.createElement('time');
  date.dateTime = row.created_at;
  date.textContent = new Date(row.created_at).toLocaleDateString('ko-KR');
  header.append(game, date);
  const author = document.createElement('div');
  author.className = 'review-post-author';
  const name = document.createElement('strong');
  name.textContent = row.nickname;
  const stars = document.createElement('span');
  stars.className = 'review-post-stars';
  stars.setAttribute('aria-label', '별점 ' + row.stars + '점');
  stars.textContent = '★'.repeat(row.stars) + '☆'.repeat(5 - row.stars);
  author.append(name, stars);
  item.append(header, author);
  if (row.body) {
    const body = document.createElement('p');
    body.className = 'review-post-body';
    body.textContent = row.body;
    item.append(body);
  }
  if (Array.isArray(row.image_paths) && row.image_paths.length) {
    const photos = document.createElement('div');
    photos.className = 'review-post-photos';
    row.image_paths.forEach((path, i) => {
      const link = document.createElement('a');
      link.href = photoUrl(path);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = link.href;
      image.loading = 'lazy';
      image.alt = '후기 첨부 사진 ' + (i + 1);
      link.append(image);
      photos.append(link);
    });
    item.append(photos);
  }
  return item;
}

async function loadReviewFeed() {
  if (!client) {
    reviewFeed.textContent = '공유 서버에 연결한 후 후기를 볼 수 있어.';
    return;
  }
  const revision = ++reviewsRevision;
  const gameId = reviewGameFilter.value;
  $('#reviews-load-status').textContent = '';
  try {
    let query = client.from('oc_reviews')
      .select('game_id,nickname,stars,body,created_at,image_paths', { count: 'exact' })
      .order('created_at', { ascending: false }).order('game_id')
      .range(0, reviewLimit - 1);
    if (gameId) query = query.eq('game_id', gameId);
    const result = await query;
    const rows = unwrap(result);
    if (revision !== reviewsRevision) return;
    reviewFeed.replaceChildren(...rows.map(reviewCard));
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'review-feed-empty';
      empty.textContent = '아직 후기가 없어. 첫 번째 후기를 남겨 봐!';
      reviewFeed.append(empty);
    }
    const total = result.count || 0;
    $('#reviews-count').textContent = String(total);
    $('#reviews-stats').textContent = gameId
      ? (window.OIBUNG_CATALOG.getGame(gameId)?.title || '선택한 게임') + ' · ' + total + '개 후기'
      : '전체 ' + total + '개 후기';
    $('#reviews-more').hidden = rows.length >= total;
  } catch {
    if (revision === reviewsRevision) {
      reviewFeed.textContent = '후기를 불러오지 못했어.';
      $('#reviews-load-status').textContent = '연결을 확인하고 다시 시도해 줘.';
    }
  }
}

async function loadDetails() {
  const gameId = activeGame();
  if (!gameId || !client) return;
  const revision = ++detailRevision;
  try {
    const imagesQuery = client.from('oc_images').select('path').eq('game_id', gameId)
      .order('created_at', { ascending: false }).order('path').range(0, imageLimit);
    const ownerQuery = getStoredGuest()
      ? guestWrite({ action: 'viewer' }, gameId).catch(() => null)
      : null;
    const [images, viewer] = await Promise.all([imagesQuery, ownerQuery]);
    if (gameId !== activeGame() || revision !== detailRevision) return;
    drawImages(unwrap(images), gameId, viewer?.imageOwner);
  } catch {
    if (gameId === activeGame() && revision === detailRevision) {
      detailStatus.textContent = '스크린샷을 불러오지 못했어.';
    }
  }
}

detail.addEventListener('game-opened', () => {
  imageLimit = pageSize;
  imageForm.reset();
  imagePanel.open = false;
  editStatus.textContent = '';
  imageStatus.textContent = '';
  $('#community-gallery').replaceChildren();
  $('#more-images').hidden = true;
  detailStatus.textContent = client ? '' : '공유 서버 연결 후 스크린샷을 이용할 수 있어.';
  showParticipation();
  void loadDetails();
});

$('#more-images').addEventListener('click', () => {
  imageLimit += pageSize;
  void loadDetails();
});
$('#reviews-more').addEventListener('click', () => {
  reviewLimit += pageSize;
  void loadReviewFeed();
});
reviewGameFilter.addEventListener('change', () => {
  reviewLimit = pageSize;
  void loadReviewFeed();
});
document.addEventListener('oibung-page-changed', event => {
  if (event.detail.page === 'reviews') void loadReviewFeed();
});
document.addEventListener('oibung-review-game', event => {
  syncReviewGames();
  reviewGameFilter.value = event.detail.gameId;
  reviewLimit = pageSize;
  void loadReviewFeed();
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

function displayExistingPhotos(paths) {
  reviewExisting.replaceChildren();
  for (const path of paths) {
    const label = document.createElement('label');
    label.className = 'review-old-photo';
    const image = document.createElement('img');
    image.src = photoUrl(path);
    image.alt = '기존 후기 사진';
    const keep = document.createElement('input');
    keep.type = 'checkbox';
    keep.name = 'keepPhoto';
    keep.value = path;
    keep.checked = true;
    const hint = document.createElement('span');
    hint.textContent = '이 사진 유지';
    label.append(image, keep, hint);
    reviewExisting.append(label);
  }
  reviewExisting.hidden = !paths.length;
}

async function loadViewer() {
  reviewViewerFailed = false;
  reviewViewerLoading = false;
  const gameId = textField(reviewForm, 'gameId');
  const revision = ++viewerRevision;
  displayExistingPhotos([]);
  for (const name of ['nickname', 'stars', 'body']) reviewForm.elements.namedItem(name).value = '';
  reviewForm.elements.namedItem('photos').value = '';
  $('#review-dialog-title').textContent = '게임 후기 남기기';
  reviewStatus.textContent = '';
  if (!gameId || !client || !getStoredGuest()) return;
  reviewViewerLoading = true;
  try {
    const viewer = await guestWrite({ action: 'viewer' }, gameId);
    if (revision !== viewerRevision || !reviewDialog.open || textField(reviewForm, 'gameId') !== gameId) return;
    if (viewer.review) {
      $('#review-dialog-title').textContent = '내 게임 후기 수정';
      if (!['nickname', 'stars', 'body'].some(name => textField(reviewForm, name))) {
        for (const name of ['nickname', 'stars', 'body']) {
          reviewForm.elements.namedItem(name).value = viewer.review[name] ?? '';
        }
      }
      displayExistingPhotos(viewer.review.image_paths || []);
    }
  } catch {
    if (revision === viewerRevision && reviewDialog.open) {
      reviewViewerFailed = true;
      reviewStatus.textContent = '기존 후기를 불러오지 못했어. 다시 열어 줘.';
    }
  } finally {
    if (revision === viewerRevision) reviewViewerLoading = false;
  }
}

function openReviewEditor(gameId = '') {
  if (!client) {
    $('#reviews-load-status').textContent = '공유 서버에 연결한 후 작성할 수 있어.';
    return;
  }
  syncReviewGames();
  reviewForm.reset();
  reviewViewerFailed = false;
  reviewViewerLoading = false;
  reviewStatus.textContent = '';
  displayExistingPhotos([]);
  const gameSelect = reviewForm.elements.namedItem('gameId');
  if ([...gameSelect.options].some(option => option.value === gameId)) gameSelect.value = gameId;
  reviewDialog.showModal();
  document.body.classList.add('no-scroll');
  if (gameSelect.value) void loadViewer();
}
$('#write-review').addEventListener('click', () => openReviewEditor(reviewGameFilter.value));
reviewForm.elements.namedItem('gameId').addEventListener('change', () => { void loadViewer(); });
$('#close-review').addEventListener('click', () => reviewDialog.close());
reviewDialog.addEventListener('click', event => {
  if (event.target === reviewDialog) reviewDialog.close();
});
reviewDialog.addEventListener('close', () => {
  ++viewerRevision;
  document.body.classList.toggle('no-scroll', detail.open || account.open);
});

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
  if (reviewViewerLoading) throw new Error('기존 후기를 확인하는 중이야. 확인 후 저장해 줘.');
  if (reviewViewerFailed) throw new Error('기존 후기를 불러오지 못했어. 후기를 다시 열어 줘.');
  const gameId = textField(reviewForm, 'gameId');
  const nickname = textField(reviewForm, 'nickname');
  const photos = [...reviewForm.elements.namedItem('photos').files];
  const keepPaths = [...reviewExisting.querySelectorAll('input[name="keepPhoto"]:checked')].map(input => input.value);
  if (!gameId || !nickname) throw new Error('게임과 닉네임을 입력해 줘.');
  if (photos.length + keepPaths.length > 3 || photos.some(file =>
    !fileTypes.has(file.type) || !file.size || file.size > 5242880)) {
    throw new Error('후기 사진은 최대 3장, 한 장당 5MB 이하 JPG·PNG·WebP만 가능해.');
  }
  const fields = {
    action: 'review',
    nickname,
    stars: Number(textField(reviewForm, 'stars')),
    body: textField(reviewForm, 'body'),
    keep_paths: keepPaths
  };
  let data = fields;
  if (photos.length) {
    data = new FormData();
    data.set('metadata', JSON.stringify(fields));
    photos.forEach(file => data.append('photos', file));
  }
  await guestWrite(data, gameId);
  reviewDialog.close();
  reviewGameFilter.value = gameId;
  reviewLimit = pageSize;
  await loadReviewFeed();
  $('#reviews-load-status').textContent = '후기를 저장했어.';
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_reviews' }, () => {
      if (window.OIBUNG_CURRENT_VIEW === 'reviews') void loadReviewFeed();
    })
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
  syncReviewGames();
  if (window.OIBUNG_CURRENT_VIEW === 'reviews') void loadReviewFeed();
  window.addEventListener('focus', () => {
    refreshCatalog();
    void loadDetails();
    if (window.OIBUNG_CURRENT_VIEW === 'reviews') void loadReviewFeed();
  });
  refreshCatalog();
}

void connect().catch(() => {
  accountStatus.textContent = '공유 서버에 연결할 수 없어.';
});
