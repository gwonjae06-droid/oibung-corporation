/* Interactive Oibung World building interiors and boulevard smoke tests. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
  await fs.mkdir('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const [name,viewport] of [['desktop',{width:1440,height:900}],['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
      const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',err=>errors.push(err.message));
      await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
      await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
      const stage=page.locator('#oibung-world-stage');
      await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().count>=4,{timeout:20000});
      const original=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.equal(original.inside,false,'World should start outdoors');
      assert.equal(original.count>=4,true);
      assert.equal(await stage.isVisible(),true);
      assert.equal(await page.locator('#world-interior-hud').isVisible(),false);
      const bounds=await stage.boundingBox();
      assert.ok(Math.abs(bounds.x)<2&&Math.abs(bounds.y)<2&&Math.abs(bounds.width-viewport.width)<3&&Math.abs(bounds.height-viewport.height)<3);
      await page.screenshot({path:'artifacts/'+name+'-boulevard.png',animations:'disabled'});
      // All entrances lead to real playable rooms, not a detail popup.
      await page.evaluate(()=>window.OIBUNG_WORLD.travelTo('odenring'));
      assert.equal(await page.locator('#world-enter').isEnabled(),true);
      await page.locator('#world-enter').click();
      let room=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.equal(room.inside,true,'Entering first castle should start explorable scene');
      assert.equal(room.interior.gameId,'odenring');
      assert.equal(room.interior.objectCount,5);
      assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),false,'Interior is not just a dialog');
      assert.equal(await page.locator('#world-interior-hud').isVisible(),true);
      assert.match(await page.locator('.world-interior-location').textContent(),/오든링/);
      await page.waitForTimeout(250);
      await page.screenshot({path:'artifacts/'+name+'-castle-hall.png',animations:'disabled'});
      // Walking toward the in-game poster activates the E action.
      await stage.focus();
      const start=room.playerX;
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(530);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(150);
      room=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.ok(room.playerX>start+60,'Player must move inside room');
      assert.equal(room.inside,true);
      assert.equal(room.interior.nearest,'intro','Poster must be an interactable object');
      assert.equal(await page.locator('#world-enter').isEnabled(),true);
      await stage.focus();
      await page.keyboard.press('KeyE');
      assert.equal(await page.locator('#world-interior-info').isVisible(),true,'E opens in-game exhibit panel');
      assert.match(await page.locator('#world-interior-info-title').textContent(),/오든링/);
      assert.match(await page.locator('.world-info-description').textContent(),/보스/);
      assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),false);
      await page.screenshot({path:'artifacts/'+name+'-interior-intro.png',animations:'disabled'});
      const stopped=await page.evaluate(()=>window.OIBUNG_WORLD.getState().playerX);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(140);
      await page.keyboard.up('ArrowRight');
      assert.ok(Math.abs((await page.evaluate(()=>window.OIBUNG_WORLD.getState().playerX))-stopped)<1,'Walking pauses during info overlay');
      await page.locator('.world-info-actions button').click();
      assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),true,'Original detailed gallery available from in-world display');
      assert.match(await page.locator('#detail-title').textContent(),/오든링/);
      await page.locator('#close-detail').click();
      assert.equal(await page.locator('#game-dialog').evaluate(d=>d.open),false);
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).inside,true);
      // Tap-to-approach works without a second popup for poster/exits.
      await page.evaluate(()=>{
        const obj=window.OIBUNG_INTERIORS.objects().find(o=>o.id==='gallery');
        const current=window.OIBUNG_WORLD.getState();
        const canvas=document.querySelector('#oibung-world-canvas');
        const rect=canvas.getBoundingClientRect();
        const sx=obj.x-current.camera,sy=Math.round(rect.height*.47);
        if(sx>=4&&sx<rect.width-4)canvas.dispatchEvent(new MouseEvent('click',{
          bubbles:true,clientX:rect.x+sx,clientY:rect.y+sy
        }));
      });
      if(name==='desktop'){
        assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).interior.nearest,'gallery',
          'Clicking a visible indoor exhibition moves beside the framed gallery');
      }
      // The internal play portal doesn't destroy the room state.
      const infoAPI=await page.evaluate(()=>typeof window.OIBUNG_INTERIORS.interact);
      assert.equal(infoAPI,'function');
      await page.locator('#world-interior-return').click();
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).inside,false,'Exit restores overworld');
      assert.equal(await page.locator('#world-interior-hud').isVisible(),false);
      assert.equal(await page.locator('#world-menu-toggle').isVisible(),true);
      await page.evaluate(()=>window.OIBUNG_WORLD.travelTo('oibung-arena'));
      await page.locator('#world-enter').click();
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).interior.gameId,'oibung-arena');
      assert.match(await page.locator('.world-interior-location').textContent(),/콜로세움/);
      await page.screenshot({path:'artifacts/'+name+'-arena-lobby.png',animations:'disabled'});
      // Travel to another building from the menu while indoors must exit safely.
      await page.locator('#world-menu-toggle').click();
      await page.locator('#world-jump-select').selectOption('ochams');
      room=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.equal(room.inside,false);
      assert.equal(room.theme,'duel');
      await page.locator('#world-enter').click();
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).interior.gameId,'ochams');
      await stage.focus();
      await page.keyboard.press('Escape');
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).inside,false,
        'Escape safely returns to the exterior without opening the menu');
      await page.locator('#world-menu-toggle').click();
      await page.locator('#world-catalog-toggle').click();
      assert.equal(await page.locator('#game-grid').isVisible(),true,'Existing game catalog must be intact');
      await page.locator('#game-search').fill('오든링');
      assert.ok(await page.locator('#game-grid .game-card').count()>=1);
      await page.keyboard.press('Escape');
      await page.locator('#world-menu-toggle').click();
      await page.locator('#direct-review-shortcut').click();
      assert.equal(await page.locator('#reviews').isVisible(),true,'Review panel preserved');
      await page.locator('#close-reviews-overlay').click();
      assert.equal(await stage.isVisible(),true);
      if(name!=='desktop'){
        const right=page.locator('[data-world-move="right"]');
        const box=await right.boundingBox();
        assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height+3,'Mobile controls visible');
      }
      const overflow=await page.evaluate(()=>({
        x:document.documentElement.scrollWidth-innerWidth,
        y:document.documentElement.scrollHeight-innerHeight
      }));
      assert.ok(overflow.x<=5&&overflow.y<=5,'No page overflow after visiting rooms');
      assert.deepEqual(errors,[],name+' page errors');
      console.log('PASS '+name+': indoor walking, artworks, legacy detail, exit, fast-travel, catalog, reviews');
      await page.close();
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1);});
