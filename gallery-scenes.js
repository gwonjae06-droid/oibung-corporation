/*
 * OIBUNG GALLERY — Hybrid scene museum v1
 * Static, deterministic camera scenes, DOM artwork and a 2D character.
 * No WebGL or continuous rendering. Live catalog and dialogs stay in app.js.
 */
(() => {
  'use strict';
  const surface = document.getElementById('gallery-3d');
  const grid = document.getElementById('game-grid');
  if (!surface || !grid) return;
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches ||
    root.classList.contains('motion-off');
  const wardrobe = {
    knight: 'assets/guide-costume-knight.svg',
    maid: 'assets/guide-costume-maid.svg',
    arena: 'assets/guide-costume-arena.svg',
    duelist: 'assets/guide-costume-duelist.svg',
    commander: 'assets/guide-costume-commander.svg',
    egypt: 'assets/guide-costume-egypt.svg'
  };
  const areaLabels = {
    entrance: '정문', lobby: '중앙 로비', left: '좌측 회랑',
    right: '우측 회랑', special: '특별 전시실', focus: '작품 정면'
  };
  const scene = { area: 'entrance', selected: 0, page: 0, gameId: '', zoom: false, stack: [] };
  let cards = [];
  let soundEnabled = false;
  let flickerEnabled = true;
  let audioContext = null, ambience = null, ambienceGain = null;
  let torchOn = true, pointerFrame = 0, pointer = { x: 50, y: 53 };
  const imageChecks = new Map();
  surface.innerHTML = [
    '<div class="museum-stage" id="museum-stage" data-area="entrance">',
      '<div class="museum-view" id="museum-view">',
        '<div class="museum-architecture" aria-hidden="true">',
          '<div class="museum-cornice"></div><div class="museum-ceiling"></div>',
          '<div class="museum-back-wall"></div><div class="museum-gallery-wing wing-left"></div>',
          '<div class="museum-gallery-wing wing-right"></div>',
          '<div class="museum-columns column-left"></div><div class="museum-columns column-right"></div>',
          '<div class="museum-floor"></div><div class="museum-sky-light"></div>',
          '<div class="museum-vanishing-door"></div>',
        '</div>',
        '<div class="museum-works" id="museum-works" aria-label="전시 중인 액자"></div>',
        '<div class="museum-entry-copy" id="museum-entry-copy">',
          '<span>THE MUSEUM OF OTHER WORLDS</span>',
          '<h2>세상의 경계에 놓인<br>작은 미술관</h2>',
          '<p>친구들이 만든 또 다른 세계로 초대합니다.</p>',
          '<button type="button" class="museum-primary" id="museum-enter">전시관 입장</button>',
        '</div>',
        '<div class="museum-doors" id="museum-doors" aria-label="전시실 이동"></div>',
        '<div class="museum-blackout" aria-hidden="true"></div>',
        '<div class="museum-torch" aria-hidden="true"></div>',
        '<div class="museum-emergency-light" aria-hidden="true"></div>',
        '<div class="museum-vignette" aria-hidden="true"></div>',
      '</div>',
      '<div class="museum-ui">',
        '<header class="museum-toolbar">',
          '<div class="museum-location"><span>OIBUNG GALLERY · MUSEUM</span>',
            '<strong id="museum-area-name">정문</strong></div>',
          '<div class="museum-toolbar-actions">',
            '<button type="button" id="museum-map-button" aria-haspopup="dialog">전시 지도</button>',
            '<button type="button" id="museum-mode-button" aria-label="전시관 조명 전환">☾ 소등</button>',
            '<button type="button" id="museum-torch-button" hidden>손전등 켬</button>',
          '</div>',
        '</header>',
        '<div class="museum-description" id="museum-description" aria-live="polite">',
          '<span class="museum-number" id="museum-number">01 / 01</span>',
          '<h3 id="museum-work-name">전시관 입구</h3>',
          '<p id="museum-work-author">빛을 따라 걸어 들어오세요.</p>',
          '<div class="museum-detail-actions">',
            '<button type="button" id="museum-approach" class="museum-primary">가까이 보기</button>',
            '<button type="button" id="museum-details" class="museum-secondary">작품 정보</button>',
          '</div>',
        '</div>',
        '<nav class="museum-movement" aria-label="전시관 탐험">',
          '<button type="button" id="museum-back" aria-label="뒤로 이동">↓<span>돌아가기</span></button>',
          '<button type="button" id="museum-left" aria-label="왼쪽으로 이동">←<span>이전</span></button>',
          '<button type="button" id="museum-forward" aria-label="앞으로 이동">↑<span>접근</span></button>',
          '<button type="button" id="museum-right" aria-label="오른쪽으로 이동">→<span>다음</span></button>',
        '</nav>',
        '<div class="museum-curator" id="museum-curator">',
          '<img id="museum-curator-image" src="assets/guide-costume-egypt.svg" alt="작품별 의상을 입은 안내 비서" decoding="async">',
          '<div class="museum-curator-dialogue" id="museum-curator-dialogue">어서 오세요. 작품을 둘러보세요.</div>',
          '<button type="button" id="museum-guide-toggle" aria-label="안내 비서 숨기기">×</button>',
        '</div>',
        '<button type="button" id="museum-guide-show" hidden>비서 보기</button>',
      '</div>',
    '</div>',
    '<dialog class="museum-map-dialog" id="museum-map-dialog" aria-labelledby="museum-map-heading">',
      '<div class="museum-map-head"><h2 id="museum-map-heading">전시 안내도</h2>',
        '<button type="button" id="museum-map-close" aria-label="지도 닫기">×</button></div>',
      '<p>중앙 로비에서 회랑으로 이동하거나 작품을 바로 찾아갈 수 있습니다.</p>',
      '<div class="museum-map-rooms" id="museum-map-rooms"></div>',
      '<div class="museum-map-list" id="museum-map-list"></div>',
      '<fieldset class="museum-access"><legend>공포 연출 설정</legend>',
        '<label><input id="museum-flicker-option" type="checkbox" checked> 소등 시 깜빡임</label>',
        '<label><input id="museum-sound-option" type="checkbox"> 환경음 켜기 (기본 꺼짐)</label>',
      '</fieldset>',
    '</dialog>'
  ].join('');
  surface.setAttribute('aria-label', '장면 이동형 미술관. 방향키로 이동하고 Enter 또는 E로 작품을 감상합니다.');
  const el = id => document.getElementById(id);
  const stage = el('museum-stage');
  const view = el('museum-view');
  const works = el('museum-works');
  const doors = el('museum-doors');
  const entry = el('museum-entry-copy');
  const map = el('museum-map-dialog');
  const guidance = el('museum-curator');
  const guideImage = el('museum-curator-image');
  const guideSpeech = el('museum-curator-dialogue');
  const guideShow = el('museum-guide-show');
  const intro = el('museum-description');
  const getGame = id => window.OIBUNG_CATALOG?.getGame?.(id) || {};
  const item = card => getGame(card?.dataset.gameId);
  const title = card => String(item(card).title || '이름 없는 작품');
  const developer = card => String(item(card).developer || '전시 작품');
  const mode = () => root.dataset.galleryMode === 'dark' ? 'dark' : 'light';
  function areaItems(area) {
    if (area === 'special') {
      const finished = cards.filter(card => {
        const game = item(card);
        return game.developmentStatus === 'finished' || game.badge === 'FEATURED';
      });
      return finished.length ? finished : cards.slice(0, 1);
    }
    const midpoint = Math.ceil(cards.length / 2);
    return area === 'right' ? cards.slice(midpoint) : cards.slice(0, midpoint);
  }
  function focusedCard() {
    if (scene.area === 'focus') return cards.find(card => card.dataset.gameId === scene.gameId) || null;
    if (scene.area === 'lobby') return cards[0] || null;
    if (scene.area === 'left' || scene.area === 'right' || scene.area === 'special') {
      return areaItems(scene.area)[scene.selected] || null;
    }
    return null;
  }
  function outfitFor(game) {
    const name = [game.id, game.title, game.english].filter(Boolean).join(' ').toLowerCase();
    const genre = String(game.genre || '').toLowerCase();
    if (/퍼리|furry|furi|고양이|cat/.test(name + ' ' + genre)) return 'maid';
    if (/오든링|oden.?ring|elden.?ring|소울|souls/.test(name + ' ' + genre)) return 'knight';
    if (/아레나|arena|ballfight|핀볼|pinball/.test(name + ' ' + genre)) return 'arena';
    if (/오이챔스|ochams|duel|듀얼/.test(name)) return 'duelist';
    if (/대학전선|campus|strategy|전략/.test(name + ' ' + genre)) return 'commander';
    return 'egypt';
  }
  function makeFrame(card, ordinal, place) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'museum-painting museum-position-' + place;
    button.setAttribute('aria-label', title(card) + ' 작품 정면으로 이동');
    button.dataset.gameId = card.dataset.gameId;
    const art = document.createElement('div');
    art.className = 'museum-art';
    const source = card.querySelector('.artwork-image-window');
    if (source) {
      const copy = source.cloneNode(true);
      copy.querySelectorAll('img').forEach(img => {
        img.loading = 'lazy';
        img.decoding = 'async';
        img.removeAttribute('width');
        img.removeAttribute('height');
      });
      art.appendChild(copy);
    }
    const plaque = document.createElement('span');
    plaque.className = 'museum-plaque';
    const sequence = document.createElement('small');
    sequence.textContent = 'EXHIBIT ' + String(ordinal + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = title(card);
    plaque.append(sequence, name);
    button.append(art, plaque);
    button.addEventListener('click', () => {
      if (scene.area === 'focus' && scene.zoom) openDetails();
      else if (scene.area === 'focus') { scene.zoom = true; render(); }
      else focusOn(card.dataset.gameId);
    });
    return button;
  }
  function copyState() {
    return { area: scene.area, selected: scene.selected, page: scene.page,
      gameId: scene.gameId, zoom: scene.zoom };
  }
  function pushState() {
    scene.stack.push(copyState());
    if (scene.stack.length > 16) scene.stack.shift();
  }
  function changeArea(area, push = true) {
    if (!areaLabels[area]) return;
    if (push) pushState();
    scene.area = area; scene.selected = 0; scene.page = 0; scene.gameId = ''; scene.zoom = false;
    render(true);
  }
  function focusOn(gameId) {
    if (!cards.some(card => card.dataset.gameId === gameId)) return;
    pushState();
    scene.area = 'focus'; scene.gameId = gameId; scene.zoom = false;
    render(true);
  }
  function back() {
    if (scene.area === 'focus' && scene.zoom) {
      scene.zoom = false; render(); return;
    }
    const previous = scene.stack.pop();
    if (previous) Object.assign(scene, previous);
    else if (scene.area !== 'entrance') Object.assign(scene, { area: 'lobby', selected: 0, page: 0, gameId: '', zoom: false });
    render(true);
  }
  function approach() {
    if (scene.area === 'entrance') { changeArea('lobby'); return; }
    const chosen = focusedCard();
    if (scene.area === 'focus') {
      if (!scene.zoom) { scene.zoom = true; render(); }
      else openDetails();
      return;
    }
    if (chosen) focusOn(chosen.dataset.gameId);
  }
  function move(delta) {
    if (scene.area === 'entrance') { changeArea('lobby'); return; }
    if (scene.area === 'lobby') { changeArea(delta < 0 ? 'left' : 'right'); return; }
    if (scene.area === 'focus') {
      const list = cards;
      const current = list.findIndex(card => card.dataset.gameId === scene.gameId);
      const next = list[(current + delta + list.length) % list.length];
      if (next) { scene.gameId = next.dataset.gameId; scene.zoom = false; render(true); }
      return;
    }
    const list = areaItems(scene.area);
    if (!list.length) return;
    scene.selected = (scene.selected + delta + list.length) % list.length;
    scene.page = Math.floor(scene.selected / 3);
    render(true);
  }
  function openDetails() {
    const card = focusedCard();
    if (card) window.OIBUNG_CATALOG?.openDetail?.(card.dataset.gameId);
  }
  function showRoomDoors() {
    doors.replaceChildren();
    if (scene.area === 'entrance' || scene.area === 'focus') return;
    const routes = scene.area === 'lobby'
      ? [['left', '← 좌측 회랑'], ['special', '특별 전시실'], ['right', '우측 회랑']]
      : [['lobby', '↶ 중앙 로비'], [scene.area === 'left' ? 'right' : 'left', '반대쪽 회랑'], ['special', '특별 전시실']];
    routes.forEach(([target, label]) => {
      if (target === scene.area) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => changeArea(target));
      doors.append(button);
    });
  }
  function paintWorks() {
    works.replaceChildren();
    const chosen = focusedCard();
    let group = [];
    if (scene.area === 'lobby') group = cards.slice(0, 1);
    else if (scene.area === 'focus') group = chosen ? [chosen] : [];
    else if (scene.area === 'left' || scene.area === 'right' || scene.area === 'special') {
      const list = areaItems(scene.area);
      // Centre the visitor's current artwork; neighbours recede in perspective.
      group = list.slice(Math.max(0, scene.selected - 1), scene.selected + 2);
    }
    group.forEach((card, index) => {
      const selectedIndex = group.findIndex(node => node.dataset.gameId === chosen?.dataset.gameId);
      const distance = index - selectedIndex;
      const place = scene.area === 'focus' || scene.area === 'lobby' || group.length === 1
        ? 'center' : distance < 0 ? 'left' : distance > 0 ? 'right' : 'center';
      const frame = makeFrame(card, cards.indexOf(card), place);
      if (index === selectedIndex) frame.classList.add('is-selected');
      works.append(frame);
    });
    works.classList.toggle('museum-single', group.length === 1);
    works.classList.toggle('museum-close', scene.area === 'focus' && scene.zoom);
  }
  function updateCopy() {
    const card = focusedCard();
    const game = item(card);
    el('museum-area-name').textContent = scene.area === 'focus' && scene.zoom
      ? '근접 감상' : areaLabels[scene.area];
    entry.hidden = scene.area !== 'entrance';
    intro.hidden = scene.area === 'entrance';
    el('museum-work-name').textContent = card ? title(card) : '전시 작품을 준비하고 있습니다';
    el('museum-work-author').textContent = card ?
      (game.developer ? '제작 · ' + developer(card) : String(game.genre || '오이붕 갤러리')) :
      '새 작품이 등록되면 이 공간에 전시됩니다.';
    const position = card ? cards.indexOf(card) + 1 : 0;
    el('museum-number').textContent = String(position).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    el('museum-approach').textContent = scene.area === 'focus'
      ? scene.zoom ? '작품 상세 보기' : '더 가까이 감상' : '가까이 보기';
    el('museum-details').hidden = !card;
    el('museum-approach').disabled = !card;
    el('museum-forward').disabled = !card && scene.area !== 'entrance';
    const gameForGuide = game || {};
    guideImage.src = wardrobe[outfitFor(gameForGuide)];
    guideSpeech.textContent = scene.area === 'entrance'
      ? '어서 오세요. 전시관으로 안내할게요.'
      : scene.area === 'lobby'
        ? '좌우 회랑과 특별 전시실을 자유롭게 둘러보세요.'
        : card ? title(card) + ' 작품입니다. 가까이 가서 감상해 보세요.'
          : '등록된 작품이 없어요. 작품 등록으로 새로운 전시를 시작할 수 있어요.';
  }
  function updateMap() {
    const rooms = el('museum-map-rooms');
    const list = el('museum-map-list');
    rooms.replaceChildren(); list.replaceChildren();
    [['entrance', '정문'], ['lobby', '중앙 로비'], ['left', '좌측 회랑'],
      ['right', '우측 회랑'], ['special', '특별 전시실']].forEach(([area,label]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.className = scene.area === area ? 'is-current' : '';
      button.addEventListener('click', () => { map.close(); changeArea(area); });
      rooms.append(button);
    });
    cards.forEach((card, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      const leftSize = Math.ceil(cards.length / 2);
      button.textContent = String(i + 1).padStart(2,'0') + ' · ' + title(card) +
        ' — ' + (i < leftSize ? '좌측 회랑' : '우측 회랑');
      button.addEventListener('click', () => {
        map.close();
        const destination = i < leftSize ? 'left' : 'right';
        pushState();
        scene.area = destination;
        scene.selected = i < leftSize ? i : i - leftSize;
        scene.page = Math.floor(scene.selected / 3);
        scene.gameId = ''; scene.zoom = false;
        render(true);
      });
      list.append(button);
    });
  }
  const mobileScene = matchMedia('(max-width: 700px)');
  function sceneImage(area, lighting = mode()) {
    const source = window.OIBUNG_SCENE_ASSETS?.[area]?.[lighting];
    if (typeof source === 'string') return source;
    return mobileScene.matches ? (source?.mobile || source?.desktop || '')
      : (source?.desktop || source?.mobile || '');
  }
  function applyBackdrop() {
    // If Blender renders are added later, a matching scene/lighting file wins.
    // The architectural CSS fallback works fully offline, even without assets.
    const area = scene.area === 'focus' ? 'focus' : scene.area;
    const url = sceneImage(area);
    // Do not request missing renders. An explicit manifest opts in each scene.
    if (!/^assets\/museum\/[a-z0-9/_-]+\.avif$/.test(url)) {
      view.style.removeProperty('--museum-render');
      view.classList.remove('museum-has-render');
      return;
    }
    const cached = imageChecks.get(url);
    if (cached === true) {
      view.style.setProperty('--museum-render', 'url("' + url + '")');
      view.classList.add('museum-has-render');
    } else if (cached === false) {
      view.style.removeProperty('--museum-render');
      view.classList.remove('museum-has-render');
    } else {
      view.style.removeProperty('--museum-render');
      view.classList.remove('museum-has-render');
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        imageChecks.set(url, true);
        const current = (scene.area === 'focus' ? 'focus' : scene.area) + '-' + mode();
        if (url === sceneImage(area) &&
            current === area + '-' + mode()) {
          view.style.setProperty('--museum-render', 'url("' + url + '")');
          view.classList.add('museum-has-render');
        }
      };
      image.onerror = () => {
        imageChecks.set(url, false);
        view.classList.remove('museum-has-render');
      };
      image.src = url;
    }
  }
  function render(transition = false) {
    cards = [...grid.querySelectorAll(':scope > .game-card')];
    if (scene.area === 'focus' && !cards.some(card => card.dataset.gameId === scene.gameId)) {
      scene.area = 'lobby'; scene.zoom = false;
    }
    if (['left','right','special'].includes(scene.area)) {
      const list = areaItems(scene.area);
      scene.selected = Math.max(0, Math.min(scene.selected, list.length - 1));
      scene.page = Math.floor(scene.selected / 3);
    }
    stage.dataset.area = scene.area;
    stage.dataset.zoom = scene.zoom ? 'true' : 'false';
    stage.dataset.galleryMode = mode();
    surface.classList.toggle('gallery-3d-dark', mode() === 'dark');
    paintWorks(); showRoomDoors(); updateCopy(); updateMap(); applyBackdrop();
    if (transition && !reduced()) {
      view.classList.remove('museum-transition');
      void view.offsetWidth;
      view.classList.add('museum-transition');
    }
    const chosen = focusedCard();
    if (chosen) {
      const index = cards.indexOf(chosen);
      document.dispatchEvent(new CustomEvent('oibung-gallery-jump', {
        detail: { index, fromScene: true }
      }));
    }
  }
  function darkMode() { return mode() === 'dark'; }
  function refreshLighting(previousDark) {
    const dark = darkMode();
    stage.dataset.galleryMode = mode();
    surface.classList.toggle('gallery-3d-dark', dark);
    el('museum-mode-button').textContent = dark ? '☀ 조명 켜기' : '☾ 소등';
    el('museum-torch-button').hidden = !dark;
    stage.classList.toggle('museum-torch-off', !torchOn);
    if (ambienceGain && audioContext) {
      ambienceGain.gain.setTargetAtTime(dark && soundEnabled ? .045 : 0, audioContext.currentTime, .25);
    }
    if (dark && !previousDark && flickerEnabled && !reduced()) {
      stage.classList.remove('museum-flicker');
      void stage.offsetWidth;
      stage.classList.add('museum-flicker');
    } else stage.classList.remove('museum-flicker');
    applyBackdrop();
  }
  function switchMode() {
    const destination = darkMode() ? 'light' : 'dark';
    document.querySelector('[data-gallery-mode-choice="' + destination + '"]')?.click();
  }
  function toggleTorch() {
    torchOn = !torchOn;
    el('museum-torch-button').textContent = torchOn ? '손전등 켬 · F' : '손전등 끔 · F';
    stage.classList.toggle('museum-torch-off', !torchOn);
  }
  function startAmbience() {
    if (audioContext) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      audioContext = new Audio();
      const seconds = 3;
      const buffer = audioContext.createBuffer(1, seconds * audioContext.sampleRate, audioContext.sampleRate);
      const array = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < array.length; i++) {
        last = (last + .028 * (Math.random() * 2 - 1)) / 1.028;
        array[i] = last * 3.4;
      }
      ambience = audioContext.createBufferSource();
      ambience.buffer = buffer; ambience.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 340;
      ambienceGain = audioContext.createGain();
      ambienceGain.gain.value = 0;
      ambience.connect(filter); filter.connect(ambienceGain);
      ambienceGain.connect(audioContext.destination); ambience.start();
    } catch (error) {
      soundEnabled = false;
      el('museum-sound-option').checked = false;
      console.warn('[Museum] Environmental audio unavailable:', error);
    }
  }
  function isFreeToNavigate(event) {
    return window.OIBUNG_CURRENT_VIEW !== 'reviews' &&
      !document.querySelector('dialog[open]') &&
      !event.target.closest('input, textarea, select, [contenteditable="true"]') &&
      !event.ctrlKey && !event.altKey && !event.metaKey;
  }
  el('museum-enter').addEventListener('click', () => changeArea('lobby'));
  el('museum-left').addEventListener('click', () => move(-1));
  el('museum-right').addEventListener('click', () => move(1));
  el('museum-forward').addEventListener('click', approach);
  el('museum-back').addEventListener('click', back);
  el('museum-approach').addEventListener('click', approach);
  el('museum-details').addEventListener('click', openDetails);
  el('museum-mode-button').addEventListener('click', switchMode);
  el('museum-torch-button').addEventListener('click', toggleTorch);
  el('museum-map-button').addEventListener('click', () => map.showModal());
  el('museum-map-close').addEventListener('click', () => map.close());
  map.addEventListener('click', event => { if (event.target === map) map.close(); });
  el('museum-flicker-option').addEventListener('change', event => { flickerEnabled = event.target.checked; });
  el('museum-sound-option').addEventListener('change', async event => {
    soundEnabled = event.target.checked;
    if (soundEnabled) { startAmbience(); await audioContext?.resume?.(); }
    refreshLighting(darkMode());
  });
  const guideRoot = el('gallery-guide');
  function syncGuide() {
    const visible = !guideRoot?.hidden;
    guidance.hidden = !visible;
    guideShow.hidden = visible;
  }
  el('museum-guide-toggle').addEventListener('click', () => {
    if (guideRoot && !guideRoot.hidden) el('menu-toggle-guide')?.click();
    else { guidance.hidden = true; guideShow.hidden = false; }
  });
  guideShow.addEventListener('click', () => {
    if (guideRoot?.hidden) el('menu-toggle-guide')?.click();
    else { guidance.hidden = false; guideShow.hidden = true; }
  });
  if (guideRoot) new MutationObserver(syncGuide).observe(guideRoot, { attributes:true, attributeFilter:['hidden'] });
  document.addEventListener('keydown', event => {
    if (!isFreeToNavigate(event)) return;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','e','E','Escape','m','M','f','F'].includes(event.key)) return;
    if (event.target.closest?.('button, a') && !surface.contains(event.target)) return;
    if (event.key === 'ArrowLeft') move(-1);
    else if (event.key === 'ArrowRight') move(1);
    else if (event.key === 'ArrowUp' || event.key === 'Enter') approach();
    else if (event.key === 'ArrowDown' || event.key === 'Escape') back();
    else if (event.key.toLowerCase() === 'e') openDetails();
    else if (event.key.toLowerCase() === 'm') map.showModal();
    else if (event.key.toLowerCase() === 'f' && darkMode()) toggleTorch();
    event.preventDefault();
  }, true);
  // A virtual flashlight is cheaper than a WebGL shadow pass; only pointer movement updates it.
  surface.addEventListener('pointermove', event => {
    if (!darkMode() || !torchOn || pointerFrame) return;
    const bounds = view.getBoundingClientRect();
    pointer = { x: (event.clientX - bounds.left) / bounds.width * 100,
      y: (event.clientY - bounds.top) / bounds.height * 100 };
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      view.style.setProperty('--torch-x', Math.max(0, Math.min(100,pointer.x)) + '%');
      view.style.setProperty('--torch-y', Math.max(0, Math.min(100,pointer.y)) + '%');
    });
  }, { passive:true });
  document.addEventListener('oibung-gallery-jump', event => {
    if (event.detail?.fromScene || !Number.isInteger(event.detail?.index)) return;
    const card = cards[event.detail.index];
    if (card) {
      const half = Math.ceil(cards.length / 2);
      pushState();
      scene.area = event.detail.index < half ? 'left' : 'right';
      scene.selected = event.detail.index < half ? event.detail.index : event.detail.index - half;
      scene.page = Math.floor(scene.selected / 3);
      scene.zoom = false;
      render(true);
    }
  });
  let rebuildScheduled = false;
  new MutationObserver(() => {
    if (rebuildScheduled) return;
    rebuildScheduled = true;
    requestAnimationFrame(() => { rebuildScheduled = false; render(); });
  }).observe(grid, { childList:true });
  let previousDark = darkMode();
  new MutationObserver(() => {
    const nextDark = darkMode();
    refreshLighting(previousDark);
    previousDark = nextDark;
  }).observe(root, {attributes:true,attributeFilter:['data-gallery-mode']});
  document.addEventListener('oibung-page-changed', event => {
    if (event.detail?.page !== 'games' && audioContext && ambienceGain)
      ambienceGain.gain.setTargetAtTime(0, audioContext.currentTime, .15);
    else refreshLighting(darkMode());
  });
  if (mobileScene.addEventListener) mobileScene.addEventListener('change', applyBackdrop);
  else mobileScene.addListener?.(applyBackdrop);
  surface.hidden = false;
  document.body.classList.add('three-gallery-ready', 'scene-gallery-ready');
  syncGuide();
  render();
  refreshLighting(darkMode());
})();
