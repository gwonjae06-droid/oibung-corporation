(() => {
  'use strict';
  const games = Array.isArray(window.OIBUNG_GAMES) ? window.OIBUNG_GAMES.filter(g => g && g.id && g.title) : [];
  const initialGames = [...games];
  const byId = new Map(games.map(game => [game.id, game]));
  const grid = document.querySelector('#game-grid');
  const searchInput = document.querySelector('#game-search');
  const tabs = [...document.querySelectorAll('[data-filter]')];
  const pageTabs = [...document.querySelectorAll('[data-page-tab]')];
  const allCount = document.querySelector('#filter-all-count');
  const emptyState = document.querySelector('#empty-state');
  const detailDialog = document.querySelector('#game-dialog');
  const guideDialog = document.querySelector('#guide-dialog');
  let activeFilter = 'all';
  let toastTimer;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"></use></svg>`;
  const formatCount = value => String(value).padStart(2, '0');
  const visualOptions = new Set(['eclipse','arena','duel','tactics','custom']);
  const statusLabels = { unknown: '미정', in_development: '개발 중', released: '정식 출시', live_service: '라이브 서비스', finished: '완결' };
  const normalizedStatus = game => Object.prototype.hasOwnProperty.call(statusLabels, game.developmentStatus)
    ? game.developmentStatus : 'unknown';
  const metadata = game => [
    game.developer && `<span>개발자 · ${escapeHTML(game.developer)}</span>`,
    `<span class="game-status${normalizedStatus(game) === 'live_service' ? ' game-status--live' : normalizedStatus(game) === 'finished' ? ' game-status--finished' : ''}">${statusLabels[normalizedStatus(game)]}</span>`
  ].filter(Boolean).join('');
  const visualClass = game => visualOptions.has(game.visual) ? game.visual : 'custom';
  const coverArt = game => safeSourceUrl(game.thumbnailUrl)
    ? `<img class="game-thumbnail" src="${escapeHTML(game.thumbnailUrl)}" alt="" loading="lazy">`
    : `<div class="cover-art cover-${visualClass(game)}" aria-hidden="true"><span class="decor decor-a"></span><span class="decor decor-b"></span><span class="decor decor-c"></span></div>`;
  const safeSourceUrl = url => /^https:\/\//.test(url || '') ? url : '';
  const favoriteKey = 'oibung-corporation:favorites';
  const getFavorites = () => {
    try { const parsed = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); return new Set(Array.isArray(parsed) ? parsed : []); }
    catch { return new Set(); }
  };
  let favorites = getFavorites();
  const saveFavorites = () => {
    try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); }
    catch { showToast('이 브라우저에서는 찜 목록을 저장할 수 없어요.'); }
  };
  function showToast(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2500);
  }
  function showPage(page, navigate = false) {
    const current = page === 'reviews' ? 'reviews' : 'games';
    pageTabs.forEach(tab => {
      const selected = tab.dataset.pageTab === current;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelector('#games').hidden = current !== 'games';
    document.querySelector('#reviews').hidden = current !== 'reviews';
    window.OIBUNG_CURRENT_VIEW = current;
    if (navigate) {
      history.replaceState(null, '', '#' + current);
      document.querySelector('.page-switcher').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.dispatchEvent(new CustomEvent('oibung-page-changed', { detail: { page: current } }));
  }
  pageTabs.forEach(tab => {
    tab.addEventListener('click', () => showPage(tab.dataset.pageTab, true));
    tab.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const index = pageTabs.indexOf(tab);
      const next = pageTabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + pageTabs.length) % pageTabs.length];
      next.focus();
      showPage(next.dataset.pageTab, true);
    });
  });
  document.querySelectorAll('a[href="#games"], a[href="#reviews"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      showPage(link.getAttribute('href').slice(1), true);
      document.querySelector('#mobile-nav').hidden = true;
      document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
    });
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#games' || location.hash === '#reviews') showPage(location.hash.slice(1));
  });
  document.querySelector('#detail-open-reviews').addEventListener('click', () => {
    const id = detailDialog.dataset.gameId;
    detailDialog.close();
    showPage('reviews', true);
    document.dispatchEvent(new CustomEvent('oibung-review-game', { detail: { gameId: id } }));
  });
  showPage(location.hash === '#reviews' ? 'reviews' : 'games');

  function setFilter(next) {
    activeFilter = next;
    tabs.forEach(tab => {
      const selected = tab.dataset.filter === next;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    render();
  }
  function cardTemplate(game) {
    const favorite = favorites.has(game.id);
    const playUrl = safeSourceUrl(game.playUrl);
    const cover = coverArt(game);
    return `<article class="game-card" data-game-id="${escapeHTML(game.id)}">
      ${playUrl
        ? `<a class="game-cover" href="${escapeHTML(playUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(game.title)} 플레이하기">${cover}</a>`
        : `<div class="game-cover">${cover}</div>`}
      <div class="game-card-body"><div class="game-card-title-row"><div><div class="game-genre">${escapeHTML(game.genre)}</div><h3>${escapeHTML(game.title)}</h3></div>
      <div class="game-card-actions">
      <button class="icon-button edit-button" type="button" data-edit-game="${escapeHTML(game.id)}" title="게임 정보 수정" aria-label="${escapeHTML(game.title)} 정보 수정">${icon('pencil')}</button>
      <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${escapeHTML(game.id)}" aria-label="${escapeHTML(game.title)} ${favorite ? '찜 해제' : '찜하기'}" aria-pressed="${favorite}">${icon('heart')}</button></div></div>
      <div class="game-meta">${metadata(game)}</div>
      <p class="game-card-desc">${escapeHTML(game.description)}</p>
      <div class="game-card-footer"><button class="details-link" type="button" data-details="${escapeHTML(game.id)}">게임 자세히 보기 ↗</button>
      ${playUrl ? `<a class="play-link" href="${escapeHTML(playUrl)}" target="_blank" rel="noopener noreferrer">플레이하기 ${icon('arrow')}</a>` : ''}</div></div></article>`;
  }
  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase('ko-KR');
    const filtered = games.filter(game => {
      const categoryMatch = activeFilter === 'all' || (activeFilter === 'favorite' ? favorites.has(game.id) : normalizedStatus(game) === activeFilter);
      const searchMatch = [game.title, game.english, game.genre, game.developer, game.description, game.tagline, ...(game.tags || [])].join(' ').toLocaleLowerCase('ko-KR').includes(query);
      return categoryMatch && searchMatch;
    });
    grid.innerHTML = filtered.map(cardTemplate).join('');
    emptyState.hidden = filtered.length > 0;
    allCount.textContent = formatCount(games.length);
  }
  function renderDetail(game) {
    const detailCover = document.querySelector('#dialog-cover');
    detailCover.innerHTML = coverArt(game);
    document.querySelector('#detail-genre').textContent = game.genre || 'GAME';
    document.querySelector('#detail-title').textContent = game.title;
    document.querySelector('#detail-meta').innerHTML = metadata(game);
    document.querySelector('#detail-summary').textContent = game.description;
    document.querySelector('#detail-tags').innerHTML = (game.tags || []).map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
    const play = document.querySelector('#detail-play');
    const playUrl = safeSourceUrl(game.playUrl);
    play.hidden = !playUrl;
    if (playUrl) play.href = playUrl;
    else play.removeAttribute('href');
    const source = document.querySelector('#detail-source');
    source.hidden = !safeSourceUrl(game.sourceUrl);
    if (!source.hidden) source.href = game.sourceUrl;
    play.parentElement.hidden = play.hidden && source.hidden;
  }
  function openDetail(id) {
    const game = byId.get(id);
    if (!game) return;
    renderDetail(game);
    detailDialog.dataset.gameId = id;
    detailDialog.showModal();
    detailDialog.scrollTop = 0;
    detailDialog.dispatchEvent(new Event('game-opened'));
    document.body.classList.add('no-scroll');
  }
  function closeDialog(dialog) { dialog.close(); }
  grid.addEventListener('click', event => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const id = favoriteButton.dataset.favorite;
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      saveFavorites();
      render();
      showToast(favorites.has(id) ? '찜 목록에 추가했어 ♥' : '찜 목록에서 제거했어');
      return;
    }
    const detailButton = event.target.closest('[data-details]');
    if (detailButton) openDetail(detailButton.dataset.details);
  });
  tabs.forEach(tab => tab.addEventListener('click', () => setFilter(tab.dataset.filter)));
  searchInput.addEventListener('input', render);
  document.querySelector('#reset-filters').addEventListener('click', () => {searchInput.value = '';setFilter('all');});
  document.querySelector('#close-detail').addEventListener('click', () => closeDialog(detailDialog));
  document.querySelector('#close-guide').addEventListener('click', () => closeDialog(guideDialog));
  for (const dialog of [detailDialog,guideDialog]) {
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('no-scroll', detailDialog.open || guideDialog.open);
    });
  }
  function syncOpenDetail() {
    if (!detailDialog.open) return;
    const game = byId.get(detailDialog.dataset.gameId);
    if (game) renderDetail(game);
  }
  window.OIBUNG_CATALOG = {
    openDetail,
    getGame: id => byId.get(id),
    listGames: () => [...games],
    saveSharedGame(game) {
      const index = games.findIndex(current => current.id === game.id);
      const merged = { ...byId.get(game.id), ...game };
      if (index === -1) games.push(merged);
      else games[index] = merged;
      byId.set(game.id, merged);
      render();
      syncOpenDetail();
    },
    setSharedGames(shared) {
      const next = new Map(initialGames.map(game => [game.id, game]));
      shared.forEach(game => next.set(game.id, { ...next.get(game.id), ...game }));
      games.splice(0, games.length, ...next.values());
      byId.clear();
      next.forEach((game, id) => byId.set(id, game));
      render();
      syncOpenDetail();
    }
  };
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName) && !detailDialog.open && !guideDialog.open && window.OIBUNG_CURRENT_VIEW === 'games') {
      event.preventDefault();searchInput.focus();document.querySelector('#games').scrollIntoView({behavior:'smooth'});
    }
  });
  const menuToggle = document.querySelector('#menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  menuToggle.addEventListener('click', () => {
    mobileNav.hidden = !mobileNav.hidden;
    menuToggle.setAttribute('aria-expanded', String(!mobileNav.hidden));
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {mobileNav.hidden = true;menuToggle.setAttribute('aria-expanded', 'false');}));
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  render();
})();
