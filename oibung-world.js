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
  const BUILDING_WIDTH = 1490;
  const BUILDING_SPACING = 1580;
  const DISTRICT_GAP = 760;
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
  let W=640,H=330,groundY=276,worldEnd=1550,camera=0;
  let lastFrame=0,elapsed=0,frameId=0,paused=false;
  let player={x:165,y:0,vx:0,vy:0,direction:1,walk:0,onGround:true};
  // Independent residents: their routes are world-space positions, never
  // offsets from the player's position or camera.
  const guides=['angel','devil'].map((formId,index)=>({
    formId,state:curatorMotion.reset({},165),
    brain:{mode:'patrol',targetX:165,buildingIndex:-1,
      visits:0,stay:0,meetWait:3+index*2,greetWait:0,restCount:0}
  }));
  let curatorForm='angel';
  try{
    if(localStorage.getItem('oibung-world-guide')==='devil')curatorForm='devil';
  }catch{}
  if(guideSelect)guideSelect.value=curatorForm;
  const speakingGuide=()=>guides[curatorForm==='devil'?1:0];
  let keys={left:false,right:false};
  let guideTextUntil=0;
  // Synchronized interactions happen only when both guides and the player are still.
  let duetWait=8.5,duetIndex=0;
  // Nong always keeps the left-hand place; Bbang keeps the right-hand place.
  let didInitialSpawn=false;
  let previousInteriorObject=null;
  let interiorOrigin=null;

  const patrolLimit=()=>inRoom()?room().roomWidth():worldEnd;
  function guideStop(index,visit){
    const count=buildings.length;
    if(!count){
      // Even an empty world has a tiny plaza to explore.
      return {x:clamp(390+(visit%4-1.5)*210,45,worldEnd-45),buildingIndex:-1};
    }
    const indexWithin=count===1?0:((visit+index*(count>1?1:0))%count);
    const b=buildings[indexWithin];
    // Slightly different stopping places at a real building entrance.
    const meetup=visit>0&&visit%5===4;
    const offset=meetup?(index===0?-35:35):
      (index===0?-1:1)*(visit%2===0?103:168);
    return {x:clamp(entrance(b)+offset,35,worldEnd-35),buildingIndex:indexWithin};
  }
  function beginGuidePatrol(guide,index){
    const brain=guide.brain;
    const stop=guideStop(index,brain.visits++);
    brain.mode='patrol';
    brain.targetX=stop.x;
    brain.buildingIndex=stop.buildingIndex;
    brain.stay=0;
    brain.greetWait=Math.max(brain.greetWait,3);
  }
  function resetGuides(){
    duetWait=7;
    for(const [index,guide] of guides.entries()){
      const spot=guideStop(index,index);
      const x=clamp(spot.x+(index===0?-50:50),20,worldEnd-20);
      curatorMotion.reset(guide.state,x);
      guide.state.y=-curatorHeight(guide.formId)*.35;
      guide.state.facing=index===0?1:-1;
      guide.state.turn=guide.state.facing;
      guide.state.gestureWait=1.8+index*1.1;
      Object.assign(guide.brain,{mode:'present',targetX:spot.x,
        buildingIndex:spot.buildingIndex,visits:index+1,
        stay:3.5+index*1.5,meetWait:3+index*3,greetWait:5,restCount:0});
    }
  }
  function updateGuides(dt){
    // Continue their lightweight outdoor itinerary even while the visitor is
    // exploring an interior. Their art is rendered only when outdoors.
    const visitorOutside=!inRoom();
    for(const [index,guide] of guides.entries()){
      const brain=guide.brain;
      brain.greetWait=Math.max(0,brain.greetWait-dt);
      const distance=Math.abs(guide.state.x-brain.targetX);
      if(brain.mode==='patrol'&&distance<18&&Math.abs(guide.state.speed)<42){
        brain.mode=brain.visits%3===0?'rest':'present';
        brain.stay=(brain.mode==='rest'?2.8:4.2)+
          ((brain.visits+index)%3)*.85;
        // Greeting is an existing, painted pixel animation—not a scaling
        // effect. Avoid interrupting an action already in progress.
        if(!reduceMotion.matches&&!guide.state.gesture){
          const theme=buildings[brain.buildingIndex]?.style;
          const action=index===0
            ?(theme==='castle'?'surprise':theme==='cat'?'shy':
              brain.mode==='rest'?'hair':'wave')
            :(theme==='arena'?'cheer':theme==='tower'?'surprise':
              brain.mode==='rest'?'stretch':'beckon');
          curatorMotion.play(guide.state,action);
        }
      }else if(brain.mode!=='patrol'){
        brain.stay-=dt;
        if(brain.stay<=0&&!guide.state.gesture)beginGuidePatrol(guide,index);
      }
      const relaxing=brain.mode!=='patrol';
      curatorMotion.update(guide.state,{
        dt,player,limit:worldEnd,gap:curatorGap(),
        height:curatorHeight(guide.formId),reduced:reduceMotion.matches,
        targetX:brain.targetX,formId:guide.formId,
        hovering:true,roaming:true,hoverSide:index===0?-1:1,
        floatHeight:relaxing?.27:.62,floatBob:index===0?3.6:4.8,
        allowHop:false,jumpDelay:0
      });
      if(visitorOutside&&relaxing&&brain.buildingIndex>=0&&brain.greetWait===0
        &&player.onGround&&Math.abs(player.vx)<35
        &&Math.abs(player.x-guide.state.x)<105){
        const building=buildings[brain.buildingIndex];
        if(building){
          brain.greetWait=11;
          curatorForm=guide.formId;
          if(guideSelect)guideSelect.value=curatorForm;
          announce(building.game.title+' · '+
            (building.game.tagline||'이 작품을 구경해 보세요!'),4.8);
          if(!reduceMotion.matches&&!guide.state.gesture)
            curatorMotion.play(guide.state,index===0?'wave':'beckon');
        }
      }
    }
    // Their interaction happens because their independent patrols crossed,
    // not because the user stood still next to two bodyguards.
    const [nong,bbang]=guides;
    const together=Math.abs(nong.state.x-bbang.state.x)<110&&
      guides.every(g=>g.brain.mode!=='patrol'&&
        Math.abs(g.state.speed)<38&&!g.state.gesture);
    if(together&&!reduceMotion.matches){
      duetWait=Math.max(0,duetWait-dt);
      if(duetWait===0){
        const action=['pairWave','pairShy','pairCheer'][duetIndex++%3];
        curatorMotion.play(nong.state,action);
        curatorMotion.play(bbang.state,action);
        duetWait=13;
      }
    }else duetWait=Math.max(2.5,duetWait);
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
    const oldAnchor=oldBuildings.reduce((closest,b)=>
      !closest||Math.abs(entrance(b)-oldExterior)<Math.abs(entrance(closest)-oldExterior)?b:closest,null);
    games=next;
    buildings=[];
    districts=[];
    let x=450;
    for (const [status,label] of districtLabels) {
      const entries=games.filter(game=>districtOf(game)===status);
      if (!entries.length) continue;
      districts.push({status,label,start:districts.length?x-DISTRICT_GAP*.8:0});
      for(const game of entries){
        const index=buildings.length;
        const style=themeOf(game);
        buildings.push({game,index,x,width:BUILDING_WIDTH,style,status});
        x+=BUILDING_SPACING;
      }
      x+=DISTRICT_GAP;
    }
    worldEnd=buildings.length?entrance(buildings.at(-1))+900:1550;
    const replacement=oldAnchor&&buildings.find(b=>b.game.id===oldAnchor.game.id);
    const offset=replacement?entrance(replacement)-entrance(oldAnchor):0;
    if(wasInterior&&interiorOrigin&&offset){
      interiorOrigin.playerX+=offset;
      interiorOrigin.guideX=interiorOrigin.guideX.map(x=>x+offset);
      interiorOrigin.camera+=offset;
    }else if(!wasInterior){
      if(!didInitialSpawn&&buildings.length){
        player.x=entrance(buildings[0])-105;
        resetGuides();
        didInitialSpawn=true;
      }else if(offset){
        player.x+=offset;
        for(const guide of guides){
          guide.state.x=clamp(guide.state.x+offset,20,worldEnd-20);
          if(guide.brain.buildingIndex>=0)beginGuidePatrol(
            guide,guides.indexOf(guide));
          else guide.brain.targetX=clamp(
            guide.brain.targetX+offset,20,worldEnd-20);
        }
      }
      player.x=clamp(player.x,18,worldEnd-35);
      camera=clamp(player.x-W*.49,0,Math.max(0,worldEnd-W));
    }

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
      player.x*=roomScale;
      for(const {state} of guides)state.x*=roomScale;
    }
    const extent=inRoom()?room().roomWidth():worldEnd;
    camera=Math.max(0,Math.min(Math.max(0,extent-W),player.x-W*.49));
    if(!inRoom())updateSigns();
  }
  function updateSigns(){
    signs.style.pointerEvents='none';
    for(let i=0;i<signButtons.length;i++){
      const b=buildings[i],button=signButtons[i];
      const sx=(b.x+b.width*.5-camera)*LOGICAL_PIXEL_SIZE;
      // A small plaque above the doorway is easier to read and leaves
      // the grand roof and towers unobscured.
      const sy=groundY-Math.max(48,Math.min(100,H*.12));
      const visible=sx>-70&&sx<stage.clientWidth+70&&
        Math.abs(player.x-entrance(b))<Math.max(420,W*.68);
      button.hidden=!visible;
      if(visible){
        button.style.left=Math.round(sx)+'px';
        button.style.top=Math.round(Math.max(75,sy))+'px';
      }
    }
  }
  function warp(i){
    const b=buildings[i];if(!b)return;
    if(inRoom()){room().leave();interiorOrigin=null;signs.hidden=false;previousInteriorObject=null;}
    // Let the player stand beside the monumental door, not on top of it.
    player.x=b.x+b.width*.5-105;
    player.vx=0;player.vy=0;player.y=0;player.onGround=true;
    // Jumping to a building does not teleport the independent guide residents.
    const target=Math.max(0,Math.min(worldEnd-W,player.x-W*.5));
    camera=target;
    updateNearby(true);updateSigns();render();
  }
  function nearbyBuilding(){
    let result=-1,dist=135;
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i];
      const d=Math.abs(player.x-(b.x+b.width*.5));
      if(d<=dist){dist=d;result=i;}
    }
    return result;
  }
  function announce(text,seconds=4){
    guideTextUntil=elapsed+seconds;
    guideBubble.textContent=text;
  }
  function updateDistrict(){
    const district=inRoom()?null:districts.findLast(d=>d.start<=player.x);
    const label=inRoom()?'실내 전시':district?district.label+' 구역':'중앙 광장';
    if(counter.textContent!==label)counter.textContent=label;
    if(district&&counter.dataset.district!==district.status)counter.dataset.district=district.status;
    if(!district&&counter.dataset.district)delete counter.dataset.district;
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
        nearbyLabel.textContent=games.length?'←  → 이동해서 마음에 드는 건물을 찾으세요.':'첫 게임이 등록되면 건물이 생깁니다.';
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
    player.x=clamp(origin?.playerX??player.x,18,worldEnd-35);
    // Guide patrols resume at their original outdoor positions.
    camera=clamp(origin?.camera??0,0,Math.max(0,worldEnd-W));
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
    const origin={playerX:player.x,camera};
    if(!room().enter(b.game,b.style,origin))return false;
    interiorOrigin=origin;
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
    if(!reduceMotion.matches){
      const guide=guides.find(({formId,state})=>
        Math.abs(x-state.x)<curatorHeight(formId)*.45&&
        tapY>groundY+state.y-curatorHeight(formId)*1.12&&
        tapY<groundY+state.y+8);
      if(guide){
        curatorForm=guide.formId;
        if(guideSelect)guideSelect.value=curatorForm;
        guide.brain.greetWait=9;
        const building=buildings[guide.brain.buildingIndex];
        announce(building?building.game.title+' · '+
          (building.game.tagline||'이곳을 안내해 드릴게요.'):
          (guide.formId==='angel'?'어떤 작품을 보러 오셨나요?':'이 근처 작품을 구경해 볼래?'),4.5);
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
    const other=guides[guide===guides[0]?1:0];
    const outwardDistance=(other.state.x-guide.state.x)*facingOut;
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
      y=top-14;
    }
    guideBubble.dataset.side=side;
    guideBubble.style.setProperty('--guide-width',width+'px');
    guideBubble.style.setProperty('--guide-x',Math.round(x)+'px');
    guideBubble.style.setProperty('--guide-y',y+'px');
    guideBubble.style.setProperty('--guide-tail-x',Math.round(center-x)+'px');
  }
  function drawCurator(guide){
    const {state:curator,formId}=guide;
    const height=curatorHeight(formId);
    const center=curator.x-camera;
    const width=Math.round(height*.96);
    const top=groundY+curator.y-height;
    const visible=curatorMotion.ready(formId)&&center>=-width&&center<=W+width;
    if(guide===speakingGuide()&&!inRoom()){
      guideBubble.hidden=!visible||!guideBubble.textContent||elapsed>guideTextUntil||center<0||center>W;
      if(!guideBubble.hidden)positionDialogue(center,top,width,height,guide);
    }
    if(!visible)return;
    // A light shadow on the ground reinforces that the guide is airborne.
    footShadow(curator.x,groundY,Math.max(7,height*.105),
      clamp(.21+curator.y*.0012,.10,.21));
    curatorMotion.draw(ctx,curator,{center,groundY,height,elapsed,reduced:reduceMotion.matches,formId});
  }
  function draw(){
    ctx.imageSmoothingEnabled=false;
    const view={W,H,groundY,camera,elapsed,reducedMotion:reduceMotion.matches};
    if(inRoom())room().draw(ctx,view);
    else scenes.drawOutdoor(ctx,{...view,buildings,districts});
    const height=Math.round(clamp(H*.185,63,157));
    footShadow(player.x,groundY,Math.max(9,height*.12),player.onGround?.43:.2);
    const drawPlayer=()=>scenes.drawPlayer(ctx,{
      x:player.x,groundY,camera,direction:player.direction,
      moving:player.walk>.1&&!reduceMotion.matches,airborne:!player.onGround,
      elapsed,yOffset:player.y,height
    });
    if(!inRoom())for(const guide of guides)
      if(guide.state.x<player.x)drawCurator(guide);
    drawPlayer();
    if(!inRoom())for(const guide of guides)
      if(guide.state.x>=player.x)drawCurator(guide);
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
    player.x=Math.max(18,Math.min(limit-35,player.x+player.vx*dt));
    if(!player.onGround){
      player.y+=player.vy*dt;player.vy+=GRAVITY*dt;
      if(player.y>=0){player.y=0;player.vy=0;player.onGround=true;}
    }
    player.walk=Math.abs(player.vx)>10?1:0;
    updateGuides(dt);
    const maxCam=Math.max(0,limit-W);
    const follow=Math.max(0,Math.min(maxCam,player.x-W*.49));
    camera+=(follow-camera)*Math.min(1,dt*5.6);
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
        buildingWidths:buildings.map(b=>b.width),district:districts.findLast(d=>d.start<=player.x)?.status||null,
        districts:districts.map(d=>({...d})),buildingPositions:buildings.map(b=>({id:b.game.id,x:entrance(b),district:b.status})),
        guideBubbleVisible:!guideBubble.hidden,pixelArtReady:scenes.ready(nearest<0?(buildings[0]?.style||'studio'):buildings[nearest].style),
        renderDensity:LOGICAL_PIXEL_SIZE,curatorArtLoaded:curatorMotion.ready(),curatorHdAtlasReady:curatorMotion.ready(),
        curatorY:curator.y,curatorMode:curator.mode,curatorAffection:curator.affection,curatorForm,
        guides:guides.map(({formId,state,brain})=>({formId,x:state.x,y:state.y,
          targetX:brain.targetX,buildingIndex:brain.buildingIndex,
          mode:brain.mode,hovering:state.hovering===true,
          motion:state.gesture?.name||(state.hovering?'hover':Math.abs(state.speed)>24?'walk':'idle')}))};
    },
    travelTo:id=>{const index=buildings.findIndex(b=>String(b.game.id)===String(id));if(index>=0)warp(index);return index>=0;},
    enter,leaveInterior,approachInterior,refresh:rebuild,jump,movement
  };
})();
