/*
 * OIBUNG WORLD — explorable, theme-specific pixel interiors.
 * The existing side-scrolling character, physics and menu are reused.
 * Interior art is local procedural Canvas 2D, no new game data/backend.
 */
(() => {
  'use strict';
  const stage=document.getElementById('oibung-world-stage');
  if(!stage)return;
  const themes={
    castle:{wall:'#332d3d',shadow:'#1a1b2a',stone:'#6a5663',light:'#bd96a0',trim:'#d9ae81',glass:'#a74f63',rug:'#8e394d',metal:'#d8b898',label:'황혼의 왕좌 홀',intro:'붉은 촛불 아래 오든링의 보스들이 기다리는 전시실'},
    arena:{wall:'#51473d',shadow:'#242832',stone:'#a88f72',light:'#edd1a6',trim:'#f1cb89',glass:'#58c6c4',rug:'#337e84',metal:'#e6ce99',label:'황금 콜로세움 로비',intro:'튀어 오르는 공과 경기장의 함성이 남아 있는 공간'},
    duel:{wall:'#353d5a',shadow:'#1e263f',stone:'#8491b3',light:'#d0d4e4',trim:'#e5c69a',glass:'#c08592',rug:'#5f5e88',metal:'#e9d3b6',label:'검격의 회랑',intro:'검과 승부의 기록을 모아 둔 푸른 전당'},
    tactics:{wall:'#34483f',shadow:'#1e2c2e',stone:'#849d86',light:'#c8d1ac',trim:'#e3cf94',glass:'#98c1ad',rug:'#486d5b',metal:'#e5d8b7',label:'작전 지휘 본부',intro:'전략 지도와 작전 기록이 펼쳐지는 전시실'},
    cat:{wall:'#71516c',shadow:'#392b48',stone:'#c9a3b9',light:'#f9d9db',trim:'#f7d8a6',glass:'#edb5c9',rug:'#a8789f',metal:'#ffebc7',label:'달빛 고양이 저택',intro:'따뜻한 벨벳과 고양이 문양이 반기는 살롱'},
    studio:{wall:'#3d5860',shadow:'#202f39',stone:'#91acb0',light:'#d5e0d4',trim:'#f0cfa1',glass:'#9edfd6',rug:'#5c8490',metal:'#f2e0b9',label:'창작자의 갤러리',intro:'친구들이 만든 세계를 자유롭게 발견하는 방'},
    tower:{wall:'#51465e',shadow:'#292339',stone:'#9f91ab',light:'#ead8d8',trim:'#f0d2a2',glass:'#b5a8ce',rug:'#76618c',metal:'#edcfb9',label:'별빛 연구탑',intro:'별빛과 오래된 기록이 교차하는 신비한 전시장'}
  };
  const WIDTH=1850;
  const positions=[{id:'exit',x:116,label:'월드로 돌아가기',kind:'exit'},
    {id:'intro',x:432,label:'작품 소개 보기',kind:'intro'},
    {id:'gallery',x:792,label:'전시 기록 보기',kind:'gallery'},
    {id:'guide',x:1148,label:'비서 설명 듣기',kind:'guide'},
    {id:'portal',x:1530,label:'게임 플레이하기',kind:'play'}];
  const state={active:false,game:null,style:'studio',origin:null,nearest:null,selected:null};
  function safeUrl(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
  function theme(){return themes[state.style]||themes.studio;}
  const hud=document.createElement('div');
  hud.id='world-interior-hud';hud.className='world-interior-hud';hud.hidden=true;
  const markers=document.createElement('div');
  markers.className='world-room-markers';
  markers.hidden=true;
  markers.setAttribute('aria-hidden','true');
  const markerLabels=positions.map(object=>{
    const label=document.createElement('span');
    label.className='world-room-sign';
    label.textContent=object.label;
    markers.append(label);
    return label;
  });
  stage.append(markers);

  const loc=document.createElement('span');loc.className='world-interior-location';
  const leaveButton=document.createElement('button');leaveButton.type='button';leaveButton.id='world-interior-return';
  leaveButton.textContent='↩ 월드로';leaveButton.addEventListener('click',()=>window.OIBUNG_WORLD?.leaveInterior());
  hud.append(loc,leaveButton);stage.append(hud);

  const sheet=document.createElement('section');
  sheet.id='world-interior-info';sheet.className='world-interior-info';sheet.hidden=true;
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','false');sheet.setAttribute('aria-labelledby','world-interior-info-title');
  const close=document.createElement('button');close.type='button';close.className='world-info-close';close.setAttribute('aria-label','설명 패널 닫기');close.textContent='✕';
  const kicker=document.createElement('small');kicker.className='world-info-kicker';kicker.textContent='OIBUNG WORLD · EXHIBITION';
  const title=document.createElement('h2');title.id='world-interior-info-title';
  const desc=document.createElement('p');desc.className='world-info-description';
  const meta=document.createElement('p');meta.className='world-info-meta';
  const actions=document.createElement('div');actions.className='world-info-actions';
  sheet.append(close,kicker,title,desc,meta,actions);stage.append(sheet);
  const focusStage=()=>{stage.focus({preventScroll:true});};
  function closeInfo(){sheet.hidden=true;state.selected=null;focusStage();}
  close.addEventListener('click',closeInfo);
  sheet.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();closeInfo();}});
  function actionButton(text,handler){
    const button=document.createElement('button');button.type='button';button.textContent=text;
    button.addEventListener('click',handler);actions.append(button);return button;
  }
  function openOriginal(){
    const game=state.game;if(!game)return;
    closeInfo();
    const dialog=document.getElementById('game-dialog');
    if(dialog)dialog.dataset.worldTheme=state.style;
    const name=document.getElementById('world-interior-name');
    if(name)name.textContent=game.title+'의 세계';
    window.OIBUNG_CATALOG?.openDetail(game.id);
  }
  function showInfo(kind){
    const game=state.game;if(!game)return false;
    const t=theme();
    sheet.dataset.theme=state.style;
    sheet.style.setProperty('--room-art','url("'+window.OIBUNG_PIXEL_SCENES.roomArt(state.style)+'")');
    kicker.textContent=t.label;
    title.textContent=kind==='gallery'?'작품 기록 · '+game.title:kind==='guide'?'안내 비서의 이야기':game.title;
    desc.textContent=kind==='gallery'
      ? '이 전시실에 보관된 스크린샷, 제작 정보, 플레이 기록과 후기를 살펴보세요.'
      : kind==='guide'?(game.tagline||t.intro)+'\n'+(game.description||'친구들의 상상력이 하나의 세계가 된 작품입니다.')
      : (game.description||t.intro);
    meta.textContent=[game.genre,game.developer].filter(Boolean).join(' · ')||t.label;
    actions.replaceChildren();
    actionButton(kind==='gallery'?'스크린샷·후기 자세히 보기':'전체 작품 소개 보기',openOriginal);
    const url=safeUrl(game.playUrl);
    if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='게임 실행';actions.append(a);}
    state.selected=kind;
    sheet.hidden=false;close.focus({preventScroll:true});
    return true;
  }
  function enter(game,style,origin){
    if(!game||!game.id)return false;
    state.active=true;state.game=game;state.style=themes[style]?style:'studio';
    state.origin=origin;state.nearest=null;state.selected=null;
    sheet.hidden=true;hud.hidden=false;markers.hidden=false;
    stage.dataset.roomTheme=state.style;
    window.OIBUNG_PIXEL_SCENES.preload(state.style);
    markerLabels.at(-1).textContent=safeUrl(game.playUrl)?'게임 플레이하기':'작품 상세 보기';
    loc.textContent=game.title+'  ·  '+theme().label;
    stage.classList.add('is-world-interior');
    return true;
  }
  function leave(){
    if(!state.active)return null;
    const origin=state.origin;
    state.active=false;state.game=null;state.origin=null;state.nearest=null;
    closeInfo();hud.hidden=true;sheet.hidden=true;markers.hidden=true;
    delete stage.dataset.roomTheme;
    stage.classList.remove('is-world-interior');
    return origin;
  }
  function nearest(x){
    if(!state.active)return null;
    let best=null,dist=112;
    for(const object of positions){
      const d=Math.abs(object.x-x);
      if(d<=dist){dist=d;best=object;}
    }
    state.nearest=best;
    return best;
  }
  function interact(object,handlers={}){
    if(!state.active)return false;
    const target=object||state.nearest;if(!target)return false;
    if(target.id==='exit'){handlers.leave?.();return true;}
    if(target.id==='portal'){
      const url=safeUrl(state.game?.playUrl);
      if(url){
        // This is called synchronously from a key or button gesture.
        window.open(url,'_blank','noopener,noreferrer');
        return true;
      }
      return showInfo('intro');
    }
    return showInfo(target.id);
  }

  function drawArt(ctx,view){
    if(state.active)window.OIBUNG_PIXEL_SCENES.drawIndoor(ctx,view,state.style,WIDTH);
  }

  function drawForeground(ctx,{W,H,groundY,camera}){
    if(!state.active)return;
    for(const [i,object] of positions.entries()){
      const marker=markerLabels[i];
      const x=Math.round(object.x-camera);
      marker.hidden=x<55||x>W-55;
      if(marker.hidden)continue;
      marker.style.left=x+'px';
      marker.style.top=Math.round(groundY-Math.max(81,Math.min(225,H*.26)))+'px';
      marker.classList.toggle('is-nearby',object.id===state.nearest?.id);
    }
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!sheet.hidden&&!document.querySelector('dialog[open]')){
      e.preventDefault();e.stopImmediatePropagation();closeInfo();
    }
  },true);
  window.OIBUNG_INTERIORS={
    enter,leave,interact,nearest,draw:drawArt,drawForeground,showInfo,
    isActive:()=>state.active,isInfoOpen:()=>!sheet.hidden,
    currentGame:()=>state.game,theme:()=>state.style,
    roomWidth:()=>WIDTH,objects:()=>positions.map(obj=>({...obj})),
    state:()=>({active:state.active,gameId:state.game?.id||null,nearest:state.nearest?.id||null,
      infoOpen:!sheet.hidden,objectCount:positions.length})
  };
})();
