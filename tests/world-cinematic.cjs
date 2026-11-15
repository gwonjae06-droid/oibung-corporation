/* Browser-level art integration tests: no external CDN or token required. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     return url.hostname==='127.0.0.1'?route.continue():route.abort();
   });
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().count>=4&&
      window.OIBUNG_CINEMATIC&&window.OIBUNG_CINEMATIC_ART?.ready('curator_atlas')&&
      window.OIBUNG_CINEMATIC_ART?.ready('castle_facade'),{timeout:25000});
   const data=await page.evaluate(()=>{
     const state=window.OIBUNG_WORLD.getState();
     const art=window.OIBUNG_CINEMATIC_ART;
     const castle=window.OIBUNG_HD_ARCHITECTURE.get({
       style:'castle',width:640,height:835,seed:23
     });
     return {state,atlas:art.images.curator_atlas.naturalWidth,
       facade:art.images.castle_facade.naturalWidth,
       castleHires:castle.buildingInfo.hires,
       fx:window.OIBUNG_CINEMATIC.stats()};
   });
   assert.equal(data.state.hdRenderer,true);
   assert.equal(data.state.cinematicFX,true);
   assert.equal(data.state.curatorHdAtlasReady,true);
   assert.equal(data.state.castleHdArtReady,true);
   assert.equal(data.atlas,1024,'Crisp 4×2 curator sprite atlas must load');
   assert.equal(data.facade,844,'High-resolution Odenring pixel facade must load');
   assert.equal(data.castleHires,true,'Castle must use the actual art, not the old facade');
   assert.ok(data.fx.cachedSprites>=2,'Mountains/clouds should be cached');
   const bbox=await page.locator('#oibung-world-stage').boundingBox();
   assert.ok(bbox&&Math.abs(bbox.x)<2&&Math.abs(bbox.y)<2&&
     Math.abs(bbox.width-viewport.width)<2&&Math.abs(bbox.height-viewport.height)<2);
   const assetImages=await page.locator('#oibung-world-canvas').evaluate(el=>{
     const c=el.getContext('2d');
     const w=el.width,h=el.height;
     const d=c.getImageData(0,Math.floor(h*.1),w,Math.floor(h*.8)).data;
     const colors=new Set();
     for(let i=0;i<d.length;i+=64){
       colors.add((d[i]<<16)+(d[i+1]<<8)+d[i+2]);
     }
     return {unique:colors.size};
   });
   assert.ok(assetImages.unique>750,'Visual scene should have painterly HD color detail: '+assetImages.unique);
   await page.waitForTimeout(400);
   await page.screenshot({path:'artifacts/'+name+'-world-hd.png',animations:'disabled'});
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-jump-select').selectOption('odenring');
   await page.waitForTimeout(230);
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).theme,'castle');
   await page.screenshot({path:'artifacts/'+name+'-castle-hd.png',animations:'disabled'});
   assert.equal(await page.locator('#world-enter').isEnabled(),true);
   await page.locator('#world-enter').click();
   assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),true);
   assert.match(await page.locator('#detail-title').textContent(),/오든링/);
   await page.locator('#close-detail').click();
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-jump-select').selectOption('oibung-arena');
   await page.waitForTimeout(180);
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).theme,'arena');
   await page.screenshot({path:'artifacts/'+name+'-arena-hd.png',animations:'disabled'});
   if(name==='desktop'){
     await page.evaluate(()=>window.OIBUNG_CATALOG.saveSharedGame({
       id:'cinematic-furry-corp',title:'퍼리corp',genre:'캐주얼',
       description:'고양이 저택 자동 생성 확인',category:'other',playUrl:''
     }));
     await page.waitForFunction(()=>window.OIBUNG_WORLD.getState().count>=5);
     await page.evaluate(()=>window.OIBUNG_WORLD.travelTo('cinematic-furry-corp'));
     await page.waitForTimeout(160);
     assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).theme,'cat');
     await page.screenshot({path:'artifacts/desktop-cat-manor-hd.png',animations:'disabled'});
   }
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-catalog-toggle').click();
   assert.equal(await page.locator('#game-grid').isVisible(),true);
   await page.keyboard.press('Escape');
   await page.locator('#world-menu-toggle').click();
   await page.locator('#direct-review-shortcut').click();
   assert.equal(await page.locator('#reviews').isVisible(),true);
   await page.locator('#close-reviews-overlay').click();
   const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,
     y:document.documentElement.scrollHeight-innerHeight}));
   assert.ok(overflow.x<=4&&overflow.y<=4,'Viewport must stay fullscreen');
   assert.deepEqual(errors,[],'JavaScript errors: '+errors.join(' | '));
   // Use animation timestamps, not predicted FPS, and allow CI jitter.
   const pacing=await page.evaluate(async()=>{
     const values=[];let t=0;
     await new Promise(resolve=>{
       let i=0;function tick(next){if(t)values.push(next-t);t=next;
         if(++i<54)requestAnimationFrame(tick);else resolve();}
       requestAnimationFrame(tick);
     });
     values.sort((a,b)=>a-b);
     return values[Math.floor(values.length*.95)];
   });
   assert.ok(pacing<180,'Avoid pathological browser frame stalls: '+pacing);
   console.log('PASS '+name+' pixel colors='+assetImages.unique+
     ', cached='+data.fx.cachedSprites+', p95='+pacing.toFixed(1)+'ms');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
