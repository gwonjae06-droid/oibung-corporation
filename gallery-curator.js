/*
 * Oibung Gallery — text-only exhibition introductions.
 * Registered game data drives each label. Three original high-resolution
 * illustrated poses are staged as twelve distinct, restrained compositions.
 * No audio, speech synthesis, remote AI requests, or automatic voice playback.
 */
(() => {
  'use strict';

  const root = document.getElementById('gallery-guide');
  const sprite = document.getElementById('gallery-guide-image');
  const head = document.getElementById('gallery-guide-head');
  const fabric = document.getElementById('gallery-guide-fabric');
  const intro = document.getElementById('gallery-guide-intro');
  const title = document.getElementById('gallery-guide-intro-title');
  const description = document.getElementById('gallery-guide-intro-description');
  const detailButton = document.getElementById('gallery-guide-intro-detail');
  if (!root || !sprite || !intro || !title || !description || !detailButton) return;

  const wardrobe = Object.freeze({
    knight: 'assets/guide-costume-knight.svg',
    maid: 'assets/guide-costume-maid.svg',
    arena: 'assets/guide-costume-arena.svg',
    duelist: 'assets/guide-costume-duelist.svg',
    commander: 'assets/guide-costume-commander.svg',
    egypt: 'assets/guide-costume-egypt.svg'
  });
  // Titles and genres can come from the public Supabase catalog, not only
  // the four seed games. Explicit names take priority over generic genres.
  function wardrobeFor(game) {
    if (!game) return 'egypt';
    const name = [game.id, game.title, game.english, game.name].filter(Boolean).join(' ').toLowerCase();
    const genre = [game.genre, game.category, ...(Array.isArray(game.tags) ? game.tags : [])]
      .filter(Boolean).join(' ').toLowerCase();
    if (/퍼리|furry|furi|furrycorp|furry-corp|furry corp/.test(name)) return 'maid';
    if (/오든링|oden.?ring|elden.?ring/.test(name)) return 'knight';
    if (/아레나|arena|오레나|ballfight/.test(name)) return 'arena';
    if (/오이챔스|ochams|듀얼|duel/.test(name)) return 'duelist';
    if (/대학전선|campus|frontier/.test(name)) return 'commander';
    if (/고양이|cat|메이드|maid|퍼리|furry/.test(genre)) return 'maid';
    if (/보스|소울|boss|souls|기사|knight/.test(genre)) return 'knight';
    if (/핀볼|pinball|격투|brawl|battle/.test(genre)) return 'arena';
    if (/전략|strategy|시뮬|tactics/.test(genre)) return 'commander';
    return 'egypt';
  }

  // Reuse the three true illustrations in changing orientations / stage
  // positions rather than stretch low-resolution background photographs.
  // The first six exhibits use all three illustrations in both directions;
  // subsequent scenes alter the subtle stance and size as well.
  const arrangements = Object.freeze([
    { pose: 'calm',    x:  0, y:  0, scale: 1.00, angle:  0.0, face:  1 },
    { pose: 'present', x:-18, y:  0, scale: 1.04, angle: -1.1, face:  1 },
    { pose: 'welcome', x: 18, y:  5, scale: 0.98, angle:  1.3, face:  1 },
    { pose: 'calm',    x:-16, y:  4, scale: 1.02, angle: -1.3, face: -1 },
    { pose: 'present', x: 20, y: -3, scale: 0.97, angle:  1.4, face: -1 },
    { pose: 'welcome', x:-15, y: -4, scale: 1.04, angle: -1.2, face: -1 },
    { pose: 'calm',    x: 24, y:  6, scale: 0.95, angle:  1.7, face:  1 },
    { pose: 'present', x:-26, y:  2, scale: 1.06, angle: -1.8, face:  1 },
    { pose: 'welcome', x: 10, y: -8, scale: 1.02, angle:  0.8, face:  1 },
    { pose: 'calm',    x:-10, y: -6, scale: 1.04, angle: -0.8, face: -1 },
    { pose: 'present', x: 16, y:  4, scale: 1.02, angle:  1.1, face: -1 },
    { pose: 'welcome', x:-22, y:  3, scale: 0.96, angle: -1.5, face: -1 }
  ]);

  // Warm the six existing costume illustrations, without generating copies.
  const cached = [];
  for (const src of Object.values(wardrobe)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    cached.push(image);
  }

  let installTimer = 0;
  let generation = 0;

  function currentGame() {
    const active = document.querySelector('#game-grid .game-card.walk-room-current');
    if (!active) return null;
    return (window.OIBUNG_CATALOG?.listGames?.() || [])
      .find(game => String(game.id) === String(active.dataset.gameId)) || null;
  }

  function trimText(value, maxLength = 165) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    const cut = normalized.slice(0, maxLength);
    return cut.replace(/\s+\S*$/, '') + '…';
  }

  function introduction(game) {
    if (!game) return {
      title: '전시 안내',
      body: '지금 전시 중인 작품이 없어요. 메뉴에서 검색 조건을 확인해 주세요.'
    };
    const developer = game.developer
      ? '제작자는 ' + trimText(game.developer, 60) + '입니다. ' : '';
    const genre = game.genre ? trimText(game.genre, 60) + ' 작품으로, ' : '';
    const detail = trimText(game.description || game.tagline || '', 160);
    return {
      title: String(game.title || '이 작품'),
      body: developer + genre +
        (detail || '액자를 선택하면 이 작품을 자세히 살펴볼 수 있어요.')
    };
  }

  function currentIndex() {
    const cards = [...document.querySelectorAll('#game-grid .game-card')];
    const active = cards.findIndex(card => card.classList.contains('walk-room-current'));
    return Math.max(0, active);
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('motion-off');
  }

  function applyScene(index) {
    const variantIndex = Math.abs(Number(index) || 0) % arrangements.length;
    const arrangement = arrangements[variantIndex];
    const game = currentGame();
    const copy = introduction(game);

    root.dataset.guidePose = arrangement.pose;
    const outfit = wardrobeFor(game);
    root.dataset.guideOutfit = outfit;
    const source = wardrobe[outfit];
    root.dataset.guideVariant = String(variantIndex);
    root.style.setProperty('--curator-x', arrangement.x + 'px');
    root.style.setProperty('--curator-y', arrangement.y + 'px');
    root.style.setProperty('--curator-mobile-x', (arrangement.x * .38).toFixed(2) + 'px');
    root.style.setProperty('--curator-mobile-y', (arrangement.y * .38).toFixed(2) + 'px');
    root.style.setProperty('--curator-scale', String(arrangement.scale));
    root.style.setProperty('--curator-rotate', arrangement.angle + 'deg');
    root.style.setProperty('--curator-facing', String(arrangement.face));

    for (const image of [sprite, head, fabric]) {
      if (image && image.getAttribute('src') !== source) image.src = source;
    }
    title.textContent = copy.title;
    description.textContent = copy.body;
    intro.hidden = !game || root.hidden;
    detailButton.disabled = !game;
  }

  function showExhibit(index = 0, animate = true) {
    clearTimeout(installTimer);
    const token = ++generation;
    const shouldAnimate = animate && !reducedMotion() && !root.hidden;
    if (shouldAnimate) {
      root.classList.add('is-scene-changing');
      intro.classList.add('is-changing');
    }

    const install = () => {
      if (token !== generation) return; // Rapid swipes: only newest work wins.
      applyScene(index);
      requestAnimationFrame(() => {
        root.classList.remove('is-scene-changing');
        intro.classList.remove('is-changing');
      });
    };

    if (shouldAnimate) installTimer = window.setTimeout(install, 320);
    else install();
  }

  detailButton.addEventListener('click', () => {
    const active = document.querySelector('#game-grid .game-card.walk-room-current');
    active?.querySelector('[data-details]')?.click();
  });

  document.addEventListener('oibung-exhibit-change', event => {
    showExhibit(event.detail?.index ?? currentIndex(), true);
  });
  document.addEventListener('oibung-page-changed', event => {
    if (event.detail?.page === 'games') showExhibit(currentIndex(), false);
    else intro.hidden = true;
  });

  // The existing menu controls whether the guide is visible.
  const visibilityObserver = new MutationObserver(() => {
    if (root.hidden) {
      clearTimeout(installTimer);
      generation++;
      root.classList.remove('is-scene-changing');
      intro.classList.remove('is-changing');
      intro.hidden = true;
    } else showExhibit(currentIndex(), false);
  });
  visibilityObserver.observe(root, { attributes: true, attributeFilter: ['hidden'] });

  // Small pointer-driven head parallax: a lightweight Live2D-like gesture,
  // not a full Cubism rig. Do not run when motion is reduced or a dialog opens.
  let gazeFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  document.addEventListener('pointermove', event => {
    if (!head || reducedMotion() || root.hidden || document.querySelector('dialog[open]')) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (gazeFrame) return;
    gazeFrame = requestAnimationFrame(() => {
      gazeFrame = 0;
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(-1, Math.min(1,
        (pointerX - rect.left - rect.width / 2) / Math.max(window.innerWidth * .54, 1)));
      const y = Math.max(-1, Math.min(1,
        (pointerY - rect.top - rect.height * .3) / Math.max(window.innerHeight * .6, 1)));
      root.style.setProperty('--guide-look-x', (3.5 * x).toFixed(2) + 'px');
      root.style.setProperty('--guide-look-y', (2.2 * y).toFixed(2) + 'px');
    });
  }, { passive: true });

  showExhibit(currentIndex(), false);
})();
