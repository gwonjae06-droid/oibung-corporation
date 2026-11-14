/* Pixel side-scroll world UI smoke tests. */
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
   const stage=page.locator('#oibung-world-stage');await stage.waitFor({timeout:15000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().count>=4,{timeout:15000});
   const init=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.ok(init.buildingIds.includes('odenring'));assert.ok(init.buildingIds.includes('oibung-arena'));
   assert.equal(await page.locator('#oibung-world-canvas').isVisible(),true);
   assert.equal(await page.locator('#world-enter').isDisabled(),true);
   assert.equal(await page.locator('[data-world-move]').count(),2);
   await page.screenshot({path:'artifacts/'+name+'-world.png',animations:'disabled'});
   await stage.focus();
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(600);await page.keyboard.up('ArrowRight');
   await page.waitForTimeout(100);
   const moved=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.ok(moved.playerX>init.playerX+25,'Movement should work '+JSON.stringify(moved));
   assert.ok(moved.curatorX>init.curatorX+3,'Guide follows the visitor');

   const jump=page.locator('#world-jump-select');
   assert.equal(await jump.locator('option').count(),init.count+1);
   await jump.selectOption('odenring');
   await page.waitForTimeout(90);
   const castle=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(castle.theme,'castle');
   assert.equal(castle.buildingIds[castle.nearest],'odenring');
   await page.screenshot({path:'artifacts/'+name+'-castle.png',animations:'disabled'});
   assert.equal(await page.locator('#world-enter').isEnabled(),true);
   await page.locator('#world-enter').click();
   assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),true);
   assert.match(await page.locator('#detail-title').textContent(),/오든링/);
   await page.locator('#close-detail').click();
   await jump.selectOption('oibung-arena');
   await page.waitForTimeout(50);
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).theme,'arena');
   await stage.focus();await page.keyboard.press('KeyE');
   assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),true);
   assert.match(await page.locator('#detail-title').textContent(),/아레나/);
   await page.locator('#close-detail').click();

   await page.locator('#world-list-toggle').click();
   assert.equal(await page.locator('#world-directory').isVisible(),true);
   assert.equal(await page.locator('.world-directory-item').count(),init.count);
   await page.locator('.world-directory-item').last().click();
   assert.equal(await page.locator('#world-directory').isVisible(),false);
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).nearest,init.count-1);

   await page.evaluate(()=>window.OIBUNG_CATALOG.saveSharedGame({
     id:'world-test-added',title:'QA 신규 건물',genre:'도트 테스트',description:'새 게임 등록 자동 배치',category:'other',visual:'custom',playUrl:''
   }));
   await page.waitForFunction(n=>window.OIBUNG_WORLD.getState().count===n+1,init.count);
   await jump.selectOption('world-test-added');
   assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).nearest,init.count);
   await page.locator('#world-enter').click();
   assert.match(await page.locator('#detail-title').textContent(),/QA 신규 건물/);
   await page.locator('#close-detail').click();

   await page.locator('#world-all-games').evaluate(el=>el.open=true);
   assert.equal(await page.locator('#game-grid').isVisible(),true);
   await page.locator('#game-search').fill('오든링');
   assert.ok(await page.locator('#game-grid .game-card').count()>=1);
   await page.locator('#game-search').fill('');
   await page.locator('#tab-reviews').click();
   assert.equal(await page.locator('#reviews').isVisible(),true);
   await page.locator('#tab-games').click();
   assert.equal(await stage.isVisible(),true);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=7,'Horizontal overflow '+name+': '+overflow);
   assert.deepEqual(errors,[],name+' JS runtime errors');
   console.log('PASS '+name+' : world, keyboard move, companion, castles, entrance, dynamic buildings, list, reviews');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
