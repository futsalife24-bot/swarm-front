import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1100,height:650},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5347/?playtest=1');
 await page.locator('#pt-begin').click(); await page.locator('#pt-confirm').click();
 await page.locator('#pt-launch-menu').click(); await page.locator('#pt-start').click();
 await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});
 await page.locator('#pt-enter').click(); await page.locator('#pt-tutorial-skip').click();
 await page.locator('#pt-intro-skip').waitFor({timeout:45000});
 const intro=await page.evaluate(()=>window.__playtest);
 assert.ok(Object.values(intro.renderedEnemies).flat().length>0);
 await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>window.__playtest.world.time),intro.world.time);
 await page.screenshot({path:'dist-validation/playtest-v1/encounter.png'});
 await page.locator('#pt-intro-skip').click(); await page.waitForTimeout(300);
 assert.ok(await page.evaluate(()=>window.__playtest.world.time)>intro.world.time);
 // Reload retries the failed required boss in the same finite test save/stage.
 await page.goto('http://127.0.0.1:5347/?playtest=1');
 await page.evaluate(async()=>{const m=await import('/src/client/progression-save.ts');const s=m.freshProgress('test');s.tutorials=['combat'];m.persistProgress(s);sessionStorage.setItem('swarm-front-playtest-mode','test');});
 await page.route(/foundry_zero.*\.glb/,route=>route.abort());
 await page.reload();await page.locator('#pt-launch-menu').click();await page.locator('#pt-stage').selectOption('4');await page.locator('#pt-difficulty').selectOption('medium');await page.locator('#pt-start').click();
 await page.locator('#pt-load-retry').waitFor({timeout:90000});assert.equal(await page.locator('#pt-enter').isHidden(),true);
 await page.screenshot({path:'dist-validation/playtest-v1/load-error.png'});
 await page.unroute(/foundry_zero.*\.glb/);await page.locator('#pt-load-retry').click();
 await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});
 const restored=await page.evaluate(()=>window.__playtest);
 assert.equal(restored.mode,'test');assert.equal(restored.world.solo.stage,4);assert.equal(restored.world.solo.difficulty,'medium');assert.equal(restored.world.time,0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('dist-validation/playtest-v1/audit-ui.json',JSON.stringify({intro:{time:intro.world.time,rendered:intro.renderedEnemies,encounters:intro.save.encounters},retry:{mode:restored.mode,stage:restored.world.solo.stage,difficulty:restored.world.solo.difficulty,ready:restored.loadReady},errors},null,2));
 console.log('PASS intro rendered before pause; required boss failure and same-mode stage retry');
} finally {await browser.close();}
