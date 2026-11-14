/* Oibung direct catalog: essential real browser smoke tests. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await fs.mkdir('artifacts',{recursive:true});
 try{
  for(const [label,viewport] of [
    ['desktop',{width:1440,height:900}],
    ['mobile',{width:390,height:844}],
    ['landscape',{width:844,height:390}]
  ]){
   const page=await browser.newPage({viewport,hasTouch:label!=='desktop',reducedMotion:'reduce'});
   const pageErrors=[];
   page.on('pageerror',e=>pageErrors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
   const cards=page.locator('#game-grid .game-card');
   await cards.first().waitFor({timeout:15000});
   await page.waitForTimeout(200);
   assert.equal(await page.locator('#walk-gallery').count(),0,'Old immersive museum must not occupy the home page');
   assert.equal(await page.locator('#game-grid').isVisible(),true,'All game covers visible directly');
   assert.equal(await page.locator('#walk-filter-drawer').isVisible(),true,'Search and filters visible immediately');
   assert.equal(await page.locator('#game-search').isVisible(),true,'No extra menu for search');
   const cardCount=await cards.count();
   assert.ok(cardCount>=1,'No games rendered on '+label);
   const display=await page.locator('#game-grid').evaluate(e=>getComputedStyle(e).display);
   assert.equal(display,'grid','Show game cards instead of a horizontally transformed track');
   const cardTitle=(await cards.first().locator('h3').textContent()).trim();
   assert.ok(cardTitle.length>0);
   const width=await cards.first().boundingBox();
   assert.ok(width?.width>170&&width.width<viewport.width,'Cards must fit screen');
   const info=page.locator('#game-grid .game-card').first();
   assert.equal(await info.locator('.details-link').isVisible(),true,'Details action exposed');
   const links=await page.locator('#game-grid .play-link').count();
   if(links>0)assert.equal(await page.locator('#game-grid .play-link').first().getAttribute('target'),'_blank');
   await page.screenshot({path:'artifacts/'+label+'-direct-home.png',animations:'disabled',fullPage:label==='desktop'});

   await cards.first().locator('h3').click();
   assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),true,'Entire card can open game details');
   assert.equal((await page.locator('#detail-title').textContent()).trim(),cardTitle);
   await page.locator('#close-detail').click();
   assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),false);

   await page.locator('#game-search').fill(cardTitle);
   assert.ok(await cards.count()>=1,'Search finds selected game');
   await page.locator('#game-search').fill('not-a-real-oibung-game-987654');
   assert.equal(await cards.count(),0);
   assert.equal(await page.locator('#empty-state').isVisible(),true);
   await page.locator('#game-search').fill('');
   await page.waitForFunction(n=>document.querySelectorAll('#game-grid .game-card').length===n,cardCount);

   await page.locator('#direct-review-shortcut').click();
   assert.equal(await page.locator('#reviews').isVisible(),true,'Review shortcut opens real board');
   await page.locator('#tab-games').click();
   assert.equal(await page.locator('#game-grid').isVisible(),true,'Return to game list');

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=5,'Horizontal viewport overflow '+label+': '+overflow);
   const scroll=await page.evaluate(()=>({
     h:document.documentElement.scrollHeight,
     visible:innerHeight,
     overflow:getComputedStyle(document.documentElement).overflowY
   }));
   assert.ok(scroll.h>scroll.visible,'Game collection should be vertically scrollable '+JSON.stringify(scroll));
   assert.deepEqual(pageErrors,[],'JavaScript runtime errors '+label);
   console.log('PASS '+label+': '+cardCount+' game cards visible, details, search, reviews, scroll');
   await page.close();
  }
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1);});
