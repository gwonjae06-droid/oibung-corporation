const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 await fs.mkdir('artifacts',{recursive:true});
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['portrait',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
  await page.locator('.bk-stage').waitFor();
  await page.waitForFunction(()=>document.querySelector('.bk-plaque')?.textContent.includes('·')||document.querySelector('.bk-count')?.textContent.includes('회랑'));
  await page.locator('.bk-human').evaluate(img=>img.decode());
  assert.match(await page.locator('.bk-human').getAttribute('src'),/assets\/curator\//);
  await page.locator('[data-act="talk"]').click();
  assert.match(await page.locator('.bk-human').getAttribute('src'),/explain\.png$/);
  await page.screenshot({path:`artifacts/${name}-light.png`});
  await page.locator('[data-act="night"]').click();
  await page.locator('[data-act="start"]').click();
  await page.waitForFunction(()=>document.querySelector('.bk-stage').dataset.dark==='true');
  await page.locator('[data-act="torch"]').click();
  assert.equal(await page.locator('.bk-stage').getAttribute('data-torch'),'false');
  await page.screenshot({path:`artifacts/${name}-dark.png`});
  await page.locator('[data-act="exit"]').click();
  assert.equal(await page.locator('.bk-stage').getAttribute('data-dark'),'false');
  await page.locator('[data-act="list"]').click();
  assert.ok(await page.locator('.bk-list').evaluate(d=>d.open));
  await page.locator('[data-act="close-list"]').click();
  assert.deepEqual(errors,[]);
  await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
