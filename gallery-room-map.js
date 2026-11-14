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
      '<p>성의 중앙 로비와 2층에 흩어진 액자들을 찾아보세요.</p>',
      '<canvas class="gallery-hub-schematic" width="320" height="218" role="img" aria-label="중앙 로비 평면도. 황금 점은 액자, 민트 점은 내 위치입니다." hidden></canvas>',
      '<ol class="gallery-room-map-list"></ol>',
    '</section>'
  ].join('');
  hall.appendChild(dock);

  const toggle = dock.querySelector('.gallery-room-map-toggle');
  const panel = dock.querySelector('.gallery-room-map-panel');
  const list = dock.querySelector('.gallery-room-map-list');
  const schematic=dock.querySelector('.gallery-hub-schematic');
  let layout=[],visitor=null;
  let buttons=[];
  let activeIndex=0;
  function paintSchematic(){
    if(!layout.length){schematic.hidden=true;return;}
    schematic.hidden=false;
    const ctx=schematic.getContext('2d');
    if(!ctx)return;
    const W=schematic.width,H=schematic.height,s=9.2;
    const X=x=>W/2+x*s,Z=z=>H/2+z*s;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#141a21';ctx.fillRect(0,0,W,H);
    ctx.lineWidth=3;ctx.strokeStyle='#c3a779';
    ctx.fillStyle='#293a42';
    ctx.fillRect(X(-9.6),Z(-9.6),19.2*s,19.2*s);
    ctx.strokeRect(X(-9.6),Z(-9.6),19.2*s,19.2*s);
    // Main floor, arch doorway, 2nd level and real staircase.
    ctx.fillStyle='#39545a';ctx.fillRect(X(-7.8),0,15.6*s,Z(-9.6));
    ctx.strokeStyle='#c4a575';ctx.beginPath();
    ctx.moveTo(X(-3.4),Z(-9.6));ctx.lineTo(X(3.4),Z(-9.6));ctx.stroke();
    ctx.fillStyle='#725d8b8f';
    ctx.fillRect(X(5.55),Z(-6.65),(9.3-5.55)*s,(1.88+6.65)*s);
    ctx.fillStyle='#baa777';
    ctx.fillRect(X(5.55),Z(1.88),(9.3-5.55)*s,(6.38-1.88)*s);
    for(let i=0;i<10;i++){
      ctx.strokeStyle='#dec795';ctx.lineWidth=.7;
      const z=6.38-i*.45;
      ctx.beginPath();ctx.moveTo(X(5.55),Z(z));ctx.lineTo(X(9.3),Z(z));ctx.stroke();
    }
    ctx.strokeStyle='#caa66c';ctx.lineWidth=2;ctx.beginPath();
    ctx.arc(X(0),Z(2.3),2.40*s,0,Math.PI*2);ctx.stroke();
    // Paintings are positioned using the exact dynamic world coordinates.
    const painted=[];
    layout.forEach((p,i)=>{
      if(p.z<-10){painted.push(i);return;}
      const x=X(p.x),y=Z(p.z);
      ctx.fillStyle=i===activeIndex?'#fff1c3':'#d7ad65';
      ctx.beginPath();ctx.arc(x,y,i===activeIndex?5.4:3.6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#17232b';ctx.font='700 9px sans-serif';
      ctx.textAlign='center';ctx.fillText(String(i+1),x,y-8);
    });
    if(painted.length){
      ctx.fillStyle='#d2bf98';ctx.font='600 11px sans-serif';ctx.textAlign='center';
      ctx.fillText('안쪽 전시 복도  '+painted.length+'점',W/2,13);
    }
    if(visitor&&visitor.room==='hall'){
      const x=X(Math.max(-10,Math.min(10,visitor.x)));
      const y=Z(Math.max(-10,Math.min(10,visitor.z)));
      ctx.fillStyle='#7ee3ca';ctx.beginPath();ctx.arc(x,y,5.1,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#152e31';ctx.lineWidth=1.8;ctx.stroke();
      ctx.strokeStyle='#caffed';ctx.lineWidth=2.1;ctx.beginPath();
      const yaw=visitor.yaw||0;
      ctx.moveTo(x,y);
      ctx.lineTo(x-Math.sin(yaw)*11,y-Math.cos(yaw)*11);
      ctx.stroke();
    }
    ctx.fillStyle='#e3d5bb';ctx.font='600 11px sans-serif';
    ctx.textAlign='left';ctx.fillText('◇ 로비',13,H-12);
    ctx.fillStyle='#9adcca';ctx.textAlign='right';ctx.fillText('● 나',W-13,H-12);
  }


  function openMap(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      paintSchematic();
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
    if(!panel.hidden)paintSchematic();
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
    if (event.code === 'KeyM' && document.body.classList.contains('three-gallery-ready')
      && !dock.hidden && !document.querySelector('dialog[open]')
      && !event.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault();
      openMap(panel.hidden);
      return;
    }
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
  document.addEventListener('oibung-gallery-layout',event=>{
    layout=Array.isArray(event.detail?.placements)?event.detail.placements:[];
    if(!panel.hidden)paintSchematic();
  });
  document.addEventListener('oibung-gallery-player-motion',event=>{
    visitor=event.detail||null;
    if(!panel.hidden)paintSchematic();
  });
  new MutationObserver(syncRooms).observe(grid, { childList: true });
  syncRooms();
})();
