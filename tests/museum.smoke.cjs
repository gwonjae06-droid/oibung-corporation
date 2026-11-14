/* Static gallery smoke tests: desktop, touch mobile, dark mode and deep links. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

async function runCase(browser, name, viewport, mobile) {
  const context = await browser.newContext({
    viewport, isMobile:mobile, hasTouch:mobile,
    deviceScaleFactor: mobile ? 2 : 1
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:8000/', { waitUntil:'domcontentloaded', timeout:30_000 });
  await page.locator('body.scene-gallery-ready').waitFor({ timeout:15_000 });
  await page.locator('#museum-enter').waitFor();
  assert.equal(await page.locator('#gallery-3d').isVisible(), true, name + ' museum visible');
  assert.equal(await page.locator('#gallery-3d canvas').count(), 0, 'No heavy WebGL canvas');
  assert.equal(await page.locator('.museum-architecture').count(), 1);

  await page.locator('#museum-enter').click();
  assert.equal(await page.locator('#museum-stage').getAttribute('data-area'), 'lobby');
  await page.locator('#museum-map-button').click();
  assert.equal(await page.locator('#museum-map-dialog').evaluate(node => node.open), true);
  await page.locator('#museum-map-close').click();
  await page.locator('#museum-right').click();
  assert.equal(await page.locator('#museum-stage').getAttribute('data-area'), 'right');
  await page.locator('#museum-back').click();
  assert.equal(await page.locator('#museum-stage').getAttribute('data-area'), 'lobby');

  // The catalog is populated by app.js, and the same id must open its real details.
  assert.ok((await page.locator('.museum-map-list button').count()) >= 4, 'Seed entries rendered');
  await page.locator('#museum-approach').click();
  assert.equal(await page.locator('#museum-stage').getAttribute('data-area'), 'focus');
  assert.ok((await page.locator('#museum-work-name').innerText()).trim().length > 0);
  await page.locator('#museum-details').click();
  await page.locator('#game-dialog[open]').waitFor();
  await page.locator('#close-detail').click();
  await page.locator('#game-dialog').evaluate(node => !node.open);

  fs.mkdirSync('artifacts', { recursive:true });
  await page.screenshot({path:'artifacts/' + name + '-light.png',animations:'disabled'});
  await page.locator('#museum-mode-button').click();
  assert.equal(await page.locator('#museum-stage').getAttribute('data-gallery-mode'), 'dark');
  await page.locator('#museum-torch-button').waitFor({state:'visible'});
  await page.locator('#museum-torch-button').click();
  assert.equal(await page.locator('#museum-stage').evaluate(node => node.classList.contains('museum-torch-off')), true);
  await page.screenshot({path:'artifacts/' + name + '-dark.png',animations:'disabled'});
  await page.locator('#museum-torch-button').click();

  const geometry = await page.evaluate(() => ({
    width:window.innerWidth, scrollWidth:document.documentElement.scrollWidth,
    museumWidth:document.getElementById('gallery-3d').getBoundingClientRect().width,
    museumHeight:document.getElementById('gallery-3d').getBoundingClientRect().height
  }));
  assert.ok(geometry.museumWidth >= viewport.width - 10, 'Museum fills screen');
  assert.ok(geometry.museumHeight > viewport.height * .75, 'Museum has usable height');
  assert.ok(geometry.scrollWidth <= geometry.width + 4, 'No horizontal overflow: ' + JSON.stringify(geometry));
  assert.deepEqual(pageErrors.filter(error => /gallery-scenes|Cannot read properties|is not a function/i.test(error)), [],
    'No scene runtime errors: ' + pageErrors.join('; '));
  console.log(name + ' pass', geometry);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  try {
    await runCase(browser, 'desktop', {width:1440,height:900}, false);
    await runCase(browser, 'mobile', {width:390,height:844}, true);
    await runCase(browser, 'mobile-landscape', {width:844,height:390}, true);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
