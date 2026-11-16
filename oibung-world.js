/* Oibung World — side-scrolling pixel-art game museum. */
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
  const guideSelect = document.getElementById('world-guide-select');
  const jumpSelect = document.getElementById('world-jump-select');
  const interactButton = document.getElementById('world-enter');
  const controls = [...world.querySelectorAll('[data-world-move]')];
  const jumpButton = world.querySelector('[data-world-jump]');
  const listButton = document.getElementById('world-list-toggle');
  const list = document.getElementById('world-directory');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const room=()=>window.OIBUNG_INTERIORS;
  const inRoom=()=>!!room()?.isActive();
  if (!ctx) return;

  const LOGICAL_PIXEL_SIZE = 1;
  const MOVE_SPEED = 335;
  // Compact horizontal footprint; progress snakes UP through the town.
  const FLOOR_WIDTH=1400,FLOOR_RISE=450,STAIR_SPAN=390;
  const ROUTE_SPAN=FLOOR_WIDTH-160,BUILDINGS_PER_FLOOR=2;
  const BUILDING_WIDTH=430;
  const GRAVITY = 720;
  const scenes = window.OIBUNG_PIXEL_SCENES;
  const curatorMotion = window.OIBUNG_CURATOR;
  const districtLabels = new Map([
    ['finished', '완결'],
    ['released', '정식 출시'],
    ['live_service', '라이브 서비스'],
    ['in_development', '개발 중'],
    ['unknown', '미정']
  ]);
  const districtOf = game => districtLabels.has(game.developmentStatus) ? game.developmentStatus : 'unknown';
  const entrance = building => building.x + building.width / 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const curatorGap = () => Math.round(108 * clamp(H / 690, .64, 1.28));

  // Continuous switchback corridor: right on level 1, left on level 2,
  // right on level 3, etc. The final stretch of each leg is a real ascent.
  function routeInfo(route){
    const value=clamp(route,0,maxRoute);
    const floor=Math.min(floorCount-1,Math.floor(value/ROUTE_SPAN));
    const progress=value-floor*ROUTE_SPAN;
    const right=floor%2===0;
    const x=right?80+progress:FLOOR_WIDTH-80-progress;
    const climb=floor<floorCount-1
      ?clamp((progress-(ROUTE_SPAN-STAIR_SPAN))/STAIR_SPAN,0,1)
      :0;
    return {floor,progress,x,elevation:(floor+climb)*FLOOR_RISE,
      onStairs:climb>0&&climb<1};
  }
  function setPlayerRoute(route){
    player.route=clamp(route,0,maxRoute);
    const info=routeInfo(player.route);
    player.x=info.x;
    player.level=info.floor;
    player.elevation=info.elevation;
    player.onStairs=info.onStairs;
  }
  function onSameTerrace(guide){
    return Math.abs((guide.elevation||0)-player.elevation)<85;
  }

  function themeOf(game) {
    const match = (String(game?.title || '')+' '+String(game?.english || '')+' '+String(game?.genre || '')+' '+String(game?.id || '')).toLowerCase();
    if (/\bfur[.\s_-]*corp\b|퍼리|furry/.test(match)) return 'corp';
    if (/오든링|oden.?ring|elden|소울라이크|보스 러시/.test(match)) return 'castle';
    if (/아레나|arena|핀볼|ballfight|콜로세움/.test(match)) return 'arena';
    if (/고양이|\bcat\b/.test(match)) return 'cat';
    if (/오이챔스|ochams|대전|duel|배틀/.test(match)) return 'duel';
    if (/대학전선|frontier|캠퍼스|전략|strategy/.test(match)) return 'tactics';
    if (/마법|별빛|우주|연구탑|magic|observatory|space|astral/.test(match)) return 'tower';
    return 'studio';
  }
  let games=[],buildings=[],districts=[],signButtons=[],nearest=-1;
  let W=640,H=560,groundY=460,worldEnd=FLOOR_WIDTH,camera=0,cameraY=0;
  let floorCount=1,maxRoute=ROUTE_SPAN-STAIR_SPAN;
  let lastFrame=0,elapsed=0,frameId=0,paused=false;
  let player={x:80,y:0,vx:0,vy:0,direction:1,walk:0,onGround:true,
    route:0,level:0,elevation:0,onStairs:false,stairsLock:0};
  let guides=[];
  let announcingGuide=null;
  let curatorForm='angel';
  try{
    if(localStorage.getItem('oibung-world-guide')==='devil')curatorForm='devil';
  }catch{}
  if(guideSelect)guideSelect.value=curatorForm;
  const speakingGuide=()=>announcingGuide||guides
    .filter(guide=>guide.formId===curatorForm&&onSameTerrace(guide))
    .sort((a,b)=>Math.abs(a.state.x-player.x)-Math.abs(b.state.x-player.x))[0];
  let keys={left:false,right:false};
  let guideTextUntil=0;
  let didInitialSpawn=false;
  let previousInteriorObject=null;
  let interiorOrigin=null;

  function resetGuides(){
    announcingGuide=null;
    guideTextUntil=0;
    guides=buildings.flatMap((building,index)=>['angel','devil'].map((formId,side)=>{
      const x=entrance(building)+(side?102:-102);
      const state=curatorMotion.reset({},x);
      state.facing=side?-1:1;
      state.turn=state.facing;
      state.gestureWait=.65+side*.7;
      return {formId,theme:building.style,elevation:building.floor*FLOOR_RISE,state,
        brain:{mode:'present',buildingIndex:index,greetWait:0}};
    }));
  }

  function updateGuides(dt){
    const active=guides.filter(guide=>onSameTerrace(guide));
    const nearestGuide=active.reduce((best,guide)=>!best||
      Math.abs(guide.state.x-player.x)<Math.abs(best.state.x-player.x)?guide:best,null);
    for(const guide of active){
      const {state,brain,formId}=guide;
      const distance=player.x-state.x;
      const perform=Math.abs(distance)<155;
      curatorMotion.update(state,{
        dt,player,limit:worldEnd,gap:curatorGap(),
        height:curatorHeight(formId),reduced:reduceMotion.matches,
        targetX:state.x,formId,hovering:true,roaming:true,
        hoverSide:formId==='angel'?-1:1,floatHeight:0,floatBob:0,perform,
        allowHop:false,jumpDelay:0
      });
      if(perform&&Math.abs(distance)>12)state.facing=Math.sign(distance);
      brain.greetWait=Math.max(0,brain.greetWait-dt);
      if(guide===nearestGuide&&perform&&brain.greetWait===0&&
        Math.abs(distance)<98&&Math.abs(player.vx)<35&&elapsed>=guideTextUntil){
        const building=buildings[brain.buildingIndex];
        brain.greetWait=12;
        announce(building.game.title+' · '+(building.game.tagline||'이 작품을 구경해 보세요!'),4.8,guide);
      }
    }
  }

  function canRun(){
    return !document.hidden&&window.OIBUNG_CURRENT_VIEW!=='reviews'&&
      !world.classList.contains('world-menu-open')&&
      !document.getElementById('world-all-games')?.open&&
      !document.querySelector('dialog[open]')&&
      !room()?.blocksMovement()&&world.isConnected;
  }
  function listCatalog(){
    const api=window.OIBUNG_CATALOG;
    if(api&&typeof api.listGames==='function')return api.listGames().filter(g=>g&&g.id&&g.title);
    return Array.isArray(window.OIBUNG_GAMES)?window.OIBUNG_GAMES.filter(g=>g&&g.id&&g.title):[];
  }
  function rebuild(){
    const next=listCatalog();
    const oldBuildings=buildings;
    const wasInterior=inRoom();
    const oldExterior=wasInterior?interiorOrigin?.playerX:player.x;
    const oldAnchor=oldBuildings.reduce((closest,b)=>{
      const d=Math.abs(entrance(b)-oldExterior)+
        Math.abs((b.floor||0)-(player.level||0))*FLOOR_WIDTH;
      const best=closest?Math.abs(entrance(closest)-oldExterior)+
        Math.abs((closest.floor||0)-(player.level||0))*FLOOR_WIDTH:Infinity;
      return d<best?b:closest;
    },null);
    games=next;
    buildings=[];
    districts=[];
    let number=0;
    for(const [status,label] of districtLabels){
      const entries=games.filter(game=>districtOf(game)===status);
      if(!entries.length)continue;
      const firstFloor=Math.floor(number/BUILDINGS_PER_FLOOR);
      districts.push({status,label,start:firstFloor*ROUTE_SPAN+
        (number%BUILDINGS_PER_FLOOR===0?280:665)});
      for(const game of entries){
        const index=buildings.length;
        const floor=Math.floor(number/BUILDINGS_PER_FLOOR);
        const order=number%BUILDINGS_PER_FLOOR;
        const progress=order===0?280:665;
        const route=floor*ROUTE_SPAN+progress;
        const x=(floor%2===0?80+progress:FLOOR_WIDTH-80-progress)-BUILDING_WIDTH/2;
        buildings.push({game,index,x,width:BUILDING_WIDTH,style:themeOf(game),
          status,floor,route});
        number++;
      }
    }
    floorCount=Math.max(1,Math.ceil(buildings.length/BUILDINGS_PER_FLOOR));
    maxRoute=Math.max(0,(floorCount-1)*ROUTE_SPAN+
      ROUTE_SPAN-STAIR_SPAN-18);
    worldEnd=FLOOR_WIDTH;
    const replacement=oldAnchor&&buildings.find(b=>b.game.id===oldAnchor.game.id);
    if(wasInterior&&interiorOrigin&&replacement){
      interiorOrigin.route=clamp(replacement.route+
        (interiorOrigin.route-(oldAnchor?.route||0)),0,maxRoute);
    }else if(!wasInterior){
      if(!didInitialSpawn&&buildings.length){
        setPlayerRoute(Math.max(0,buildings[0].route-105));
        didInitialSpawn=true;
      }else if(replacement){
        setPlayerRoute(replacement.route+(player.route-(oldAnchor?.route||0)));
      }else setPlayerRoute(player.route);
      camera=clamp(player.x-W*.49,0,Math.max(0,worldEnd-W));
      cameraY=-player.elevation;
    }

    resetGuides();
    nearest=-1;
    jumpSelect.replaceChildren(new Option('건물 바로 찾기',''));
    list.replaceChildren();
    signs.replaceChildren();
    signButtons=[];
    let group;
    let directoryGroup;
    for(const b of buildings){
      if(group?.dataset.status!==b.status){
        group=document.createElement('optgroup');
        group.label=districtLabels.get(b.status)+' 구역';
        group.dataset.status=b.status;
        jumpSelect.append(group);
        directoryGroup=document.createElement('section');
        directoryGroup.className='world-district-directory';
        const heading=document.createElement('h3');
        heading.textContent=group.label;
        directoryGroup.append(heading);
        list.append(directoryGroup);
      }
      group.append(new Option(b.game.title,String(b.game.id)));
      const button=document.createElement('button');
      button.type='button';button.className='world-building-sign';
      button.textContent=b.game.title;button.title=b.game.title+' 건물로 이동';
      button.setAttribute('aria-label',b.game.title+' 건물로 이동');
      button.addEventListener('click',()=>{warp(b.index);stage.focus({preventScroll:true});});
      signs.append(button);
      signButtons.push(button);
      const item=document.createElement('button');
      item.type='button';item.className='world-directory-item';
      const name=document.createElement('strong');name.textContent=b.game.title;
      const category=document.createElement('small');category.textContent=b.game.genre||'오이붕 월드';
      item.append(name,category);
      item.addEventListener('click',()=>{warp(b.index);list.hidden=true;listButton.setAttribute('aria-expanded','false');stage.focus({preventScroll:true});});
      directoryGroup.append(item);
    }
    scenes.preload(buildings[0]?.style||'studio');
    if(!games.length)nearbyLabel.textContent='등록된 게임이 생기면 이곳에 건물이 등장합니다.';
    updateNearby(true);
  }
  function resize(){
    const size=stage.getBoundingClientRect();
    // Pixel-perfect internal rendering at full CSS resolution.
    W=Math.max(160,Math.floor(size.width/LOGICAL_PIXEL_SIZE));
    H=Math.max(130,Math.floor(size.height/LOGICAL_PIXEL_SIZE));
    groundY=H-Math.max(43,Math.min(83,Math.round(H*.092)));
    const density=clamp(window.devicePixelRatio||1,1,2);
    canvas.width=Math.round(W*density);canvas.height=Math.round(H*density);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    ctx.imageSmoothingEnabled=false;
    const roomScale=room()?.resize?.(W,H);
    if(inRoom()&&roomScale&&roomScale!==1){
      // Interior coordinate scaling applies ONLY to the player.
      // Guide patrol positions are stored in external world coordinates.
      player.x*=roomScale;
    }
    const extent=inRoom()?room().roomWidth():worldEnd;
    camera=Math.max(0,Math.min(Math.max(0,extent-W),player.x-W*.49));
    if(!inRoom())cameraY=-player.elevation;
    if(!inRoom())updateSigns();
  }
  function updateSigns(){
    signs.style.pointerEvents='none';
    for(let i=0;i<signButtons.length;i++){
      const b=buildings[i],button=signButtons[i];
      const sx=(b.x+b.width*.5-camera)*LOGICAL_PIXEL_SIZE;
      // A small plaque above the doorway is easier to read and leaves
      // the grand roof and towers unobscured.
      const sy=groundY-b.floor*FLOOR_RISE-cameraY+14;
      const visible=sx>-70&&sx<W+70&&sy>28&&sy<H-23&&
        Math.abs(player.elevation-b.floor*FLOOR_RISE)<105;
      button.hidden=!visible;
      if(visible){
        button.style.left=Math.round(sx)+'px';
        button.style.top=Math.round(Math.max(28,sy))+'px';
      }
    }
  }
  function warp(i){
    const b=buildings[i];if(!b)return;
    if(inRoom()){room().leave();interiorOrigin=null;signs.hidden=false;previousInteriorObject=null;}
    // Let the player stand beside the monumental door, not on top of it.
    setPlayerRoute(b.route-105);
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;
    player.stairsLock=0;
    cameraY=-player.elevation;
    // Jumping to a building does not teleport the independent guide residents.
    const target=Math.max(0,Math.min(worldEnd-W,player.x-W*.5));
    camera=target;
    updateNearby(true);updateSigns();render();
  }
  function nearbyBuilding(){
    let result=-1,dist=135;
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i];
      const d=Math.abs(player.x-entrance(b));
      if(b.floor===player.level&&!player.onStairs&&
          Math.abs(player.elevation-b.floor*FLOOR_RISE)<55&&d<=dist){
        dist=d;result=i;
      }
    }
    return result;
  }
  function announce(text,seconds=4,guide=null){
    announcingGuide=guide;
    guideTextUntil=elapsed+seconds;
    guideBubble.textContent=text;
  }
  function updateDistrict(){
    const building=buildings[nearbyBuilding()];
    const status=!inRoom()?building?.status:null;
    const label=inRoom()?'실내 전시':
      (player.level+1)+'층'+(player.onStairs?' · 계단':status?' · '+districtLabels.get(status):' · 전시 거리');
    if(counter.textContent!==label)counter.textContent=label;
    if(status)counter.dataset.district=status;
    else if(counter.dataset.district)delete counter.dataset.district;
  }
  function updateNearby(force=false){
    updateDistrict();
    if(inRoom()){
      const object=room().nearest(player.x);
      const id=object?.id||null;
      if(id!==previousInteriorObject||force){
        previousInteriorObject=id;
        interactButton.disabled=!object;
        interactButton.textContent=object?.action||'전시물에 가까이';
        nearbyLabel.textContent=object
          ?room().currentGame().title+' · '+object.label
          :room().currentGame().title+' · 전시실을 탐험하세요';
        if(object&&id!=='exit')announce(object.hint,3.5);
      }
      return;
    }
    const n=nearbyBuilding();
    if(n!==nearest||force){
      nearest=n;
      if(n>=0){
        const b=buildings[n],g=b.game;
        nearbyLabel.textContent=g.title+' · '+(g.tagline||g.genre||'친구가 만든 작품');
        interactButton.disabled=false;
        interactButton.textContent='건물 들어가기';
        // Building information belongs in the nearby label. A character
        // speech bubble appears only when an actual guide is nearby.
      }else{
        nearbyLabel.textContent=games.length
          ?(player.onStairs?'계단을 따라 올라가 다음 층을 탐험하세요.':
             '← → 이동해 건물을 찾고, 층 끝의 계단을 올라가세요.')
          :'첫 게임이 등록되면 건물이 생깁니다.';
        interactButton.disabled=true;
        interactButton.textContent='입구에 가까이';
        // No disembodied companion dialogue when the visitor is alone.
      }
    }
    if(!games.length)interactButton.disabled=true;
  }
  function leaveInterior(){
    if(!inRoom())return false;
    const origin=room().leave();
    interiorOrigin=null;
    setPlayerRoute(origin?.route??player.route);
    // Guide patrols resume at their original outdoor positions.
    camera=clamp(origin?.camera??0,0,Math.max(0,worldEnd-W));
    cameraY=-player.elevation;
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;
    previousInteriorObject=null;
    signs.hidden=false;keys.left=false;keys.right=false;
    updateNearby(true);updateSigns();render();
    stage.focus({preventScroll:true});
    return true;
  }
  function enter(){
    if(!canRun())return false;
    if(inRoom()){
      const object=room().nearest(player.x);
      return !!room().interact(object,{leave:leaveInterior});
    }
    if(nearest<0)return false;
    const b=buildings[nearest];
    if(!b||!room())return false;
    const origin={playerX:player.x,route:player.route,camera,cameraY};
    if(!room().enter(b.game,b.style,origin))return false;
    interiorOrigin=origin;
    curatorMotion.reset(interiorGuide,room().host()?.x||0);
    interiorGuide.gestureWait=.5;
    player.x=room().spawnX();
    camera=clamp(player.x-W*.49,0,Math.max(0,room().roomWidth()-W));
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;
    keys.left=false;keys.right=false;previousInteriorObject=null;
    signs.hidden=true;
    updateNearby(true);
    announce(room().welcome(),5);
    render();stage.focus({preventScroll:true});
    return true;
  }
  function jump(){
    if(!player.onGround||!canRun())return;
    player.vy=-285;player.onGround=false;
  }
  function movement(code,down){
    if(down&&!canRun())return;
    if(code==='left'||code==='right'){
      keys[code]=down;
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
  guideSelect?.addEventListener('change',()=>{
    curatorForm=guideSelect.value==='devil'?'devil':'angel';
    try{localStorage.setItem('oibung-world-guide',curatorForm);}catch{}
    const form=curatorMotion.formFor(curatorForm);
    // Selecting a voice never moves or summons the autonomous resident.
    // The visitor can meet and tap them while exploring their own route.
    nearbyLabel.textContent=form.name+' 비서는 월드의 건물을 순찰하고 있어요.';
    document.getElementById('world-menu-close')?.click();
    render();
  });
  listButton.addEventListener('click',()=>{
    list.hidden=!list.hidden;
    listButton.setAttribute('aria-expanded',String(!list.hidden));
  });
  world.querySelector('.world-hint a')?.addEventListener('click',event=>{
    event.preventDefault();
    const panel=document.getElementById('world-all-games');
    if(!panel)return;
    panel.open=true;
    panel.scrollIntoView({behavior:reduceMotion.matches?'auto':'smooth',block:'start'});
  });
  function approachInterior(object){
    if(!object||!inRoom()||!canRun())return false;
    if(room().nearest(player.x)?.id===object.id){
      return room().interact(object,{leave:leaveInterior});
    }
    player.x=object.x-38;
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;keys.left=false;keys.right=false;
    camera=clamp(player.x-W*.49,0,Math.max(0,room().roomWidth()-W));
    updateNearby(true);render();stage.focus({preventScroll:true});
    return true;
  }
  world.addEventListener('click',e=>{
    if(e.target!==canvas||!canRun())return;
    const bounds=canvas.getBoundingClientRect();
    const x=(e.clientX-bounds.left)/LOGICAL_PIXEL_SIZE+camera;
    const tapY=(e.clientY-bounds.top)/LOGICAL_PIXEL_SIZE;
    // Tap either character to play its next hand-drawn expression or pose.
    if(!reduceMotion.matches&&!inRoom()){
      const guide=guides.find(({formId,state,elevation})=>
        Math.abs(x-state.x)<curatorHeight(formId)*.45&&
        tapY>groundY-elevation-cameraY+state.y-curatorHeight(formId)*1.12&&
        tapY<groundY-elevation-cameraY+state.y+8);
      if(guide){
        curatorForm=guide.formId;
        if(guideSelect)guideSelect.value=curatorForm;
        guide.brain.greetWait=9;
        const building=buildings[guide.brain.buildingIndex];
        announce(building?building.game.title+' · '+
          (building.game.tagline||'이곳을 안내해 드릴게요.'):
          (guide.formId==='angel'?'어떤 작품을 보러 오셨나요?':'이 근처 작품을 구경해 볼래?'),4.5,guide);
        const catalog=guide.formId==='devil'
          ?['beckon','hair','kiss','shy','cheer','pout','surprise','stretch','wave']
          :['wink','hair','kiss','shy','cheer','pout','surprise','stretch','wave'];
        if(curatorMotion.play(guide.state,catalog[guide.state.nextGesture%catalog.length]))
          guide.state.nextGesture++;
        stage.focus({preventScroll:true});
        return;
      }
    }
    if(inRoom()){
      const object=room().objects().find(obj=>Math.abs(obj.x-x)<72);
      if(object&&room().nearest(player.x)?.id!==object.id)approachInterior(object);
      return;
    }
    const y=(e.clientY-bounds.top)/LOGICAL_PIXEL_SIZE;
    const idx=buildings.findIndex(b=>
      Math.abs(x-entrance(b))<Math.min(132,b.width*.14)&&
      y>=groundY-Math.max(76,Math.min(H*.22,185))&&y<=groundY+10);
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
      if(inRoom()||nearbyBuilding()>=0){enter();e.preventDefault();}
    }
    if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){
      jump();e.preventDefault();
    }
  });
  window.addEventListener('keyup',e=>{
    const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
    if(map[e.code])movement(map[e.code],false);
  });
  function restoreWorldFocus(){
    // Native <dialog> restores focus to the opener *after* its close event.
    // Move focus back on the following frame, or keyboard movement stays
    // disabled because the focused element is the old "Enter" button.
    requestAnimationFrame(()=>{
      if(window.OIBUNG_CURRENT_VIEW!=='reviews'&&
         !document.querySelector('dialog[open]'))stage.focus({preventScroll:true});
    });
  }
  document.getElementById('game-dialog')?.addEventListener('close',e=>{
    delete e.currentTarget.dataset.worldTheme;
    restoreWorldFocus();
  });
  document.getElementById('guide-dialog')?.addEventListener('close',restoreWorldFocus);
  window.addEventListener('blur',()=>{keys.left=false;keys.right=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.left=false;keys.right=false;}});
  document.addEventListener('oibung-catalog-updated',rebuild);
  document.addEventListener('oibung-page-changed',()=>{
    keys.left=false;keys.right=false;
    if(window.OIBUNG_CURRENT_VIEW==='games')resize();
  });

  function footShadow(x,ground,width,strength){
    ctx.fillStyle='rgba(12,17,25,'+strength+')';
    ctx.beginPath();
    ctx.ellipse(Math.round(x-camera),Math.round(ground)+1,width,4,0,0,Math.PI*2);
    ctx.fill();
  }

  function curatorHeight(formId){return Math.round(clamp(H*.185,63,157)*curatorMotion.formFor(formId).scale);}

  function positionDialogue(center,top,spriteWidth,height,guide){
    const edge=14, gap=13;
    const leftEdge=center-Math.ceil(spriteWidth/2)-gap;
    const rightEdge=center+Math.ceil(spriteWidth/2)+gap;
    const leftSpace=leftEdge-edge;
    const rightSpace=W-edge-rightEdge;
    const maxWidth=W<620?164:224;
    const facingOut=guide.state.x<player.x?-1:1;
    const preferredSide=facingOut<0?'left':'right';
    const nearbyResidents=guides.filter(g=>g!==guide&&Math.abs(g.elevation-guide.elevation)<48);
    const outwardDistance=Math.min(Infinity,...nearbyResidents
      .map(g=>(g.state.x-guide.state.x)*facingOut).filter(d=>d>0));
    const preferredSpace=preferredSide==='left'?leftSpace:rightSpace;
    const otherSpace=preferredSide==='left'?rightSpace:leftSpace;
    let side=preferredSpace>=maxWidth||preferredSpace>=otherSpace
      ?preferredSide:preferredSide==='left'?'right':'left';
    const space=side==='left'?leftSpace:rightSpace;
    const width=Math.round(Math.min(maxWidth,space>=100?space:W-2*edge));
    let x=side==='left'?leftEdge-width:rightEdge;
    let y=top+Math.min(28,Math.round(height*.19));
    if(space<100||(outwardDistance>0&&outwardDistance<maxWidth+spriteWidth)){
      side='above';
      x=clamp(center-width/2,edge,W-width-edge);
      y=Math.max(top-14,82);
    }
    guideBubble.dataset.side=side;
    guideBubble.style.setProperty('--guide-width',width+'px');
    guideBubble.style.setProperty('--guide-x',Math.round(x)+'px');
    guideBubble.style.setProperty('--guide-y',y+'px');
    guideBubble.style.setProperty('--guide-tail-x',Math.round(center-x)+'px');
  }
  function drawCurator(guide){
    const {state:curator,formId,theme}=guide;
    const height=curatorHeight(formId);
    const center=curator.x-camera;
    const width=Math.round(height*.96);
    const guideGround=groundY-(guide.elevation||0)-cameraY;
    const top=guideGround+curator.y-height;
    const visible=guide.elevation<=player.elevation+170&&curatorMotion.ready(formId)&&center>=-width&&
      center<=W+width&&top<H+height&&top>-height*1.2;
    if(guide===speakingGuide()&&!inRoom()){
      guideBubble.hidden=!visible||!guideBubble.textContent||elapsed>guideTextUntil||center<0||center>W;
      if(!guideBubble.hidden)positionDialogue(center,top,width,height,guide);
    }
    if(!visible)return;
    // A light shadow on the ground reinforces that the guide is airborne.
    footShadow(curator.x,guideGround,Math.max(7,height*.105),
      clamp(.21+curator.y*.0012,.10,.21));
    curatorMotion.draw(ctx,curator,{center,groundY:guideGround,height,
      elapsed,reduced:reduceMotion.matches,formId,theme});
  }
  const interiorGuide=curatorMotion.reset({},0);
  function drawInteriorGuide(){
    const host=room().host();
    if(!host)return;
    const center=host.x-camera;
    if(center< -100||center>W+100)return;
    interiorGuide.facing=player.x<host.x?-1:1;
    interiorGuide.formId=host.formId;
    const height=curatorHeight(host.formId);
    footShadow(host.x,groundY,Math.max(7,height*.105),.25);
    curatorMotion.draw(ctx,interiorGuide,{center,groundY,height,elapsed,
      reduced:reduceMotion.matches,formId:host.formId,theme:host.theme});
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    const view={W,H,groundY,camera,elapsed,reducedMotion:reduceMotion.matches};
    if(inRoom())room().draw(ctx,view);
    else scenes.drawTerraces(ctx,{...view,cameraY,buildings,districts,
      floorCount,floorWidth:FLOOR_WIDTH,rise:FLOOR_RISE,elevation:player.elevation,
      stairSpan:STAIR_SPAN});
    const height=Math.round(clamp(H*.185,63,157));
    const playerGround=inRoom()?groundY:groundY-player.elevation-cameraY;
    footShadow(player.x,playerGround,Math.max(9,height*.12),player.onGround?.43:.2);
    const drawPlayer=()=>scenes.drawPlayer(ctx,{
      x:player.x,groundY:playerGround,camera,direction:player.direction,
      moving:player.walk>.1&&!reduceMotion.matches,airborne:!player.onGround,
      elapsed,yOffset:player.y,height
    });
    const locals=inRoom()?[]:guides;
    for(const guide of locals)if(guide.state.x<player.x)drawCurator(guide);
    drawPlayer();
    for(const guide of locals)if(guide.state.x>=player.x)drawCurator(guide);
    if(inRoom())drawInteriorGuide();
    if(inRoom()){
      guideBubble.hidden=true;
      room().drawForeground(ctx,view);
    }
  }
  function update(dt){
    elapsed+=dt;
    const axis=(keys.right?1:0)-(keys.left?1:0);
    const speed=axis*MOVE_SPEED;
    player.vx+=(speed-player.vx)*Math.min(1,dt*13);
    if(!axis&&Math.abs(player.vx)<.15)player.vx=0;
    if(player.vx)player.direction=player.vx>=0?1:-1;
    const limit=inRoom()?room().roomWidth():worldEnd;
    if(inRoom()){
      player.x=clamp(player.x+player.vx*dt,18,limit-35);
    }else{
      const floorBefore=player.level;
      const axisNow=(keys.right?1:0)-(keys.left?1:0);
      let delta=player.vx*dt*(floorBefore%2===0?1:-1);
      if(player.stairsLock){
        if(axisNow===player.stairsLock || axisNow===0){
          delta=0;
          if(axisNow===0){
            // Land and release: cancel residual horizontal momentum, so
            // releasing RIGHT on floor two cannot walk BACK DOWN by inertia.
            player.vx=0;
            player.stairsLock=0;
          }
        }else{
          // Discard the previous direction's momentum at a landing.
          // Otherwise the first tap toward the new floor walks BACK down.
          player.vx=axisNow*MOVE_SPEED*.55;
          delta=player.vx*dt*(floorBefore%2===0?1:-1);
          player.stairsLock=0;
        }
      }
      const next=clamp(player.route+delta,0,maxRoute);
      const crossed=Math.floor(next/ROUTE_SPAN)!==floorBefore;
      setPlayerRoute(next);
      // When reaching a landing, old directional input does not instantly
      // send the player BACK down the stairs. Turn around to continue up.
      if(crossed&&axisNow)player.stairsLock=axisNow;
    }
    if(!player.onGround){
      player.y+=player.vy*dt;player.vy+=GRAVITY*dt;
      if(player.y>=0){player.y=0;player.vy=0;player.onGround=true;}
    }
    player.walk=Math.abs(player.vx)>10?1:0;
    if(inRoom()){
      const host=room().host();
      if(host){
        interiorGuide.x=host.x;
        curatorMotion.update(interiorGuide,{dt,player,limit:room().roomWidth(),
          gap:120,height:curatorHeight(host.formId),reduced:reduceMotion.matches,
          formId:host.formId,hovering:true,roaming:true,targetX:host.x,
          floatHeight:0,floatBob:0,perform:Math.abs(host.x-player.x)<155});
      }
    }else updateGuides(dt);
    const maxCam=Math.max(0,limit-W);
    const follow=Math.max(0,Math.min(maxCam,player.x-W*.49));
    camera+=(follow-camera)*Math.min(1,dt*5.6);
    if(!inRoom()){
      const targetY=-player.elevation+player.y*.13;
      cameraY+=(targetY-cameraY)*Math.min(1,dt*5.5);
    }
    updateNearby();
    if(!inRoom())updateSigns();
  }
  function render(){draw();}
  function frame(timestamp){
    const delta=lastFrame?Math.min(.043,(timestamp-lastFrame)/1000):.016;
    lastFrame=timestamp;
    if(canRun()){
      update(delta);
      render();
    }else{
      // Menus and dialogs keep the last painted scene; do not waste CPU
      // redrawing architecture and hundreds of background pixels.
      keys.left=false;keys.right=false;player.vx=0;
    }
    frameId=requestAnimationFrame(frame);
  }
  // Cap all world effects to a single Canvas rather than hundreds of DOM layers.
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  observer?.observe(stage);
  window.addEventListener('resize',resize,{passive:true});
  // The first spawn uses the real screen width, including mobile portrait.
  resize();rebuild();
  frameId=requestAnimationFrame(frame);
  window.OIBUNG_WORLD={
    getState:()=>{
      const curator=speakingGuide().state;
      return {inside:inRoom(),interior:room()?.state(),playerX:player.x,curatorX:curator.x,camera,
        nearest,count:buildings.length,buildingIds:buildings.map(b=>b.game.id),theme:nearest<0?null:buildings[nearest].style,
        buildingWidths:buildings.map(b=>b.width),district:districts.findLast(d=>d.start<=player.route)?.status||null,
        districts:districts.map(d=>({...d})),buildingPositions:buildings.map(b=>({id:b.game.id,x:entrance(b),floor:b.floor,route:b.route,district:b.status})),
        floor:player.level+1,floorCount,worldWidth:FLOOR_WIDTH,route:player.route,elevation:player.elevation,
        stairs:player.onStairs,cameraY,
        guideBubbleVisible:!guideBubble.hidden,pixelArtReady:scenes.ready(nearest<0?(buildings[0]?.style||'studio'):buildings[nearest].style),
        renderDensity:LOGICAL_PIXEL_SIZE,curatorArtLoaded:curatorMotion.ready(),curatorHdAtlasReady:curatorMotion.ready(),
        curatorY:curator.y,curatorMode:curator.mode,curatorAffection:curator.affection,curatorForm,
        guides:guides.map(({formId,theme,elevation,state,brain})=>({formId,theme,elevation,x:state.x,y:state.y,
          targetX:brain.targetX,targetElevation:brain.targetElevation,
          buildingIndex:brain.buildingIndex,
          mode:brain.mode,hovering:state.hovering===true,
          motion:state.gesture?.name||(state.hovering?'hover':Math.abs(state.speed)>24?'walk':'idle')}))};
    },
    travelTo:id=>{const index=buildings.findIndex(b=>String(b.game.id)===String(id));if(index>=0)warp(index);return index>=0;},
    enter,leaveInterior,approachInterior,refresh:rebuild,jump,movement
  };
})();
