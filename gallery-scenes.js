/* Hybrid B: original pixel curator in a pre-rendered 3D museum, same-character pixel horror. */
/* CURATOR_STAGING_V2: alpha-cutout expressions and cancellable blackout. */
(()=>{'use strict';
const host=document.getElementById('gallery-3d'),grid=document.getElementById('game-grid');if(!host||!grid)return;
const root=document.documentElement,S={index:0,phase:'tour',moves:0,power:0,threat:-1,torch:true,hidden:false,sound:false},human='assets/pixel/curator-neutral.png';let games=[],focus=null,pending=false,audio=null,gain=null,swipe=null;
host.innerHTML=`<section class="bk-stage" data-curator-art="loading" aria-label="전시관"><header class="bk-top"><span>OIBUNG GALLERY</span><div><button data-act="list">작품 목록</button><button data-act="night">소등 체험</button><button data-act="exit" hidden>일반 관람 복귀</button><button data-act="sound" aria-pressed="false">환경음 꺼짐</button></div></header><div class="bk-room"><div class="bk-light" aria-hidden="true"></div><button class="bk-frame" data-act="detail"><img alt=""><span class="bk-fallback">OTHER WORLDS</span><span class="bk-plaque"></span></button><img class="bk-human" alt="안내 비서" src="${human}"><div class="bk-monster" aria-hidden="true"><img class="bk-monster-sprite" alt="" src="assets/pixel/curator-monster-1.png"></div></div><nav class="bk-nav" aria-label="회랑 이동"><button data-act="prev" aria-label="이전 회랑">←</button><button data-act="next" aria-label="다음 회랑">→</button></nav><footer class="bk-caption"><span class="bk-count"></span><p role="status"></p><button data-act="talk">비서에게 묻기</button><button data-act="hide" hidden>액자 뒤에 숨기</button><button data-act="power" hidden>비상전원 복구</button><button data-act="torch" hidden>손전등 끄기</button><button data-act="quiet" hidden>조용히 걷기</button><button data-act="fuse" hidden>퓨즈 회수</button><button data-act="wait" hidden>기다리기</button><button data-act="restart" hidden>다시 시도</button><div class="bk-hud" role="status" aria-live="polite" hidden></div></footer><dialog class="bk-dialog" aria-labelledby="bk-warning"><h2 id="bk-warning">소등 후 관람 안내</h2><p>비서가 달라진 모습을 보이며 어둠 속에서 위협으로 등장합니다. 괴물이 회랑을 순찰합니다. 손전등을 켜면 물건을 찾기 쉽지만 발견 위험이 커집니다. 퓨즈를 수집하고 전원실에서 차단기를 올려야 탈출할 수 있습니다. 숨거나 조용히 움직이세요. 언제든 일반 관람으로 돌아올 수 있습니다. 환경음은 기본 꺼짐이며 번쩍임은 없습니다.</p><button data-act="start">소등 시작</button><button data-act="cancel">취소</button></dialog><dialog class="bk-list" aria-labelledby="bk-list-title"><h2 id="bk-list-title">작품 목록</h2><div></div><button data-act="close-list">닫기</button></dialog></section>`;
const $=s=>host.querySelector(s),stage=$('.bk-stage'),room=$('.bk-room'),frame=$('.bk-frame'),img=$('.bk-frame img'),plaque=$('.bk-plaque'),caption=$('.bk-caption p'),notice=$('.bk-dialog'),list=$('.bk-list'),actor=$('.bk-human'),monster=$('.bk-monster'),creature=$('.bk-monster-sprite');
const PIXEL_BASE='assets/pixel/';const RULES=window.OIBUNG_BLACKOUT_RULES;
if(!RULES)throw Error('OIBUNG_BLACKOUT_RULES missing: load gallery-blackout-rules.js first');
let curatorPose='neutral',blackoutTimer=null,distortionTimer=null,blackoutGame=null,patrolTimer=null;
function synchronizeBlackout(){if(!blackoutGame)return;S.index=blackoutGame.room;S.phase=blackoutGame.phase;S.moves=blackoutGame.turns;S.power=blackoutGame.powerRoom;S.torch=blackoutGame.torch;S.hidden=blackoutGame.hidden;S.threat=blackoutGame.monster;}
function stopPatrol(){if(patrolTimer!==null){clearInterval(patrolTimer);patrolTimer=null;}}
function beginPatrol(){stopPatrol();patrolTimer=setInterval(()=>{if(!blackoutGame||document.hidden||document.querySelector('dialog[open]'))return;RULES.tick(blackoutGame);synchronizeBlackout();render();},2400);}
function blackoutAction(result){if(!result)return;const message=result.message||'';if(result.type==='restored'){restore();return;}synchronizeBlackout();render(message);}
/* Artist-made atlas v3: four original full-body guide poses and four linked
   monster poses. Fallback stays intact until both real images are available. */
const CURATOR_V3_BASE='assets/curator-v3/';
const CURATOR_V3_CELL={w:228,h:408};
const CURATOR_V3_GUIDE={neutral:0,present:1,explain:2,alert:3};
let curatorV3=null;
function splitCharacterAtlas(image){
 const sprites=[];
 if(image.naturalWidth!==4*CURATOR_V3_CELL.w||image.naturalHeight!==CURATOR_V3_CELL.h)throw Error('Invalid curator v3 atlas dimensions');
 for(let i=0;i<4;i++){
  const canvas=document.createElement('canvas');canvas.width=CURATOR_V3_CELL.w;canvas.height=CURATOR_V3_CELL.h;
  const ctx=canvas.getContext('2d',{willReadFrequently:false});if(!ctx)throw Error('No canvas context');
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(image,i*CURATOR_V3_CELL.w,0,CURATOR_V3_CELL.w,CURATOR_V3_CELL.h,0,0,CURATOR_V3_CELL.w,CURATOR_V3_CELL.h);
  sprites.push(canvas.toDataURL('image/png'));
 }
 return sprites;
}
function loadCuratorV3(){
 const v4='assets/curator-v4/';
 const guide=['neutral','present','explain','alert'].map(x=>v4+'guide-'+x+'.webp');
 const monster=['disturbed','approach','lunge','watch'].map(x=>v4+'monster-'+x+'.webp');
 const morph=Array.from({length:10},(_,i)=>v4+'morph-'+String(i).padStart(2,'0')+'.webp');
 const read=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{if(i.naturalHeight===512&&i.naturalWidth===288)resolve(i);else reject(Error('wrong v4 dimensions'));};i.onerror=reject;i.src=src;});
 // A full preload prevents blank or half-loaded monster frames during pursuit.
 Promise.all([...guide,...monster,...morph].map(read)).then(()=>{
  curatorV3={humanFrames:guide,monsterFrames:monster,morphFrames:morph,quality:'v4'};
  stage.dataset.curatorArt='v4';render();
 }).catch(()=>{
  const readOld=name=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=CURATOR_V3_BASE+name+'-atlas.webp';});
  Promise.all([readOld('guide'),readOld('monster')]).then(([h,m])=>{
   curatorV3={humanFrames:splitCharacterAtlas(h),monsterFrames:splitCharacterAtlas(m),morphFrames:null,quality:'v3'};
   stage.dataset.curatorArt='v3';render();
  }).catch(()=>{stage.dataset.curatorArt='legacy';});
 });
}

