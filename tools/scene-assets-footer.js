
/* Visual polish layer: appended last so it wins the cascade over gallery-scenes.css. */
(function(){
  if(document.querySelector('link[data-museum-polish]'))return;
  var l=document.createElement('link');
  l.rel='stylesheet';l.href='gallery-scenes-polish.css';l.setAttribute('data-museum-polish','');
  (document.head||document.documentElement).appendChild(l);
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
  }
  function start(){
    apply();
    new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
