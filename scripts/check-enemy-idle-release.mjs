import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.IDLE_SITE||'http://127.0.0.1:5351',published=base.startsWith('https'),label=published?'published':'local',out='dist-validation/enemy-idle';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const rows=[];
try {
for(const [width,height] of [[844,390],[1280,720]]){
 const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#open-bestiary').waitFor();await page.locator('h1').click();await page.waitForTimeout(400);await page.locator('#open-bestiary').click();
 for(const kind of ['crawler','ant','spider','spitter','hornet','boss','worm']){
  if(kind==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${kind}"]`).click();
  await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready',null,{timeout:90000});
  await page.locator('button[data-motion="idle"]').click();await page.waitForTimeout(300);
  const a=await page.locator('.enemy-viewport').screenshot();await page.waitForTimeout(1200);const b=await page.locator('.enemy-viewport').screenshot({path:`${out}/${label}-${kind}-${width}.png`});assert.ok(!a.equals(b),kind+' idle motion');
  for(const mode of ['move','attack','idle']){await page.locator(`button[data-motion="${mode}"]`).click();await page.waitForTimeout(200);}
  rows.push({kind,width,height,idleChangesPixels:true,modes:true});
 }
 await page.locator('#report-close').click();await page.locator('#open-bestiary').click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready');await page.locator('#report-close').click();assert.deepEqual(errors,[]);await page.close();
}
const assets=[];
if(published){const sha=b=>createHash('sha256').update(b).digest('hex');for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p)]){const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync('dist/'+p)));assets.push(p);}assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);}
fs.writeFileSync(`${out}/${label}-release.json`,JSON.stringify({rows,assets,errors:[]},null,2));console.log('PASS',label,rows.length,'views, transitions, close/reopen',assets.length,'asset hashes');
}finally{await browser.close()}
