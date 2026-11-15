/* Full viewport game-only shell regression checks.
 * Confirm that the real shared catalog, edit and reviews are still reachable.
 */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await fs.mkdir('artifacts',{recursive:true});
 try{
  for(const [name,viewport] of [
   ['desktop',{width:1440,height:900}],
   ['portrait',{width:390,height:844}],
   ['landscape',{width:844,height:390}]
  ]){
   const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'reduce'});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
   const stage=page.locator('#oibung-world-stage'),menuButton=page.locator('#world-menu-toggle');
   await stage.waitFor({timeout:15000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState().count>=4,{timeout:10000});
   const bounds=await stage.boundingBox();
   assert.ok(bounds,'Missing world stage');
   assert.ok(Math.abs(bounds.x)<=1&&Math.abs(bounds.y)<=1,'World origin not fullscreen '+JSON.stringify(bounds));
   assert.ok(Math.abs(bounds.width-viewport.width)<=2,'World width not fullscreen '+JSON.stringify(bounds));
   assert.ok(Math.abs(bounds.height-viewport.height)<=2,'World height not fullscreen '+JSON.stringify(bounds));
   assert.equal(await page.locator('.site-header').isVisible(),false,'Site header must be gone');
   assert.equal(await page.locator('.page-switcher').isVisible(),false,'Tabs must be gone');
   assert.equal(await page.locator('#games .section-heading-row').isVisible(),false,'Intro heading hidden');
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),false,'Menu starts collapsed');
   assert.equal(await menuButton.isVisible(),true,'In-game menu remains accessible');
   assert.equal(await page.locator('#world-all-games').isVisible(),false,'Card catalog not shown around world');
   const doc=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,
    viewportWidth:innerWidth,viewportHeight:innerHeight,bodyOverflow:getComputedStyle(document.body).overflow}));
   assert.ok(doc.w<=doc.viewportWidth+3&&doc.h<=doc.viewportHeight+3,'Page must not scroll '+JSON.stringify(doc));
   await page.screenshot({path:'artifacts/'+name+'-fullscreen-world.png',animations:'disabled'});

   const initial=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   if(name==='desktop'){
     await stage.focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');
     const after=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
     assert.ok(after.playerX>initial.playerX+15,'Keyboard moves player');
   }else{
     const right=page.locator('[data-world-move="right"]');
     assert.equal(await right.isVisible(),true);
     const hit=await right.boundingBox();
     assert.ok(hit&&hit.y>=0&&hit.y+hit.height<=viewport.height+2,'Virtual direction button visible '+JSON.stringify(hit));
     await right.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});
     await page.waitForTimeout(230);
     await right.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});
     const after=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
     assert.ok(after.playerX>initial.playerX+10,'Virtual controller moves player');
   }

   await menuButton.click();
   assert.equal(await menuButton.getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),true);
   const paused=await page.evaluate(()=>window.OIBUNG_WORLD.getState().playerX);
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(190);await page.keyboard.up('ArrowRight');
   assert.ok(Math.abs((await page.evaluate(()=>window.OIBUNG_WORLD.getState().playerX))-paused)<1,'In-game menu pauses walking');
   await page.screenshot({path:'artifacts/'+name+'-menu.png',animations:'disabled'});

   await page.locator('#world-catalog-toggle').click();
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),false);
   assert.equal(await page.locator('#world-all-games').evaluate(el=>el.open),true);
   assert.equal(await page.locator('#game-grid').isVisible(),true);
   await page.locator('#game-search').fill('오든링');
   assert.ok(await page.locator('#game-grid .game-card').count()>0,'Existing search still works');
   await page.locator('#game-search').fill('');
   await page.screenshot({path:'artifacts/'+name+'-catalog.png',animations:'disabled'});
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#world-all-games').evaluate(el=>el.open),false,'Escape closes game catalog');

   await menuButton.click();
   await page.locator('#world-list-toggle').click();
   assert.equal(await page.locator('#world-directory').isVisible(),true);
   assert.ok(await page.locator('.world-directory-item').count()>=4);
   await page.locator('.world-directory-item').first().click();
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),false,'Selecting building closes menu');
   await menuButton.click();
   await page.locator('#world-jump-select').selectOption('odenring');
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),false,'Quick travel returns to world');
   const castle=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(castle.theme,'castle');
   await page.locator('#world-enter').click();
   assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),true);
   assert.equal(await page.locator('#game-dialog').getAttribute('data-world-theme'),'castle');
   const dialogRect=await page.locator('#game-dialog').boundingBox();
   assert.ok(dialogRect&&dialogRect.x>=-3&&dialogRect.y>=-3&&
     dialogRect.width<=viewport.width+3&&dialogRect.height<=viewport.height+3,'Detail interior fits viewport');
   await page.screenshot({path:'artifacts/'+name+'-interior.png',animations:'disabled'});
   await page.locator('#close-detail').click();

   await menuButton.click();
   await page.locator('#direct-review-shortcut').click();
   assert.equal(await page.locator('#reviews').isVisible(),true,'Reviews work in game overlay');
   assert.equal(await page.locator('#world-overlay-menu').isVisible(),false);
   await page.screenshot({path:'artifacts/'+name+'-reviews.png',animations:'disabled'});
   await page.locator('#close-reviews-overlay').click();
   assert.equal(await page.locator('#reviews').isVisible(),false,'Close reviews returns to world');
   assert.equal(await stage.isVisible(),true);

   await menuButton.click();
   await page.locator('#world-overlay-menu [data-open-editor]').click();
   assert.equal(await page.locator('#guide-dialog').evaluate(d=>d.open),true,'Game registration remains accessible');
   await page.locator('#close-guide').click();

   const last=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,
     iw:innerWidth,ih:innerHeight}));
   assert.ok(last.w<=last.iw+4&&last.h<=last.ih+4,'Fullscreen remains fixed after closing overlays '+JSON.stringify(last));
   assert.deepEqual(errors,[],name+' browser JS errors');
   console.log('PASS '+name+': fullscreen, menu, travel, catalog, registration, reviews, pixel interior');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
