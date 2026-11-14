/* Auto-generated when the 24 Blender assets are available. */
window.OIBUNG_SCENE_ASSETS = Object.freeze({
  entrance: {
    light:{desktop:'assets/museum/entrance-light.avif',mobile:'assets/museum/entrance-light-mobile.avif'},
    dark:{desktop:'assets/museum/entrance-dark.avif',mobile:'assets/museum/entrance-dark-mobile.avif'}
  },
  lobby: {
    light:{desktop:'assets/museum/lobby-light.avif',mobile:'assets/museum/lobby-light-mobile.avif'},
    dark:{desktop:'assets/museum/lobby-dark.avif',mobile:'assets/museum/lobby-dark-mobile.avif'}
  },
  left: {
    light:{desktop:'assets/museum/left-light.avif',mobile:'assets/museum/left-light-mobile.avif'},
    dark:{desktop:'assets/museum/left-dark.avif',mobile:'assets/museum/left-dark-mobile.avif'}
  },
  right: {
    light:{desktop:'assets/museum/right-light.avif',mobile:'assets/museum/right-light-mobile.avif'},
    dark:{desktop:'assets/museum/right-dark.avif',mobile:'assets/museum/right-dark-mobile.avif'}
  },
  focus: {
    light:{desktop:'assets/museum/focus-light.avif',mobile:'assets/museum/focus-light-mobile.avif'},
    dark:{desktop:'assets/museum/focus-dark.avif',mobile:'assets/museum/focus-dark-mobile.avif'}
  },
  special: {
    light:{desktop:'assets/museum/special-light.avif',mobile:'assets/museum/special-light-mobile.avif'},
    dark:{desktop:'assets/museum/special-dark.avif',mobile:'assets/museum/special-dark-mobile.avif'}
  }
});

/* Corridor model: every artwork gets its own corridor; corridors grow as games are added.
   Left/right walk through ALL corridors (no wing to get stuck in). */
(function(){
  var css='#gallery-3d .museum-map-rooms{display:none}'+
    '#gallery-3d .museum-view::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none;mix-blend-mode:soft-light;background:var(--corridor-tint,transparent);transition:background .5s}'+
    '#gallery-3d .museum-view[data-corridor="1"]{--corridor-tint:#3a5a9a66}'+
    '#gallery-3d .museum-view[data-corridor="2"]{--corridor-tint:#8a3a5a60}'+
    '#gallery-3d .museum-view[data-corridor="3"]{--corridor-tint:#3a8a6a60}'+
    '#gallery-3d .museum-view[data-corridor="4"]{--corridor-tint:#8a6a2a66}';
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

/* Corridors and map jumps. */
(function(){
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
    if(c.area==='focus'&&c.n){
      var label=document.getElementById('museum-area-name');
      var text='제 '+c.n+' 회랑'+(c.total?' · 총 '+c.total+'개':'');
      if(label&&label.textContent!==text)label.textContent=text;
      var view=document.getElementById('museum-view'),tone=String((c.n-1)%5);
      if(view&&view.dataset.corridor!==tone)view.dataset.corridor=tone;
    }
    if(c.area==='lobby'&&!lobbyBusy&&document.querySelector('#gallery-3d .museum-painting')){
      lobbyBusy=true;
      setTimeout(function(){
        lobbyBusy=false;
        var s=document.getElementById('museum-stage'),p=document.querySelector('#gallery-3d .museum-painting');
        if(s&&s.dataset.area==='lobby'&&p)p.click();
      },0);
    }
  }
  function start(){
    apply();
    new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-area']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
