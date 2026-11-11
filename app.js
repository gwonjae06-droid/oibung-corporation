(() => {
  'use strict';
  const games = Array.isArray(window.OIBUNG_GAMES) ? window.OIBUNG_GAMES.filter(g => g && g.id && g.title) : [];
  const initialGames = [...games];
  const byId = new Map(games.map(game => [game.id, game]));
  const grid = document.querySelector('#game-grid');
  const searchInput = document.querySelector('#game-search');
  const tabs = [...document.querySelectorAll('[data-filter]')];
  const count = document.querySelector('#games-count');
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
  const visualClass = game => visualOptions.has(game.visual) ? game.visual : 'custom';
  const coverArt = game => `<div class="cover-art cover-${visualClass(game)}" aria-hidden="true"><span class="decor decor-a"></span><span class="decor decor-b"></span><span class="decor decor-c"></span></div>`;
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
  function setFilter(next) {
    activeFilter = next;
    tabs.forEach(tab => {
      const selected = tab.dataset.filter === next;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    render();
  }
  function cardTemplate(game, index) {
    const favorite = favorites.has(game.id);
    const playUrl = safeSourceUrl(game.playUrl);
    const cover = `
      ${coverArt(game)}<span class="game-card-number">${formatCount(index + 1)} / ${formatCount(games.length)}</span>
      ${game.badge || playUrl ? `<span class="game-card-badge">${escapeHTML(game.badge || 'PLAY NOW')}</span>` : ''}
      <div class="cover-content"><div class="cover-english">${escapeHTML(game.english || game.title)}</div><div class="cover-sub">${escapeHTML(game.tagline)}</div></div>`;
    return `<article class="game-card" data-game-id="${escapeHTML(game.id)}">
      ${playUrl
        ? `<a class="game-cover" href="${escapeHTML(playUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(game.title)} 플레이하기">${cover}</a>`
        : `<div class="game-cover">${cover}</div>`}
      <div class="game-card-body"><div class="game-card-title-row"><div><div class="game-genre">${escapeHTML(game.genre)}</div><h3>${escapeHTML(game.title)}</h3></div>
      <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${escapeHTML(game.id)}" aria-label="${escapeHTML(game.title)} ${favorite ? '찜 해제' : '찜하기'}" aria-pressed="${favorite}">${icon('heart')}</button></div>
      <p class="game-card-desc">${escapeHTML(game.description)}</p>
      <div class="game-card-footer"><button class="details-link" type="button" data-details="${escapeHTML(game.id)}">게임 자세히 보기 ↗</button>
      ${playUrl ? `<a class="play-link" href="${escapeHTML(playUrl)}" target="_blank" rel="noopener noreferrer">플레이하기 ${icon('arrow')}</a>` : ''}</div></div></article>`;
  }
  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase('ko-KR');
    const filtered = games.filter(game => {
      const categoryMatch = activeFilter === 'all' || (activeFilter === 'favorite' ? favorites.has(game.id) : game.category === activeFilter);
      const searchMatch = [game.title, game.english, game.genre, game.description, game.tagline, ...(game.tags || [])].join(' ').toLocaleLowerCase('ko-KR').includes(query);
      return categoryMatch && searchMatch;
    });
    grid.innerHTML = filtered.map(game => cardTemplate(game, games.indexOf(game))).join('');
    emptyState.hidden = filtered.length > 0;
    count.textContent = formatCount(games.length);
    allCount.textContent = formatCount(games.length);
  }
  function openDetail(id) {
    const game = byId.get(id);
    if (!game) return;
    const detailCover = document.querySelector('#dialog-cover');
    detailCover.innerHTML = coverArt(game);
    document.querySelector('#detail-genre').textContent = game.genre || 'GAME';
    document.querySelector('#detail-title').textContent = game.title;
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
    detailDialog.dataset.gameId = id;
    detailDialog.showModal();
    detailDialog.dispatchEvent(new Event('game-opened'));
    document.body.classList.add('no-scroll');
  }
  function closeDialog(dialog) { dialog.close(); document.body.classList.remove('no-scroll'); }
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
  function openGuide() {
    guideDialog.showModal();
    document.body.classList.add('no-scroll');
  }
  document.querySelector('#add-guide').addEventListener('click', openGuide);
  window.OIBUNG_CATALOG = {
    openDetail,
    addSharedGame(game) {
      if (!byId.has(game.id)) games.push(game);
      byId.set(game.id, game);
      render();
    },
    setSharedGames(shared) {
      games.splice(0, games.length, ...new Map([...initialGames, ...shared.map(game => ({...initialGames.find(initial => initial.id === game.id), ...game}))].map(game => [game.id, game])).values());
      byId.clear();
      games.forEach(game => byId.set(game.id, game));
      render();
    }
  };
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName) && !detailDialog.open && !guideDialog.open) {
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
