'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
  await fs.mkdir('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const [name,viewport] of [
      ['desktop',{width:1440,height:900}],
      ['portrait',{width:390,height:844}],
      ['landscape',{width:844,height:390}]
    ]){
      const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
      await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
      const stage=page.locator('#oibung-world-stage');
      await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState().count>=4&&
        window.OIBUNG_WORLD?.getState().curatorArtLoaded&&window.OIBUNG_WORLD_VISITOR?.frameCount===6,
        {timeout:18000});
      const intro=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.equal(intro.hdRenderer,true);
      assert.equal(intro.renderDensity,1);
      // The first mobile screen previously contained no game building.
      const ground=viewport.height-Math.max(43,Math.min(83,Math.round(viewport.height*.092)));
      const scale=Math.min(1,Math.max(.24,(ground-39)/(intro.buildingHeights[0]+126)));
      const firstBuildingLeft=525+intro.buildingWidths[0]*.5-(intro.buildingWidths[0]+170)*scale*.5-intro.camera;
      assert.ok(firstBuildingLeft<viewport.width*.80,
        'Game buildings must be visible as soon as the world opens: '+firstBuildingLeft);
      assert.equal(await page.locator('#world-menu-toggle').isVisible(),true);
      const area=await stage.boundingBox();
      assert.ok(Math.abs(area.x)<2&&Math.abs(area.y)<2&&Math.abs(area.width-viewport.width)<2&&Math.abs(area.height-viewport.height)<2);
      await page.waitForTimeout(300);
      await page.screenshot({path:'artifacts/'+name+'-arrival.png',animations:'disabled'});
      // Menu close must focus the game instead of leaving keyboard movement dead.
      await page.locator('#world-menu-toggle').click();
      await page.locator('#world-menu-close').click();
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'oibung-world-stage');
      let before=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(320);
      await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(110);
      let moved=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.ok(moved.playerX>before.playerX+27,name+' movement after menu close');
      // The scene used to pop abruptly to the next district palette.
      function distance(a,b){
        return [1,3,5].reduce((s,i)=>s+Math.abs(parseInt(a.slice(i,i+2),16)-parseInt(b.slice(i,i+2),16)),0);
      }
      assert.ok(distance(before.skyColor,moved.skyColor)<90,'Scene palette must blend locally');
      // Jump / mobile buttons must keep working.
      if(name!=='desktop'){
        const right=page.locator('[data-world-move="right"]');
        assert.equal(await right.isVisible(),true);
        const bb=await right.boundingBox();
        assert.ok(bb.y>=0&&bb.y+bb.height<=viewport.height+3,'Mobile controls outside viewport');
        const px=moved.playerX;
        // Pointer capture requires a real active pointer. Browser-level
        // touch events avoid the false failures of synthetic dispatchEvent.
        const cdp=await page.context().newCDPSession(page);
        const tx=Math.round(bb.x+bb.width*.5),ty=Math.round(bb.y+bb.height*.5);
        await cdp.send('Input.dispatchTouchEvent',{
          type:'touchStart',touchPoints:[{x:tx,y:ty,id:4}]
        });
        await page.waitForTimeout(245);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await cdp.detach();
        moved=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
        assert.ok(moved.playerX>px+15,'Touch hold-to-walk is operational');
      }
      await page.locator('#world-menu-toggle').click();
      await page.locator('#world-jump-select').selectOption('odenring');
      await page.waitForTimeout(180);
      const castle=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      assert.equal(castle.theme,'castle');
      assert.equal(castle.buildingIds[castle.nearest],'odenring');
      assert.equal(await page.locator('#world-enter').isEnabled(),true);
      const doorCenter=castle.playerX+105;
      assert.ok(Math.abs(doorCenter-castle.playerX)>80,'Visitor should stand to one side of entry');
      await page.screenshot({path:'artifacts/'+name+'-castle-entrance.png',animations:'disabled'});
      // Clicking *empty sky* at the same horizontal coordinate as a building
      // must not teleport the visitor (old oversized Y hitbox bug).
      await stage.focus();
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(250);
      await page.keyboard.up('ArrowLeft');
      await page.waitForTimeout(110);
      before=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
      const sx=doorCenter-before.camera;
      if(sx>140&&sx<viewport.width-100){
        // On short landscape screens the new tall spires legitimately reach
        // y=57. Test genuinely empty sky above their pixel silhouette instead.
        await page.mouse.click(sx,5);
        await page.waitForTimeout(65);
        moved=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
        assert.ok(Math.abs(moved.playerX-before.playerX)<8,'Empty sky click must not warp character');
      }
      await page.evaluate(()=>window.OIBUNG_WORLD.travelTo('odenring'));
      await page.locator('#world-enter').click();
      assert.equal((await page.evaluate(()=>window.OIBUNG_WORLD.getState())).inside,true,'Building now opens a walkable room');
      await page.evaluate(()=>window.OIBUNG_INTERIORS.showInfo('intro'));
      await page.locator('.world-info-actions button').first().click();
      assert.equal(await page.locator('#game-dialog').evaluate(el=>el.open),true);
      assert.match(await page.locator('#detail-title').textContent(),/오든링/);
      await page.locator('#close-detail').click();
      await page.waitForFunction(()=>document.activeElement?.id==='oibung-world-stage',{timeout:2500});
      await page.locator('#world-menu-toggle').click();
      // The in-game theme button used to recolor HTML but not the world art.
      const oldFilter=await page.locator('#oibung-world-canvas').evaluate(el=>getComputedStyle(el).filter);
      await page.locator('#world-theme-toggle').click();
      const newFilter=await page.locator('#oibung-world-canvas').evaluate(el=>getComputedStyle(el).filter);
      assert.notEqual(oldFilter,newFilter,'Night mode must change the actual game image');
      await page.locator('#world-menu-close').click();
      await page.locator('#world-menu-toggle').click();
      await page.locator('#world-catalog-toggle').click();
      assert.equal(await page.locator('#game-grid').isVisible(),true,'Existing game search retained');
      await page.locator('#game-search').fill('오든링');
      assert.ok(await page.locator('#game-grid .game-card').count()>=1);
      await page.keyboard.press('Escape');
      await page.locator('#world-menu-toggle').click();
      await page.locator('#direct-review-shortcut').click();
      assert.equal(await page.locator('#reviews').isVisible(),true);
      await page.locator('#close-reviews-overlay').click();
      if(name==='desktop'){
        // Monumental textures must be cached rather than unbounded across
        // a large amount of newly registered user content.
        for(let i=0;i<13;i++){
          await page.evaluate(i=>window.OIBUNG_CATALOG.saveSharedGame({
            id:'qa-polish-'+i,title:'추가 도트 '+i,genre:'기타',
            category:'other',description:'건물 캐시 테스트',playUrl:''
          }),i);
        }
        await page.waitForFunction(()=>window.OIBUNG_WORLD.getState().count>=17);
        for(let i=0;i<13;i++) await page.evaluate(i=>window.OIBUNG_WORLD.travelTo('qa-polish-'+i),i);
        const cacheSize=await page.evaluate(()=>window.OIBUNG_HD_ARCHITECTURE.cacheSize());
        assert.ok(cacheSize<=10,'HD art LRU must remain bounded: '+cacheSize);
      }
      const overflow=await page.evaluate(()=>({
        x:document.documentElement.scrollWidth-innerWidth,
        y:document.documentElement.scrollHeight-innerHeight
      }));
      assert.ok(overflow.x<=4&&overflow.y<=4,'Fullscreen overflow '+JSON.stringify(overflow));
      assert.deepEqual(errors,[],name+' JS errors: '+errors.join(';'));
      console.log('PASS '+name+': controls, sky fade, door and game details, overlay menu, cache, theme');
      await page.close();
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
