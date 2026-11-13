/*
 * Oibung Gallery — exhibition introductions by the guide.
 * Data-driven from registered games. Speech remains opt-in; no server or AI API.
 */
(() => {
  'use strict';

  const root = document.getElementById('gallery-guide');
  const sprite = document.getElementById('gallery-guide-image');
  const intro = document.getElementById('gallery-guide-intro');
  const title = document.getElementById('gallery-guide-intro-title');
  const description = document.getElementById('gallery-guide-intro-description');
  const voiceButton = document.getElementById('gallery-guide-voice');
  const detailButton = document.getElementById('gallery-guide-intro-detail');
  if (!root || !sprite || !intro || !title || !description || !voiceButton || !detailButton) return;

  const poses = ['calm', 'present', 'welcome'];
  const sources = Object.fromEntries(poses.map(pose => [
    pose, 'assets/guide-hires-' + pose + '.webp?v=curator-1'
  ]));
  // Preload the original-resolution illustration poses so subsequent artworks
  // can dissolve smoothly without a blank frame or stretched scene photo.
  const preloaded = [];
  for (const pose of poses) {
    const image = new Image();
    image.decoding = 'async';
    image.src = sources[pose];
    preloaded.push(image);
  }

  let timer = 0;
  let generation = 0;
  let voiceEnabled = false;
  let activeNarration = '';
  let speaking = false;
  const canSpeak = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

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
      body: '지금 전시 중인 작품이 없어요. 메뉴에서 검색 조건을 확인해 주세요.',
      speech: ''
    };
    const work = String(game.title || '이 작품');
    const developer = game.developer ? '제작자는 ' + trimText(game.developer, 60) + '입니다. ' : '';
    const genre = game.genre ? trimText(game.genre, 60) + ' 작품으로, ' : '';
    const detail = trimText(game.description || game.tagline || '', 160);
    const body = developer + (genre ? genre : '') +
      (detail || '액자를 선택하면 이 작품을 자세히 살펴볼 수 있어요.');
    return {
      title: work,
      body,
      speech: '이번에 소개할 작품은 ' + work + '입니다. ' + body
    };
  }

  function stopSpeech() {
    speaking = false;
    if (canSpeak) {
      try { window.speechSynthesis.cancel(); }
      catch { /* Browser may suspend audio on background tabs. */ }
    }
    voiceButton.textContent = voiceEnabled ? '음성 안내 켜짐' : '음성으로 듣기';
    voiceButton.setAttribute('aria-pressed', String(voiceEnabled));
  }

  function narrate() {
    if (!voiceEnabled || !canSpeak || !activeNarration || root.hidden ||
        document.body.classList.contains('reviews-open') ||
        document.querySelector('dialog[open]')) return;

    stopSpeech();
    const utterance = new window.SpeechSynthesisUtterance(activeNarration);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.98;
    utterance.pitch = 1.04;
    const koreanVoice = window.speechSynthesis.getVoices?.()
      .find(voice => String(voice.lang).toLowerCase().startsWith('ko'));
    if (koreanVoice) utterance.voice = koreanVoice;
    utterance.onstart = () => { speaking = true; voiceButton.textContent = '음성 안내 끄기'; };
    utterance.onend = () => {
      speaking = false;
      voiceButton.textContent = voiceEnabled ? '음성 안내 켜짐' : '음성으로 듣기';
    };
    utterance.onerror = () => {
      speaking = false;
      voiceButton.textContent = voiceEnabled ? '음성 안내 켜짐' : '음성으로 듣기';
    };
    window.speechSynthesis.speak(utterance);
  }

  function showExhibit(index = 0, animate = true) {
    clearTimeout(timer);
    const token = ++generation;
    stopSpeech();

    const pose = poses[Math.abs(Number(index) || 0) % poses.length];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('motion-off');

    if (animate && !reduceMotion && !root.hidden) intro.classList.add('is-changing');

    const install = () => {
      if (token !== generation) return; // Rapid wheel navigation: newest work wins.
      const game = currentGame();
      const copy = introduction(game);

      sprite.src = sources[pose];
      title.textContent = copy.title;
      description.textContent = copy.body;
      activeNarration = copy.speech;
      intro.hidden = !game || root.hidden;
      voiceButton.hidden = !canSpeak;
      detailButton.disabled = !game;

      requestAnimationFrame(() => {
        intro.classList.remove('is-changing');
        if (voiceEnabled) narrate();
      });
    };

    if (animate && !reduceMotion && !root.hidden) timer = window.setTimeout(install, 390);
    else install();
  }

  function currentIndex() {
    const cards = [...document.querySelectorAll('#game-grid .game-card')];
    const active = cards.findIndex(card => card.classList.contains('walk-room-current'));
    return Math.max(0, active);
  }

  voiceButton.hidden = !canSpeak;
  voiceButton.setAttribute('aria-pressed', 'false');
  voiceButton.addEventListener('click', () => {
    if (!canSpeak) return;
    voiceEnabled = !voiceEnabled;
    if (voiceEnabled) {
      voiceButton.textContent = '음성 안내 끄기';
      narrate();
    } else stopSpeech();
  });

  detailButton.addEventListener('click', () => {
    const active = document.querySelector('#game-grid .game-card.walk-room-current');
    active?.querySelector('[data-details]')?.click();
  });

  document.addEventListener('oibung-exhibit-change', event => {
    showExhibit(event.detail?.index ?? currentIndex(), true);
  });
  document.addEventListener('oibung-page-changed', event => {
    if (event.detail?.page !== 'games') stopSpeech();
    else showExhibit(currentIndex(), false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && speaking) stopSpeech();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSpeech();
  });
  // The guide visibility toggle already exists in gallery-guide.js.
  const visibilityObserver = new MutationObserver(() => {
    if (root.hidden) {
      intro.hidden = true;
      stopSpeech();
    } else showExhibit(currentIndex(), false);
  });
  visibilityObserver.observe(root, { attributes: true, attributeFilter: ['hidden'] });

  showExhibit(currentIndex(), false);
})();
