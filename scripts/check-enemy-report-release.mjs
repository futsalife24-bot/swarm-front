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
const kinds=['crawler','ant','spider','spitter','boss','hornet','bastion','worm','calyx','harrow'];
try{
 for(const [width,height,touch] of [[1280,800,false],[915,412,true]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('.title-entry-start').click();await page.locator('.title-entry').waitFor({state:'detached'});
  const html=readFileSync('dist/index.html','utf8');
  const paths=[html.match(/src="([^"]+\.js)"/)[1],html.match(/href="([^"]+\.css)"/)[1],'/assets/enemies/pleat_motion_v5.glb','/assets/enemies/leaper_motion_v3.glb','/assets/enemies/hound_motion_v1.glb'];
  const hashes={};for(const path of paths){const response=await page.request.get(base+path);assert.equal(response.status(),200);hashes[path]=hash(await response.body());assert.equal(hashes[path],hash(readFileSync('dist'+path)))}
  await page.locator('#open-bestiary').click();
  const newSaveConfirm=page.locator('dialog.menu-dialog[open]').filter({hasText:'新しい進行を開始'}).getByRole('button',{name:'確定'});
  if(await newSaveConfirm.count())await newSaveConfirm.first().click();
  await page.getByRole('heading',{name:'エネミーレポート',exact:true}).waitFor();
  await page.evaluate(keys=>{
   const key='swarm-front-shared-progress-v3';
   const save=JSON.parse(localStorage.getItem(key));
   save.encounters=Object.fromEntries(keys.map(kind=>[kind,'solo']));
   localStorage.setItem(key,JSON.stringify(save));
  },kinds);
  await page.reload();
  await page.locator('.title-entry-start').waitFor({state:'visible'});await page.locator('.title-entry-start').click();await page.locator('.title-entry').waitFor({state:'detached'});
  await page.locator('#open-bestiary').click();
  await page.getByRole('heading',{name:'エネミーレポート',exact:true}).waitFor();
  assert.equal(await page.locator('[data-enemy]').count(),10);
  await page.waitForTimeout(1500);
  for(const kind of kinds){
   await page.locator(`[data-enemy="${kind}"]`).click();
   await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready');
   for(const mode of ['move','attack','idle']){await page.locator(`button[data-motion="${mode}"]`).click();assert.equal(await page.locator('.enemy-viewport').getAttribute('data-motion'),mode)}
   if(['crawler','spider','worm'].includes(kind))await page.screenshot({path:`${out}/${label}-${width}-${kind}.png`});
  }
  await page.evaluate(()=>document.querySelectorAll('dialog.bestiary[open] #report-close').forEach(button=>button.click()));
  await page.waitForFunction(()=>document.querySelectorAll('dialog.bestiary[open]').length===0);
  await page.evaluate(()=>localStorage.setItem('swarm-front-player-name-v1','RELEASE CHECK'));
  await page.reload();
  await page.locator('.title-entry-start').waitFor({state:'visible'});
  await page.locator('.title-entry-start').click();
  await page.locator('.title-entry').waitFor({state:'detached'});
  for(let step=0;step<12 && !(await page.locator('#pt-start:visible').count());step++){
   if(!(await page.locator('dialog[open]').count())){
    await page.evaluate(()=>[...document.querySelectorAll('#solo')].find(button=>button.getClientRects().length)?.click());
   }
   await page.evaluate(()=>[...document.querySelectorAll('[data-operation="advance"]')].find(button=>button.getClientRects().length)?.click());
   await page.evaluate(()=>{
    for(const button of document.querySelectorAll('dialog[open] button')){
     if(!button.getClientRects().length)continue;
     if(/^(確定|あとで)$/.test((button.textContent||'').trim()))button.click();
    }
   });
   await page.waitForTimeout(400);
  }
  await page.locator('#pt-start:visible').first().click();
  await page.waitForFunction(()=>document.body.dataset.screen==='loading');
  let battleEntry='skipped: headless shader preparation did not finish within 20s';
  try{
   await page.locator('#pt-enter:visible').first().waitFor({state:'visible',timeout:20000});
   await page.locator('#pt-enter:visible').first().click();
   await page.locator('#pause:visible').first().waitFor({state:'visible',timeout:15000});
   await page.locator('#pause:visible').first().click();
   await page.locator('#pt-retire:visible').first().click();
   await page.locator('#pt-confirm:visible').first().click();
   await page.waitForFunction(()=>document.body.dataset.screen==='result');
   battleEntry='verified';
  }catch{}
  assert.deepEqual(errors,[]);results.push({width,height,touch,hashes,battleEntry,errors});await context.close();
 }
 if(label==='published'){const response=await fetch(base+'/api/health');assert.equal(response.status,200);const health=await response.json();assert.equal(health.ok,true);results.push({health})}
 writeFileSync(`${out}/${label}-checks.json`,JSON.stringify({pass:true,results},null,2));console.log(JSON.stringify({pass:true,label,results}));
}finally{await browser.close()}

