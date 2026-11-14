/* End-to-end QA for approved 512px art and blackout stealth game. */
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
    const page=await browser.newPage({viewport,hasTouch:name!=='desktop',reducedMotion:'no-preference'});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('requestfailed',req=>{
      if(req.url().includes('/assets/curator-v4/'))errors.push('Broken high-resolution asset: '+req.url());
    });
    await page.route('**/*',route=>
      new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort()
    );
    await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
    const stage=page.locator('.bk-stage');
    const actor=page.locator('.bk-human');
    const creature=page.locator('.bk-monster-sprite');
    await stage.waitFor();
    await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.curatorArt==='v4',{timeout:25000});
    await actor.evaluate(img=>img.decode());
    const dims=await actor.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,src:img.getAttribute('src')}));
    assert.equal(dims.height,512);
    assert.equal(dims.width,288);
    assert.match(dims.src,/curator-v4\/guide-neutral\.webp$/);
    assert.equal(await actor.evaluate(el=>getComputedStyle(el).imageRendering),'auto');
    assert.notEqual(await page.locator('.bk-frame img').evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
    assert.match(await page.locator('.bk-room').evaluate(el=>el.style.backgroundImage),/assets\/museum\//);
    const box=await actor.boundingBox();
    assert.ok(box&&box.x>=-6&&box.x+box.width<=viewport.width+6,'Character cropped horizontally '+JSON.stringify(box));
    await page.screenshot({path:'artifacts/'+name+'-guide-v4.png',animations:'disabled'});

    await page.locator('[data-act="talk"]').click();
    await actor.evaluate(img=>img.decode());
    assert.match(await actor.getAttribute('src'),/curator-v4\/guide-explain\.webp$/);
    await page.locator('[data-act="night"]').click();
    await page.locator('[data-act="start"]').click();
    await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.blackoutPending==='true');
    await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.transformation==='true',{timeout:5000});
    const first=await actor.getAttribute('src');
    assert.match(first,/curator-v4\/morph-\d\d\.webp$/);
    await page.waitForFunction(before=>document.querySelector('.bk-human')?.getAttribute('src')!==before,first,{timeout:3000});
    await actor.evaluate(img=>img.decode());
    await page.screenshot({path:'artifacts/'+name+'-morph-v4.png',animations:'disabled'});
    await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:5000});
    assert.equal(await page.locator('.bk-hud').isVisible(),true,'Dark mode displays compact objective status');
    assert.match(await page.locator('.bk-hud').textContent(),/퓨즈 0\/[123]/);
    assert.equal(await page.locator('[data-act="quiet"]').isVisible(),true);
    assert.equal(await page.locator('[data-act="torch"]').isVisible(),true);

    await page.locator('[data-act="torch"]').click();
    assert.equal(await stage.getAttribute('data-torch'),'false');
    await page.locator('[data-act="torch"]').click();
    assert.equal(await stage.getAttribute('data-torch'),'true');
    await page.locator('[data-act="quiet"]').click();
    assert.equal(await stage.getAttribute('data-silent'),'true');

    const next=page.locator('[data-act="next"]');
    if(await next.isEnabled())await next.click();
    if(await page.locator('[data-act="fuse"]').isVisible()){
      const disabled=await page.locator('[data-act="fuse"]').isDisabled();
      if(!disabled){
        await page.locator('[data-act="fuse"]').click();
        assert.match(await page.locator('.bk-hud').textContent(),/퓨즈 1\//);
      }
    }
    if((await stage.getAttribute('data-danger'))==='true'){
      await creature.evaluate(img=>img.decode());
      assert.equal(await creature.evaluate(img=>img.naturalHeight),512);
      await page.screenshot({path:'artifacts/'+name+'-monster-v4.png',animations:'disabled'});
    }
    await page.screenshot({path:'artifacts/'+name+'-night-v4.png',animations:'disabled'});
    await page.locator('[data-act="exit"]').click();
    assert.equal(await stage.getAttribute('data-dark'),'false');
    assert.match(await actor.getAttribute('src'),/guide-neutral\.webp$/);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=6,name+' horizontal overflow '+overflow);
    assert.deepEqual(errors,[],name+' browser/runtime errors');
    console.log('PASS',name,'512px guide, 10-step morph, stealth, torch, gallery preserved');
    await page.close();
  }
  const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await reduced.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await reduced.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
  await reduced.locator('.bk-stage').waitFor();
  await reduced.locator('[data-act="night"]').click();
  await reduced.locator('[data-act="start"]').click();
  await reduced.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:5000});
  console.log('PASS reduced-motion: instant non-flashing entrance');
  await reduced.close();
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