const monsterCache=new Map([1,2].map(n=>{const src=PIXEL_BASE+'curator-monster-'+n+'.png';const img=new Image();img.src=src;img.addEventListener('load',()=>{if(creature.dataset.desired===src)creature.src=src;});return [src,img];}));
function setMonsterFrame(src){creature.dataset.desired=src;const img=monsterCache.get(src);if(img?.complete&&img.naturalWidth>0&&creature.getAttribute('src')!==src)creature.src=src;}
function cancelBlackout(){if(blackoutTimer!==null){clearTimeout(blackoutTimer);blackoutTimer=null;}if(distortionTimer!==null){clearTimeout(distortionTimer);distortionTimer=null;}stage.removeAttribute('data-blackout-pending');stage.removeAttribute('data-transformation');}
const btn=a=>$(`[data-act="${a}"]`),dark=()=>S.phase!=='tour';
function mode(value){if(root.dataset.galleryMode!==value)root.dataset.galleryMode=value;document.querySelectorAll('[data-gallery-mode-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.galleryModeChoice===value)));}
function volume(){if(gain)gain.gain.setTargetAtTime(S.sound&&dark()&&!document.hidden?.valueOf()&&!document.querySelector('dialog[open]')?.open?.valueOf()?0.018:0,audio.currentTime,.3);}
async function sound(){try{if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('unsupported');audio=new A();gain=audio.createGain();gain.gain.value=0;gain.connect(audio.destination);for(const hz of[53,79]){const o=audio.createOscillator();o.type='sine';o.frequency.value=hz;o.connect(gain);o.start();}}await audio.resume();S.sound=!S.sound;btn('sound').textContent=S.sound?'환경음 켜짐':'환경음 꺼짐';btn('sound').setAttribute('aria-pressed',String(S.sound));volume();}catch{S.sound=false;caption.textContent='이 브라우저에서는 환경음을 켤 수 없습니다. 소리 없이 관람할 수 있습니다.';}}
function restore(){
 cancelBlackout();stopPatrol();blackoutGame=null;curatorPose='neutral';
 Object.assign(S,{phase:'tour',moves:0,threat:-1,torch:true,hidden:false});
 mode('light');render('조명이 돌아왔습니다. 낮의 갤러리로 돌아왔습니다.');
}
function enterDark(){
 cancelBlackout();
 blackoutGame=RULES.begin(games.length,S.index);
 synchronizeBlackout();mode('dark');
 render('옆에 있던 비서가 사라졌습니다. 퓨즈를 찾아 비상전원을 복구하세요.');
 beginPatrol();
}
function start(){
 cancelBlackout();
 if(S.phase!=='tour'||!games.length)return;
 curatorPose='alert';stage.dataset.blackoutPending='true';
 render('잠깐만요. 방금 복도 끝에서…');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('motion-off');
 if(reduced){enterDark();return;}
 // Ten separately authored output frames are preloaded before beginning.
 blackoutTimer=setTimeout(()=>{
   blackoutTimer=null;
   if(stage.dataset.blackoutPending!=='true')return;
   const frames=curatorV3?.morphFrames;
   stage.dataset.transformation='true';
   if(!frames?.length){
     actor.src=curatorV3?curatorV3.monsterFrames[0]:PIXEL_BASE+'curator-corrupt.png';
     distortionTimer=setTimeout(()=>{distortionTimer=null;if(stage.dataset.blackoutPending==='true')enterDark();},760);
     return;
   }
   let frameIndex=0;
   function nextFrame(){
     if(stage.dataset.blackoutPending!=='true')return;
     actor.src=frames[frameIndex++];
     if(frameIndex===4)caption.textContent='…비서의 모습이 뒤틀립니다.';
     if(frameIndex<frames.length){distortionTimer=setTimeout(nextFrame,80);}
     else{distortionTimer=setTimeout(()=>{distortionTimer=null;if(stage.dataset.blackoutPending==='true')enterDark();},90);}
   }
   nextFrame();
 },320);
}
function refresh(){const api=window.OIBUNG_CATALOG;if(!api?.listGames)return;const old=games[S.index]?.id;const visible=new Set([...grid.querySelectorAll('.game-card')].filter(c=>!c.hidden&&c.style.display!=='none').map(c=>c.dataset.gameId));games=(api.listGames()||[]).filter(g=>visible.has(String(g.id)));if(blackoutGame&&blackoutGame.count!==games.length){restore();return;}const i=games.findIndex(g=>g.id===old);S.index=i<0?Math.min(S.index,Math.max(0,games.length-1)):i;S.power=Math.min(S.power,Math.max(0,games.length-1));if(S.threat>=games.length)S.threat=-1;render();}
const greetings=[g=>`어서 오세요. 「${g.title}」부터 소개하겠습니다.`,g=>`이번 회랑은 「${g.title}」입니다. 편하게 살펴보세요.`,g=>`조금 더 둘러보시겠어요? 「${g.title}」 앞입니다.`,g=>`여기서는 서두르지 않으셔도 됩니다. 「${g.title}」입니다.`];
function render(message){
 const g=games[S.index],night=dark(),encounter=night&&S.phase==='warning',caught=night&&S.phase==='caught',mission=blackoutGame;
 stage.dataset.dark=String(night);
 stage.dataset.side=S.index%2?'right':'left';
 stage.dataset.danger=String(encounter);
 stage.dataset.torch=String(S.torch);
 stage.dataset.caught=String(caught);
 stage.dataset.nearby=String(!!mission&&RULES.nearby(mission));
 stage.dataset.silent=String(!!mission?.quiet);
 frame.disabled=!g||caught;
 $('.bk-count').textContent=games.length?'제 '+(S.index+1)+' 회랑 / '+games.length:'전시 준비 중';
 plaque.textContent=g?(g.title||'이름 없는 작품')+(g.developer?' · '+g.developer:''):'검색 조건을 바꾸거나 작품을 등록해 주세요';
 frame.setAttribute('aria-label',g?g.title+' 작품 상세':'전시 작품 없음');
 const card=[...grid.querySelectorAll('.game-card')].find(c=>c.dataset.gameId===String(g?.id));
 const src=card?.querySelector('img.game-thumbnail')?.getAttribute('src')||'';
 if(img.dataset.source!==src){img.dataset.source=src;img.hidden=true;if(src)img.src=src;else img.removeAttribute('src');}
 const area=['lobby','left','right','special'][S.index%4];
 const asset=window.OIBUNG_SCENE_ASSETS?.[area]?.[night?'dark':'light'];
 const url=typeof asset==='string'?asset:(matchMedia('(max-width:700px)').matches?asset?.mobile:asset?.desktop);
 room.style.backgroundImage=url?'url("'+url+'")':'';
 const small=matchMedia('(max-width:700px)').matches,variant=S.index%4;
 const poseSrc=curatorV3?curatorV3.humanFrames[CURATOR_V3_GUIDE[curatorPose]??0]:PIXEL_BASE+'curator-'+curatorPose+'.png';
 if(stage.dataset.transformation!=='true'&&actor.getAttribute('src')!==poseSrc)actor.src=poseSrc;
 actor.style.height=(small?[74,80,70,77]:[91,88,96,91])[variant]+'%';
 actor.style.bottom=(small?-4:-6)+'%';
 actor.style.transform=(S.index%2?'scaleX(-1) ':'')+'rotate('+[0,-1,1,0][variant]+'deg)';
 monster.style.left=S.index%2?'62%':'17%';
 monster.style.height=S.hidden?'38%':'72%';
 const which=encounter?2:Math.abs(S.moves)%4;
 if(curatorV3){
   const frameUrl=curatorV3.monsterFrames[which];
   if(creature.getAttribute('src')!==frameUrl)creature.src=frameUrl;
 }else setMonsterFrame(PIXEL_BASE+'curator-monster-'+(S.moves%2+1)+'.png');
 btn('night').hidden=night;
 btn('list').hidden=night;
 btn('exit').hidden=!night;
 btn('torch').hidden=!night||caught;
 btn('talk').hidden=night||!g;
 btn('hide').hidden=!encounter||S.hidden;
 btn('wait').hidden=!night||caught||!(S.hidden||encounter);
 btn('fuse').hidden=!night||caught||!mission||!mission.fuses.includes(S.index)||mission.found.includes(S.index);
 btn('quiet').hidden=!night||caught;
 btn('quiet').textContent=mission?.quiet?'일반 걸음으로':'조용히 걷기';
 btn('power').hidden=!night||caught||!mission||S.index!==mission.powerRoom;
 btn('power').textContent=mission?.panel===1?'차단기 올리기':'퓨즈 설치 · 전원 복구';
 btn('torch').textContent=S.torch?'손전등 끄기':'손전등 켜기';
 btn('restart').hidden=!caught;
 btn('fuse').disabled=encounter||S.hidden||!S.torch;
 btn('fuse').title=!S.torch?'손전등을 켜야 찾을 수 있습니다.':'';
 for(const[a,d,arrow] of [['prev',-1,'←'],['next',1,'→']]){
   const danger=night&&mission&&games.length>1&&((S.index+d+games.length)%games.length===mission.monster);
   btn(a).disabled=games.length<2||caught||S.hidden;
   btn(a).textContent=arrow+(danger?' 발소리':'');
   btn(a).setAttribute('aria-label',(d<0?'이전':'다음')+' 회랑'+(danger?' · 가까운 발소리':''));
 }
 const hud=$('.bk-hud');
 hud.hidden=!night||!mission;
 if(mission){
   const risk=mission.alert>=65?'높음':mission.alert>=35?'보통':'낮음';
   hud.textContent='퓨즈 '+mission.found.length+'/'+mission.fuses.length+
     ' · 소음 '+(mission.noise>=60?'높음':mission.noise>=30?'보통':'낮음')+
     ' · 발각 위험 '+risk+' · '+(S.torch?'손전등 켜짐':'소등');
   hud.dataset.risk=risk;
 }
 let notice=message;
 if(!notice&&night){
   if(caught)notice='괴물에게 붙잡혔습니다. 다시 시도하거나 일반 관람으로 돌아갈 수 있습니다.';
   else if(encounter)notice='누군가 가까이 있습니다. 숨거나 발소리가 없는 쪽으로 이동하세요.';
   else if(mission&&mission.fuses.includes(S.index)&&!mission.found.includes(S.index))
     notice=S.torch?'이 회랑에서 예비 퓨즈가 보입니다.':'이 근처에 퓨즈가 있습니다. 손전등을 켜서 찾아보세요.';
   else if(mission&&S.index===mission.powerRoom)
     notice=mission.found.length===mission.fuses.length?'필요한 퓨즈가 모였습니다. 분전반을 열고 차단기를 올리세요.':'비상전원실입니다. 나머지 퓨즈를 모아야 합니다.';
   else notice=RULES.nearby(mission)?'멀지 않은 곳에서 발소리가 들립니다.':'멀리서 느린 발소리가 들립니다. 다음 회랑을 살펴보세요.';
 }
 caption.textContent=notice||(g?greetings[variant](g):'전시 중인 작품이 없습니다.');
 const holder=$('.bk-list>div');
 holder.replaceChildren();
 games.forEach((item,i)=>{const b=document.createElement('button');b.textContent=(i+1)+'. '+item.title;b.dataset.room=String(i);holder.append(b);});
 volume();
}

img.onload=()=>{img.hidden=!img.naturalWidth;};img.onerror=()=>{img.hidden=true;};
function travel(target){
 cancelBlackout();
 if(!games.length)return;
 const next=(target%games.length+games.length)%games.length;
 if(!dark()){S.index=next;curatorPose=next%2?'present':'neutral';render();return;}
 if(!blackoutGame)return;
 blackoutAction(RULES.move(blackoutGame,next));
}
function open(d){focus=document.activeElement;d.showModal();volume();}for(const d of[notice,list])d.addEventListener('close',()=>{focus?.focus?.();volume();});
host.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.room!==undefined){
   if(dark())return;
   const target=Number(b.dataset.room);
   list.close();travel(target);return;
 }
 switch(b.dataset.act){
  case 'prev':if(games.length>1)travel(S.index-1);break;
  case 'next':if(games.length>1)travel(S.index+1);break;
  case 'detail':if(games[S.index])window.OIBUNG_CATALOG?.openDetail?.(games[S.index].id);volume();break;
  case 'list':if(!dark())open(list);break;
  case 'close-list':list.close();break;
  case 'night':cancelBlackout();open(notice);break;
  case 'start':notice.close();start();break;
  case 'cancel':notice.close();break;
  case 'exit':restore();break;
  case 'restart':stopPatrol();enterDark();break;
  case 'power':if(blackoutGame)blackoutAction(RULES.power(blackoutGame));break;
  case 'fuse':if(blackoutGame)blackoutAction(RULES.collect(blackoutGame));break;
  case 'torch':if(blackoutGame)blackoutAction(RULES.toggleTorch(blackoutGame));break;
  case 'quiet':if(blackoutGame)blackoutAction(RULES.toggleQuiet(blackoutGame));break;
  case 'sound':sound();break;
  case 'hide':if(blackoutGame)blackoutAction(RULES.hide(blackoutGame));break;
  case 'wait':if(blackoutGame)blackoutAction(RULES.wait(blackoutGame));break;
  case 'talk':{
    cancelBlackout();curatorPose='explain';
    const g=games[S.index];
    if(g)render((g.developer?g.developer+'님이 만든 작품입니다. ':'')+
       String(g.description||g.tagline||'액자를 누르면 작품 소개와 플레이 링크를 볼 수 있습니다.').slice(0,230));
    break;
  }
 }
});
host.tabIndex=0;host.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.dataset.blackoutPending==='true'){cancelBlackout();curatorPose='neutral';render('일반 관람을 계속합니다.');return;}if(document.querySelector('dialog[open]')||e.target.closest('button,input,textarea,select'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();if(games.length>1)travel((S.index+(e.key==='ArrowLeft'?-1:1)+games.length)%games.length);}if(e.key==='Escape'&&dark())restore();});
room.addEventListener('pointermove',e=>{const r=room.getBoundingClientRect();room.style.setProperty('--x',`${e.clientX-r.left}px`);room.style.setProperty('--y',`${e.clientY-r.top}px`);});room.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))swipe={x:e.clientX,y:e.clientY,id:e.pointerId};});room.addEventListener('pointerup',e=>{if(!swipe||swipe.id!==e.pointerId)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5&&games.length>1)travel((S.index+(dx<0?1:-1)+games.length)%games.length);});room.addEventListener('pointercancel',()=>{swipe=null;});
new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;refresh();});}).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','src']});new MutationObserver(()=>{if(root.dataset.galleryMode==='dark'&&!dark()){mode('light');if(!document.querySelector('dialog[open]'))open(notice);}else if(root.dataset.galleryMode==='light'&&dark())restore();}).observe(root,{attributes:true,attributeFilter:['data-gallery-mode']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){const pendingMorph=stage.dataset.blackoutPending==='true';cancelBlackout();if(pendingMorph){curatorPose='neutral';render('관람을 계속할 수 있습니다.');}}volume();});document.addEventListener('oibung-page-changed',()=>{refresh();if(audio&&window.OIBUNG_CURRENT_VIEW==='reviews')gain.gain.setTargetAtTime(0,audio.currentTime,.2);});window.addEventListener('resize',()=>render());mode('light');host.hidden=false;document.body.classList.add('scene-gallery-ready','blackout-rebuild');refresh();loadCuratorV3();
})();
