/*
 * OIBUNG GALLERY — optional exhibition directory.
 * Visitors can walk from artwork to artwork, or open a discreet room map.
 * Uses the same live catalog DOM and does not alter editing/reviews.
 */
(() => {
  'use strict';
  const hall = document.getElementById('walk-gallery');
  const grid = document.getElementById('game-grid');
  if (!hall || !grid) return;

  const dock = document.createElement('div');
  dock.className = 'gallery-room-map';
  dock.innerHTML = [
    '<button class="gallery-room-map-toggle" type="button" aria-expanded="false" aria-controls="gallery-room-map-panel">',
      '<span aria-hidden="true">◇</span><span>전시 지도</span>',
    '</button>',
    '<section class="gallery-room-map-panel" id="gallery-room-map-panel" aria-label="전시 지도" hidden>',
      '<h2>전시실 안내</h2>',
      '<p>작품을 선택하면 해당 전시실로 이동합니다.</p>',
      '<ol class="gallery-room-map-list"></ol>',
    '</section>'
  ].join('');
  hall.appendChild(dock);

  const toggle = dock.querySelector('.gallery-room-map-toggle');
  const panel = dock.querySelector('.gallery-room-map-panel');
  const list = dock.querySelector('.gallery-room-map-list');
  let buttons = [];
  let activeIndex = 0;

  function openMap(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      (buttons[activeIndex] || buttons[0])?.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
  }

  function markCurrent(index) {
    activeIndex = Number.isInteger(index) ? index : 0;
    buttons.forEach((button, i) => {
      const active = i === activeIndex;
      button.setAttribute('aria-current', active ? 'location' : 'false');
      button.parentElement.classList.toggle('is-current', active);
    });
  }

  function syncRooms() {
    const cards = [...grid.querySelectorAll(':scope > .game-card')];
    const active = cards.findIndex(card => card.classList.contains('walk-room-current'));
    dock.hidden = cards.length === 0;
    const fragment = document.createDocumentFragment();
    buttons = [];
    cards.forEach((card, index) => {
      const name = card.querySelector('h3')?.textContent?.trim() || '이름 없는 작품';
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', (index + 1) + '번 전시실 ' + name + ' 이동');
      const number = document.createElement('span');
      number.className = 'gallery-room-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.textContent = name;
      button.append(number, label);
      button.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('oibung-gallery-jump', {
          detail: { index }
        }));
        openMap(false);
        document.getElementById('walk-gallery-viewport')?.focus({ preventScroll: true });
      });
      item.appendChild(button);
      fragment.appendChild(item);
      buttons.push(button);
    });
    list.replaceChildren(fragment);
    markCurrent(Math.max(0, active));
  }

  toggle.addEventListener('click', () => openMap(panel.hidden));
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !dock.contains(event.target)) openMap(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      openMap(false);
    }
  });
  document.addEventListener('oibung-exhibit-change', event => {
    const index = event.detail?.index ?? 0;
    markCurrent(index);
    const current = grid.querySelector('.game-card.walk-room-current');
    const id = String(current?.dataset.gameId || '').toLocaleLowerCase('ko-KR');
    const label = String(current?.querySelector('h3')?.textContent || '').toLocaleLowerCase('ko-KR');
    const theme = id.includes('oden') || label.includes('오든') ? 'knight'
      : id.includes('furry') || label.includes('퍼리') ? 'maid'
      : id.includes('arena') || label.includes('아레나') ? 'arena'
      : id.includes('ochams') || label.includes('오이챔스') ? 'duelist'
      : id.includes('campus') || label.includes('대학전선') ? 'commander' : 'gallery';
    document.getElementById('games')?.setAttribute('data-gallery-world', theme);
  });
  document.addEventListener('oibung-page-changed', () => {
    if (!panel.hidden) openMap(false);
  });
  new MutationObserver(syncRooms).observe(grid, { childList: true });
  syncRooms();
})();
