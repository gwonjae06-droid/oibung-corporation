/*
 * Oibung Gallery — on-page exhibition guide.
 * Rule-based; information comes from the real registered catalog.
 * No AI subscription, tracking, microphone, or external requests.
 */
(() => {
  'use strict';
  const root = document.getElementById('gallery-guide');
  const avatar = document.getElementById('gallery-guide-avatar');
  const panel = document.getElementById('gallery-guide-panel');
  const closeButton = document.getElementById('gallery-guide-close');
  const message = document.getElementById('gallery-guide-message');
  const hideButton = document.getElementById('gallery-guide-hide');
  const menuToggle = document.getElementById('menu-toggle-guide');
  const guidePortrait = avatar?.querySelector('img');
  if (!root || !avatar || !panel || !closeButton || !message || !hideButton || !menuToggle) return;

  const preferenceKey = 'oibung-gallery:guide-visible';
  const poses = ['calm', 'present', 'welcome'];
  // Small vector poses are cached up front so swapping doesn't flash white.
  if (typeof Image !== 'undefined') {
    poses.forEach(pose => {
      const preview = new Image();
      preview.src = 'assets/guide-egypt-' + pose + '.svg?v=1';
    });
  }
  let currentPose = 'calm';
  let poseTimer = 0;
  function showPose(index, animate = true) {
    const pose = poses[Math.abs(index || 0) % poses.length];
    if (pose === currentPose) return;
    clearTimeout(poseTimer);
    const install = () => {
      currentPose = pose;
      root.dataset.guidePose = pose;
      if (guidePortrait) guidePortrait.src = 'assets/guide-egypt-' + pose + '.svg?v=1';
      requestAnimationFrame(() => root.classList.remove('is-scene-changing'));
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('motion-off');
    if (!animate || reduced || root.hidden) {
      root.classList.remove('is-scene-changing');
      install();
      return;
    }
    setPanelOpen(false);
    root.classList.add('is-scene-changing');
    poseTimer = window.setTimeout(install, 330);
  }
  document.addEventListener('oibung-exhibit-change', event => {
    showPose(event.detail?.index ?? 0, true);
  });
  const fallback = '전시관에 오신 것을 환영해요. 작품을 누르면 상세 전시가 열리고, 화면을 좌우로 움직이면 다른 작품을 볼 수 있어요.';

  function currentGame() {
    const active = document.querySelector('#game-grid .game-card.walk-room-current');
    if (!active) return null;
    return (window.OIBUNG_CATALOG?.listGames?.() || [])
      .find(game => game.id === active.dataset.gameId) || null;
  }

  function say(value) {
    message.textContent = value;
  }

  function setPanelOpen(open, returnFocus = false) {
    panel.hidden = !open;
    avatar.setAttribute('aria-expanded', String(open));
    if (open) {
      const game = currentGame();
      say(game ? '지금은 ' + game.title + ' 전시를 보고 계세요. 무엇을 도와드릴까요?' : fallback);
      closeButton.focus({ preventScroll: true });
    } else if (returnFocus && !root.hidden) {
      avatar.focus({ preventScroll: true });
    }
  }

  function setVisible(visible) {
    root.hidden = !visible;
    menuToggle.setAttribute('aria-pressed', String(visible));
    menuToggle.textContent = visible ? '가이드 숨기기' : '가이드 보이기';
    if (!visible) setPanelOpen(false);
    try { localStorage.setItem(preferenceKey, visible ? 'on' : 'off'); }
    catch { /* No persistent preference in private mode. */ }
  }

  let shown = true;
  try { shown = localStorage.getItem(preferenceKey) !== 'off'; }
  catch { /* Default visible. */ }
  setVisible(shown);
  // The camera may have initialized before the deferred guide script ran.
  const first = document.querySelector('#game-grid .game-card.walk-room-current');
  const orderedCards = [...document.querySelectorAll('#game-grid .game-card')];
  if (first) showPose(orderedCards.indexOf(first), false);

  avatar.addEventListener('click', () => setPanelOpen(panel.hidden));
  closeButton.addEventListener('click', () => setPanelOpen(false, true));
  hideButton.addEventListener('click', () => {
    setVisible(false);
    document.getElementById('menu-toggle')?.focus({ preventScroll: true });
  });
  menuToggle.addEventListener('click', () => setVisible(root.hidden));

  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-guide-action]');
    if (!button) return;
    const action = button.dataset.guideAction;
    const game = currentGame();

    if (action === 'about') {
      if (!game) {
        say('표시된 작품이 없어요. 검색 조건을 확인하거나 전시관으로 돌아와 주세요.');
        return;
      }
      const author = game.developer ? '제작자: ' + game.developer + '. ' : '';
      const genre = game.genre ? '분류: ' + game.genre + '. ' : '';
      const description = String(game.description || game.tagline || '작품을 눌러 더 자세히 감상해 보세요.').trim();
      const shortText = description.length > 165 ? description.slice(0, 165).trimEnd() + '…' : description;
      say(game.title + '\n' + author + genre + shortText);
      return;
    }

    if (action === 'next' || action === 'previous') {
      const nav = document.getElementById(action === 'next' ? 'walk-next' : 'walk-prev');
      if (!nav || nav.disabled) {
        say(action === 'next' ? '마지막 작품이에요. 이전 전시로 돌아가 볼까요?' :
          '첫 번째 작품이에요. 오른쪽으로 이동하면 다음 작품을 볼 수 있어요.');
        return;
      }
      nav.click();
      const target = currentGame();
      say(target ? target.title + ' 전시로 안내할게요.' : '다른 작품으로 안내할게요.');
      return;
    }

    if (action === 'detail') {
      const card = document.querySelector('#game-grid .game-card.walk-room-current');
      const details = card?.querySelector('[data-details]');
      if (!details) { say('먼저 감상할 작품을 선택해 주세요.'); return; }
      setPanelOpen(false);
      details.click();
      return;
    }

    if (action === 'search') {
      setPanelOpen(false);
      document.getElementById('menu-open-filters')?.click();
      return;
    }

    if (action === 'reviews') {
      setPanelOpen(false);
      document.getElementById('tab-reviews')?.click();
    }
  });

  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !root.contains(event.target)) setPanelOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      setPanelOpen(false, true);
    }
  });
  document.addEventListener('oibung-page-changed', event => {
    if (event.detail?.page !== 'games') setPanelOpen(false);
  });
})();
