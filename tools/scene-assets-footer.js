
/* Corridor model + large per-corridor curator composition (original curators: costume SVG and hi-res poses). */
(function(){
  var css=[
    '#gallery-3d .museum-map-rooms{display:none}',
    '#gallery-3d .museum-view::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;mix-blend-mode:soft-light;background:var(--corridor-tint,transparent);transition:background .5s}',
    '#gallery-3d .museum-view[data-corridor="1"]{--corridor-tint:#3a5a9a66}',
    '#gallery-3d .museum-view[data-corridor="2"]{--corridor-tint:#8a3a5a60}',
    '#gallery-3d .museum-view[data-corridor="3"]{--corridor-tint:#3a8a6a60}',
    '#gallery-3d .museum-view[data-corridor="4"]{--corridor-tint:#8a6a2a66}',
    '#gallery-3d .museum-movement{z-index:22}',
    '#gallery-3d .museum-ui .museum-curator{height:calc(var(--ch,150) * 1vh);width:calc(var(--ch,150) * .4444vh);bottom:calc(var(--cb,-20) * 1vh)}',
    '#gallery-3d .museum-ui .museum-curator[data-side="l"]{left:calc(var(--cx,17) * 1vw - var(--ch,150) * .2222vh);right:auto}',
    '#gallery-3d .museum-ui .museum-curator[data-side="r"]{right:calc(var(--cx,17) * 1vw - var(--ch,150) * .2222vh);left:auto}',
    '#gallery-3d .museum-curator>img{transform:rotate(var(--rot,0deg));transform-origin:50% 100%}',
    '#gallery-3d .museum-curator[data-side="r"]>img{transform:scaleX(-1) rotate(var(--rot,0deg))}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue{display:block;position:absolute;top:auto;right:auto;left:50%;bottom:clamp(14px,4vh,40px);transform:translateX(-50%);width:min(620px,60vw);z-index:23;padding:14px 20px;font-size:clamp(13px,1.15vw,17px);line-height:1.65;pointer-events:none}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue::before{content:"안내 비서";display:block;margin-bottom:4px;font-size:11px;letter-spacing:.2em;color:#e0c8a2}',
    '#gallery-3d .museum-ui>.museum-curator-dialogue[hidden]{display:none}',
    '#gallery-3d .museum-ui>#museum-guide-toggle{position:absolute;top:auto;right:12px;bottom:12px;z-index:23}',
    '#gallery-3d .museum-ui>#museum-guide-toggle[hidden]{display:none}',
    '@media(max-width:700px){#gallery-3d .museum-ui>.museum-curator-dialogue{left:auto;right:56px;transform:none;width:min(64vw,420px);bottom:10px;font-size:12px;padding:10px 12px}}'
  ].join('');
  var style=document.createElement('style');
  style.setAttribute('data-museum-corridor','');
  style.textContent=css;
  (document.head||document.documentElement).appendChild(style);
})();

/* Clicking an artwork opens its detail directly (no walk-forward / close-up step). */
(function(){
  function blocked(e){
    return window.OIBUNG_CURRENT_VIEW==='reviews'||document.querySelector('dialog[open]')||e.ctrlKey||e.altKey||e.metaKey;
  }
  function areaNow(){var s=document.getElementById('museum-stage');return s?s.dataset.area:'';}
  window.addEventListener('click',function(e){
    var p=e.target.closest&&e.target.closest('#gallery-3d .museum-painting');
    if(!p)return;
    if(areaNow()==='lobby')return;
    var id=p.dataset.gameId;
    if(!id||!window.OIBUNG_CATALOG||!window.OIBUNG_CATALOG.openDetail)return;
    e.stopImmediatePropagation();e.preventDefault();
    window.OIBUNG_CATALOG.openDetail(id);
  },true);
  window.addEventListener('keydown',function(e){
    if(['Enter','ArrowUp','e','E'].indexOf(e.key)<0||blocked(e))return;
    var t=e.target;
    if(t.closest&&t.closest('input,textarea,select,[contenteditable="true"]'))return;
    var stage=document.getElementById('museum-stage'),surface=document.getElementById('gallery-3d');
    if(!stage||!surface||surface.hidden||!surface.offsetParent||stage.dataset.area==='entrance')return;
    if(t.closest&&t.closest('button,a')&&!surface.contains(t))return;
    var d=document.getElementById('museum-details');
    if(!d||d.hidden)return;
    e.stopImmediatePropagation();e.preventDefault();d.click();
  },true);
})();

