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
  const sortSelect = document.querySelector('#game-sort');
  const featuredSection = document.querySelector('#featured-exhibit');
  const featuredIntervalMs = 6500;
  let featuredOrder = [];
  let featuredCurrentId = null;
  let featuredRenderedId = null;
  let featuredPaused = false;
  let featuredElapsed = 0;
  let featuredLastTick = performance.now();
  let featuredKeyboardFocus = false;
  const featuredToggle = document.querySelector('#featured-toggle');
  const featuredProgressBar = document.querySelector('#featured-progress-bar');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener('keydown', event => {
    if (['Tab','ArrowLeft','ArrowRight'].includes(event.key)) featuredKeyboardFocus = true;
  });
  document.addEventListener('pointerdown', () => { featuredKeyboardFocus = false; });
  const stats = new Map();
  const recentKey = 'oibung-gallery:recent-v1';
  const readRecent = () => { try { const a = JSON.parse(localStorage.getItem(recentKey) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
  let recent = readRecent();
  let pendingLinkedGame = new URLSearchParams(location.search).get('game');
  let detailHistoryPushed = false;
  let suppressNextDetailCloseNavigation = false;
  let detailReturnFocus = null;
  const galleryTitle = document.title;
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
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.delete('game');
      nextUrl.hash = current;
      history.replaceState(null, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
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
    suppressNextDetailCloseNavigation = true;
    detailHistoryPushed = false;
    detailDialog.close();
    showPage('reviews', true);
    document.dispatchEvent(new CustomEvent('oibung-review-game', { detail: { gameId: id } }));
  });
  showPage(location.hash === '#reviews' ? 'reviews' : 'games');

  function reviewStat(id) { return stats.get(id) || { count: 0, average: 0 }; }
  function reviewBadge(id) {
    const data = reviewStat(id);
    return data.count ? `<span class="review-mini" aria-label="평점 ${data.average.toFixed(1)}점, 후기 ${data.count}개">★ ${data.average.toFixed(1)} <small>· 후기 ${data.count}</small></span>`
      : '<span class="review-mini review-mini--empty">첫 후기를 기다립니다</span>';
  }
  function markRecent(id) {
    recent = [id, ...recent.filter(x => x !== id)].slice(0, 16);
    try { localStorage.setItem(recentKey, JSON.stringify(recent)); } catch { /* private mode */ }
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
  function cardTemplate(game, displayIndex) {
    const favorite = favorites.has(game.id);
    const playUrl = safeSourceUrl(game.playUrl);
    const cover = coverArt(game);
    return `<article class="game-card" data-game-id="${escapeHTML(game.id)}" tabindex="0" aria-label="${escapeHTML(game.title)} 작품 상세 페이지 열기">
      <div class="walk-room" aria-hidden="true">
        <span class="walk-back-wall"></span><span class="walk-side-left"></span><span class="walk-side-right"></span>
        <span class="walk-ceiling"></span><span class="walk-floor"></span><span class="walk-spotlight"></span>
      </div>
      <button type="button" class="game-cover" data-details="${escapeHTML(game.id)}" aria-label="${escapeHTML(game.title)} 상세 보기"><span class="artwork-image-window">${cover}</span></button>
      <div class="game-card-body" data-intro-tone="${escapeHTML(game.introTone ?? 'gallery')}"><div class="game-card-title-row"><div class="artwork-identity">
        <div class="artwork-caption"><span class="artwork-sequence">전시 ${String(displayIndex).padStart(2,'0')}</span><span class="game-genre">${escapeHTML(game.genre)}</span></div>
        <h3>${escapeHTML(game.title)}</h3></div>
      <div class="game-card-actions">
      <button class="icon-button edit-button" type="button" data-edit-game="${escapeHTML(game.id)}" title="게임 정보 수정" aria-label="${escapeHTML(game.title)} 정보 수정">${icon('pencil')}</button>
      <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${escapeHTML(game.id)}" aria-label="${escapeHTML(game.title)} ${favorite ? '찜 해제' : '찜하기'}" aria-pressed="${favorite}">${icon('heart')}</button></div></div>
      <div class="game-meta">${metadata(game)}</div>
      <p class="game-card-desc">${escapeHTML(game.description)}</p>
      <div class="game-card-score">${reviewBadge(game.id)}</div>
      <div class="game-card-footer"><button class="details-link" type="button" data-details="${escapeHTML(game.id)}">작품 보기</button>
      ${playUrl ? `<a class="play-link" href="${escapeHTML(playUrl)}" target="_blank" rel="noopener noreferrer">플레이하기 ${icon('arrow')}</a>` : ''}</div></div></article>`;
  }
  function render() {
    const query = searchInput.value.trim().toLocaleLowerCase('ko-KR');
    const filtered = games.filter(game => {
      const categoryMatch = activeFilter === 'all' || (activeFilter === 'favorite' ? favorites.has(game.id) : activeFilter === 'recent' ? recent.includes(game.id) : normalizedStatus(game) === activeFilter);
      const searchMatch = [game.title, game.english, game.genre, game.developer, game.description, game.tagline, ...(game.tags || [])].join(' ').toLocaleLowerCase('ko-KR').includes(query);
      return categoryMatch && searchMatch;
    });
    const mode = sortSelect.value;
    const defaultOrder = new Map(games.map((game, index) => [game.id, index]));
    filtered.sort((a, b) => {
      const metricA = reviewStat(a.id), metricB = reviewStat(b.id);
      if (mode === 'rating') return ((metricB.count ? metricB.average : -1) - (metricA.count ? metricA.average : -1)) || (metricB.count - metricA.count);
      if (mode === 'reviews') return metricB.count - metricA.count || metricB.average - metricA.average;
      if (mode === 'name') return a.title.localeCompare(b.title, 'ko');
      if (mode === 'newest') return (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0);
      if (activeFilter === 'recent') return recent.indexOf(a.id) - recent.indexOf(b.id);
      return defaultOrder.get(a.id) - defaultOrder.get(b.id);
    });
    grid.innerHTML = filtered.map((game, index) => cardTemplate(game, index + 1)).join('');
    document.querySelector('#catalog-count').textContent = `전시 작품 ${filtered.length}점 · 전체 ${games.length}점`;
    renderFeatured();
    emptyState.hidden = filtered.length > 0;
    allCount.textContent = formatCount(games.length);
  }
  function renderFeatured() {
    // The horizontal museum is the primary exhibit; avoid a second auto-rotating hero.
    if (document.getElementById('walk-gallery')) {
      featuredSection.hidden = true;
      return;
    }
    const ranked = [...games].sort((a, b) => {
      const ar = reviewStat(a.id), br = reviewStat(b.id);
      const av = ar.count >= 2 ? ar.average * 2 + Math.log2(ar.count + 1) : 0;
      const bv = br.count >= 2 ? br.average * 2 + Math.log2(br.count + 1) : 0;
      return bv - av || Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });
    featuredOrder = ranked.map(game => game.id);
    if (!ranked.length) {
      featuredSection.hidden = true;
      featuredCurrentId = null;
      featuredRenderedId = null;
      featuredElapsed = 0;
      updateFeaturedControls();
      return;
    }
    const choice = ranked.find(game => game.id === featuredCurrentId) || ranked[0];
    featuredCurrentId = choice.id;
    const changed = featuredRenderedId !== null && featuredRenderedId !== choice.id;
    featuredRenderedId = choice.id;
    if (changed) featuredElapsed = 0;
    featuredSection.hidden = false;
    document.querySelector('#featured-cover').innerHTML = coverArt(choice);
    document.querySelector('#featured-title').textContent = choice.title;
    document.querySelector('#featured-description').textContent = (choice.description || '').slice(0, 170);
    document.querySelector('#featured-meta').innerHTML = metadata(choice) + reviewBadge(choice.id);
    document.querySelector('#featured-detail').dataset.details = choice.id;

    const multiple = featuredOrder.length > 1;
    document.querySelector('.featured-navigation').hidden = !multiple;
    document.querySelector('#featured-prev').disabled = !multiple;
    document.querySelector('#featured-next').disabled = !multiple;
    const index = featuredOrder.indexOf(choice.id) + 1;
    document.querySelector('#featured-position').textContent =
      String(index).padStart(2, '0') + ' / ' + String(featuredOrder.length).padStart(2, '0');
    updateFeaturedControls();

    if (changed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      featuredSection.classList.remove('featured-animate');
      void featuredSection.offsetWidth; // Restart the subtle entrance animation only when the artwork changes.
      featuredSection.classList.add('featured-animate');
    }
  }
  function updateFeaturedControls() {
    const canRotate = featuredOrder.length > 1;
    featuredToggle.hidden = !canRotate;
    const userReduced = document.documentElement.classList.contains('motion-off');
    featuredToggle.disabled = !canRotate || reducedMotion.matches || userReduced;
    const paused = featuredPaused || reducedMotion.matches || userReduced;
    featuredToggle.setAttribute('aria-pressed', String(featuredPaused));
    const label = reducedMotion.matches ? '자동 전환 사용 안 함 (동작 감소 설정)' :
      userReduced ? '자동 전환 사용 안 함 (움직임 줄이기)' :
      featuredPaused ? '자동 전환 재생' : '자동 전환 일시정지';
    featuredToggle.setAttribute('aria-label', label);
    featuredToggle.title = label;
    featuredToggle.querySelector('span').textContent = paused ? '▶' : 'Ⅱ';
    featuredProgressBar.style.transform =
      'scaleX(' + (canRotate ? Math.min(1, featuredElapsed / featuredIntervalMs) : 0) + ')';
    document.querySelector('#featured-progress').hidden = !canRotate;
    featuredSection.classList.toggle('is-paused', paused);
  }
  function moveFeatured(direction) {
    if (featuredOrder.length < 2) return;
    const index = featuredOrder.indexOf(featuredCurrentId);
    featuredCurrentId = featuredOrder[(index + direction + featuredOrder.length) % featuredOrder.length];
    featuredElapsed = 0;
    featuredLastTick = performance.now();
    renderFeatured();
  }
  document.querySelector('#featured-detail').addEventListener('click', event => openDetail(event.currentTarget.dataset.details));
  for (const [id, direction] of [['#featured-prev', -1], ['#featured-next', 1]]) {
    document.querySelector(id).addEventListener('click', () => moveFeatured(direction));
  }
  featuredToggle.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    featuredPaused = !featuredPaused;
    featuredLastTick = performance.now();
    updateFeaturedControls();
  });
  reducedMotion.addEventListener('change', () => {
    featuredLastTick = performance.now();
    updateFeaturedControls();
  });
  window.addEventListener('oibung-motion-preference', () => {
    featuredLastTick = performance.now();
    updateFeaturedControls();
  });
  // Maintain real elapsed viewing time, without skipping artworks when tabs/windows are hidden.
  // Hover and keyboard focus pause timing without resetting the visitor's progress.
  window.setInterval(() => {
    const now = performance.now();
    const delta = Math.max(0, Math.min(250, now - featuredLastTick));
    featuredLastTick = now;
    const blocked = featuredOrder.length < 2 || featuredSection.hidden ||
      window.OIBUNG_CURRENT_VIEW !== 'games' || document.hidden ||
      detailDialog.open || guideDialog.open ||
      document.querySelector('#review-dialog')?.open ||
      document.querySelector('#update-dialog')?.open ||
      document.querySelector('#report-dialog')?.open ||
      document.querySelector('#media-lightbox')?.open ||
      (window.matchMedia('(hover: hover)').matches && featuredSection.matches(':hover')) ||
      (featuredKeyboardFocus && featuredSection.matches(':focus-within')) ||
      featuredPaused || reducedMotion.matches ||
      document.documentElement.classList.contains('motion-off');
    if (blocked) return;
    featuredElapsed += delta;
    if (featuredElapsed >= featuredIntervalMs) moveFeatured(1);
    else featuredProgressBar.style.transform = 'scaleX(' + (featuredElapsed / featuredIntervalMs) + ')';
  }, 100);

  function renderDetail(game) {
    detailDialog.querySelector('.detail-introduction').dataset.introTone = game.introTone ?? 'gallery';
    document.querySelector('#detail-room-label').textContent = '작품 전시';
    document.title = game.title + ' | ' + galleryTitle;
    const detailCover = document.querySelector('#dialog-cover');
    detailCover.innerHTML = coverArt(game);
    document.querySelector('#detail-genre').textContent = game.genre || 'GAME';
    document.querySelector('#detail-title').textContent = game.title;
    document.querySelector('#detail-meta').innerHTML = metadata(game);
    document.querySelector('#detail-rating').innerHTML = reviewBadge(game.id);
    const platforms = { web: '웹', pc: 'PC', android: 'Android', mod: '게임 모드', other: '기타' };
    const playModes = { single: '싱글 플레이', multi: '멀티 플레이', both: '싱글·멀티' };
    const extra = [platforms[game.platform], playModes[game.playMode]].filter(Boolean);
    document.querySelector('#detail-specs').innerHTML = extra.map(text => '<span>' + escapeHTML(text) + '</span>').join('');
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
    // The share button remains useful even for APK/mod entries with no web play link.
    play.parentElement.hidden = false;
  }
  function openDetail(id, options = {}) {
    const game = byId.get(id);
    if (!game) return;
    if (!detailDialog.open) detailReturnFocus = document.activeElement;
    if (!options.fromHistory && new URLSearchParams(location.search).get('game') !== id) {
      const url = new URL(location.href);
      url.searchParams.set('game', id);
      history.pushState({ oibungGame: id }, '', url.pathname + url.search + url.hash);
      detailHistoryPushed = true;
    }
    detailDialog.dataset.gameId = id;
    renderDetail(game);
    if (!detailDialog.open) detailDialog.showModal();
    markRecent(id);
    if (pendingLinkedGame === id) pendingLinkedGame = null;
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
    if (detailButton) { openDetail(detailButton.dataset.details); return; }
    const card = event.target.closest('.game-card');
    if (card && !event.target.closest('button,a,input,select,textarea,label,summary')) {
      openDetail(card.dataset.gameId);
    }
  });
  grid.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') &&
        event.target.classList.contains('game-card')) {
      event.preventDefault();
      openDetail(event.target.dataset.gameId);
    }
  });
  tabs.forEach(tab => tab.addEventListener('click', () => setFilter(tab.dataset.filter)));
  sortSelect.addEventListener('change', render);
  document.querySelector('#detail-share').addEventListener('click', async () => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('game', detailDialog.dataset.gameId);
    const link = url.href;
    try { await navigator.clipboard.writeText(link); showToast('작품 링크를 복사했어요.'); }
    catch { window.prompt('공유할 작품 링크', link); }
  });
  searchInput.addEventListener('input', render);
  document.querySelector('#reset-filters').addEventListener('click', () => {searchInput.value = '';setFilter('all');});
  document.querySelector('#close-detail').addEventListener('click', () => closeDialog(detailDialog));
  document.querySelector('#close-guide').addEventListener('click', () => closeDialog(guideDialog));
  for (const dialog of [detailDialog,guideDialog]) {
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
    dialog.addEventListener('close', () => {
      document.body.classList.toggle('no-scroll', detailDialog.open || guideDialog.open);
      if (dialog !== detailDialog) return;
      document.title = galleryTitle;
      if (!suppressNextDetailCloseNavigation) {
        const url = new URL(location.href);
        if (url.searchParams.get('game') === detailDialog.dataset.gameId) {
          if (detailHistoryPushed) {
            detailHistoryPushed = false;
            history.back();
          } else {
            url.searchParams.delete('game');
            history.replaceState(null, '', url.pathname + url.search + url.hash);
          }
        }
      }
      suppressNextDetailCloseNavigation = false;
      if (detailReturnFocus && detailReturnFocus.isConnected) {
        detailReturnFocus.focus({ preventScroll: true });
      }
      detailReturnFocus = null;
    });
  }
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('game');
    detailHistoryPushed = false;
    if (id && byId.has(id)) {
      openDetail(id, { fromHistory: true });
    } else if (detailDialog.open) {
      suppressNextDetailCloseNavigation = true;
      detailDialog.close();
    }
  });
  function syncOpenDetail() {
    if (!detailDialog.open) return;
    const game = byId.get(detailDialog.dataset.gameId);
    if (game) renderDetail(game);
  }
  window.OIBUNG_CATALOG = {
    openDetail,
    getGame: id => byId.get(id),
    setReviewStats(rows) {
      stats.clear();
      (rows || []).forEach(row => { if (row.id && Number.isFinite(Number(row.average))) stats.set(row.id, {count: Number(row.count)||0, average: Number(row.average)||0}); });
      render();
      syncOpenDetail();
    },
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
      if (pendingLinkedGame && byId.has(pendingLinkedGame) && !detailDialog.open) openDetail(pendingLinkedGame, { fromHistory: true });
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
  if (pendingLinkedGame && byId.has(pendingLinkedGame)) openDetail(pendingLinkedGame, { fromHistory: true });
})();
