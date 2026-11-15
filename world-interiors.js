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
  const rect=(c,x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
  const ellipse=(c,x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(0.1,rx),Math.max(0.1,ry),0,0,Math.PI*2);c.fill();};
  const line=(c,x1,y1,x2,y2,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);c.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);c.stroke();};
  const poly=(c,points,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.closePath();c.fill();};
  function safeUrl(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
  function theme(){return themes[state.style]||themes.studio;}
  const hud=document.createElement('div');
  hud.id='world-interior-hud';hud.className='world-interior-hud';hud.hidden=true;
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
    const type=kind==='gallery'?'ARCHIVE':kind==='guide'?'CURATOR':'EXHIBITION';
    kicker.textContent='OIBUNG WORLD · '+type;
    title.textContent=kind==='gallery'?'작품 기록 · '+game.title:kind==='guide'?'안내 비서의 이야기':game.title;
    desc.textContent=kind==='gallery'
      ? '이 전시실에 보관된 스크린샷, 제작 정보, 플레이 기록과 후기를 살펴보세요.'
      : kind==='guide'?(game.tagline||t.intro)+'\n'+(game.description||'친구들의 상상력이 하나의 세계가 된 작품입니다.')
      : (game.description||t.intro);
    meta.textContent=[game.genre,game.developer,game.status].filter(Boolean).join(' · ')||t.label;
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
    sheet.hidden=true;hud.hidden=false;
    loc.textContent=game.title+'  ·  '+theme().label;
    stage.classList.add('is-world-interior');
    return true;
  }
  function leave(){
    if(!state.active)return null;
    const origin=state.origin;
    state.active=false;state.game=null;state.origin=null;state.nearest=null;
    closeInfo();hud.hidden=true;sheet.hidden=true;
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

  function drawArt(c,v){
    if(!state.active)return;
    const {W,H,groundY,camera,elapsed,reducedMotion}=v;
    const t=theme();
    // High ceiling and atmospheric depth, clipped by the game viewport.
    const sky=c.createLinearGradient(0,0,0,groundY);
    sky.addColorStop(0,t.shadow);sky.addColorStop(.65,t.wall);sky.addColorStop(1,t.stone);
    c.fillStyle=sky;c.fillRect(0,0,W,H);
    // Original WebP masonry is used at low opacity, so hall stone gains
    // fine detail without extra network requests or giant new textures.
    const textureAtlas=window.OIBUNG_CINEMATIC_ART;
    if(textureAtlas?.ready('ornate_stone')){
      const texture=textureAtlas.images.ornate_stone;
      c.save();c.globalAlpha=.115;
      const tw=238,shift=Math.floor(camera*.17)%tw;
      for(let x=-tw-shift;x<W+tw;x+=tw){
        for(let y=0;y<groundY;y+=tw)c.drawImage(texture,x,y,tw,tw);
      }
      c.restore();
    }
    // Fill the viewport with the actual hall. The original short backdrop
    // left a giant featureless black ceiling on tall phones and desktops.
    const top=Math.max(10,groundY-Math.max(690,H*.86));
    rect(c,0,top,W,13,t.trim);rect(c,0,top+13,W,14,t.shadow);
    // Vaulted ribbing, fresco medallions, and decorative ceiling joinery.
    // These are architectural perspective cues rather than movement obstacles.
    for(let xx=Math.floor(camera/320)*320-320;xx<camera+W+320;xx+=320){
      const x=Math.round(xx-camera);
      poly(c,[[x,top+20],[x+160,top+145],[x+320,top+20]],t.shadow);
      poly(c,[[x+14,top+26],[x+160,top+111],[x+306,top+26]],t.wall);
      line(c,x+6,top+24,x+160,top+129,t.trim,4);
      line(c,x+314,top+24,x+160,top+129,t.trim,4);
      ellipse(c,x+160,top+108,14,14,t.trim);
      ellipse(c,x+160,top+108,9,9,t.glass);
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4;
        const dx=Math.round(Math.cos(a)*25),dy=Math.round(Math.sin(a)*20);
        rect(c,x+160+dx,top+108+dy,3,3,t.light);
      }
    }
    // Hanging chandeliers and flickering candles add depth and scale.
    for(let xx=Math.floor(camera/410)*410-410;xx<camera+W+410;xx+=410){
      const x=xx-camera+205,baseY=top+68;
      line(c,x,top+14,x,baseY+68,t.shadow,5);
      line(c,x+1,top+16,x+1,baseY+66,t.trim,1);
      ellipse(c,x,baseY+73,66,13,t.shadow);
      ellipse(c,x,baseY+69,62,8,t.trim);
      for(let k=-2;k<=2;k++){
        const px=x+k*24;
        rect(c,px-3,baseY+47,6,17,t.stone);
        rect(c,px-2,baseY+40,4,10,t.light);
        const flame=reducedMotion?0:Math.sin(elapsed*4+k*2.7)*2;
        ellipse(c,px+flame,baseY+35,4,8,t.glass);
        ellipse(c,px,baseY+35,2,4,t.light);
      }
      ellipse(c,x,baseY+73,8,8,t.light);
    }
    // Warm diagonal illumination through the glass. Static when reduced
    // motion is preferred; no blur filter or GPU compositing needed.
    c.save();c.globalAlpha=.085;
    for(let xx=Math.floor(camera/465)*465-465;xx<camera+W+465;xx+=465){
      const x=xx-camera+95;
      poly(c,[[x-27,top+132],[x+27,top+132],[x+200,groundY-28],[x+33,groundY-28]],t.light);
    }
    c.restore();
    for(let x=Math.floor(camera/155)*155-155;x<camera+W+170;x+=155){
      const sx=Math.round(x-camera),col=(Math.floor(x/155)%3+3)%3;
      rect(c,sx,top+31,4,groundY-top-46,t.shadow);
      rect(c,sx+4,top+31,2,groundY-top-46,t.light);
      // Stone wall micro-bricks, alternating mortar.
      for(let y=top+44;y<groundY-34;y+=23){
        line(c,sx+8,y,sx+150,y,t.shadow,1);
        for(let xx=sx+(Math.floor(y/23)%2)*40;xx<sx+151;xx+=59){
          rect(c,xx,y+2,2,19,col===0?t.light:t.shadow);
        }
      }
      rect(c,sx+8,groundY-29,145,8,t.trim);
      // Arch-supported columns with reflective gold edging.
      rect(c,sx-10,top+35,16,groundY-top-56,t.stone);
      rect(c,sx-9,top+36,3,groundY-top-58,t.light);
      rect(c,sx-18,top+35,32,9,t.trim);
      rect(c,sx-18,groundY-35,32,11,t.shadow);
      if(col===0){
        // Stained-glass window, with cut glass and leadwork.
        rect(c,sx+48,top+99,59,155,t.shadow);
        poly(c,[[sx+48,top+106],[sx+78,top+63],[sx+108,top+106]],t.trim);
        rect(c,sx+53,top+106,51,143,t.glass);
        for(let j=0;j<8;j++)rect(c,sx+55+(j*17)%44,top+115+j*15,9,15,j%2?t.rug:t.light);
        line(c,sx+78,top+105,sx+78,top+246,t.shadow,4);
        for(let j=0;j<6;j++)rect(c,sx+53,top+124+j*22,51,3,t.shadow);
      }
    }
    // Painted second-story balcony with dramatic banisters.
    rect(c,0,top+275,W,14,t.shadow);
    rect(c,0,top+275,W,4,t.trim);
    for(let x=Math.floor(camera/27)*27;x<camera+W+35;x+=27){
      const sx=x-camera;
      rect(c,sx,top+252,4,24,t.stone);rect(c,sx+1,top+253,1,17,t.light);
    }
    // Genuine perspective floor using offset stone courses; non-platform art.
    rect(c,0,groundY-14,W,H-groundY+14,t.shadow);
    rect(c,0,groundY-13,W,13,t.stone);
    for(let row=0;row<Math.ceil((H-groundY+20)/18);row++){
      const y=groundY+row*18;
      rect(c,0,y,W,1,t.trim);
      for(let x=-60;x<W+60;x+=65){
        const sx=x-(Math.floor(camera*(.65+row*.035))%65)+(row%2)*31;
        rect(c,sx,y+2,62,15,row%2?t.wall:t.stone);
        rect(c,sx+2,y+3,47,1,t.light);
        rect(c,sx+3,y+12,32,1,t.shadow);
      }
    }
    // Central runway guides visitors toward the next exhibit.
    rect(c,0,groundY-4,W,10,t.rug);
    rect(c,0,groundY-5,W,2,t.trim);
    for(let x=Math.floor(camera/32)*32;x<camera+W+40;x+=32){
      rect(c,x-camera,groundY+2,10,1,t.trim);
    }
    const left=Math.max(0,Math.floor((camera-100)/WIDTH));
    if(left>99)return; // protection against malicious camera data
    for(let i=0;i<positions.length;i++){
      const object=positions[i];
      const x=Math.round(object.x-camera);
      if(x<-180||x>W+180)continue;
      drawExhibit(c,x,groundY,top,t,object,i,elapsed,reducedMotion);
    }
    // Theme-specific monumental centerpiece, kept behind the actual player.
    if(state.style==='castle')drawThrone(c,950-camera,groundY,t,elapsed,reducedMotion);
    if(state.style==='arena')drawArenaFloor(c,952-camera,groundY,t,elapsed,reducedMotion);
    if(state.style==='tactics')drawWarMap(c,952-camera,groundY,t);
    if(state.style==='cat')drawCatLounge(c,952-camera,groundY,t);
    if(state.style==='tower')drawOrrery(c,952-camera,groundY,t,elapsed,reducedMotion);
    drawLocationHUD(c,W,H,camera,groundY,t);
  }
  function drawExhibit(c,x,ground,top,t,obj,i,time,reduced){
    if(obj.kind==='exit'){
      rect(c,x-57,ground-218,114,214,t.trim);
      rect(c,x-49,ground-214,98,210,t.shadow);
      poly(c,[[x-49,ground-214],[x,ground-268],[x+49,ground-214]],t.trim);
      rect(c,x-36,ground-191,72,188,t.wall);
      rect(c,x-29,ground-186,57,181,t.shadow);
      rect(c,x-4,ground-173,7,165,t.trim);
      ellipse(c,x+27,ground-88,4,4,t.trim);
      rect(c,x-62,ground-10,124,12,t.stone);
    }else if(obj.kind==='intro'){
      // Golden illustrated movie-poster alcove and detailed hanging frame.
      rect(c,x-115,ground-325,230,252,t.shadow);
      rect(c,x-110,ground-320,220,242,t.trim);
      rect(c,x-100,ground-310,200,222,t.wall);
      const castleArt=state.style==='castle'&&window.OIBUNG_CINEMATIC_ART?.ready('castle_facade')
        ?window.OIBUNG_CINEMATIC_ART.images.castle_facade:null;
      if(castleArt){
        c.save();c.beginPath();c.rect(x-96,ground-306,192,215);c.clip();
        c.imageSmoothingEnabled=true;
        c.drawImage(castleArt,x-96,ground-306,192,215);
        c.restore();c.imageSmoothingEnabled=false;
      }
      const imageColors=[t.shadow,t.glass,t.rug,t.light,t.stone];
      if(!castleArt){
        for(let n=0;n<11;n++){
          poly(c,[[x-86+(n%3)*18,ground-117],[x-78+(n%3)*12,ground-164-n*9],[x+81-n*6,ground-120]],imageColors[n%5]);
        }
      }
      if(!castleArt){
        ellipse(c,x,ground-233,43,43,t.glass);
        ellipse(c,x,ground-233,31,31,t.trim);
      }
      rect(c,x-50,ground-145,100,7,t.light);
      rect(c,x-46,ground-130,91,4,t.trim);
      rect(c,x-80,ground-65,160,10,t.shadow);
    }else if(obj.kind==='gallery'){
      rect(c,x-118,ground-332,236,264,t.trim);
      rect(c,x-109,ground-320,218,242,t.shadow);
      for(let j=0;j<3;j++){
        const xx=x-97+j*67;
        rect(c,xx,ground-291,58,165,t.stone);
        rect(c,xx+4,ground-285,50,148,j===1?t.glass:t.rug);
        poly(c,[[xx+8,ground-173],[xx+30,ground-268],[xx+50,ground-173]],t.shadow);
        rect(c,xx+6,ground-148,46,2,t.trim);
      }
      rect(c,x-95,ground-114,190,7,t.trim);
    }else if(obj.kind==='guide'){
      // A welcome desk and an ornate object book; the guide follows nearby.
      rect(c,x-106,ground-122,212,113,t.shadow);
      rect(c,x-104,ground-126,208,20,t.trim);
      rect(c,x-91,ground-99,184,82,t.stone);
      rect(c,x-78,ground-91,158,12,t.light);
      rect(c,x-30,ground-150,60,27,t.rug);
      rect(c,x-26,ground-155,52,7,t.trim);
      rect(c,x-2,ground-182,4,30,t.trim);
      ellipse(c,x,ground-187,9,7,t.light);
    }else{
      const glow=reduced?.4:.35+Math.sin(time*2.6)*.14;
      c.save();c.globalAlpha=glow;
      ellipse(c,x,ground-190,85,120,t.glass);c.restore();
      rect(c,x-79,ground-225,158,223,t.trim);
      rect(c,x-70,ground-219,140,216,t.shadow);
      poly(c,[[x-60,ground-204],[x,ground-290],[x+60,ground-204]],t.glass);
      rect(c,x-49,ground-206,98,200,t.glass);
      for(let k=0;k<12;k++){
        line(c,x-38+k*7,ground-195,x-38+k*7,ground-21,k%3?t.light:t.rug,1);
      }
      rect(c,x-105,ground-14,210,15,t.trim);
    }
    // A readable icon and selection sparkle at walk height.
    const selected=state.nearest?.id===obj.id;
    if(selected){
      ellipse(c,x,ground-355,8,8,t.trim);
      rect(c,x-2,ground-363,4,16,t.light);
    }
    const label=obj.kind==='play'&&!safeUrl(state.game?.playUrl)?'작품 상세 보기':obj.label;
    c.save();
    c.textAlign='center';c.font='bold 14px "Noto Sans KR",system-ui,sans-serif';
    const tw=Math.min(215,c.measureText(label).width+24);
    rect(c,x-tw/2,ground-79,tw,29,selected?t.trim:t.shadow);
    c.fillStyle=selected?t.shadow:t.light;
    c.fillText(label,x,ground-60);
    c.restore();
  }
  function drawThrone(c,x,ground,t){
    if(x<-185||x>c.canvas.width+185)return;
    poly(c,[[x-65,ground-155],[x-40,ground-259],[x,ground-312],[x+40,ground-259],[x+65,ground-155]],t.trim);
    poly(c,[[x-51,ground-155],[x-32,ground-242],[x,ground-292],[x+32,ground-242],[x+51,ground-155]],t.rug);
    rect(c,x-81,ground-145,162,23,t.stone);
    rect(c,x-72,ground-139,144,115,t.wall);
    rect(c,x-96,ground-28,192,27,t.trim);
    rect(c,x-70,ground-8,140,10,t.shadow);
    // A sword above the throne—no combat mechanics in a game gallery.
    rect(c,x-3,ground-284,6,111,t.light);
    rect(c,x-19,ground-202,38,6,t.trim);
    rect(c,x-4,ground-195,8,21,t.trim);
  }
  function drawArenaFloor(c,x,ground,t,time,reduced){
    if(x<-180||x>c.canvas.width+180)return;
    ellipse(c,x,ground-64,114,25,t.trim);
    ellipse(c,x,ground-67,95,17,t.glass);
    for(let i=0;i<6;i++){
      const phase=reduced?i:i+time*.7;
      const xx=x+Math.cos(phase*1.05)*75,yy=ground-76+Math.sin(phase*1.05)*14;
      ellipse(c,xx,yy,4+i%2,4+i%2,i%2?t.rug:t.light);
    }
  }
  function drawWarMap(c,x,ground,t){
    if(x<-180||x>c.canvas.width+180)return;
    rect(c,x-109,ground-156,218,23,t.trim);
    rect(c,x-98,ground-135,18,111,t.stone);
    rect(c,x+82,ground-135,18,111,t.stone);
    rect(c,x-89,ground-165,178,40,t.light);
    for(let i=0;i<7;i++)line(c,x-84+i*28,ground-164,x-104+i*29,ground-129,t.glass,2);
    for(let i=0;i<12;i++)rect(c,x-75+(i*37)%145,ground-155+(i*13)%20,7,7,i%3?t.rug:t.glass);
  }
  function drawCatLounge(c,x,ground,t){
    if(x<-170||x>c.canvas.width+170)return;
    rect(c,x-93,ground-94,186,81,t.rug);rect(c,x-105,ground-101,23,80,t.stone);
    rect(c,x+82,ground-101,23,80,t.stone);
    ellipse(c,x,ground-117,73,19,t.light);
    poly(c,[[x-17,ground-129],[x-26,ground-153],[x-1,ground-132]],t.light);
    poly(c,[[x+17,ground-129],[x+26,ground-153],[x+1,ground-132]],t.light);
    ellipse(c,x-9,ground-123,4,3,t.shadow);ellipse(c,x+9,ground-123,4,3,t.shadow);
    rect(c,x-3,ground-119,6,3,t.rug);
  }
  function drawOrrery(c,x,ground,t,time,reduced){
    if(x<-170||x>c.canvas.width+170)return;
    const a=reduced?1:time*.32;
    ellipse(c,x,ground-145,92,64,t.trim);
    ellipse(c,x,ground-145,76,50,t.shadow);
    for(let i=0;i<7;i++){
      const angle=i*(Math.PI*2/7)+a;
      ellipse(c,x+Math.cos(angle)*78,ground-145+Math.sin(angle)*47,4+i%3,4+i%3,t.glass);
    }
    ellipse(c,x,ground-145,19,19,t.light);
    rect(c,x-3,ground-126,6,111,t.trim);
    rect(c,x-70,ground-17,140,13,t.stone);
  }
  function drawLocationHUD(c,W,H,camera,ground,t){
    // Low-contrast, unobtrusive floor shadows beneath interactive objects.
    for(const obj of positions){
      const x=obj.x-camera;
      if(x<-100||x>W+100)continue;
      ellipse(c,x,ground+3,54,5,'#15192466');
    }
  }
  function drawForeground(c,v){
    if(!state.active)return;
    const {W,groundY,camera}=v,t=theme();
    // Foreground candle posts and wrought-iron pillars for dimensional depth.
    for(let x=260;x<WIDTH;x+=350){
      const screen=Math.round(x-camera);
      if(screen<-75||screen>W+75)continue;
      rect(c,screen-6,groundY-71,12,70,t.shadow);
      rect(c,screen-10,groundY-75,20,7,t.trim);
      rect(c,screen-5,groundY-87,10,11,t.light);
      rect(c,screen-2,groundY-92,4,6,t.glass);
      ellipse(c,screen,groundY+3,20,3,'#11182666');
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
