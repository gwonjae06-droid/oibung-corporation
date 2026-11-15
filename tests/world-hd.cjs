'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().count>=4,{timeout:15000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().curatorArtLoaded,{timeout:16000});
   const initial=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(initial.renderDensity,1,'Higher native logical pixel density must be active');
   assert.equal(initial.hdRenderer,true,'New high-density architectural art must be loaded');
   assert.ok(initial.buildingHeights[0]>=800,'Odenring castle must be monumental');
   assert.ok(initial.buildingWidths[0]>=600,'Castle should span over 600 logical pixels');
   const stage=await page.locator('#oibung-world-stage').boundingBox();
   assert.ok(Math.abs(stage.x)<=1&&Math.abs(stage.y)<=1&&Math.abs(stage.width-viewport.width)<=2&&Math.abs(stage.height-viewport.height)<=2);
   const canvas=await page.locator('#oibung-world-canvas').evaluate(el=>({w:el.width,h:el.height}));
   assert.ok(canvas.w>=viewport.width-2&&canvas.h>=viewport.height-2,'Canvas renders at high density');
   await page.waitForTimeout(1000);
   await page.screenshot({path:'artifacts/'+name+'-hd-plaza.png',animations:'disabled'});
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-jump-select').selectOption('odenring');
   await page.waitForTimeout(350);
   const castle=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(castle.theme,'castle');
   assert.equal(castle.buildingIds[castle.nearest],'odenring');
   const cache=await page.evaluate(()=>window.OIBUNG_HD_ARCHITECTURE.cacheSize());
   assert.ok(cache>=1,'Visible buildings must have a cached detailed sprite');
   await page.screenshot({path:'artifacts/'+name+'-hd-castle.png',animations:'disabled'});
   await page.locator('#world-enter').click();
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).inside,true,'Building now opens a walkable room');
   await page.evaluate(()=>window.OIBUNG_INTERIORS.showInfo('intro'));
   await page.locator('.world-info-actions button').first().click();
   assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),true,'Entering the castle opens game detail');
   assert.match(await page.locator('#detail-title').textContent(),/오든링/);
   await page.locator('#close-detail').click();
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-jump-select').selectOption('oibung-arena');
   await page.waitForTimeout(250);
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).theme,'arena');
   await page.screenshot({path:'artifacts/'+name+'-hd-arena.png',animations:'disabled'});
   // The game's large world must remain usable without heavy frame hitching.
   const frameStats=await page.evaluate(async()=>{
     const out=[];let previous=0;
     await new Promise(resolve=>{
       let count=0;
       function next(now){if(previous)out.push(now-previous);previous=now;if(++count<45)requestAnimationFrame(next);else resolve();}
       requestAnimationFrame(next);
     });
     out.sort((a,b)=>a-b);
     return {median:out[Math.floor(out.length*.5)],p95:out[Math.floor(out.length*.95)]};
   });
   assert.ok(frameStats.p95<150,'Heavy texture work must be cached, not rebuilt each frame: '+JSON.stringify(frameStats));
   if(name!=='desktop'){
     const right=page.locator('[data-world-move="right"]');
     assert.equal(await right.isVisible(),true);
     const bb=await right.boundingBox();
     assert.ok(bb&&bb.y>=0&&bb.y+bb.height<=viewport.height+3,'Mobile virtual controls fit');
   }
   await page.locator('#world-menu-toggle').click();
   await page.locator('#world-catalog-toggle').click();
   assert.equal(await page.locator('#game-grid').isVisible(),true,'Existing all-games catalog retained');
   await page.keyboard.press('Escape');
   await page.locator('#world-menu-toggle').click();
   await page.locator('#direct-review-shortcut').click();
   assert.equal(await page.locator('#reviews').isVisible(),true,'Review function retained');
   await page.locator('#close-reviews-overlay').click();
   assert.deepEqual(errors,[],'Browser JavaScript errors: '+errors.join(';'));
   const over=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight}));
   assert.ok(over.x<=4&&over.y<=4,'No overflow in full-screen world');
   console.log('PASS '+name+' cache='+cache+' p95='+frameStats.p95.toFixed(1)+'ms, building height='+initial.buildingHeights[0]);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
