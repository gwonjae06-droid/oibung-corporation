
/* Clicking an artwork opens its detail directly (no walk-forward / close-up step). */
(function(){
  function blocked(e){
    return window.OIBUNG_CURRENT_VIEW==='reviews'||document.querySelector('dialog[open]')||e.ctrlKey||e.altKey||e.metaKey;
  }
  window.addEventListener('click',function(e){
    var p=e.target.closest&&e.target.closest('#gallery-3d .museum-painting');
    if(!p)return;
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

/* Unified curator: black bob, cat eyes, cold expression (layered SVG with blink/gaze/breath motion). */
(function(){
  var SRC='assets/guide-live2d-cold.svg';
  function apply(){
    var list=document.querySelectorAll('#gallery-3d .museum-curator img');
    for(var i=0;i<list.length;i++){
      var img=list[i];
      if(img.getAttribute('src')!==SRC){img.removeAttribute('srcset');img.setAttribute('src',SRC);}
    }
    var ps=document.querySelectorAll('#gallery-3d .museum-painting');
    for(var j=0;j<ps.length;j++){
      var a=ps[j].getAttribute('aria-label')||'';
      if(/작품 정면으로 이동$/.test(a))ps[j].setAttribute('aria-label',a.replace(/작품 정면으로 이동$/,'작품 상세 보기'));
    }
  }
  function start(){
    apply();
    new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
