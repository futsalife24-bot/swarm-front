import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.BASE_ORIGIN||'http://127.0.0.1:5362';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Local fixtures only');
const out='dist-validation/base-menu';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try{
for(const [width,height] of [[1280,582],[844,390],[667,375]]){
 const p=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin);await p.getByRole('button',{name:'基地',exact:true}).click();await p.locator('#pt-confirm').click();
 assert.equal(await p.locator('h1').innerText(),'基地');assert.equal(await p.locator('.pt-base-menu > button').count(),4);assert.ok(await p.locator('#pt-base-workshop').isDisabled());
 assert.match(await p.locator('#pt-base-workshop').innerText(),/工事中/);
 const layout=await p.locator('.pt-base-menu').evaluate(e=>({scroll:e.scrollHeight-e.clientHeight,cards:[...e.children].map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}),overflow:document.documentElement.scrollWidth>innerWidth}));
 assert.ok(!layout.overflow);assert.ok(layout.cards.every(r=>r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height));assert.ok(layout.scroll<=1);
 await p.screenshot({path:`${out}/${width}-base.png`});
 await p.locator('#pt-base-weapons').click();assert.equal(await p.locator('h1').innerText(),'武器');await p.locator('[data-genre=rifle]').click();assert.equal(await p.locator('h1').innerText(),'ライフル');await p.locator('#pt-base').click();
 await p.locator('#pt-base-accessories').click();await p.locator('#pt-tutorial-skip').click();assert.equal(await p.locator('h1').innerText(),'アクセサリ');await p.locator('#pt-base').click();
 await p.locator('#pt-base-growth').click();await p.locator('#pt-tutorial-skip').click();assert.equal(await p.locator('h1').innerText(),'兵士の育成');await p.locator('#pt-base').click();
 await p.locator('#pt-gear').click();assert.equal(await p.locator('h1').innerText(),'出撃準備');await p.locator('#pt-base').click();assert.equal(await p.locator('h1').innerText(),'基地');
 await p.locator('#pt-home').click();assert.equal(await p.locator('#pt-growth').count(),0);await p.screenshot({path:`${out}/${width}-title.png`});await p.getByRole('button',{name:'基地',exact:true}).click();assert.equal(await p.locator('h1').innerText(),'基地');assert.equal(await p.locator('#pt-confirm').count(),0);
 assert.deepEqual(errors,[]);results.push({width,height,...layout,errors,allRoutes:true,workshopDisabled:true});await p.close();
}
fs.writeFileSync(out+'/checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
