import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/resource-frames';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{for(const width of [667,844,1280]){
const p=await browser.newPage({viewport:{width,height:390},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
let fixture=JSON.parse(fs.readFileSync('dist-validation/gear-pinned/fixture.json','utf8'));Object.assign(fixture,{coins:999999999,powder:999999999,materials:99,points:120,tutorials:['growth','accessories']});
await p.addInitScript(s=>localStorage.setItem('swarm-front-progression-v2-normal',JSON.stringify(s)),fixture);
await p.goto('http://127.0.0.1:5347/');await p.locator('#solo').click();await p.locator('#player-name').fill('資源UI検証');await p.locator('#player-name-form button[type=submit]').click();
async function shot(name){await p.screenshot({path:`${out}/${width}-${name}.png`});const state=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,frames:[...document.querySelectorAll('.resource-frame')].map(e=>({text:e.textContent,overflow:e.scrollWidth>e.clientWidth+1,width:e.getBoundingClientRect().width})),wallet:[...document.querySelectorAll('.resource-wallet .resource-amount')].map(e=>e.textContent)}));results.push({width,name,...state});assert.ok(!state.overflow);assert.ok(state.frames.every(e=>!e.overflow),JSON.stringify(state));}
await shot('gear');await p.locator('#pt-base').click();await shot('base');assert.equal(await p.locator('.resource-wallet .resource-frame').count(),4);
await p.locator('#pt-base-accessories').click();await shot('accessories');await p.locator('#pt-craft').click();assert.equal(await p.locator('.resource-wallet [data-resource=powder] .resource-amount').textContent(),'999,999,989');await shot('crafted');
await p.locator('#pt-base').click();await p.locator('#pt-base-growth').click();await shot('growth');
await p.locator('[data-unlock]').first().click();assert.equal(await p.locator('.resource-wallet [data-resource=materials] .resource-amount').textContent(),'98');await shot('unlocked');
await p.locator('#pt-base').click();await p.locator('#pt-base-weapons').click();await shot('armory');
await p.evaluate(async()=>{const m=await import('/src/client/progression-save.ts');let s=m.loadProgress('normal');s.points=0;s=m.grantResult(s,{run:'resource-ui-win',stage:1,difficulty:'normal',win:true,time:60,kills:12,missions:[true,true,true],weapons:[],collected:0},()=>0.5);s=m.prepareChoice(s,()=>0.5);m.persistProgress(s);});
await p.reload();await p.locator('#pt-normal-reward').waitFor();await shot('reward-choice');await p.locator('#pt-normal-reward').click();await shot('result');assert.equal(await p.locator('[data-resource=materials][data-purpose=gain]').count(),1);assert.equal(await p.locator('[data-resource=points][data-purpose=gain]').count(),1);
assert.deepEqual(errors,[]);await p.close();
}fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log('Resource UI: 3 widths, 27 screenshots, wallet deductions and bounds passed');}finally{await browser.close();}
