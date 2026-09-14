import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=process.env.WEAPON_SITE||'http://127.0.0.1:5219';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];const published=base.startsWith('https');
mkdirSync('dist-validation/weapon-row',{recursive:true});
try {
for(const [width,height] of [[1280,582],[915,412],[844,390],[1280,800]]) {
const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000});
await page.goto(base); await page.locator('#solo').click();
const rows=await page.locator('.gear .weapon-row').evaluateAll(rows=>rows.map(row=>{
const cells=[row.querySelector('.weapon-identity'),...row.querySelectorAll('.weapon-figures > span')];
return cells.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,center:r.y+r.height/2,text:e.textContent}});
}));
for(const cells of rows){assert.ok(Math.max(...cells.map(c=>c.center))-Math.min(...cells.map(c=>c.center))<2);for(let i=1;i<cells.length;i++)assert.ok(cells[i].x>=cells[i-1].right-1,JSON.stringify(cells));}
const overflow=await page.locator('.weapon-list').evaluate(e=>e.scrollWidth-e.clientWidth);assert.ok(overflow<=1,`overflow ${width}: ${overflow}`);
await page.screenshot({path:`dist-validation/weapon-row/${published?'published':'local'}-${width}-${height}.png`});
await page.locator('.weapon-row').last().click();assert.ok(await page.locator('.weapon-row').last().locator('.equipped-flag').count());
results.push({width,height,overflow,rows});await page.close();
}
if(published){const html=readFileSync('dist/index.html','utf8');for(const p of [html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1]]){const response=await fetch(base+p);assert.equal(response.status,200);const sha=b=>createHash('sha256').update(b).digest('hex');assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(readFileSync('dist'+p)));}assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);}
writeFileSync(`dist-validation/weapon-row/${published?'published':'local'}.json`,JSON.stringify({pass:true,results},null,2));console.log('PASS',base,results.map(r=>[r.width,r.height,r.overflow]));
}finally{await browser.close()}
