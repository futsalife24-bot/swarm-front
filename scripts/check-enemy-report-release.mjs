import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.env.REPORT_SITE||'http://127.0.0.1:5208';
const label=base.startsWith('https:')?'published':'release';
const out='dist-validation/enemy-redesign';mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const [width,height,touch] of [[1280,800,false],[915,412,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const html=readFileSync('dist/index.html','utf8');
  const paths=[html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1],'/assets/enemies/pleat_motion_v5.glb','/assets/enemies/leaper_motion_v2.glb','/assets/enemies/hound_motion_v1.glb'];
  const hashes={};for(const path of paths){const response=await page.request.get(base+path);assert.equal(response.status(),200);hashes[path]=hash(await response.body());assert.equal(hashes[path],hash(readFileSync('dist'+path)))}
  await page.locator('#open-bestiary').click();
  for(const kind of ['crawler','spider','ant','spitter','hornet','boss','worm']){
   if(kind==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${kind}"]`).click();
   await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready');
   for(const mode of ['move','attack','idle']){await page.locator(`button[data-motion="${mode}"]`).click();assert.equal(await page.locator('.enemy-viewport').getAttribute('data-motion'),mode)}
   if(['crawler','spider','worm'].includes(kind))await page.screenshot({path:`${out}/${label}-${width}-${kind}.png`});
  }
  await page.locator('#report-close').click();
  await page.locator('#solo').click();await page.locator('#launch').click();await page.waitForTimeout(450);
  await page.locator('#pause').click();
  await page.locator('#pause-leave').click();
  await page.locator('#pause-quit').click();
  await page.locator('#launch').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);results.push({width,height,touch,hashes,errors});await context.close();
 }
 if(label==='published'){const response=await fetch(base+'/api/health');assert.equal(response.status,200);const health=await response.json();assert.equal(health.ok,true);results.push({health})}
 writeFileSync(`${out}/${label}-checks.json`,JSON.stringify({pass:true,results},null,2));console.log(JSON.stringify({pass:true,label,results}));
}finally{await browser.close()}