/* Corridors, map jumps, curator composition. */
(function(){
  /* Odd corridors (2, 4, ...) use the three original hi-res poses; the others keep the museum's own per-game costume curator. */
  var HIRES=['assets/guide-hires-present.webp','assets/guide-hires-calm.webp','assets/guide-hires-welcome.webp'];
  var DESK=[{h:150,b:-20,cx:17,rot:0},{h:125,b:-5,cx:15,rot:-2},{h:175,b:-35,cx:20,rot:1.5},{h:140,b:-14,cx:13,rot:-1},{h:160,b:-27,cx:18,rot:2}];
  var MOB=[{h:78,b:-14,cx:16,rot:0},{h:70,b:-8,cx:17,rot:-2},{h:90,b:-22,cx:18,rot:1.5},{h:74,b:-10,cx:15,rot:-1},{h:84,b:-18,cx:17,rot:2}];
  var lobbyBusy=false;
  function info(){
    var stage=document.getElementById('museum-stage');
    if(!stage)return null;
    var plaque=document.querySelector('#gallery-3d .museum-works .museum-plaque small');
    var n=plaque?parseInt((plaque.textContent.match(/\d+/)||[0])[0],10):0;
    var total=document.querySelectorAll('#gallery-3d .museum-map-list button').length;
    return {area:stage.dataset.area,n:n,total:total};
  }
  function go(target,tries){
    var c=info();
    if(!c)return;
    if(c.area==='entrance'){var enter=document.getElementById('museum-enter');if(enter)enter.click();}
    if(c.area!=='focus'||!c.n){
      if(tries>0)setTimeout(function(){go(target,tries-1);},40);
      return;
    }
    var total=c.total,cur=c.n-1;
    if(!total||target<0||target>=total)return;
    var fwd=(target-cur+total)%total,back=(cur-target+total)%total;
    var btn=document.getElementById(fwd<=back?'museum-right':'museum-left');
    var steps=Math.min(fwd,back);
    for(var i=0;i<steps&&btn;i++)btn.click();
  }
  window.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('#gallery-3d .museum-map-list button');
    if(!b)return;
    var list=[].slice.call(document.querySelectorAll('#gallery-3d .museum-map-list button'));
    var target=list.indexOf(b);
    e.stopImmediatePropagation();e.preventDefault();
    var dlg=document.getElementById('museum-map-dialog');
    if(dlg&&dlg.close)dlg.close();
    go(target,6);
  },true);
  function placeCurator(idx){
    var box=document.getElementById('museum-curator');
    if(!box)return;
    var img=box.querySelector('img');
    if(img&&idx%2===1){
      var want=HIRES[Math.floor(idx/2)%3];
      if(img.getAttribute('src')!==want){img.removeAttribute('srcset');img.setAttribute('src',want);}
    }
    var mobile=window.matchMedia('(max-width:700px)').matches;
    var cfg=(mobile?MOB:DESK)[idx%5];
    var key=(mobile?'m':'d')+idx;
    if(box.dataset.cfg===key)return;
    box.dataset.cfg=key;
    box.dataset.side=idx%2?'r':'l';
    box.style.setProperty('--ch',cfg.h);
    box.style.setProperty('--cb',cfg.b);
    box.style.setProperty('--cx',cfg.cx);
    box.style.setProperty('--rot',cfg.rot+'deg');
  }
  function apply(){
    var ps=document.querySelectorAll('#gallery-3d .museum-painting');
    for(var j=0;j<ps.length;j++){
      var a=ps[j].getAttribute('aria-label')||'';
      if(/작품 정면으로 이동$/.test(a))ps[j].setAttribute('aria-label',a.replace(/작품 정면으로 이동$/,'작품 상세 보기'));
    }
    var mb=document.querySelectorAll('#gallery-3d .museum-map-list button');
    for(var k=0;k<mb.length;k++){
      var t=mb[k].textContent,nt=t.replace(/ — (좌측|우측) 회랑$/,' — '+(k+1)+'번 회랑');
      if(nt!==t)mb[k].textContent=nt;
    }
    var c=info();
    if(!c)return;
    var ui=document.querySelector('#gallery-3d .museum-ui');
    var box=document.getElementById('museum-curator');
    var dlg=document.getElementById('museum-curator-dialogue');
    var tg=document.getElementById('museum-guide-toggle');
    if(ui&&dlg&&dlg.parentNode!==ui)ui.appendChild(dlg);
    if(ui&&tg&&tg.parentNode!==ui)ui.appendChild(tg);
    if(box){
      if(dlg&&dlg.hidden!==box.hidden)dlg.hidden=box.hidden;
      if(tg&&tg.hidden!==box.hidden)tg.hidden=box.hidden;
    }
    var idx=(c.area==='focus'&&c.n)?c.n-1:0;
    placeCurator(idx);
    if(c.area==='focus'&&c.n){
      var label=document.getElementById('museum-area-name');
      var text='제 '+c.n+' 회랑'+(c.total?' · 총 '+c.total+'개':'');
      if(label&&label.textContent!==text)label.textContent=text;
      var view=document.getElementById('museum-view'),tone=String((c.n-1)%5);
      if(view&&view.dataset.corridor!==tone)view.dataset.corridor=tone;
      if(dlg&&document.documentElement.dataset.galleryMode!=='dark'){
        var p=document.querySelector('#gallery-3d .museum-painting');
        var strong=document.querySelector('#gallery-3d .museum-works .museum-plaque strong');
        var game={};
        try{game=(p&&window.OIBUNG_CATALOG&&window.OIBUNG_CATALOG.getGame&&window.OIBUNG_CATALOG.getGame(p.dataset.gameId))||{};}catch(err){game={};}
        var name=strong?strong.textContent:'';
        var msg='제 '+c.n+' 회랑입니다. 「'+name+'」'+(game.developer?', '+game.developer+'님이 만든 세계예요.':'이에요.')+' 작품을 눌러서 자세히 보세요.';
        if(name&&dlg.textContent!==msg)dlg.textContent=msg;
      }
    }
    if(c.area==='lobby'&&!lobbyBusy&&document.querySelector('#gallery-3d .museum-painting')){
      lobbyBusy=true;
      setTimeout(function(){
        lobbyBusy=false;
        var s=document.getElementById('museum-stage'),q=document.querySelector('#gallery-3d .museum-painting');
        if(s&&s.dataset.area==='lobby'&&q)q.click();
      },0);
    }
  }
  function start(){
    apply();
    new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','data-area','hidden']});
    window.addEventListener('resize',function(){var b=document.getElementById('museum-curator');if(b)b.dataset.cfg='';apply();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
