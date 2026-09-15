import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.REPORT_FILM_OUT||'dist-validation/report-films-v2/videos';fs.mkdirSync(out,{recursive:true});
const kinds=['crawler','ant','spider','spitter','hornet','boss','worm'];
let rows=fs.existsSync(out+'/recordings.json')?JSON.parse(fs.readFileSync(out+'/recordings.json')):[];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{for(const [index,kind]of kinds.entries()){
 if(process.env.ENCOUNTER_KIND&&kind!==process.env.ENCOUNTER_KIND)continue;
 const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block',recordVideo:{dir:out+'/raw',size:{width:1280,height:720}}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/client/playtest-app.ts*',async route=>{const r=await route.fetch();let body=await r.text();const before='encounterCamera(view.camera.clone(), pos, view.encounterFront(e), distance)';assert.ok(body.includes(before));body=body.replace(before,'window.__filmCamera(view.camera.clone(), pos, distance)');await route.fulfill({response:r,body:body+'\n'+fs.readFileSync('scripts/report-film-director.js','utf8')});});
 await page.goto('http://127.0.0.1:5351/?playtest=1');await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();
 const setup=await page.evaluate(k=>window.__filmPrepare(k),kind);assert.ok(setup.frontDot>.999);assert.equal(setup.idleDuration,6);
 await page.addStyleTag({content:'#hud,#minimap,#damage,#scope-overlay,#pause,#controls,#ui{display:none!important}.pt-cutscene #pt-intro-skip{display:none!important}body.playtest .pt-cutscene .menu-dialog-body{min-height:10vh;background:#000;box-sizing:border-box;padding:14px 4vw}body.playtest .pt-cutscene .menu-dialog-body p{font-size:18px;line-height:1.5;margin:0}'});
 await page.waitForTimeout(500);
 await page.evaluate(()=>{window.filmSamples=[];const f=()=>{if(document.querySelector('.pt-cutscene'))window.filmSamples.push(window.__filmCheck());requestAnimationFrame(f)};requestAnimationFrame(f)});
 const start=Date.now();await page.waitForTimeout(800);await page.screenshot({path:`${out}/${kind}-start.png`});await page.evaluate(()=>window.__filmBegin());await page.locator('.pt-cutscene-ready').waitFor();await page.waitForTimeout(700);const a=await page.screenshot();await page.waitForTimeout(800);const b=await page.screenshot();assert.ok(!a.equals(b),kind+' idle visible');await page.waitForTimeout(5000);await page.screenshot({path:`${out}/${kind}.png`});
 const samples=await page.evaluate(()=>window.filmSamples);assert.deepEqual([...new Set(samples.map(s=>s.phase))],['freeze','bars','zoom','text']);for(const s of samples){assert.ok(s.worldFrozen);assert.ok(s.frontDot>.999);assert.ok(s.straightDot>.999999)}assert.deepEqual(errors,[]);
 const duration=(Date.now()-start)/1000;const video=page.video();await context.close();const row={index,kind,...setup,duration,path:await video.path(),phases:['freeze','bars','zoom','text'],errors};rows=rows.filter(r=>r.kind!==kind);rows.push(row);rows.sort((a,b)=>a.index-b.index);fs.writeFileSync(out+'/recordings.json',JSON.stringify(rows,null,2));fs.writeFileSync(`${out}/${kind}-checks.json`,JSON.stringify(samples));console.log('PASS film',kind,setup.map,row.duration);
}}finally{await browser.close()}
