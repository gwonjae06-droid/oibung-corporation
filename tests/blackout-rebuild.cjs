/* End-to-end checks for the approved curator expressions and blackout flow. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await fs.mkdir('artifacts',{recursive:true});
  const layouts=[
   ['desktop',{width:1440,height:900}],
   ['portrait',{width:390,height:844}],
   ['landscape',{width:844,height:390}]
  ];
  for(const [name,viewport] of layouts){
   const page=await browser.newPage({viewport,reducedMotion:'no-preference',hasTouch:name!=='desktop'});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('requestfailed',r=>{if(r.url().includes('/assets/curator/'))errors.push('Sprite network failure: '+r.url());});
   await page.route('**/*',route=>{
    const address=new URL(route.request().url());
    if(address.hostname==='127.0.0.1')return route.continue();
    return route.abort();
   });
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('.bk-stage').waitFor();
   await page.locator('.bk-human').evaluate(async img=>{await img.decode();});
   const actor=page.locator('.bk-human');
   assert.match(await actor.getAttribute('src'),/assets\/curator\/neutral\.png$/);
   assert.ok(await actor.evaluate(x=>x.naturalWidth>160&&x.naturalHeight>700));
   await page.locator('[data-act="talk"]').click();
   assert.match(await actor.getAttribute('src'),/assets\/curator\/explain\.png$/);
   await actor.evaluate(img=>img.decode());
   await page.screenshot({path:'artifacts/'+name+'-light.png',animations:'disabled'});

   // Navigation should cancel pending horror rather than switching modes later.
   const hasNeighbours=await page.locator('.bk-list>div button').count()>1;
   await page.locator('[data-act="night"]').click();
   await page.locator('[data-act="start"]').click();
   await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.blackoutPending==='true');
   assert.match(await actor.getAttribute('src'),/assets\/curator\/alert\.png$/);
   await actor.evaluate(img=>img.decode());
   await page.screenshot({path:'artifacts/'+name+'-alert.png',animations:'disabled'});
   if(hasNeighbours){
    await page.locator('[data-act="next"]').click();
    assert.equal(await page.locator('.bk-stage').getAttribute('data-blackout-pending'),null);
    await page.waitForTimeout(1450);
    assert.equal(await page.locator('.bk-stage').getAttribute('data-dark'),'false');
   }else{
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1450);
    assert.equal(await page.locator('.bk-stage').getAttribute('data-dark'),'false');
   }
   await page.locator('[data-act="night"]').click();
   await page.locator('[data-act="start"]').click();
   await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:5000});
   assert.equal(await page.locator('.bk-stage').getAttribute('data-blackout-pending'),null);
   await page.locator('[data-act="torch"]').click();
   assert.equal(await page.locator('.bk-stage').getAttribute('data-torch'),'false');
   await page.screenshot({path:'artifacts/'+name+'-dark.png',animations:'disabled'});
   await page.locator('[data-act="exit"]').click();
   assert.equal(await page.locator('.bk-stage').getAttribute('data-dark'),'false');
   assert.match(await actor.getAttribute('src'),/assets\/curator\/neutral\.png$/);
   await page.locator('[data-act="list"]').click();
   assert.equal(await page.locator('.bk-list').evaluate(x=>x.open),true);
   await page.locator('[data-act="close-list"]').click();
   const sizing=await page.evaluate(()=>({
    width:innerWidth,
    scrollWidth:document.documentElement.scrollWidth
   }));
   assert.ok(sizing.scrollWidth<=sizing.width+6,'Horizontal overflow '+JSON.stringify(sizing));
   assert.deepEqual(errors,[],name+' has browser errors');
   console.log('PASS '+name+' — poses, pending cancellation, blackout, torch, list, sizing');
   await page.close();
  }
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1);});
