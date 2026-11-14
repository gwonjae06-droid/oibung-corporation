/* Validate the newly drawn 384×512 pixel art in desktop and mobile galleries. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
   const viewports=[
     ['desktop',{width:1440,height:900}],
     ['portrait',{width:390,height:844}],
     ['landscape',{width:844,height:390}]
   ];
   for(const [label,viewport] of viewports){
     const page=await browser.newPage({viewport,hasTouch:label!=='desktop',reducedMotion:'no-preference'});
     const errors=[];
     page.on('pageerror',e=>errors.push(e.message));
     page.on('requestfailed',r=>{
       if(r.url().includes('/assets/curator-v5/'))errors.push('Missing v5 artwork '+r.url());
     });
     await page.route('**/*',route=>{
       const url=new URL(route.request().url());
       return url.hostname==='127.0.0.1'?route.continue():route.abort();
     });
     await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
     const stage=page.locator('.bk-stage'),actor=page.locator('.bk-human'),creature=page.locator('.bk-monster-sprite');
     await stage.waitFor();
     await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.curatorArt==='v5',{timeout:25000});
     await actor.evaluate(img=>img.decode());
     assert.match(await actor.getAttribute('src'),/assets\/curator-v5\/guide-neutral\.webp$/);
     assert.equal(await actor.evaluate(img=>img.naturalHeight),512);
     assert.equal(await actor.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
     assert.equal(await actor.evaluate(img=>getComputedStyle(img).transform),'none');
     const artRender=await page.locator('.bk-frame img').evaluate(img=>getComputedStyle(img).imageRendering);
     assert.notEqual(artRender,'pixelated','User paintings remain full resolution');
     assert.match(await page.locator('.bk-room').evaluate(el=>el.style.backgroundImage),/assets\/museum\//);
     const bounds=await actor.boundingBox();
     assert.ok(bounds&&bounds.x>=-5&&bounds.x+bounds.width<=viewport.width+5,
       label+' character touches viewport boundary: '+JSON.stringify(bounds));
     await page.screenshot({path:'artifacts/'+label+'-v5-day.png',animations:'disabled'});

     await page.locator('[data-act="talk"]').click();
     await actor.evaluate(img=>img.decode());
     assert.match(await actor.getAttribute('src'),/guide-explain\.webp$/);
     await page.locator('[data-act="night"]').click();
     await page.locator('[data-act="start"]').click();
     await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.transformation==='true',{timeout:3500});
     const firstMorph=await actor.getAttribute('src');
     assert.match(firstMorph,/curator-v5\/morph-\d\d\.webp$/);
     await page.waitForFunction(first=>document.querySelector('.bk-human')?.getAttribute('src')!==first,firstMorph,{timeout:2400});
     await actor.evaluate(img=>img.decode());
     assert.equal(await actor.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
     await page.screenshot({path:'artifacts/'+label+'-v5-morph.png',animations:'disabled'});

     await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:5000});
     await creature.evaluate(img=>img.decode());
     assert.equal(await creature.evaluate(img=>img.naturalHeight),512);
     assert.equal(await creature.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
     const hud=page.locator('.bk-hud');
     assert.equal(await hud.isVisible(),true);
     await page.screenshot({path:'artifacts/'+label+'-v5-night.png',animations:'disabled'});
     await page.locator('[data-act="exit"]').click();
     assert.equal(await stage.getAttribute('data-dark'),'false');
     assert.match(await actor.getAttribute('src'),/guide-neutral\.webp$/);
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     assert.ok(overflow<=6,label+' overflow '+overflow);
     assert.deepEqual(errors,[],label+' browser errors');
     console.log('PASS '+label+': new 1:1 pixel art, no rotation, 12-frame morph, intact gallery');
     await page.close();
   }
   const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
   await reduced.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   await reduced.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
   await reduced.locator('[data-act="night"]').click();
   await reduced.locator('[data-act="start"]').click();
   await reduced.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:3000});
   console.log('PASS reduced-motion: instant blackout without flashing');
   await reduced.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
