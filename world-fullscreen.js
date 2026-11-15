/* Oibung World — in-game menus for the fullscreen canvas experience.
 * Reuses existing catalog, reviews and editor. No new game data or API calls.
 */
(() => {
  'use strict';
  const world=document.getElementById('oibung-world');
  const menu=document.getElementById('world-overlay-menu');
  const toggle=document.getElementById('world-menu-toggle');
  const closeButton=document.getElementById('world-menu-close');
  const stage=document.getElementById('oibung-world-stage');
  const catalog=document.getElementById('world-all-games');
  const directory=document.getElementById('world-directory');
  const listButton=document.getElementById('world-list-toggle');
  const reviews=document.getElementById('direct-review-shortcut');
  const search=document.getElementById('game-search');
  if(!world||!menu||!toggle||!catalog||!stage)return;

  function menuOpen() {return !menu.hidden;}
  function setMenu(open,returnFocus=false) {
    menu.hidden=!open;
    world.classList.toggle('world-menu-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'오이붕 월드 메뉴 닫기':'오이붕 월드 메뉴 열기');
    if(!open) {
      if(directory)directory.hidden=true;
      listButton?.setAttribute('aria-expanded','false');
      // Return keyboard focus to the playable stage, not the closed menu
      // button (world movement intentionally ignores focused buttons).
      if(returnFocus)stage.focus({preventScroll:true});
    }else{
      closeButton?.focus({preventScroll:true});
    }
  }
  toggle.addEventListener('click',()=>{const wasOpen=menuOpen();setMenu(!wasOpen,wasOpen);});
  closeButton?.addEventListener('click',()=>setMenu(false,true));
  let suppressNextWorldClick=false;
  stage.addEventListener('pointerdown',event=>{
    if(menuOpen()&&!event.target.closest('#world-overlay-menu,#world-menu-toggle')){
      suppressNextWorldClick=true;
      setMenu(false,true);
    }
  });
  // Clicking outside the pause menu dismisses it without also triggering a
  // second, surprising teleport action on the underlying canvas.
  stage.addEventListener('click',event=>{
    if(!suppressNextWorldClick)return;
    suppressNextWorldClick=false;
    if(event.target.tagName==='CANVAS'){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  document.getElementById('world-catalog-toggle')?.addEventListener('click',()=>{
    setMenu(false);
    catalog.open=true;
    requestAnimationFrame(()=>search?.focus({preventScroll:true}));
  });
  const themeButton=document.getElementById('world-theme-toggle');
  const syncThemeLabel=()=>{
    if(themeButton)themeButton.textContent=document.documentElement.dataset.galleryMode==='dark'
      ?'☀ 밝은 테마로':'☾ 어두운 테마로';
  };
  themeButton?.addEventListener('click',()=>{
    const current=document.documentElement.dataset.galleryMode;
    const target=current==='dark'?'light':'dark';
    document.querySelector('[data-gallery-mode-choice="'+target+'"]')?.click();
    syncThemeLabel();
  });
  syncThemeLabel();
  reviews?.addEventListener('click',()=>setMenu(false));
  menu.querySelectorAll('[data-open-editor]').forEach(button=>{
    button.addEventListener('click',()=>setMenu(false));
  });
  document.getElementById('world-jump-select')?.addEventListener('change',()=>{
    setMenu(false);
    stage.focus({preventScroll:true});
  });
  directory?.addEventListener('click',event=>{
    if(event.target.closest('.world-directory-item')){
      setMenu(false);
      stage.focus({preventScroll:true});
    }
  });
  // The older page-tabs are intentionally invisible. Their handlers remain
  // active, so reviews still share the existing data source and navigation.
  document.addEventListener('oibung-page-changed',event=>{
    if(event.detail?.page==='reviews'){
      setMenu(false);
      catalog.open=false;
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
    if(window.OIBUNG_CURRENT_VIEW==='reviews'){
      document.getElementById('tab-games')?.click();
      stage.focus({preventScroll:true});
      event.preventDefault();return;
    }
    if(catalog.open){
      catalog.open=false;
      stage.focus({preventScroll:true});
      event.preventDefault();return;
    }
    if(menuOpen()){
      setMenu(false,true);
      event.preventDefault();return;
    }
    if(window.OIBUNG_WORLD?.getState?.().inside&&!window.OIBUNG_INTERIORS?.isInfoOpen?.()){
      window.OIBUNG_WORLD.leaveInterior();
      event.preventDefault();
    }
  });
  catalog.addEventListener('toggle',()=>{
    world.classList.toggle('world-catalog-open',catalog.open);
    if(catalog.open)setMenu(false);
  });
  // Ensure there is never a leftover expanded menu on a fresh visit.
  setMenu(false);
})();
