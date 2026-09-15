import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.env.TYPE_SITE||'http://127.0.0.1:5353',label=base.startsWith('https')?'published':'local',out='dist-validation/enemy-types';
const types={crawler:'生物型',ant:'異構型',spider:'異構型',spitter:'異構型',hornet:'生物型',boss:'機構型',worm:'機構型'};
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']}),rows=[];
try {
 for(const [width,height] of process.env.TYPE_LOCK_ONLY ? [] : [[844,390],[1280,720]]) {
  const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?developer=1');await page.locator('#open-bestiary').waitFor();await page.locator('h1').click();await page.locator('#open-bestiary').click();
  for(const [kind,type] of Object.entries(types)) {
   if(kind==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${kind}"]`).click();
   await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready',null,{timeout:90000});
   assert.equal(await page.locator('.enemy-description > .eyebrow').innerText(),type);
   if(kind!=='worm')assert.equal(await page.locator(`[data-enemy="${kind}"] small`).innerText(),type);
   assert.equal(await page.locator('.enemy-description h4').count(),2);
   assert.equal(await page.locator('.report-film-open').count(),1);
   const fit=await page.locator('.enemy-description > .eyebrow').evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));assert.ok(fit.scroll<=fit.client);
   await page.screenshot({path:`${out}/${label}-${kind}-${width}.png`});rows.push({width,height,kind,type,fit});
  }
  await page.locator('#report-close').click();assert.deepEqual(errors,[]);await page.close();
 }
 // Fresh normal save must not expose the new labels before a solo encounter.
 const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base+'/?playtest=1');await page.locator('#open-bestiary').waitFor();await page.locator('h1').click();await page.waitForTimeout(400);await page.locator('#open-bestiary').click();
 await page.locator('#pt-confirm').click();
 for(const kind of Object.keys(types).filter(k=>k!=='worm')) {
  await page.locator(`[data-enemy="${kind}"]`).click();assert.equal(await page.locator('.enemy-description > .eyebrow').innerText(),'未遭遇');assert.equal(await page.locator(`[data-enemy="${kind}"] small`).innerText(),'未遭遇');
 }
 await page.close();
 const sha=b=>createHash('sha256').update(b).digest('hex'),assets=[];
 for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p)]) {
  const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync('dist/'+p)));assets.push(p);
 }
 if(label==='published')assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
 fs.writeFileSync(`${out}/${label}.json`,JSON.stringify({rows,locked:true,assets},null,2));console.log('PASS',label,rows.length,'type labels/layout/body/film',assets.length,'hashes, encounter locks');
}finally{await browser.close()}
