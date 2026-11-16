/* Short end-to-end vertical village regression: desktop and mobile. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 await fs.mkdir('artifacts',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [name,viewport] of [
    ['desktop',{width:1420,height:900}],
    ['mobile',{width:390,height:844}]
  ]){
   const page=await browser.newPage({viewport,reducedMotion:'reduce'});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>
     new URL(route.request().url()).hostname==='127.0.0.1'?
       route.continue():route.abort());
   await page.goto('http://127.0.0.1:8000/',{waitUntil:'domcontentloaded',timeout:30000});
   const stage=page.locator('#oibung-world-stage');
   await stage.waitFor({timeout:15000});
   await page.waitForFunction(()=>window.OIBUNG_WORLD?.getState?.().count>=4,{timeout:15000});
   const start=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(start.guides.length,8,'exactly eight independent residents');
   assert.deepEqual(start.guides.map(g=>g.variant),[0,1,2,3,0,1,2,3]);
   assert.ok(start.floorCount>=2,'at least two climbable floors');
   assert.ok(start.buildingPositions.every(b=>Number.isInteger(b.floor)&&Number.isFinite(b.route)));
   assert.ok(start.buildingWidths.every(w=>w<=450),'shorter horizontal buildings');
   const dims=await page.evaluate(async()=>{
     const paths=['curator-nong-variant-1.png','curator-bbang-variant-3.png',
       'world-terrace-stone.png','world-stair-flight.png'];
     return Promise.all(paths.map(name=>new Promise(resolve=>{
       const img=new Image();img.onload=()=>resolve([name,img.width,img.height]);
       img.onerror=()=>resolve([name,0,0]);
       img.src='assets/world-pixel/'+name;
     })));
   });
   assert.deepEqual(dims.map(x=>x.slice(1)),[[1504,1746],[1504,1746],[512,94],[270,300]]);
   const box=await stage.boundingBox();
   assert.ok(box.height>=490,'tall village viewport');
   // Fullscreen view intentionally spans the physical monitor. The world
   // route itself stays just 1400px wide, then stacks vertically.
   assert.ok(start.worldWidth<=1400,'compact horizontal world footprint');
   await page.screenshot({path:'artifacts/vertical-'+name+'-start.png',animations:'disabled'});
   // Jump to the second exhibit on the ground terrace, then walk UP
   // the physical stone flight. The direction reverses at the landing.
   const second=start.buildingPositions.find((b,i)=>b.floor===0&&i>0);
   assert.ok(second,'second exhibit on ground terrace');
   assert.ok(await page.evaluate(id=>window.OIBUNG_WORLD.travelTo(id),second.id));
   await stage.focus();
   await page.keyboard.down('ArrowRight');
   await page.waitForTimeout(2600);
   await page.keyboard.up('ArrowRight');
   await page.waitForTimeout(180);
   const upper=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.ok(upper.floor>=2,
     'should reach floor two via stairs: '+JSON.stringify({route:upper.route,floor:upper.floor}));
   assert.ok(upper.elevation>=295,'actual physical ascent changes altitude');
   await page.keyboard.down('ArrowLeft');
   await page.waitForTimeout(600);
   await page.keyboard.up('ArrowLeft');
   const advanced=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.ok(advanced.route>upper.route+40,
     'reverse walking direction continues on upper terrace: '+JSON.stringify({
       upperRoute:upper.route,upperFloor:upper.floor,
       afterRoute:advanced.route,afterFloor:advanced.floor}));
   await page.screenshot({path:'artifacts/vertical-'+name+'-upper.png',animations:'disabled'});
   // Directory still warps accurately to a specific floor's door.
   const top=start.buildingPositions.at(-1);
   assert.ok(await page.evaluate(id=>window.OIBUNG_WORLD.travelTo(id),top.id));
   const warped=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(warped.floor,top.floor+1);
   assert.equal(warped.nearest,start.buildingPositions.length-1);
   assert.equal(await page.locator('#world-enter').isEnabled(),true);
   await page.locator('#world-enter').click();
   const interior=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(interior.inside,true,'door should enter its playable interior');
   assert.equal(interior.interior.gameId,top.id);
   assert.ok(await page.evaluate(()=>window.OIBUNG_WORLD.leaveInterior()),
     'exiting the interior should work');
   const returned=await page.evaluate(()=>window.OIBUNG_WORLD.getState());
   assert.equal(returned.inside,false);
   assert.equal(returned.floor,top.floor+1,'return to the originating terrace');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(overflow<=7,'no document horizontal overflow');
   assert.deepEqual(errors,[],'JavaScript should not throw in '+name);
   console.log('PASS '+name+': eight NPCs, PNG dimensions, stairs, reverse landing, floor-aware doors');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
