import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base=process.env.REPORT_DEV_SITE||'http://127.0.0.1:5351',published=base.startsWith('https'),label=published?'published':'local',out='dist-validation/report-developer',rows=[];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try {
for(const [width,height] of [[844,390],[1280,582]]){
 const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?playtest=1');await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').waitFor();
 const preserved=await page.evaluate(()=>{const k='swarm-front-progression-v2-normal',s=JSON.parse(localStorage.getItem(k));s.encounters={crawler:'solo',ant:'coop'};localStorage.setItem(k,JSON.stringify(s));localStorage.setItem('swarm-front-progression-v2-test','untouched-test-save');return {[k]:localStorage.getItem(k),'swarm-front-progression-v2-test':localStorage.getItem('swarm-front-progression-v2-test')};});
 await page.goto(base+'/?playtest=1');await page.locator('#open-bestiary').click();await page.locator('.bestiary').waitFor();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready');
 assert.ok(await page.locator('.enemy-description').innerText().then(t=>t.includes('胸部の襞')));assert.equal(await page.locator('.pt-report').count(),0);
 await page.locator('[data-enemy="spitter"]').click();assert.equal(await page.locator('.enemy-description h3').innerText(),'？？？');assert.equal(await page.locator('.report-film-open').count(),0);assert.equal(await page.locator('.enemy-viewport canvas').count(),0);
 await page.locator('[data-enemy="ant"]').click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready');assert.equal(await page.locator('.enemy-description h3').innerText(),'？？？');assert.equal(await page.locator('.report-film-open').count(),0);
 await page.locator('#report-close').click();await page.locator('#home-settings').click();await page.locator('#tab-save').click();await page.locator('#pt-developer-entry').click();await page.waitForURL('**developer=1');await page.locator('.connection-dot').filter({hasText:'開発者モード'}).waitFor();
 const homeShot=await page.screenshot();await page.locator('#open-bestiary').click();
 for(const kind of ['crawler','ant','spider','spitter','hornet','boss','worm']){
  if(kind==='worm')await page.locator('[data-worm="true"]').click();else await page.locator(`[data-enemy="${kind}"]`).click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready',null,{timeout:90000});
  assert.ok(!(await page.locator('.enemy-description h3').innerText()).includes('？？'));
  for(const mode of ['move','attack','idle'])await page.locator(`button[data-motion="${mode}"]`).click();
  const fit=await page.locator('.bestiary').evaluate(d=>{const r=d.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth+1};});assert.ok(fit.x>=0&&fit.y>=0&&fit.right<=width&&fit.bottom<=height&&!fit.overflow,JSON.stringify(fit));
  const reportShot=await page.screenshot({path:`${out}/${label}-${kind}-${width}.png`});assert.ok(!homeShot.equals(reportShot),'dialog must visibly cover home');rows.push({kind,width,fit});
 }
 await page.locator('.report-film-open').click();await page.waitForFunction(()=>document.querySelector('.report-film-dialog video')?.readyState>=2,null,{timeout:30000});await page.locator('.report-film-dialog .dialog-close').click();await page.locator('#report-close').click();
 await page.locator('#solo').click();assert.equal(await page.locator('#pt-stage option').count(),21);
 for(const difficulty of ['normal','medium'])for(let stage=1;stage<=21;stage++){await page.locator('#pt-stage').selectOption(String(stage));await page.locator('#pt-difficulty').selectOption(difficulty);assert.ok(await page.locator('#pt-start').isEnabled());}
 await page.locator('#pt-stage').selectOption('20');await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();await page.locator('#pause').click();await page.locator('#pt-resume').waitFor();
 const current=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(preserved));assert.deepEqual(current,preserved);
 await page.goto(base+'/?developer=1');await page.locator('#solo').click();const count=await page.locator('.weapon-row').count();
 if(!published){const state=await page.evaluate(()=>window.__playtest.save);assert.equal(state.inventory.length,15);assert.equal(state.accessories.length,18);assert.equal(state.unlocked.length,4);assert.equal(Object.keys(state.encounters).length,7);}
 await page.locator('#pt-home').click();await page.locator('#pt-developer-exit').click();await page.waitForURL('**?playtest=1');await page.locator('#solo').click();await page.locator('#pt-stage').selectOption('20');assert.equal(await page.locator('#pt-start').isEnabled(),false);assert.deepEqual(errors,[]);await page.close();console.log('PASS',label,width,'report locks, all 42 stages, stage 20 sortie, storage isolation, exit');
}
const assets=[];if(published){const sha=b=>createHash('sha256').update(b).digest('hex');for(const p of ['index.html','sw.js',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'assets/'+p)]){const r=await fetch(base+'/'+p);assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),sha(fs.readFileSync('dist/'+p)));assets.push(p)}assert.equal((await(await fetch(base+'/api/health')).json()).ok,true);}
fs.writeFileSync(`${out}/${label}.json`,JSON.stringify({rows,assets,errors:[],storageIsolation:true,allStages:true},null,2));
}finally{await browser.close()}
