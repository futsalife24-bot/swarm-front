import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=process.env.FILM_SITE||'http://127.0.0.1:5351',published=base.startsWith('https'),label=published?'published':'local',out='dist-validation/report-films-v2',kinds=['crawler','ant','spider','spitter','hornet','boss','worm'],rows=[];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{for(const [width,height] of [[844,390],[1280,720]]){
 const page=await browser.newPage({viewport:{width,height},serviceWorkers:'allow'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/encounters/'))requests.push(r.url());});
 await page.goto(base+'/?developer=1');await page.locator('#open-bestiary').click();assert.equal(requests.length,0,'No eager movie downloads');
 for(const kind of kinds){
  if(kind==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${kind}"]`).click();await page.locator('.report-film-open').click();const video=page.locator('.report-film-dialog video');
  await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.currentTime>.25,null,{timeout:60000});
  const meta=await video.evaluate(v=>({source:v.dataset.source,width:v.videoWidth,height:v.videoHeight,duration:v.duration}));assert.ok(meta.source.endsWith('/report-v2/'+kind+'.mp4'));assert.equal(meta.width,1280);assert.equal(meta.height,720);assert.ok(meta.duration>8&&meta.duration<20);
  await video.evaluate(v=>{v.pause();v.currentTime=6;});await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return !v.seeking&&v.readyState>=2&&Math.abs(v.currentTime-6)<.1;});const a=await video.screenshot();
  await video.evaluate(v=>{v.currentTime=7.4;});await page.waitForFunction(()=>{const v=document.querySelector('.report-film-dialog video');return !v.seeking&&Math.abs(v.currentTime-7.4)<.1;});const b=await video.screenshot({path:`${out}/${label}-${kind}-${width}.png`});assert.ok(!a.equals(b),kind+' movie idle visible');
  await video.evaluate(v=>{v.currentTime=0;void v.play()});await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.currentTime>.2);
  await video.evaluate(v=>window.closedMovie=v);await page.locator('.report-film-dialog .dialog-close').click();await page.locator('.report-film-dialog').waitFor({state:'detached'});assert.ok(await page.evaluate(()=>window.closedMovie.paused&&!window.closedMovie.hasAttribute('src')));
  rows.push({kind,width,height,...meta,seek:true,replay:true,release:true});
 }
 assert.ok(requests.every(p=>p.includes('/report-v2/')));assert.deepEqual(errors,[]);await page.close();console.log('PASS',label,width,'all 7 new movies');
}
const assets=[];if(published){const sha=b=>createHash('sha256').update(b).digest('hex');for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p),...kinds.map(k=>'assets/encounters/report-v2/'+k+'.mp4')]){const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync('dist/'+p)));assets.push(p)}assert.equal((await(await fetch(base+'/api/health')).json()).ok,true);}
fs.writeFileSync(`${out}/${label}-checks.json`,JSON.stringify({rows,assets,errors:[],onlyVersion2:true},null,2));
}finally{await browser.close()}
