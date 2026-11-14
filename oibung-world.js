/*
 * OIBUNG WORLD — a pixel side-scrolling museum of friends' games.
 *
 * The pixel world is an original procedural Canvas 2D scene; artwork, creator
 * details, comments and uploads are still rendered by the existing catalog.
 * No WebGL, external image service or new database.
 */
(() => {
  'use strict';
  const world = document.getElementById('oibung-world');
  if (!world) return;
  const canvas = document.getElementById('oibung-world-canvas');
  const stage = document.getElementById('oibung-world-stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const signs = document.getElementById('world-signs');
  const counter = document.getElementById('world-count');
  const nearbyLabel = document.getElementById('world-nearby');
  const guideBubble = document.getElementById('world-guide-bubble');
  const jumpSelect = document.getElementById('world-jump-select');
  const interactButton = document.getElementById('world-enter');
  const controls = [...world.querySelectorAll('[data-world-move]')];
  const jumpButton = world.querySelector('[data-world-jump]');
  const listButton = document.getElementById('world-list-toggle');
  const list = document.getElementById('world-directory');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!ctx) return;

  const LOGICAL_PIXEL_SIZE = 2;
  const MOVE_SPEED = 145;
  const BUILDING_SPACING = 300;
  const FIRST_BUILDING = 290;
  const GRAVITY = 720;
  const colors = {
    castle: {sky:'#392b50',far:'#65546a',facade:'#4d3948',wall:'#75616b',roof:'#342639',accent:'#e66e73',trim:'#d9a57a',window:'#e7a48b'},
    arena:  {sky:'#2b5877',far:'#5d9a9d',facade:'#946b54',wall:'#c79d72',roof:'#795345',accent:'#6debe1',trim:'#f6d38e',window:'#6be4e2'},
    duel:   {sky:'#484c79',far:'#8588ba',facade:'#535e85',wall:'#8d9dc2',roof:'#2d385e',accent:'#f1a5aa',trim:'#ede0b5',window:'#f5d493'},
    tactics:{sky:'#416f80',far:'#7ba5a0',facade:'#687a72',wall:'#adbd9a',roof:'#42564c',accent:'#b8e9a2',trim:'#f5e1a0',window:'#def3bd'},
    cat:    {sky:'#87678e',far:'#c6a5bd',facade:'#c995b4',wall:'#e2bdd0',roof:'#9b658e',accent:'#ffe7ab',trim:'#fff4dd',window:'#fff0c8'},
    studio: {sky:'#416a7a',far:'#7fa1a0',facade:'#607787',wall:'#9cb1b5',roof:'#3a5866',accent:'#f3b87b',trim:'#e8dcca',window:'#c6efe2'},
    tower:  {sky:'#635477',far:'#aea0a8',facade:'#86768b',wall:'#c3b4c0',roof:'#524b6d',accent:'#fad48c',trim:'#fff0bb',window:'#f6dc9e'}
  };

  function themeOf(game, index) {
    const match = (String(game?.title || '')+' '+String(game?.english || '')+' '+String(game?.genre || '')+' '+String(game?.id || '')).toLowerCase();
    if (/오든링|oden.?ring|elden|소울라이크|보스 러시/.test(match)) return 'castle';
    if (/아레나|arena|핀볼|ballfight|콜로세움/.test(match)) return 'arena';
    if (/퍼리|furry|고양이|cat/.test(match)) return 'cat';
    if (/오이챔스|ochams|대전|duel|배틀/.test(match)) return 'duel';
    if (/대학전선|frontier|캠퍼스|전략|strategy/.test(match)) return 'tactics';
    const keys=['studio','tower','arena','cat','duel','tactics'];
    let h=0;for(const character of match)h=(h*33+character.charCodeAt(0))|0;
    return keys[Math.abs(h)%keys.length]||keys[index%keys.length];
  }
  function hash(input) {
    let value=2166136261;
    for(const ch of String(input)) {value=Math.imul(value^ch.charCodeAt(0),16777619);}
    return value>>>0;
  }
  function mix(a,b,t) {
    const aa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16));
    const bb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
    return '#'+aa.map((v,i)=>Math.round(v*(1-t)+bb[i]*t).toString(16).padStart(2,'0')).join('');
  }
  const rect = (x,y,w,h,c) => {
    if(w<=0||h<=0)return;
    ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
  };
  function line(x1,y1,x2,y2,c,width=1){
    ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();
    ctx.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);
    ctx.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);ctx.stroke();
  }
  function polygon(points,c){
    ctx.fillStyle=c;ctx.beginPath();
    ctx.moveTo(Math.round(points[0][0]),Math.round(points[0][1]));
    for(let i=1;i<points.length;i++)ctx.lineTo(Math.round(points[i][0]),Math.round(points[i][1]));
    ctx.closePath();ctx.fill();
  }
  function circle(x,y,r,c) {
    ctx.fillStyle=c;ctx.beginPath();ctx.arc(Math.round(x),Math.round(y),r,0,Math.PI*2);ctx.fill();
  }
  function roundedFlag(x,y,c){rect(x,y,2,24,'#f1d4b0');rect(x+2,y+1,13,8,c);rect(x+14,y+3,4,4,c);}
  function outline(x,y,w,h,fill,edge='#2e2638'){rect(x-2,y-2,w+4,h+4,edge);rect(x,y,w,h,fill);}
  function brickwork(x,y,w,h,face,highlight,seed=0) {
    rect(x,y,w,h,face);
    for(let row=0;row<h;row+=13){
      rect(x,y+row,w,1,highlight);
      const phase=((row/13+seed)%2)*13;
      for(let col=-phase;col<w;col+=26)rect(x+col,y+row,1,12,highlight);
    }
  }
  function pixelStars(viewW,viewH,camera,time){
    const offset=Math.round(camera*.08);
    for(let i=0;i<43;i++){
      const x=((i*137+37-offset)%(viewW+40)+viewW+40)%(viewW+40);
      const y=(i*59+21)%(Math.max(50,viewH*.6));
      rect(x,y,(i%5===0?2:1),(i%5===0?2:1),i%2?'#f9d9b3':'#e1d6e8');
    }
  }

  let games=[],buildings=[],signButtons=[],nearest=-1;
  let W=640,H=330,groundY=276,worldEnd=1550,camera=0;
  let lastFrame=0,elapsed=0,frameId=0,paused=false;
  let player={x:165,y:0,vx:0,vy:0,direction:1,walk:0,onGround:true};
  let curator={x:111,direction:1,walk:0};
  let keys={left:false,right:false};
  let guideText='환영합니다! 오른쪽으로 걸어가면 게임들이 있어요.';
  let guideTextUntil=0;
  let justWarped=false;
  let inputIsActive=false;

  function canRun(){
    return !document.hidden&&window.OIBUNG_CURRENT_VIEW!=='reviews'&&
      !document.querySelector('dialog[open]')&&world.isConnected;
  }
  function listCatalog(){
    const api=window.OIBUNG_CATALOG;
    if(api&&typeof api.listGames==='function')return api.listGames().filter(g=>g&&g.id&&g.title);
    return Array.isArray(window.OIBUNG_GAMES)?window.OIBUNG_GAMES.filter(g=>g&&g.id&&g.title):[];
  }
  function rebuild(){
    const next=listCatalog();
    const oldId=nearest>=0?buildings[nearest]?.game.id:null;
    const previousX=player.x;
    games=next;
    buildings=next.map((game,i)=>{
      const style=themeOf(game,i);
      const width=(style==='castle'?191:style==='arena'?198:style==='tactics'?186:177);
      return {game,index:i,x:FIRST_BUILDING+i*BUILDING_SPACING,width,height:style==='castle'?211:style==='arena'?174:style==='tower'?213:184,style,seed:hash(game.id)};
    });
    worldEnd=FIRST_BUILDING+next.length*BUILDING_SPACING+210;
    if(justWarped&&oldId){
      const b=buildings.find(item=>item.game.id===oldId);
      if(b)player.x=b.x+b.width*.5;
    }else if(previousX>worldEnd-60) player.x=Math.max(80,worldEnd-90);
    nearest=-1;
    jumpSelect.replaceChildren(new Option('건물 바로 찾기',''));
    list.replaceChildren();
    signs.replaceChildren();
    signButtons=[];
    for(const b of buildings){
      jumpSelect.add(new Option(b.game.title,String(b.game.id)));
      const button=document.createElement('button');
      button.type='button';button.className='world-building-sign';
      button.textContent=b.game.title;button.title=b.game.title+' 건물로 이동';
      button.setAttribute('aria-label',b.game.title+' 건물로 이동');
      button.addEventListener('click',()=>{warp(b.index);stage.focus({preventScroll:true});});
      signs.append(button);
      signButtons.push(button);
      const item=document.createElement('button');
      item.type='button';item.className='world-directory-item';
      const number=document.createElement('span');
      number.className='world-directory-number';number.textContent=String(b.index+1).padStart(2,'0');
      const name=document.createElement('strong');name.textContent=b.game.title;
      const category=document.createElement('small');category.textContent=b.game.genre||'오이붕 월드';
      item.append(number,name,category);
      item.addEventListener('click',()=>{warp(b.index);list.hidden=true;listButton.setAttribute('aria-expanded','false');stage.focus({preventScroll:true});});
      list.append(item);
    }
    counter.textContent=games.length+'개 게임의 세계';
    if(!games.length)nearbyLabel.textContent='등록된 게임이 생기면 이곳에 건물이 등장합니다.';
    updateNearby(true);
  }
  function resize(){
    const size=stage.getBoundingClientRect();
    // One logical pixel corresponds to two CSS pixels at all DPRs.
    W=Math.max(160,Math.floor(size.width/LOGICAL_PIXEL_SIZE));
    H=Math.max(130,Math.floor(size.height/LOGICAL_PIXEL_SIZE));
    groundY=H-37;
    canvas.width=W;canvas.height=H;
    ctx.imageSmoothingEnabled=false;
    camera=Math.max(0,Math.min(camera,Math.max(0,worldEnd-W)));
    updateSigns();
  }
  function buildingScale(b){return Math.min(1,Math.max(.34,(groundY-19)/(b.height+36)));}
  function updateSigns(){
    signs.style.pointerEvents='none';
    for(let i=0;i<signButtons.length;i++){
      const b=buildings[i],button=signButtons[i];
      const sx=(b.x+b.width*.5-camera)*LOGICAL_PIXEL_SIZE;
      const sy=(groundY-(b.height-33)*buildingScale(b))*LOGICAL_PIXEL_SIZE;
      const visible=sx>-90&&sx<stage.clientWidth+90;
      button.hidden=!visible;
      if(visible){
        button.style.left=Math.round(sx)+'px';
        button.style.top=Math.round(Math.max(12,sy))+'px';
      }
    }
  }
  function warp(i){
    const b=buildings[i];if(!b)return;
    player.x=b.x+b.width*.5-1;
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;
    curator.x=player.x-50;
    const target=Math.max(0,Math.min(worldEnd-W,player.x-W*.5));
    camera=target;justWarped=true;
    updateNearby(true);updateSigns();render();
  }
  function nearbyBuilding(){
    let result=-1,dist=76;
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i];
      const d=Math.abs(player.x-(b.x+b.width*.5));
      if(d<=dist){dist=d;result=i;}
    }
    return result;
  }
  function announce(text,seconds=4){
    guideText=text;guideTextUntil=elapsed+seconds;
    guideBubble.textContent=text;
  }
  function updateNearby(force=false){
    const n=nearbyBuilding();
    if(n!==nearest||force){
      nearest=n;
      if(n>=0){
        const b=buildings[n],g=b.game;
        nearbyLabel.textContent=g.title+' · '+(g.tagline||g.genre||'친구가 만든 작품');
        interactButton.disabled=false;
        interactButton.textContent='건물 들어가기';
        if(n!==-1)announce((g.title)+'! '+(g.tagline||'제가 이 작품을 소개해 드릴게요.'),6);
      }else{
        nearbyLabel.textContent=games.length?'←  → 이동해서 마음에 드는 건물을 찾으세요.':'첫 게임이 등록되면 건물이 생깁니다.';
        interactButton.disabled=true;
        interactButton.textContent='입구에 가까이';
        if(force)announce('여긴 오이붕 월드! 친구들이 만든 게임의 거리를 함께 걸어요.',6);
      }
    }
    if(!games.length)interactButton.disabled=true;
  }
  function enter(){
    if(nearest<0)return false;
    const b=buildings[nearest];
    if(!b)return false;
    const api=window.OIBUNG_CATALOG;
    if(!api||typeof api.openDetail!=='function')return false;
    announce(b.game.title+'을(를) 소개할게요!',3);
    const detail=document.getElementById('game-dialog');
    if(detail)detail.dataset.worldTheme=b.style;
    const bannerName=document.getElementById('world-interior-name');
    if(bannerName)bannerName.textContent=b.game.title+'의 세계';
    api.openDetail(b.game.id);
    return true;
  }
  function jump(){
    if(!player.onGround)return;
    player.vy=-258;player.onGround=false;
  }
  function movement(code,down){
    if(code==='left'||code==='right'){
      keys[code]=down;
      inputIsActive=keys.left||keys.right;
    }else if(code==='jump'&&down)jump();
  }
  for(const button of controls){
    const direction=button.dataset.worldMove;
    button.addEventListener('pointerdown',event=>{
      if(button.disabled)return;
      button.setPointerCapture?.(event.pointerId);
      movement(direction,true);event.preventDefault();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])
      button.addEventListener(type,()=>movement(direction,false));
    button.addEventListener('contextmenu',e=>e.preventDefault());
  }
  jumpButton?.addEventListener('click',()=>{if(canRun())jump();});
  interactButton.addEventListener('click',enter);
  jumpSelect.addEventListener('change',()=>{
    if(!jumpSelect.value)return;
    const n=buildings.findIndex(b=>String(b.game.id)===jumpSelect.value);
    if(n>=0)warp(n);
    jumpSelect.value='';
  });
  listButton.addEventListener('click',()=>{
    list.hidden=!list.hidden;
    listButton.setAttribute('aria-expanded',String(!list.hidden));
  });
  world.addEventListener('click',e=>{
    if(e.target!==canvas)return;
    const rect=canvas.getBoundingClientRect();
    const x=(e.clientX-rect.left)/LOGICAL_PIXEL_SIZE+camera;
    const y=(e.clientY-rect.top)/LOGICAL_PIXEL_SIZE;
    const idx=buildings.findIndex(b=>x>=b.x-12&&x<=b.x+b.width+12&&y>groundY-b.height-25&&y<groundY+8);
    if(idx<0)return;
    if(nearest===idx)enter();
    else warp(idx);
    stage.focus({preventScroll:true});
  });
  window.addEventListener('keydown',e=>{
    if(!canRun()||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
    const target=e.target;
    if(target?.closest?.('input,textarea,select,dialog,[contenteditable],button'))return;
    const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
    if(map[e.code]){
      movement(map[e.code],true);e.preventDefault();return;
    }
    if(e.code==='KeyE'||e.code==='Enter'){
      if(nearbyBuilding()>=0){enter();e.preventDefault();}
    }
    if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){
      jump();e.preventDefault();
    }
  });
  window.addEventListener('keyup',e=>{
    const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
    if(map[e.code])movement(map[e.code],false);
  });
  document.getElementById('game-dialog')?.addEventListener('close',e=>{
    delete e.currentTarget.dataset.worldTheme;
  });
  window.addEventListener('blur',()=>{keys.left=false;keys.right=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.left=false;keys.right=false;}});
  document.addEventListener('oibung-catalog-updated',rebuild);
  document.addEventListener('oibung-page-changed',()=>{
    keys.left=false;keys.right=false;
    if(window.OIBUNG_CURRENT_VIEW==='games')resize();
  });

  function drawSky(){
    let theme='tactics';
    let best=Infinity;
    for(const b of buildings){
      const d=Math.abs(player.x-(b.x+b.width*.5));
      if(d<best){best=d;theme=b.style;}
    }
    const c=colors[theme];
    for(let y=0;y<groundY;y+=3){
      rect(0,y,W,3,mix(c.sky,c.far,(y/Math.max(1,groundY))*.78));
    }
    const sunX=Math.round(W*.75-camera*.02);
    if(theme==='castle'){
      circle(sunX,47,27,'#aa6375');circle(sunX,47,20,'#d4959d');
      pixelStars(W,H,camera,elapsed);
    }else{
      circle(sunX,47,24,'#f4d7a0');circle(sunX,47,16,'#fff0be');
      for(let k=0;k<8;k++){
        const x=((k*109-camera*.16)%(W+130)+W+130)%(W+130)-60;
        const y=22+(k*41)%53;
        rect(x,y,46,9,'#ffffff43');rect(x+6,y-6,32,6,'#ffffff55');rect(x+13,y+9,22,4,'#ffffff35');
      }
    }
    // Pixel-parallax distant town and mountain silhouettes.
    for(let x=-80;x<W+100;x+=68){
      const v=(x+Math.round(camera*.18))%157;
      const h=40+(Math.abs(v*13)%41);
      polygon([[x,groundY-22],[x+35,groundY-75-h],[x+83,groundY-22]],mix(c.far,c.facade,.36));
    }
    for(let x=-60;x<W+80;x+=37){
      const elevation=32+Math.abs((x+Math.floor(camera*.34))%29);
      rect(x-Math.floor(camera*.24)%37,groundY-elevation,19,elevation,mix(c.facade,c.sky,.24));
      rect(x+4-Math.floor(camera*.24)%37,groundY-elevation-10,11,10,mix(c.facade,c.sky,.24));
      rect(x+5-Math.floor(camera*.24)%37,groundY-elevation+12,4,5,c.window);
    }
  }
  function drawGround(){
    rect(0,groundY-8,W,11,'#39544b');
    for(let x=0;x<W;x+=16){rect(x,groundY-8,8,2,'#7d9674');}
    rect(0,groundY+2,W,H-groundY-2,'#49484d');
    for(let x=-16;x<W+16;x+=23){
      const xx=x-Math.floor(camera*.95)%23;
      rect(xx,groundY+5,19,1,'#71666a');
      rect(xx+10,groundY+16,10,2,'#32383d');
    }
    rect(0,groundY+25,W,3,'#aaa18a');
    rect(0,groundY+33,W,4,'#2e3338');
  }
  function drawLamp(x,ground){
    rect(x-1,ground-88,3,88,'#39434b');rect(x-5,ground-88,11,4,'#f5c88a');
    rect(x-6,ground-84,13,17,'#3b4951');
    rect(x-3,ground-82,7,12,'#ffe4a6');rect(x-9,ground-88,19,3,'#282f39');
    rect(x-4,ground-2,9,4,'#39434b');
  }
  function drawPlaza(){
    const x=-camera;
    if(x+190<0||x>W)return;
    rect(x+4,groundY-25,165,25,'#80998a');
    rect(x+28,groundY-33,119,10,'#acbfad');
    rect(x+46,groundY-36,83,4,'#e0e0c5');
    rect(x+70,groundY-49,33,16,'#50685c');
    rect(x+76,groundY-56,21,10,'#9fb4a6');
    rect(x+84,groundY-62,5,7,'#b4d3c6');
    rect(x+17,groundY-108,140,6,'#f0d69f');
    rect(x+12,groundY-101,5,61,'#5d756b');
    rect(x+150,groundY-101,5,61,'#5d756b');
    rect(x+35,groundY-95,101,50,'#304f4b');
    rect(x+40,groundY-89,91,40,'#466c61');
    // Pixel World logo is baked into architecture, clear HTML overlay holds Korean text.
    ctx.fillStyle='#fbe9c0';
    ctx.font='bold 17px monospace';
    ctx.textAlign='center';ctx.fillText('OIBUNG',Math.round(x+85),Math.round(groundY-72));
    ctx.font='bold 13px monospace';
    ctx.fillText('WORLD',Math.round(x+85),Math.round(groundY-56));
    drawLamp(x+190,groundY);
  }
  function drawCastle(b,screenY){
    const p=colors.castle,x=b.x-camera,w=b.width,y=screenY;
    rect(x-18,y+17,37,b.height-17,p.facade);
    rect(x+w-19,y+17,37,b.height-17,p.facade);
    brickwork(x-6,y+50,w+12,b.height-50,p.facade,'#67515d');
    for(const towerX of [x-18,x+w-15]){
      brickwork(towerX,y+20,32,b.height-20,'#635061','#866474',b.index);
      rect(towerX-4,y+13,40,15,p.roof);
      for(let i=0;i<5;i++)rect(towerX-4+i*9,y+2,6,12,p.roof);
      rect(towerX+9,y+53,12,26,'#2a2d3a');rect(towerX+13,y+57,4,18,'#ee9b77');
      roundedFlag(towerX+12,y-22,'#b94658');
    }
    rect(x+20,y+36,w-40,15,'#3c293d');
    for(let i=0;i<12;i++)rect(x+17+i*13,y+27,9,12,p.roof);
    // Three stained-glass gothic windows.
    for(let i=0;i<3;i++){
      const q=x+35+i*49;
      rect(q,y+72,24,56,'#2a283b');
      rect(q+4,y+77,16,47,i===1?'#a84253':'#c17d68');
      rect(q+11,y+77,2,47,'#372b3b');
      rect(q+4,y+94,16,3,'#372b3b');
      rect(q+8,y+87,7,21,'#eac5a7');
    }
    // Moon emblem / sword sculpture above the entrance.
    rect(x+w/2-4,y+133,8,36,'#e0c9a6');
    rect(x+w/2-13,y+138,26,4,'#dcc7a4');
    rect(x+w/2-2,y+119,4,14,'#e5b7af');
  }
  function drawArena(b,screenY){
    const p=colors.arena,x=b.x-camera,w=b.width,y=screenY;
    rect(x+15,y+22,w-30,15,p.trim);
    polygon([[x+10,y+32],[x+w/2,y-8],[x+w-10,y+32]],'#d9b37a');
    rect(x+18,y+31,w-36,8,p.roof);
    brickwork(x+5,y+51,w-10,b.height-51,p.facade,'#af8f6c');
    rect(x-6,y+53,w+12,20,'#695445');rect(x-10,y+76,w+20,9,'#d6aa74');
    for(let i=0;i<7;i++){
      const q=x+12+i*25;
      rect(q,y+89,15,58,'#f3ce98');
      rect(q-3,y+88,20,6,'#dec08c');
      rect(q-2,y+146,18,6,'#85684f');
      rect(q+4,y+103,7,31,'#906849');
    }
    rect(x+22,y+40,w-44,12,'#c69466');
    rect(x+35,y+44,w-70,5,'#f2dbb0');
    for(let i=0;i<7;i++){
      const ang=i*6+elapsed*2;
      const xx=x+w/2+Math.sin(ang)*65,yy=y+18+Math.cos(ang)*13;
      rect(xx,yy,5,5,i%2?p.accent:'#fbd58f');
    }
    rect(x+5,y+10,5,51,'#593d38');
    roundedFlag(x+5,y+1,'#43c8c7');
    rect(x+w-12,y+10,5,51,'#593d38');
    roundedFlag(x+w-12,y+1,'#f5ae74');
  }
  function drawDuel(b,screenY){
    const p=colors.duel,x=b.x-camera,w=b.width,y=screenY;
    brickwork(x+4,y+56,w-8,b.height-56,p.facade,p.wall);
    for(let s=0;s<4;s++){
      polygon([[x-17+s*7,y+56-s*13],[x+w/2,y+7-s*12],[x+w+17-s*7,y+56-s*13]],s%2?p.roof:'#303b61');
      rect(x-10+s*6,y+55-s*13,w+20-s*12,4,s%2?'#e7a9a1':'#d3c7b7');
    }
    for(let i=0;i<6;i++){
      rect(x+13+i*26,y+91,15,38,'#354364');
      rect(x+17+i*26,y+95,7,23,'#f3ccad');
    }
    // Crossed practice swords, graphic identifying the battle dojo.
    const mid=x+w/2;
    line(mid-25,y+65,mid+26,y+22,'#e2e9e8',4);
    line(mid+25,y+65,mid-26,y+22,'#f1c4b4',4);
    rect(mid-30,y+55,20,5,'#f8d59d');rect(mid+10,y+55,20,5,'#f8d59d');
  }
  function drawTactics(b,screenY){
    const p=colors.tactics,x=b.x-camera,w=b.width,y=screenY;
    brickwork(x+7,y+34,w-14,b.height-34,p.facade,'#899987');
    rect(x+0,y+30,w,12,p.wall);rect(x+12,y+12,w-24,20,p.roof);
    rect(x+35,y-15,w-70,28,'#587768');
    rect(x+43,y-22,w-86,9,'#a5bd91');
    // Telescope tower + strategic banner.
    rect(x+13,y-8,35,44,'#829884');
    rect(x+10,y-15,42,9,'#c5d2a9');
    rect(x+26,y-34,4,20,'#3a514d');
    roundedFlag(x+28,y-37,'#9accc0');
    for(let i=0;i<4;i++){
      rect(x+28+i*36,y+68,23,42,'#3a5956');
      rect(x+32+i*36,y+73,15,31,'#bfe3b9');
      rect(x+38+i*36,y+76,3,24,'#698f7d');
    }
    rect(x+69,y+26,52,9,'#d9c99f');
    for(let i=0;i<6;i++)rect(x+68+i*9,y+13,6,13,'#6f8e79');
  }
  function drawCat(b,screenY){
    const p=colors.cat,x=b.x-camera,w=b.width,y=screenY;
    brickwork(x+9,y+56,w-18,b.height-56,p.facade,'#dcb2c6');
    polygon([[x+6,y+57],[x+38,y+1],[x+64,y+41]],p.roof);
    polygon([[x+w-64,y+41],[x+w-38,y+1],[x+w-6,y+57]],p.roof);
    polygon([[x-8,y+66],[x+w/2,y+13],[x+w+8,y+66]],'#ae779d');
    polygon([[x+24,y+43],[x+39,y+17],[x+50,y+49]],'#f1b3cb');
    polygon([[x+w-50,y+49],[x+w-39,y+17],[x+w-24,y+43]],'#f1b3cb');
    for(let i=0;i<3;i++){
      rect(x+31+i*42,y+88,25,44,'#925e8d');
      rect(x+35+i*42,y+92,17,34,'#fff0ce');
    }
    circle(x+w/2,y+57,12,'#fff0d9');
    rect(x+w/2-8,y+55,4,3,'#62425b');rect(x+w/2+5,y+55,4,3,'#62425b');
    rect(x+w/2-1,y+61,3,3,'#d5748c');
  }
  function drawGeneric(b,screenY){
    const p=colors[b.style],x=b.x-camera,w=b.width,y=screenY;
    brickwork(x+7,y+48,w-14,b.height-48,p.facade,p.wall,b.index);
    rect(x+2,y+43,w-4,10,p.trim);
    if(b.style==='tower'){
      rect(x+40,y-11,w-80,56,p.facade);
      rect(x+33,y-19,w-66,10,p.roof);
      rect(x+w/2-9,y-28,18,11,p.accent);
    }else{
      polygon([[x-6,y+48],[x+w/2,y-9],[x+w+6,y+48]],p.roof);
      rect(x+10,y+36,w-20,12,p.trim);
    }
    for(let row=0;row<2;row++){
      for(let col=0;col<4;col++){
        rect(x+21+col*36,y+67+row*51,18,33,p.roof);
        rect(x+24+col*36,y+70+row*51,12,26,p.window);
      }
    }
    roundedFlag(x+w/2,y-31,p.accent);
  }
  function drawDoor(b){
    const p=colors[b.style],x=b.x-camera,w=b.width;
    const doorX=x+w/2-17,doorY=groundY-51;
    outline(doorX,doorY,34,51,p.roof);
    rect(doorX+5,doorY+8,24,43,'#1a2730');
    rect(doorX+8,doorY+11,18,40,'#29363f');
    rect(doorX+21,doorY+32,3,4,p.trim);
    rect(doorX-4,doorY-6,42,7,p.trim);
    rect(doorX+4,doorY-14,26,6,p.accent);
    rect(doorX-6,groundY-3,46,4,'#dfcaa6');
    if(nearest===b.index&&player.onGround){
      rect(doorX-7,groundY+2,49,3,'#f9dd9c');
      // A bouncing pixel arrow signals where E / the mobile action works.
      const arrowY=doorY-29+Math.floor((elapsed*3)%4);
      rect(doorX+13,arrowY,8,4,'#fef6bf');
      rect(doorX+15,arrowY+4,4,4,'#fef6bf');
      rect(doorX+17,arrowY+8,2,3,'#fef6bf');
    }
  }
  function drawBuilding(b){
    const x=b.x-camera,scale=buildingScale(b);
    if(x>W+85||x+b.width<-85)return;
    ctx.save();
    const anchor=x+b.width*.5;
    ctx.translate(anchor,groundY);ctx.scale(scale,scale);ctx.translate(-anchor,-groundY);
    const y=groundY-b.height;
    // Museum-scale structures dwarf the wandering avatar.
    rect(x-17,groundY-5,b.width+34,8,'#333c3e');
    rect(x-13,groundY-11,b.width+26,6,'#bdaf97');
    if(b.style==='castle')drawCastle(b,y);
    else if(b.style==='arena')drawArena(b,y);
    else if(b.style==='duel')drawDuel(b,y);
    else if(b.style==='tactics')drawTactics(b,y);
    else if(b.style==='cat')drawCat(b,y);
    else drawGeneric(b,y);
    drawDoor(b);
    if(b.index%2===0)drawLamp(x-32,groundY);
    else drawLamp(x+b.width+30,groundY);
    // A compact pixel planting strip gives each building a distinct district.
    for(let i=0;i<5;i++){
      const bx=x-15+i*(b.width+30)/4;
      rect(bx,groundY-10,4,10,'#4f8a6c');
      rect(bx-3,groundY-15-(i%2)*3,10,9,b.style==='cat'?'#f5b6d6':'#7dbd8a');
      rect(bx,groundY-19-(i%2)*3,4,4,b.style==='castle'?'#d17b87':'#c4d5a0');
    }
    ctx.restore();
  }
  function avatar(x,ground,direction,walk,guide=false,yOffset=0){
    const sx=Math.round(x-camera), sy=Math.round(ground+yOffset);
    if(sx<-24||sx>W+24)return;
    const walking=Math.abs(walk)>.05;
    const step=walking?Math.sin(elapsed*11):0;
    const bob=walking?Math.round(Math.abs(step)*1.8):0;
    const side=direction<0?-1:1;
    ctx.save();ctx.translate(sx,sy-bob);
    if(direction<0)ctx.scale(-1,1);
    const cloak=guide?'#2c2833':'#426c9e';
    const skin=guide?'#f5c3ae':'#d7a58c';
    // Human heads, legs and equipment all follow one consistent pixel grid.
    rect(-8,-29,15,13,guide?'#262432':'#312c34');
    rect(-6,-27,11,10,skin);
    rect(-9,-30,14,5,'#202432');
    rect(-7,-19,13,2,guide?'#742e4b':'#c2a17f');
    rect(2,-25,2,2,'#29212b');
    if(guide){
      rect(-10,-28,3,15,'#252432');rect(7,-25,3,14,'#292533');
      rect(-12,-17,5,13,'#332e39'); // low ponytail
      rect(-13,-17,5,4,'#a8475c');
      rect(-6,-17,11,14,'#faf2e8');
      rect(-3,-17,5,15,'#3f3443');rect(-1,-16,2,9,'#993e51');
      rect(-5,-9,10,3,'#3f3443');
      rect(-3,-12,2,2,'#d3a67b');
    } else {
      rect(-8,-18,15,14,cloak);
      rect(-5,-17,11,4,'#80a9c9');
      rect(-8,-15,3,11,'#315c86');
      rect(7,-14,3,6,'#567cb0');
    }
    // Arm cycles opposite the leg motion.
    rect(-10+(walking?Math.round(step*2):0),-16,3,11,guide?'#f8efe8':'#41699b');
    rect(8-(walking?Math.round(step*2):0),-16,3,11,guide?'#f8efe8':'#41699b');
    rect(-10+(walking?Math.round(step*2):0),-5,3,3,skin);
    rect(8-(walking?Math.round(step*2):0),-5,3,skin?3:3,skin);
    const legLeft=walking?Math.round(step*4):0,legRight=walking?-Math.round(step*4):0;
    rect(-6+legLeft,-4,5,12,guide?'#302e37':'#3a465a');
    rect(1+legRight,-4,5,12,guide?'#302e37':'#3a465a');
    rect(-8+legLeft,6,7,3,'#272832');
    rect(1+legRight,6,7,3,'#272832');
    ctx.restore();
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    drawSky();drawPlaza();
    for(const b of buildings)drawBuilding(b);
    drawGround();
    avatar(curator.x,groundY,curator.direction,curator.walk,true,0);
    avatar(player.x,groundY,player.direction,player.walk,false,player.y);
    // Guide stays visible with a caption at stops, without blocking entrances.
    const guideX=(curator.x-camera)*LOGICAL_PIXEL_SIZE;
    guideBubble.style.left=Math.round(Math.min(stage.clientWidth-90,Math.max(90,guideX)))+'px';
    const bubbleY=(groundY-30)*LOGICAL_PIXEL_SIZE;
    guideBubble.style.top=Math.round(Math.max(8,bubbleY-75))+'px';
    if(guideTextUntil<elapsed&&nearest<0&&Math.abs(player.vx)<1){
      announce('게임 건물 앞에 서서 E를 누르면 작품 설명을 볼 수 있어요.',5.5);
    }
  }
  function update(dt){
    elapsed+=dt;
    const axis=(keys.right?1:0)-(keys.left?1:0);
    const speed=axis*MOVE_SPEED;
    player.vx+=(speed-player.vx)*Math.min(1,dt*13);
    if(!axis&&Math.abs(player.vx)<.15)player.vx=0;
    if(player.vx)player.direction=player.vx>=0?1:-1;
    player.x=Math.max(18,Math.min(worldEnd-35,player.x+player.vx*dt));
    if(!player.onGround){
      player.y+=player.vy*dt;player.vy+=GRAVITY*dt;
      if(player.y>=0){player.y=0;player.vy=0;player.onGround=true;}
    }
    player.walk=Math.abs(player.vx)>10?1:0;
    const followTarget=player.x-(player.direction>=0?48:-48);
    const diff=followTarget-curator.x;
    if(Math.abs(diff)>8){
      curator.direction=diff>0?1:-1;
      curator.x+=Math.sign(diff)*Math.min(Math.abs(diff),MOVE_SPEED*.9*dt);
      curator.walk=1;
    }else curator.walk=0;
    const maxCam=Math.max(0,worldEnd-W);
    const follow=Math.max(0,Math.min(maxCam,player.x-W*.49));
    camera+=(follow-camera)*Math.min(1,dt*5.6);
    updateNearby();
    updateSigns();
  }
  function render(){draw();}
  function frame(timestamp){
    const delta=lastFrame?Math.min(.043,(timestamp-lastFrame)/1000):.016;
    lastFrame=timestamp;
    if(canRun())update(delta);
    render();
    frameId=requestAnimationFrame(frame);
  }
  // Cap all world effects to a single Canvas rather than hundreds of DOM layers.
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  observer?.observe(stage);
  window.addEventListener('resize',resize,{passive:true});
  rebuild();resize();
  frameId=requestAnimationFrame(frame);
  window.OIBUNG_WORLD={
    getState:()=>({playerX:player.x,curatorX:curator.x,camera,nearest,count:buildings.length,buildingIds:buildings.map(b=>b.game.id),theme:nearest<0?null:buildings[nearest].style}),
    travelTo:id=>{const index=buildings.findIndex(b=>String(b.game.id)===String(id));if(index>=0)warp(index);return index>=0;},
    enter,refresh:rebuild,jump,movement
  };
})();
