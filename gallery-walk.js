/*
 * OIBUNG GALLERY — horizontal exhibition camera.
 *
 * Navigates one room at a time, easing the *track* with requestAnimationFrame.
 * Vertical mouse wheel, trackpad horizontal wheel, arrow keys, previous/next
 * controls, touch swipes and optional mouse drags are supported.
 * At either end, vertical wheel scrolling passes through naturally.
 */
(() => {
  'use strict';
  const room = document.getElementById('walk-gallery');
  const viewport = document.getElementById('walk-gallery-viewport');
  const track = document.getElementById('game-grid');
  const previous = document.getElementById('walk-prev');
  const next = document.getElementById('walk-next');
  const indexLabel = document.getElementById('walk-index');
  const nameLabel = document.getElementById('walk-current-title');
  const progress = document.getElementById('walk-progress-fill');
  if (!room || !viewport || !track || !previous || !next || !indexLabel || !progress) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cards = [];
  let index = 0;
  let width = 0;
  let position = 0;
  let target = 0;
  let frameId = 0;
  let previousFrameTime = 0;
  let wheelAccumulator = 0;
  let wheelDirection = 0;
  let wheelLastTime = 0;
  let wheelLockedUntil = 0;
  let pointerStart = null;
  let suppressSwipeClick = false;
  let clickSafetyTimer = 0;
  let lastSelectedId = '';

  const formatIndex = n => String(n).padStart(2, '0');
  const reduced = () => reduceMotion.matches || document.documentElement.classList.contains('motion-off');
  const clampIndex = n => Math.min(Math.max(0, n), Math.max(0, cards.length - 1));

  function paint() {
    track.style.transform = 'translate3d(' + (-position).toFixed(3) + 'px,0,0)';
  }

  function stopAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrameTime = 0;
  }

  function animate(time) {
    const delta = previousFrameTime ? Math.min(48, Math.max(1, time - previousFrameTime)) : 16;
    previousFrameTime = time;
    // Frame-rate-independent camera easing (~0.65 s for 95% of the distance).
    const eased = 1 - Math.exp(-delta / 210);
    position += (target - position) * eased;
    if (Math.abs(target - position) < 0.35) {
      position = target;
      paint();
      stopAnimation();
      return;
    }
    paint();
    frameId = requestAnimationFrame(animate);
  }

  function updateLabels() {
    const count = cards.length;
    const visibleNumber = count ? index + 1 : 0;
    indexLabel.textContent = formatIndex(visibleNumber) + ' / ' + formatIndex(count);
    if (nameLabel) {
      const title = cards[index]?.querySelector('h3')?.textContent || '';
      nameLabel.textContent = title || '전시 작품';
    }
    previous.disabled = index <= 0 || count === 0;
    next.disabled = index >= count - 1 || count === 0;
    progress.style.transform = 'scaleX(' + (count ? (index + 1) / count : 0) + ')';

    cards.forEach((card, i) => {
      const isActive = i === index;
      card.classList.toggle('walk-room-current', isActive);
      // Offscreen paintings are not keyboard-focusable during camera travel.
      card.inert = !isActive;
      card.setAttribute('aria-hidden', String(!isActive));
    });
    if (count) lastSelectedId = cards[index].dataset.gameId || '';
  }

  function goTo(nextIndex, instant = false) {
    if (!cards.length) return;
    const chosen = clampIndex(nextIndex);
    const moved = chosen !== index;
    index = chosen;
    target = index * width;
    updateLabels();
    if (instant || reduced() || !width) {
      stopAnimation();
      position = target;
      paint();
      return;
    }
    if (moved || Math.abs(target - position) > 0.4) {
      stopAnimation();
      frameId = requestAnimationFrame(animate);
    }
  }

  function measure() {
    const newWidth = viewport.clientWidth;
    if (!newWidth) return; // Hidden while visitors read the reviews tab.
    width = newWidth;
    track.style.setProperty('--walk-panel-width', width + 'px');
    target = index * width;
    stopAnimation();
    position = target;
    paint();
  }

  function syncCards() {
    const prior = lastSelectedId;
    cards = [...track.children].filter(node => node.classList.contains('game-card'));
    const keep = prior ? cards.findIndex(card => card.dataset.gameId === prior) : -1;
    index = keep >= 0 ? keep : 0;
    room.hidden = cards.length === 0;
    if (!cards.length) lastSelectedId = '';
    updateLabels();
    measure();
    wheelAccumulator = 0;
    wheelDirection = 0;
  }

  function wheelMove(event) {
    if (room.hidden || !cards.length || document.querySelector('dialog[open]')) return;
    const scrollArea = event.target.closest('.game-card-body');
    if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight + 3) return;
    // Trackpad horizontal motion takes priority; normal vertical wheels also travel right.
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.08;
    const raw = horizontal ? event.deltaX : event.deltaY;
    if (!raw) return;
    const direction = Math.sign(raw);
    // At the ends, let the page scroll out of the exhibition normally.
    if ((direction < 0 && index <= 0) || (direction > 0 && index >= cards.length - 1)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelLastTime > 220 || direction !== wheelDirection) wheelAccumulator = 0;
    wheelLastTime = now;
    wheelDirection = direction;
    if (now < wheelLockedUntil) return;
    const normalized = event.deltaMode === 1 ? raw * 16 : event.deltaMode === 2 ? raw * 120 : raw;
    wheelAccumulator += normalized;
    if (Math.abs(wheelAccumulator) < 50) return;
    wheelAccumulator = 0;
    wheelLockedUntil = now + 850;
    goTo(index + direction);
  }

  function isGalleryVisible() {
    if (room.hidden || window.OIBUNG_CURRENT_VIEW !== 'games' || document.querySelector('dialog[open]')) return false;
    const bounds = viewport.getBoundingClientRect();
    const visible = Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
    return visible >= Math.min(160, viewport.clientHeight * 0.35);
  }

  function keyMove(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || !isGalleryVisible()) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.target.closest?.('button,a') && !event.target.closest('#walk-gallery')) return;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    if ((direction < 0 && index === 0) || (direction > 0 && index === cards.length - 1)) return;
    event.preventDefault();
    goTo(index + direction);
  }

  function onPointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      type: event.pointerType
    };
  }

  function onPointerUp(event) {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
    const start = pointerStart;
    pointerStart = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const threshold = start.type === 'mouse' ? 65 : 44;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    suppressSwipeClick = true;
    clearTimeout(clickSafetyTimer);
    clickSafetyTimer = window.setTimeout(() => { suppressSwipeClick = false; }, 320);
    const direction = dx < 0 ? 1 : -1;
    goTo(index + direction);
  }

  viewport.addEventListener('wheel', wheelMove, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
  viewport.addEventListener('pointerup', onPointerUp, { passive: true });
  viewport.addEventListener('pointercancel', () => { pointerStart = null; });
  viewport.addEventListener('click', event => {
    if (!suppressSwipeClick) return;
    suppressSwipeClick = false;
    clearTimeout(clickSafetyTimer);
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  previous.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));
  document.addEventListener('keydown', keyMove);
  window.addEventListener('resize', measure, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(viewport);
  document.addEventListener('oibung-page-changed', event => {
    if (event.detail?.page === 'games') requestAnimationFrame(measure);
  });
  window.addEventListener('oibung-motion-preference', () => {
    if (reduced()) goTo(index, true);
  });
  reduceMotion.addEventListener?.('change', () => {
    if (reduced()) goTo(index, true);
  });

  new MutationObserver(syncCards).observe(track, { childList: true });
  syncCards();
})();
