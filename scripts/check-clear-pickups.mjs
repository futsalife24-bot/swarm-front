import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({channel:'chrome', args:['--use-angle=d3d11']});
const page = await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
await page.route(/\/src\/client\/playtest-app.ts(?:\?.*)?$/,async route=>{
 const response=await route.fetch();
 await route.fulfill({response,body:(await response.text())+`\nwindow.clearFixture=()=>{const p=world.players[0]; world.enemies=[]; world.phase='victory';world.rewards.solo=[];world.drops=[{id:'visual-heal',type:'heal',owner:'solo',x:p.x-2,z:p.z-3,weapon:p.weapons[0]},{id:'visual-weapon',type:'weapon',owner:'solo',x:p.x+2,z:p.z-3,weapon:p.weapons[0]}]; victory();}; window.pickupFixture=()=>{const p=world.players[0];p.hp=80;world.drops.forEach(d=>{d.x=p.x;d.z=p.z;});};`});
});
try {
 await page.goto(process.env.CLEAR_ORIGIN || 'http://127.0.0.1:5347/');
 if(await page.locator('#landscape-start').isVisible())await page.locator('#landscape-start').click();
 await page.locator('#solo').click();
 if(await page.locator('#player-name').isVisible()){await page.locator('#player-name').fill('回収テスト');await page.locator('#player-name-form button[type=submit]').click();}
 if(await page.locator('#pt-confirm').count())await page.locator('#pt-confirm').click();
 await page.locator('#pt-start').click();
 await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});
 await page.locator('#pt-enter').click();
 if(await page.locator('#pt-tutorial-skip').count())await page.locator('#pt-tutorial-skip').click();
 if(await page.locator('#pt-intro-skip').count())await page.locator('#pt-intro-skip').click();
 await page.waitForTimeout(300);
 await page.evaluate(()=>window.clearFixture());
 await page.locator('#pt-end-collection').waitFor();
 fs.mkdirSync('dist-validation/clear-pickups',{recursive:true});
 for(const width of [844,1280,667]) {
  await page.setViewportSize({width,height:390});
  await page.waitForTimeout(200);
  const style=await page.locator('#ui').evaluate(el=>({background:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage,pointer:getComputedStyle(el).pointerEvents}));
  assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.image,'none');assert.equal(style.pointer,'none');
  assert.equal(await page.locator('.pt-fade').count(),0);
  await page.screenshot({path:`dist-validation/clear-pickups/clear-${width}.png`});
 }
 const before=await page.evaluate(()=>window.__playtest.world.players[0].z);
 await page.keyboard.down('KeyW');
 try {await page.waitForFunction(z=>window.__playtest.world.players[0].z!==z,before,{timeout:3000});}
 finally {await page.keyboard.up('KeyW');}
 const after=await page.evaluate(()=>window.__playtest.world.players[0].z);
 assert.notEqual(before,after);
 await page.evaluate(()=>window.pickupFixture());await page.waitForTimeout(250);
 const state=await page.evaluate(()=>window.__playtest);
 assert.equal(state.world.drops.length,0);assert.ok(state.world.players[0].hp>80);assert.ok(state.world.pending.solo.length>0);
 await page.locator('#pt-end-collection').click();await page.locator('#pt-normal-reward').waitFor();
 assert.deepEqual(errors,[]);
 fs.writeFileSync('dist-validation/clear-pickups/result.json',JSON.stringify({sizes:[844,1280,667],movement:true,healAndWeaponCollected:true,resultButton:true,errors},null,2));
 console.log('PASS clear transparency, movement, both pickups, result button; 3 landscape widths');
} finally {await browser.close();}


