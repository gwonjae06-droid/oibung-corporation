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

/* Visual polish layer: appended last so it wins the cascade over gallery-scenes.css. */
(function(){
  if(document.querySelector('link[data-museum-polish]'))return;
  var l=document.createElement('link');
  l.rel='stylesheet';l.href='gallery-scenes-polish.css';l.setAttribute('data-museum-polish','');
  (document.head||document.documentElement).appendChild(l);
})();
