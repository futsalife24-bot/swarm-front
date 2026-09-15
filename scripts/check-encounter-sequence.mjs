import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try {
for(const [width,height] of [[844,390],[1280,720]]) {
 const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5351/?playtest=1');
 await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();
 await page.evaluate(()=>{window.samples=[];const sample=()=>{const d=document.querySelector('.pt-cutscene'),s=window.__playtest;if(d&&s){window.samples.push({phase:d.dataset.phase,time:s.world.time,camera:s.camera,text:getComputedStyle(d.querySelector('h2')).visibility,bars:d.style.getPropertyValue('--intro-bars')});}requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await page.locator('#pt-tutorial-skip').click();
 await page.locator('.pt-cutscene-ready').waitFor({timeout:90000});
 await page.screenshot({path:`dist-validation/encounter-sequence/text-${width}.png`});
 const samples=await page.evaluate(()=>window.samples);const phases=[...new Set(samples.map(s=>s.phase))];assert.deepEqual(phases,['freeze','bars','zoom','text']);
 assert.equal(new Set(samples.map(s=>s.time)).size,1);
 const first=samples[0];for(const s of samples.filter(s=>s.phase==='freeze'||s.phase==='bars'))assert.deepEqual(s.camera,first.camera);
 assert.ok(samples.filter(s=>s.phase==='zoom').some(s=>JSON.stringify(s.camera)!==JSON.stringify(first.camera)));
 for(const s of samples.filter(s=>s.phase!=='text'))assert.equal(s.text,'hidden');
 assert.equal(samples.at(-1).text,'visible');
 await page.locator('#pt-intro-skip').click();await page.waitForTimeout(150);
 const resumed=await page.evaluate(()=>window.__playtest);assert.ok(resumed.world.time>first.time);assert.equal(resumed.encounterActive,false);assert.deepEqual(errors,[]);
 fs.writeFileSync(`dist-validation/encounter-sequence/sequence-${width}.json`,JSON.stringify({phases,samples,errors},null,2));
 console.log('PASS',width,phases.join(' -> '),samples.length,'frames');await page.close();
}
}finally{await browser.close();}
