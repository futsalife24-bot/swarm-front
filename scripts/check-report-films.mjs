import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=process.env.REPORT_SITE||'http://127.0.0.1:5351',published=base.startsWith('https:'),label=published?'published':'local';
const out='dist-validation/report-films',kinds=['crawler','ant','spider','spitter','hornet','boss','worm'],results=[];
const b=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{
 for(const [width,height]of [[1280,720],[844,390]]){
  const context=await b.newContext({viewport:{width,height},serviceWorkers:published?'allow':'block'}),page=await context.newPage(),errors=[],movies=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/encounters/'))movies.push(r.url())});
  await page.goto(base+'/?playtest=1');await page.locator('#open-bestiary').click();await page.locator('#pt-confirm').click();
  await page.locator('[data-report="crawler"]').click();assert.equal(await page.locator('#pt-report-film').isVisible(),false);assert.equal(movies.length,0);
  await page.evaluate(()=>{const key='swarm-front-progression-v2-normal',s=JSON.parse(localStorage.getItem(key));if(!s)throw Error('No isolated save');s.encounters={ant:'coop'};localStorage.setItem(key,JSON.stringify(s))});
  await page.reload();await page.locator('#open-bestiary').click();await page.locator('[data-report="ant"]').click();assert.equal(await page.locator('#pt-report-film').isVisible(),false);assert.equal(movies.length,0);
  await page.evaluate(keys=>{const key='swarm-front-progression-v2-normal',s=JSON.parse(localStorage.getItem(key));s.encounters=Object.fromEntries(keys.map(k=>[k,'solo']));localStorage.setItem(key,JSON.stringify(s))},kinds);
  await page.reload();await page.locator('#open-bestiary').click();
  for(const key of kinds){
   await page.locator(`[data-report="${key}"]`).click();await page.locator('#pt-report-film').click();
   const v=page.locator('.report-film-dialog video');await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return v?.videoWidth===1280&&v.currentTime>.2},{},{timeout:30000});
   const meta=await v.evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,src:v.dataset.source,paused:v.paused}));assert.equal(meta.height,720);assert.ok(meta.duration>6&&meta.duration<15);assert.ok(meta.src.endsWith('/'+key+'.mp4'));assert.equal(meta.paused,false);await v.evaluate(v=>v.pause());await v.evaluate(v=>{v.currentTime=5});await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return !v.seeking&&Math.abs(v.currentTime-5)<.1},{},{timeout:10000});await v.evaluate(v=>v.play());
   const box=await v.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
   await v.evaluate(v=>{v.currentTime=v.duration-.3});await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.ended);
   await v.evaluate(v=>v.play());await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return !v.paused&&v.currentTime<2});
   if(key==='crawler'||key==='worm'){await v.evaluate(v=>{v.currentTime=v.duration-2;v.pause()});await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return !v.seeking&&v.readyState>=2});await page.screenshot({path:`${out}/${label}-${width}-${key}.png`})}
   await v.evaluate(v=>window.lastFilm=v);await page.locator('.report-film-dialog .dialog-close').click();await page.locator('.report-film-dialog').waitFor({state:'detached'});
   assert.ok(await page.evaluate(()=>window.lastFilm.paused&&!window.lastFilm.hasAttribute('src')));assert.ok(await page.locator('#pt-report-film').isVisible());results.push({viewport:{width,height},key,...meta});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 // Both legacy bestiary forms use the same movies, with the report kept open.
 const page=await b.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});await page.goto(base);await page.locator('#open-bestiary').click();
 for(const key of kinds){if(key==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${key}"]`).click();await page.locator('.report-film-open').click();await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.readyState>=2);assert.ok((await page.locator('.report-film-dialog video').getAttribute('data-source')).endsWith('/'+key+'.mp4'));await page.locator('.report-film-dialog .dialog-close').click()}
 // A network failure offers a working retry without closing the report.
 await page.route('**/assets/encounters/**',r=>r.fulfill({status:404,body:'missing'}));await page.locator('.report-film-open').click();await page.locator('.film-retry').waitFor();await page.unroute('**/assets/encounters/**');await page.locator('.film-retry').click();await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.currentTime>.2);await page.locator('.report-film-dialog .dialog-close').click();await page.locator('#report-close').click();await page.close();
 if(published){
  const hash=b=>createHash('sha256').update(b).digest('hex');const paths=['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p),...kinds.map(k=>'assets/encounters/report-v1/'+k+'.mp4')];
  for(const p of paths){const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(fs.readFileSync('dist/'+p)))}
  // Complete Blob playback is verified above; the host need not support Range.
  assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
 }
 fs.writeFileSync(`${out}/${label}-checks.json`,JSON.stringify({pass:true,results,lockedAndCoopHidden:true,legacyForms:true,retry:true},null,2));console.log('PASS',label,'all 7 movies, 2 viewports, seek/replay/close, unlocks, legacy, retry');
}finally{await b.close()}


