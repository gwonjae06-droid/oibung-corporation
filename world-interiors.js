/* Landmark layouts and exhibit panels for the illustrated world interiors. */
(() => {
  'use strict';
  const stage=document.getElementById('oibung-world-stage');
  if(!stage)return;

  const layouts={
    castle:['고대의 던전','석벽에 걸린 전투 기록을 살펴보세요. 저 안쪽 봉인문 너머가 오든링이에요.',[
      [.066,.24,'무너진 입구'],[.268,.22,'석벽의 전투 기록'],[.51,.24,'망자의 석관'],[.69,.25,'유물 보관대'],[.89,.28,'봉인문']]],
    arena:['황금 콜로세움 로비','우승컵 진열대를 지나 중앙 경기장으로 들어가 보세요.',[
      [.07,.26,'선수 출입구'],[.20,.28,'황금 우승컵'],[.34,.24,'경기 기록대'],[.83,.25,'관람석 안내대'],[.55,.35,'중앙 경기장']]],
    duel:['검격의 회랑','청색 깃발과 교차한 검을 따라 결투장의 기록을 살펴보세요.',[
      [.065,.25,'회랑 입구'],[.31,.28,'결투의 문장'],[.50,.30,'교차 검 장식'],[.71,.24,'무기 보관대'],[.91,.29,'결투장 입구']]],
    tactics:['작전 지휘 본부','중앙 작전 지도와 양옆의 기록대에서 전장을 둘러보세요.',[
      [.06,.25,'본부 출입구'],[.49,.32,'중앙 작전 지도'],[.23,.26,'지도 보관소'],[.69,.23,'지휘관 책상'],[.91,.28,'전장 배치실']]],
    cat:['달빛 고양이 살롱','분홍 진열장과 커다란 고양이 쿠션이 있는 살롱이에요.',[
      [.065,.23,'카페 출입구'],[.20,.26,'케이크 진열대'],[.58,.30,'고양이 캣타워'],[.42,.24,'창가 좌석'],[.91,.28,'살롱 안쪽 문']]],
    studio:['창작자의 작업실','기어와 작업대 사이에 작품의 제작 이야기를 모아 뒀어요.',[
      [.06,.24,'작업실 입구'],[.26,.29,'제작 설계도'],[.56,.31,'톱니바퀴 전시'],[.73,.23,'공구 작업대'],[.92,.28,'실험실']]],
    tower:['별빛 연구탑','별자리 지도와 망원경을 지나 연구 기록을 찾아보세요.',[
      [.07,.24,'연구탑 현관'],[.43,.30,'황동 망원경'],[.64,.28,'별자리 지도'],[.25,.23,'왼쪽 서가'],[.92,.27,'전망대 통로']]],
    corp:['fur.corp · 본사 로비','리셉션에서 회사를 둘러보고, 오른쪽 엘리베이터를 찾아보세요.',[
      [.075,.24,'유리 출입구'],[.28,.28,'리셉션 데스크'],[.50,.30,'프로젝트 쇼케이스'],[.72,.24,'미팅 라운지'],[.91,.31,'엘리베이터 홀']]]
  };
  const roles=[
    ['exit','나가기','월드로 돌아가기',null,'↩'],
    ['intro','작품 소개','작품 소개 보기','작품의 내용과 제작 정보를 볼 수 있어요.','✦'],
    ['gallery','전시 기록','전시 기록 보기','스크린샷과 후기를 보려면 여기예요.','▧'],
    ['guide','비서 설명','비서 설명 듣기','이 전시실에서 볼 수 있는 것들을 알려 드릴게요.','✧'],
    ['portal','게임 실행','게임 플레이하기','여기에서 작품을 실행할 수 있어요.','▶']
  ];
  const statusLabels={finished:'완결',released:'정식 출시',live_service:'라이브 서비스',in_development:'개발 중',unknown:'상태 미정'};
  const featuredLocations={castle:[.268,.39],arena:[.24,.43],duel:[.30,.41],tactics:[.34,.41],
    cat:[.26,.41],studio:[.26,.41],tower:[.30,.44],corp:[.46,.45]};
  const introductions={
    odenring:'개성 강한 보스들과 맞서는 3D 액션. 공격을 읽고, 피하고, 반격하세요.',
    'oibung-arena':'공이 부딪히며 승부가 뒤집히는 핀볼 자동 배틀.',
    ochams:'기술을 골라 턴마다 승부를 겨루는 3D 대전.',
    'campus-frontier':'대학을 고르고 부대를 지휘해 거점을 차지하는 턴제 전략 게임.'
  };
  const state={active:false,game:null,style:'studio',origin:null,nearest:null,selected:null,media:null};
  const curatedScenes={
    odenring:'assets/world-snow/preview-odenring.webp',
    'oibung-arena':'assets/world-snow/preview-arena.jpg'
  };
  const guideLines={
    castle:'농이에요. 벽에 걸린 보스전부터 보세요. 공격을 피한 뒤 반격할 틈을 찾는 게임이에요.',
    arena:'빵이에요. 공은 알아서 움직여요. 벽을 튕기며 모은 기세가 차면 고유 스킬이 발동해요.',
    tactics:'농이에요. 어느 거점을 먼저 점령할지 생각해 보세요. 거점에서 얻는 자원으로 다음 턴을 준비해요.',
    duel:'빵이에요. 상대가 다음 턴에 뭘 쓸지 예상하고 기술을 골라 보세요.'
  };
  function host(){
    const stop=stations.find(station=>station.id==='guide');
    const formId=['arena','duel','corp'].includes(state.style)?'devil':'angel';
    return stop?{x:stop.x+76,formId,name:formId==='devil'?'빵':'농'}:null;
  }
  let mediaRevision=0;
  let width=1850;
  let stations=[];
  const safeUrl=url=>{try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
  const layout=()=>layouts[state.style];
  const element=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text)node.textContent=text;
    return node;
  };
  const button=(className,text)=>{
    const node=element('button',className,text);
    node.type='button';
    return node;
  };

  const hud=element('div','world-interior-hud');hud.id='world-interior-hud';hud.hidden=true;
  const location=element('div','world-interior-location');
  const locationTitle=element('strong','world-room-title');
  const locationStop=element('small','world-room-location-stop');
  location.append(locationTitle,locationStop);
  const leaveButton=button('','↩ 월드로');leaveButton.id='world-interior-return';
  leaveButton.addEventListener('click',()=>window.OIBUNG_WORLD?.leaveInterior());
  hud.append(location,leaveButton);stage.append(hud);

  const markers=element('div','world-room-markers');
  markers.hidden=true;
  markers.setAttribute('role','group');
  markers.setAttribute('aria-label','실내 전시물');
  const markerControls=roles.map(([id,,,,icon])=>{
    const control=button('world-room-sign');
    control.dataset.stop=id;
    const symbol=element('span','world-room-sign-icon',icon);symbol.setAttribute('aria-hidden','true');
    const place=element('strong','world-room-sign-place');
    const role=element('small','world-room-sign-role');
    const label=element('span','world-room-sign-label');
    label.append(place,role);
    control.append(symbol,label);
    control.addEventListener('click',()=>window.OIBUNG_WORLD?.approachInterior(stations.find(stop=>stop.id===id)));
    markers.append(control);
    return {control,place,role};
  });
  stage.append(markers);
  const feature=button('world-featured-exhibit');
  const featureImage=element('img');
  const featureName=element('strong','world-featured-name');
  featureImage.alt='';
  feature.append(featureImage,featureName);
  feature.hidden=true;
  feature.addEventListener('click',()=>showInfo('intro',{focus:true}));
  stage.append(feature);

  const sheet=element('section','world-interior-info');sheet.id='world-interior-info';sheet.hidden=true;
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','false');
  sheet.setAttribute('aria-labelledby','world-interior-info-title');
  const close=button('world-info-close','×');close.setAttribute('aria-label','설명 패널 닫기');
  const kicker=element('small','world-info-kicker');
  const title=element('h2');title.id='world-interior-info-title';
  const header=element('header','world-info-header');header.append(kicker,title,close);
  const nav=element('div','world-info-nav');
  nav.setAttribute('role','group');nav.setAttribute('aria-label','전시 정보');
  const tabs=new Map([['intro','작품 소개'],['gallery','전시 기록'],['guide','비서 설명']].map(([kind,label])=>{
    const tab=button('',label);
    tab.addEventListener('click',()=>showInfo(kind));
    nav.append(tab);
    return [kind,tab];
  }));
  const body=element('div','world-info-body');
  const desc=element('p','world-info-description');
  const cover=element('figure','world-info-cover');
  const coverImage=element('img');coverImage.loading='lazy';
  const coverCaption=element('figcaption');
  cover.append(coverImage,coverCaption);
  const details=element('div','world-info-details');details.append(desc);
  const route=element('ol','world-info-route');details.append(route);
  body.append(details,cover);
  const actions=element('div','world-info-actions');
  sheet.append(header,nav,body,actions);stage.append(sheet);

  const focusStage=()=>stage.focus({preventScroll:true});
  function closeInfo(){
    sheet.hidden=true;
    state.selected=null;
    focusStage();
  }
  close.addEventListener('click',closeInfo);
  sheet.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();e.preventDefault();closeInfo();}
  });
  function openOriginal(kind){
    const game=state.game;
    if(!game)return;
    closeInfo();
    const dialog=document.getElementById('game-dialog');
    if(dialog)dialog.dataset.worldTheme=state.style;
    const name=document.getElementById('world-interior-name');
    if(name)name.textContent=game.title+'의 세계';
    window.OIBUNG_CATALOG?.openDetail(game.id);
    if(kind==='gallery'){
      requestAnimationFrame(()=>{
        if(dialog?.open)document.getElementById('screenshots-title')?.scrollIntoView({block:'start'});
      });
    }
  }
  function setMedia(url,label){
    state.media=url?{url,label}:null;
    featureImage.hidden=!url;
    if(url&&featureImage.getAttribute('src')!==url)featureImage.src=url;
    if(!url)featureImage.removeAttribute('src');
    cover.hidden=!url;
    if(url&&coverImage.getAttribute('src')!==url)coverImage.src=url;
    if(!url)coverImage.removeAttribute('src');
    coverCaption.textContent=label||'';
  }
  featureImage.addEventListener('error',()=>{
    if(!state.media)return;
    const fallback=safeUrl(state.game?.thumbnailUrl);
    if(fallback&&fallback!==state.media.url)setMedia(fallback,'등록된 작품 표지');
    else setMedia(null);
  });
  async function loadMedia(game){
    const revision=++mediaRevision;
    const curated=Object.hasOwn(curatedScenes,game.id)?curatedScenes[game.id]:null;
    if(curated){setMedia(curated,'실제 플레이 화면');return;}
    setMedia(safeUrl(game.thumbnailUrl),'등록된 작품 표지');
    try{
      const scene=safeUrl(await window.OIBUNG_EXHIBIT_MEDIA?.getScene(game.id));
      if(revision===mediaRevision&&scene)setMedia(scene,'등록된 스크린샷');
    }catch{
      // The registered cover remains available when the gallery is offline.
    }
  }
  function showInfo(kind,{focus=true}={}){
    const game=state.game;
    if(!game||!tabs.has(kind))return false;
    const opening=sheet.hidden;
    const [roomName,welcome]=layout();
    const currentStop=stations.find(stop=>stop.id===kind);
    sheet.dataset.theme=state.style;
    sheet.dataset.view=kind;
    const status=Object.hasOwn(statusLabels,game.developmentStatus)?statusLabels[game.developmentStatus]:null;
    const intro=Object.hasOwn(introductions,game.id)?introductions[game.id]:game.tagline||game.description;
    kicker.textContent=kind==='intro'?[game.genre||roomName,status].filter(Boolean).join(' · '):currentStop.label+' · '+roomName;
    title.textContent=game.title;
    nav.hidden=kind==='intro';
    for(const [id,tab] of tabs)tab.setAttribute('aria-pressed',String(id===kind));
    desc.textContent=kind==='intro'?(intro||welcome):kind==='guide'?(guideLines[state.style]||((host()?.name||'농')+'이에요. '+welcome))
      :'등록된 스크린샷과 플레이 후기는 작품 기록에서 볼 수 있어요.';
    route.hidden=kind!=='guide';
    route.replaceChildren();
    if(kind==='guide'){
      for(const stop of [...stations].sort((a,b)=>a.x-b.x)){
        if(stop.id==='exit'||stop.id==='guide')continue;
        const item=element('li');item.append(element('strong','',stop.label),element('span','',stop.role));route.append(item);
      }
    }
    actions.replaceChildren();
    const url=safeUrl(game.playUrl);
    if(url){
      const launch=element('a','','게임 시작');launch.href=url;launch.target='_blank';launch.rel='noopener noreferrer';
      actions.append(launch);
    }
    const detailButton=button('',kind==='gallery'?'스크린샷·후기 열기':'자세히 보기');
    detailButton.addEventListener('click',()=>openOriginal(kind));actions.append(detailButton);
    state.selected=kind;
    sheet.hidden=false;
    if(opening)sheet.scrollTop=0;
    if(focus&&(opening||!sheet.contains(document.activeElement)))close.focus({preventScroll:true});
    return true;
  }
  function resize(w,h){
    const previous=width;
    width=Math.max(w,Math.min(1850,Math.max(1180,Math.round(h*2.22))));
    for(const stop of stations)stop.x=Math.round(stop.ratio*width);
    return width/previous;
  }
  function enter(game,style,origin){
    if(!game||!game.id)return false;
    state.active=true;state.game=game;state.style=layouts[style]?style:'studio';
    state.origin=origin;state.nearest=null;state.selected=null;
    const [roomName,,landmarks]=layout();
    const canLaunch=!!safeUrl(game.playUrl);
    stations=roles.map(([id,role,action,hint],i)=>{
      const [ratio,height,label]=landmarks[i];
      const noLaunch=id==='portal'&&!canLaunch;
      return {id,x:Math.round(ratio*width),ratio,height,label,
        role:noLaunch?'작품 상세':role,
        action:id==='guide'?(['arena','duel','corp'].includes(state.style)?'빵에게 설명 듣기':'농에게 설명 듣기'):noLaunch?'작품 상세 보기':action,
        hint:noLaunch?'이 작품의 등록 정보와 설명을 볼 수 있어요.':hint};
    });
    for(const [i,stop] of stations.entries()){
      const {control,place,role}=markerControls[i];
      place.textContent=stop.label;role.textContent=stop.role;
      control.setAttribute('aria-label',stop.label+' · '+stop.role);
    }
    sheet.hidden=true;hud.hidden=false;markers.hidden=false;
    stage.dataset.roomTheme=state.style;
    window.OIBUNG_PIXEL_SCENES.preload(state.style);
    locationTitle.textContent=state.style==='corp'?roomName:game.title+' · '+roomName;
    locationStop.textContent='';
    stage.classList.add('is-world-interior');
    featureName.textContent=game.title;
    feature.setAttribute('aria-label',game.title+' 대표 전시 열기');
    void loadMedia(game);
    showInfo('intro',{focus:false});
    return true;
  }
  function leave(){
    if(!state.active)return null;
    const origin=state.origin;
    mediaRevision++;
    state.active=false;state.game=null;state.origin=null;state.nearest=null;
    closeInfo();hud.hidden=true;markers.hidden=true;feature.hidden=true;
    delete stage.dataset.roomTheme;
    stage.classList.remove('is-world-interior');
    return origin;
  }
  function nearest(x){
    if(!state.active)return null;
    let best=null,dist=Math.min(112,width*.072);
    for(const stop of stations){
      const d=Math.abs(stop.x-x);
      if(d<=dist){dist=d;best=stop;}
    }
    if(state.nearest!==best){
      state.nearest=best;
      locationStop.textContent=best?.label||'전시실 탐험 중';
    }
    return best;
  }
  function interact(object,handlers={}){
    if(!state.active)return false;
    const target=object||state.nearest;
    if(!target)return false;
    if(target.id==='exit'){handlers.leave?.();return true;}
    if(target.id==='portal'){
      const url=safeUrl(state.game.playUrl);
      if(url){window.open(url,'_blank','noopener,noreferrer');return true;}
      return showInfo('intro');
    }
    return showInfo(target.id);
  }
  function drawArt(ctx,view){
    if(state.active)window.OIBUNG_PIXEL_SCENES.drawIndoor(ctx,view,state.style,width);
  }
  function drawForeground(ctx,{W,H,groundY,camera}){
    if(!state.active)return;
    const [ratio,elevation]=featuredLocations[state.style];
    const featureX=Math.round(width*ratio-camera);
    feature.hidden=featureX<35||featureX>W-35;
    if(!feature.hidden){
      feature.style.left=featureX+'px';
      feature.style.top=Math.round(groundY-H*elevation)+'px';
      feature.style.setProperty('--exhibit-width',state.style==='castle'
        ?Math.round(Math.min(width*.161,W*.65,300))+'px':'');
    }
    for(const [i,stop] of stations.entries()){
      const {control}=markerControls[i];
      const x=Math.round(stop.x-camera);
      control.hidden=x<28||x>W-28;
      if(control.hidden)continue;
      const edge=W<620?61:79;
      control.style.left=Math.min(W-edge,Math.max(edge,x))+'px';
      control.style.top=Math.round(groundY-Math.max(78,Math.min(249,H*stop.height)))+'px';
      control.classList.toggle('is-nearby',stop.id===state.nearest?.id);
    }
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!sheet.hidden&&!document.querySelector('dialog[open]')){
      e.preventDefault();e.stopImmediatePropagation();closeInfo();
    }
  },true);
  window.OIBUNG_INTERIORS={
    enter,leave,interact,nearest,resize,host,draw:drawArt,drawForeground,showInfo,
    isActive:()=>state.active,isInfoOpen:()=>!sheet.hidden,
    blocksMovement:()=>!sheet.hidden&&state.selected!=='intro',
    currentGame:()=>state.game,theme:()=>state.style,
    roomWidth:()=>width,objects:()=>stations,
    spawnX:()=>Math.round(featuredLocations[state.style][0]*width)-96,welcome:()=>layout()[1],
    state:()=>({active:state.active,gameId:state.game?.id||null,nearest:state.nearest?.id||null,
      infoOpen:!sheet.hidden,objectCount:stations.length})
  };
})();
