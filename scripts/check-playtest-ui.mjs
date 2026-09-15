import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:650},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto('http://127.0.0.1:5347/?playtest=1');
await page.locator('#solo').click();await page.locator('#pt-confirm').click();

await page.screenshot({path:'dist-validation/playtest-v1/gear.png'});
await page.locator('#pt-start').click();
await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});
await page.screenshot({path:'dist-validation/playtest-v1/load.png'});
await page.locator('#pt-enter').click();
await page.locator('#pt-tutorial-skip').click();
await page.waitForTimeout(1000);
await page.screenshot({path:'dist-validation/playtest-v1/battle.png'});
const state=await page.evaluate(()=>window.__playtest);
fs.writeFileSync('dist-validation/playtest-v1/ui-first.json',JSON.stringify({screen:state.screen,time:state.world?.time,ready:state.loadReady,errors},null,2));
assert.deepEqual(errors,[]);console.log('PASS first launch',state.screen,state.world.time);
}finally{await browser.close();}
