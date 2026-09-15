import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/playtest-ui-restore';
const origin=process.env.UI_ORIGIN || 'http://127.0.0.1:5347';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const results=[];
try {
 for(const [width,height] of [[844,390],[640,360],[1280,720]]) {
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const capture=async name=>{
   await page.screenshot({path:`${dir}/${width}-${name}.png`});
   const state=await page.evaluate(()=>({screen:document.body.dataset.screen,overflow:document.documentElement.scrollWidth>innerWidth,offscreen:[...document.querySelectorAll('#ui button,#ui select')].filter(e=>e.getClientRects().length&&!e.closest('.pt-stat-scroll')).filter(e=>{const r=e.getBoundingClientRect();return r.x<0||r.right>innerWidth+1||r.y<0||r.bottom>innerHeight+1}).map(e=>e.id||e.textContent)}));
   results.push({width,name,...state}); assert.equal(state.overflow,false,`${width} ${name} overflow`);
   assert.deepEqual(state.offscreen,[],`${width} ${name} offscreen`);
   if(name==='gear') assert.ok(await page.evaluate(()=>document.querySelector('.loadout-slots button:last-child').getBoundingClientRect().bottom<=document.querySelector('.gear-footer').getBoundingClientRect().top),`${width} equipment overlaps footer`);
  };
  await page.goto(origin+'/?playtest=1');await page.locator('#solo').waitFor();
  await capture('title');assert.equal(await page.locator('.title h1').innerText(),'SWARM\nFRONT.');
  await page.locator('#solo').click();await page.locator('#pt-confirm').click();
  await capture('gear');assert.equal(await page.locator('.loadout-slots button').count(),2);
  await page.locator('#pt-armory').click();await capture('armory');
  await page.locator('[data-detail]').first().click();await capture('detail');await page.locator('.dialog-close').click();
  await page.locator('#pt-growth').click();if(await page.locator('#pt-tutorial-skip').count())await page.locator('#pt-tutorial-skip').click();await capture('growth');
  await page.locator('#pt-register').click();assert.equal(await page.locator('#pt-soldier option').count(),2);
  await page.locator('#pt-home').click();await page.locator('#home-settings').click();await capture('settings');
  await page.locator('[data-preference="sensitivity"]').fill('2.3');
  await page.locator('#tab-controls').click();assert.ok(await page.locator('#settings-controls').isVisible());
  await page.locator('#tab-save').click();for(let i=0;i<5;i++)await page.locator('#pt-build-label').click();
  if(!origin.includes('5347'))assert.ok(await page.locator('#pt-test-entry').isHidden());
  await page.locator('#tab-preferences').click();await page.locator('#pt-layout').click();await page.locator('#layout-cancel').click();
  await page.reload();await page.locator('#home-settings').click();assert.equal(await page.locator('[data-preference="sensitivity"]').inputValue(),'2.3');await page.locator('.dialog-close').click();
  assert.deepEqual(errors,[]);await page.close();
 }
 fs.writeFileSync(`${dir}/ui.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
