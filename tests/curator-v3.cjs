const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 for(const [name,viewport] of [
  ['desktop',{width:1440,height:900}],
  ['mobile',{width:390,height:844}],
  ['landscape',{width:844,height:390}]
 ]){
  const page=await browser.newPage({viewport,reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});
  const stage=page.locator('.bk-stage'),actor=page.locator('.bk-human'),monster=page.locator('.bk-monster-sprite');
  await stage.waitFor();
  await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.curatorArt==='v3',{timeout:12000});
  await actor.evaluate(img=>img.decode());
  assert.ok((await actor.getAttribute('src')).startsWith('data:image/png;base64,'));
  assert.deepEqual(await actor.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[228,408]);
  assert.equal(await actor.evaluate(img=>getComputedStyle(img).imageRendering),'pixelated');
  assert.match(await page.locator('.bk-room').evaluate(e=>e.style.backgroundImage),/assets\/museum\//);
  await page.screenshot({path:'artifacts/'+name+'-guide.png'});
  const neutral=await actor.getAttribute('src');
  await page.locator('[data-act="talk"]').click();
  await actor.evaluate(img=>img.decode());
  assert.notEqual(await actor.getAttribute('src'),neutral,'Speaking pose must be a distinct frame');
  await page.locator('[data-act="night"]').click();
  await page.locator('[data-act="start"]').click();
  await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.blackoutPending==='true');
  await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.transformation==='true',{timeout:3000});
  await actor.evaluate(img=>img.decode());
  await page.screenshot({path:'artifacts/'+name+'-transition.png'});
  await page.waitForFunction(()=>document.querySelector('.bk-stage')?.dataset.dark==='true',{timeout:3000});
  // Trigger one scripted encounter if there are enough exhibition items.
  const count=await page.locator('.bk-list>div>button').count();
  if(count>2){
   await page.locator('[data-act="next"]').click();
   if((await stage.getAttribute('data-danger'))==='true'){
    await monster.evaluate(img=>img.decode());
    assert.deepEqual(await monster.evaluate(img=>[img.naturalWidth,img.naturalHeight]),[228,408]);
    assert.ok(await page.locator('.bk-monster').isVisible());
    await page.screenshot({path:'artifacts/'+name+'-monster.png'});
   }
  }
  await page.locator('[data-act="exit"]').click();
  await actor.evaluate(img=>img.decode());
  assert.equal(await stage.getAttribute('data-curator-art'),'v3');
  assert.equal(await stage.getAttribute('data-dark'),'false');
  assert.equal(await actor.getAttribute('src'),neutral);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=6,name+' horizontal overflow '+overflow);
  assert.deepEqual(errors,[],name+' runtime errors');
  console.log('PASS',name,'approved 4-pose new guide & related monster');
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
