/*
 * Oibung Gallery motion controller — optional, non-blocking presentation layer.
 * One IntersectionObserver, one delegated pointer tracker, one MutationObserver.
 * No per-card loops, timers, canvas or external animation dependencies.
 */
(() => {
  'use strict';
  const root = document.documentElement;
  const lowMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.querySelector('#motion-toggle');
  const savedKey = 'oibung-gallery:motion';
  const revealedGameIds = new Set();
  const tracked = new WeakSet();
  let userDisabled = false;
  let scanFrame = 0;
  let pointerFrame = 0;
  let currentCard = null;
  let pointerPosition = null;
  let visibleObserver;

  try { userDisabled = localStorage.getItem(savedKey) === 'off'; }
  catch { /* Safari private browsing can reject storage. */ }
  const enabled = () => !userDisabled && !lowMotion.matches;
  function setPreferenceUI() {
    const active = enabled();
    root.classList.toggle('motion-active', active);
    root.classList.toggle('motion-off', !active);
    root.classList.toggle('motion-suspended', document.hidden);
    if (toggle) {
      toggle.disabled = lowMotion.matches;
      toggle.setAttribute('aria-pressed', String(!active));
      toggle.setAttribute('aria-label', lowMotion.matches ? '기기의 동작 감소 설정이 적용되어 있습니다' :
        active ? '애니메이션 줄이기' : '애니메이션 켜기');
      toggle.querySelector('.motion-control-label').textContent = lowMotion.matches ?
        '동작 감소 적용 중' : active ? '움직임 줄이기' : '움직임 켜기';
    }
    if (!active) {
      clearPointer();
      document.querySelectorAll('.motion-reveal').forEach(el => el.classList.add('motion-visible'));
    }
  }
  function visibilityChange() {
    root.classList.toggle('motion-suspended', document.hidden);
    if (document.hidden) clearPointer();
  }
  document.addEventListener('visibilitychange', visibilityChange, { passive: true });
  lowMotion.addEventListener('change', () => { setPreferenceUI(); scheduleScan(); });
  toggle?.addEventListener('click', () => {
    if (lowMotion.matches) return;
    userDisabled = !userDisabled;
    try { localStorage.setItem(savedKey, userDisabled ? 'off' : 'on'); }
    catch { /* The preference still works for the current page. */ }
    setPreferenceUI();
    scheduleScan();
  });

  // Gentle, sparse ambient light that stays behind the gallery's content.
  function createAmbient(section) {
    if (!section || section.querySelector(':scope > .motion-ambient-layer')) return;
    const layer = document.createElement('div');
    layer.className = 'motion-ambient-layer';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) {
      const glow = document.createElement('span');
      glow.className = 'motion-orb';
      layer.append(glow);
    }
    section.prepend(layer);
  }
  createAmbient(document.querySelector('.library'));
  createAmbient(document.querySelector('.review-board'));

  if ('IntersectionObserver' in window) {
    visibleObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const el = entry.target;
        el.classList.toggle('motion-onstage', entry.isIntersecting);
        if (entry.isIntersecting && el.classList.contains('motion-reveal')) {
          el.classList.add('motion-visible');
          if (el.matches('.game-card') && el.dataset.gameId) revealedGameIds.add(el.dataset.gameId);
        }
      }
    }, { threshold: 0.07, rootMargin: '24px 0px 28px 0px' });
  }

  function register(el, index) {
    if (tracked.has(el)) return;
    tracked.add(el);
    const reveal = el.matches('.game-card,.review-post,.review-sidebar,.gallery-screenshot,.activity-item,.section-heading-row');
    if (reveal) {
      el.classList.add('motion-reveal');
      // Already revealed artworks should not re-fade when a user changes a filter or favorites.
      if (!enabled() || (el.matches('.game-card') && revealedGameIds.has(el.dataset.gameId))) {
        el.classList.add('motion-visible');
      } else {
        el.style.transitionDelay = Math.min(index % 8, 5) * 55 + 'ms';
      }
    }
    if (visibleObserver) visibleObserver.observe(el);
    else el.classList.add('motion-visible', 'motion-onstage');
  }
  function scan() {
    if (document.hidden) return;
    const elements = document.querySelectorAll(
      '.game-card,.review-post,.review-sidebar,.gallery-screenshot,.activity-item,.section-heading-row,' +
      '.featured-exhibit,.library,.review-board'
    );
    elements.forEach((element, index) => register(element, index));
  }
  function scheduleScan() {
    if (scanFrame) return;
    scanFrame = requestAnimationFrame(() => { scanFrame = 0; scan(); });
  }
  const observeChildren = new MutationObserver(scheduleScan);
  for (const id of ['game-grid','reviews-feed','community-gallery','game-updates']) {
    const container = document.getElementById(id);
    if (container) observeChildren.observe(container, { childList: true });
  }
  document.addEventListener('oibung-page-changed', scheduleScan);
  document.getElementById('game-dialog')?.addEventListener('game-opened', scheduleScan);
  window.addEventListener('resize', scheduleScan, { passive: true });
  // Ensure the original DOM is observed before revealing the animation-enabled state.
  scan();
  setPreferenceUI();

  // Fine-pointer lighting and almost imperceptible frame tilt.
  function clearPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointerPosition = null;
    if (!currentCard) return;
    currentCard.style.removeProperty('--card-tilt-x');
    currentCard.style.removeProperty('--card-tilt-y');
    currentCard.querySelector('.motion-card-spotlight')?.style.setProperty('opacity', '0');
    currentCard = null;
  }
  function movePointer() {
    pointerFrame = 0;
    if (!pointerPosition || !currentCard || !enabled() || document.hidden) return;
    const rect = currentCard.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, pointerPosition.x - rect.left));
    const y = Math.max(0, Math.min(rect.height, pointerPosition.y - rect.top));
    const nx = x / Math.max(1, rect.width) - .5;
    const ny = y / Math.max(1, rect.height) - .5;
    currentCard.style.setProperty('--card-tilt-x', (-ny * 2.4).toFixed(2) + 'deg');
    currentCard.style.setProperty('--card-tilt-y', (nx * 2.4).toFixed(2) + 'deg');
    const spot = currentCard.querySelector('.motion-card-spotlight');
    if (spot) {
      spot.style.transform = 'translate3d(' + Math.round(x - 112) + 'px,' +
        Math.round(y - 112) + 'px,0)';
      spot.style.opacity = '1';
    }
  }
  const grid = document.getElementById('game-grid');
  grid?.addEventListener('pointermove', event => {
    if (!enabled() || !finePointer.matches || document.hidden) return;
    const card = event.target.closest('.game-card');
    if (!card) return;
    if (currentCard !== card) {
      clearPointer();
      currentCard = card;
      if (!card.querySelector('.motion-card-spotlight')) {
        const light = document.createElement('span');
        light.className = 'motion-card-spotlight';
        light.setAttribute('aria-hidden', 'true');
        card.append(light);
      }
    }
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (!pointerFrame) pointerFrame = requestAnimationFrame(movePointer);
  }, { passive: true });
  grid?.addEventListener('pointerout', event => {
    if (!currentCard) return;
    const stillInside = event.relatedTarget?.closest?.('.game-card') === currentCard;
    if (!stillInside) clearPointer();
  }, { passive: true });
  grid?.addEventListener('pointercancel', clearPointer, { passive: true });
  grid?.addEventListener('pointerleave', clearPointer, { passive: true });
  document.addEventListener('oibung-page-changed', clearPointer);

  // Delegated ripple on primary interactions. One transient node per click only.
  document.addEventListener('pointerdown', event => {
    if (!enabled() || !finePointer.matches || event.button !== 0) return;
    const button = event.target.closest('.button-primary,.button-outline,.details-link,.page-tab');
    if (!button || button.disabled) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * .7;
    const ripple = document.createElement('span');
    ripple.className = 'motion-ripple';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
    ripple.setAttribute('aria-hidden', 'true');
    button.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, { passive: true });
})();
