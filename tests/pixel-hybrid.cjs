/* Hybrid B visual + behavior regression across responsive viewports. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await fs.mkdir('artifacts',{recursive:true});
  for(const [label,viewport] of [
    ['desktop',{width:1440,height:900}],
    ['mobile',{width:390,height:844}],
    ['landscape',{width:844,height:390}]
  ]){
   const page=await browser.newPage({viewport,hasTouch:label!=='desktop',reducedMotion:'no-preference'});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   page.on('requestfailed',r=>{if(r.url().includes('/assets/pixel/'))errors.push(r.url());});
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.hostname==='127.0.0.1'?route.continue():route.abort();
   });
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
   await page.locator('.bk-stage').waitFor();
   const actor=page.locator('.bk-human'),monster=page.locator('.bk-monster-sprite');
   await page.waitForFunction(()=>document.querySelector('.bk-count')?.textContent.includes('회랑'),{timeout:12000});
   await actor.evaluate(img=>img.decode());
   assert.match(await actor.getAttribute('src'),/^assets\/pixel\/curator-neutral\.png$/);
   assert.ok(await actor.evaluate(img=>img.naturalHeight>=200&&img.naturalHeight<=260));
   assert.equal(await actor.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
   const artIsCrisp=await page.locator('.bk-frame img').evaluate(img=>getComputedStyle(img).imageRendering);
   assert.notEqual(artIsCrisp,'pixelated','Painting images remain unpixelated');
   const roomBackground=await page.locator('.bk-room').evaluate(n=>n.style.backgroundImage);
   assert.ok(roomBackground.includes('assets/museum/'),'Original Blender background retained');
   await page.screenshot({path:'artifacts/'+label+'-day.png',animations:'disabled'});

   await page.locator('[data-act="talk"]').click();
   assert.match(await actor.getAttribute('src'),/curator-explain\.png$/);
   await actor.evaluate(img=>img.decode());

   // Witness the SAME curator becoming corrupted before the lights go dark.
   await page.locator('[data-act="night"]').click();
   await page.locator('[data-act="start"]').click();
   await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.blackoutPending==='true');
   assert.match(await actor.getAttribute('src'),/curator-alert\.png$/);
   await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.transformation==='true',{timeout:2500});
   assert.match(await actor.getAttribute('src'),/curator-corrupt\.png$/);
   await actor.evaluate(img=>img.decode());
   await page.screenshot({path:'artifacts/'+label+'-morph.png',animations:'disabled'});
   await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:3000});
   await monster.evaluate(img=>img.decode());
   assert.equal(await monster.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');

   // The altered character, not a different anonymous CSS stick monster,
   // is shown when the scripted blackout encounter is triggered.
   const buttons=await page.locator('.bk-list>div button').count();
   if(buttons>2){
     await page.locator('[data-act="next"]').click();
     const danger=await page.locator('.bk-stage').getAttribute('data-danger');
     if(danger==='true'){
       assert.equal(await page.locator('.bk-monster').isVisible(),true);
       assert.match(await monster.getAttribute('src'),/curator-monster-[12]\.png$/);
       await page.screenshot({path:'artifacts/'+label+'-encounter.png',animations:'disabled'});
     }
   }
   await page.locator('[data-act="torch"]').click();
   assert.equal(await page.locator('.bk-stage').getAttribute('data-torch'),'false');
   await page.screenshot({path:'artifacts/'+label+'-blackout.png',animations:'disabled'});
   await page.locator('[data-act="exit"]').click();
   assert.equal(await page.locator('.bk-stage').getAttribute('data-dark'),'false');
   assert.match(await actor.getAttribute('src'),/curator-neutral\.png$/);
   const bounds=await actor.boundingBox();
   assert.ok(bounds&&bounds.x>=-5&&bounds.x+bounds.width<=viewport.width+5,
    'Curator clipped horizontally: '+JSON.stringify(bounds));
   assert.deepEqual(errors,[],'Runtime/source errors: '+errors.join('; '));
   console.log(label,'PASS: pixel curator, background, morph, night, restored, no errors');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
