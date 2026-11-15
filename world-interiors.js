/* Landmark layouts and exhibit panels for the illustrated world interiors. */
(() => {
  'use strict';
  const stage=document.getElementById('oibung-world-stage');
  if(!stage)return;

  const layouts={
    castle:['황혼의 왕좌 홀','붉은 깃발 아래, 오든링의 보스와 여정을 만나 보세요.',[
      [.066,.25,'서쪽 현관'],[.23,.27,'왕좌와 붉은 깃발'],[.58,.31,'스테인드글라스 전시'],[.78,.24,'촛불 옆 서가'],[.94,.27,'황혼의 관문']]],
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
  const state={active:false,game:null,style:'studio',origin:null,nearest:null,selected:null};
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
  const meta=element('dl','world-info-meta');
  const cover=element('figure','world-info-cover');
  const coverImage=element('img');coverImage.loading='lazy';
  const coverCaption=element('figcaption');
  cover.append(coverImage,coverCaption);
  const details=element('div','world-info-details');details.append(desc,meta);
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
  function showInfo(kind){
    const game=state.game;
    if(!game||!tabs.has(kind))return false;
    const opening=sheet.hidden;
    const [roomName,welcome]=layout();
    const currentStop=stations.find(stop=>stop.id===kind);
    sheet.dataset.theme=state.style;
    kicker.textContent=currentStop.label+' · '+roomName;
    title.textContent=game.title;
    for(const [id,tab] of tabs)tab.setAttribute('aria-pressed',String(id===kind));
    desc.textContent=kind==='intro'?(game.description||welcome):kind==='guide'?welcome
      :'등록된 스크린샷과 플레이 후기는 작품 기록에서 볼 수 있어요.';
    meta.hidden=kind!=='intro';
    meta.replaceChildren();
    if(kind==='intro'){
      const fields=[['장르',game.genre],['제작',game.developer],
        ['상태',statusLabels[game.developmentStatus]||statusLabels.unknown],['플랫폼',game.platform]];
      for(const [key,value] of fields){
        if(!value)continue;
        const row=element('div');row.append(element('dt','',key),element('dd','',value));meta.append(row);
      }
    }
    route.hidden=kind!=='guide';
    route.replaceChildren();
    if(kind==='guide'){
      for(const stop of [...stations].sort((a,b)=>a.x-b.x)){
        if(stop.id==='exit'||stop.id==='guide')continue;
        const item=element('li');item.append(element('strong','',stop.label),element('span','',stop.role));route.append(item);
      }
    }
    const thumbnail=kind==='gallery'&&safeUrl(game.thumbnailUrl);
    coverImage.src=thumbnail||window.OIBUNG_PIXEL_SCENES.roomArt(state.style);
    coverImage.alt='';
    coverCaption.textContent=thumbnail?'등록된 작품 표지':roomName;
    actions.replaceChildren();
    const detailButton=button('',kind==='gallery'?'스크린샷·후기 열기':'전체 작품 소개 보기');
    detailButton.addEventListener('click',()=>openOriginal(kind));actions.append(detailButton);
    const url=safeUrl(game.playUrl);
    if(url){
      const launch=element('a','','게임 실행');launch.href=url;launch.target='_blank';launch.rel='noopener noreferrer';
      actions.append(launch);
    }
    state.selected=kind;
    sheet.hidden=false;
    if(opening){sheet.scrollTop=0;close.focus({preventScroll:true});}
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
        role:noLaunch?'작품 상세':role,action:noLaunch?'작품 상세 보기':action,
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
    return true;
  }
  function leave(){
    if(!state.active)return null;
    const origin=state.origin;
    state.active=false;state.game=null;state.origin=null;state.nearest=null;
    closeInfo();hud.hidden=true;markers.hidden=true;
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
    enter,leave,interact,nearest,resize,draw:drawArt,drawForeground,showInfo,
    isActive:()=>state.active,isInfoOpen:()=>!sheet.hidden,
    currentGame:()=>state.game,theme:()=>state.style,
    roomWidth:()=>width,objects:()=>stations,
    spawnX:()=>stations[0].x+68,welcome:()=>layout()[1],
    state:()=>({active:state.active,gameId:state.game?.id||null,nearest:state.nearest?.id||null,
      infoOpen:!sheet.hidden,objectCount:stations.length})
  };
})();
