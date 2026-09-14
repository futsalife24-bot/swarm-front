import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.SPAWN_SITE||'http://127.0.0.1:5353',label=base.startsWith('https')?'published':'local',out='dist-validation/enemy-spawn';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']}),rows=[];
try {
 for(const [width,height] of [[844,390],[1280,720]]) {
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?playtest=1');await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();
  await page.locator('#pt-tutorial-skip').click();
  await page.locator('.pt-cutscene-ready').waitFor({timeout:60000}).catch(async e=>{await page.screenshot({path:`${out}/${label}-failure.png`});console.log(await page.locator('body').innerText());throw e;});
  await page.screenshot({path:`${out}/${label}-encounter-${width}.png`});
  await page.locator('#pt-intro-skip').click();await page.waitForTimeout(1000);
  await page.locator('#pause').click();await page.waitForTimeout(200);
  assert.deepEqual(errors,[]);rows.push({width,height,encounterCompleted:true,pause:true,errors});await page.close();
 }
 const sha=b=>createHash('sha256').update(b).digest('hex'),assets=[];
 for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p)]) {
  const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync('dist/'+p)));assets.push(p);
 }
 if(label==='published')assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
 fs.writeFileSync(`${out}/${label}-release.json`,JSON.stringify({rows,assets},null,2));console.log('PASS',label,rows.length,'battle/encounter/pause',assets.length,'hashes');
}finally{await browser.close()}
