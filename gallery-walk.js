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
  const dots = document.getElementById('walk-dots');
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
  let lastAnnouncedId = null;

  const formatIndex = n => String(n).padStart(2, '0');
  const reduced = () => reduceMotion.matches || document.documentElement.classList.contains('motion-off');
  const clampIndex = n => Math.min(Math.max(0, n), Math.max(0, cards.length - 1));

  function paint() {
    track.style.transform = 'translate3d(' + (-position).toFixed(3) + 'px,0,0)';
    if (!width) return;
    // A travelling camera sees the outgoing wall turn away and the incoming
    // wall rotate toward the lens. The frame, plaque and room move at different
    // depths, rather than just sliding a flat screenshot sideways.
    const camera = position / width;
    const allowDepth = !reduced();
    cards.forEach((card, i) => {
      const distance = i - camera;
      if (Math.abs(distance) > 1.35) return; // Only two visible rooms update.
      const limited = Math.max(-1, Math.min(1, distance));
      const angle = allowDepth ? -19 * limited : 0;
      const shift = allowDepth ? -32 * limited : 0;
      card.style.setProperty('--walk-yaw', angle.toFixed(2) + 'deg');
      card.style.setProperty('--walk-shift', shift.toFixed(2) + 'px');
      card.style.setProperty('--walk-shift-plaque', (shift * .42).toFixed(2) + 'px');
      card.style.setProperty('--walk-focus', (1 - Math.abs(limited) * .23).toFixed(3));
      card.style.setProperty('--scene-depth', (allowDepth ? -Math.abs(limited) * 78 : 0).toFixed(2) + 'px');
      card.style.setProperty('--scene-photo-shift', (allowDepth ? limited * 68 : 0).toFixed(2) + 'px');
      card.style.setProperty('--scene-photo-opacity', (.22 + (1 - Math.abs(limited)) * .07).toFixed(3));
      card.style.setProperty('--scene-art-opacity', (1 - Math.abs(limited) * (allowDepth ? .3 : 0)).toFixed(3));
      card.style.setProperty('--walk-scene-opacity', (1 - Math.abs(limited) * .23).toFixed(3));
    });
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
    if (dots) {
      [...dots.children].forEach((button, i) => {
        const current = i === index;
        button.setAttribute('aria-current', String(current));
        button.setAttribute('aria-pressed', String(current));
      });
    }
    lastSelectedId = count ? (cards[index].dataset.gameId || '') : '';
    if (lastSelectedId !== lastAnnouncedId) {
      lastAnnouncedId = lastSelectedId;
      document.dispatchEvent(new CustomEvent('oibung-exhibit-change', {
        detail: { index, total: count, gameId: lastSelectedId }
      }));
    }
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
    if (dots) {
      const desired = cards.length <= 12 ? cards.length : 0;
      dots.hidden = desired === 0;
      dots.replaceChildren();
      for (let i = 0; i < desired; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', (i + 1) + '번째 작품으로 이동');
        button.title = (i + 1) + '번째 작품';
        button.addEventListener('click', () => goTo(i));
        dots.appendChild(button);
      }
    }
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
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) ||
        room.hidden || document.querySelector('dialog[open]')) return;
    pointerStart = {
      x: event.clientX, y: event.clientY,
      pointerId: event.pointerId, type: event.pointerType,
      startPosition: position,
      startIndex: index,
      time: performance.now(),
      dragging: false
    };
  }

  function onPointerMove(event) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (!pointerStart.dragging) {
      // Let the browser handle ordinary vertical page scrolling.
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      pointerStart.dragging = true;
      stopAnimation();
      viewport.classList.add('is-dragging');
      try { viewport.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
    }
    // Dragging is a LIVE camera motion, not a slide that waits for pointerup.
    position = Math.max(0, Math.min((cards.length - 1) * width, pointerStart.startPosition - dx));
    paint();
  }

  function onPointerUp(event) {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
    const start = pointerStart;
    pointerStart = null;
    viewport.classList.remove('is-dragging');
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const enough = Math.abs(dx) >= Math.min(100, Math.max(44, width * .075));
    const flick = Math.abs(dx) >= 35 && performance.now() - start.time < 330;
    if (!start.dragging && (!enough || Math.abs(dx) < Math.abs(dy) * 1.2)) return;
    if (start.dragging || enough) {
      suppressSwipeClick = true;
      clearTimeout(clickSafetyTimer);
      clickSafetyTimer = window.setTimeout(() => { suppressSwipeClick = false; }, 350);
    }
    const direction = dx < 0 ? 1 : -1;
    goTo(start.startIndex + (enough || flick ? direction : 0));
  }

  function onPointerCancel() {
    const wasDragging = pointerStart?.dragging;
    pointerStart = null;
    viewport.classList.remove('is-dragging');
    if (wasDragging) goTo(index);
  }

  viewport.addEventListener('wheel', wheelMove, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
  viewport.addEventListener('pointermove', onPointerMove, { passive: true });
  viewport.addEventListener('pointerup', onPointerUp, { passive: true });
  viewport.addEventListener('pointercancel', onPointerCancel);
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
