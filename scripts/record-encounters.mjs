import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out=process.env.ENCOUNTER_VIDEO_OUT??'dist-validation/encounter-videos';fs.mkdirSync(out,{recursive:true});
const kinds=['crawler','ant','spider','spitter','hornet','boss','worm'];const results=process.env.ENCOUNTER_KIND?JSON.parse(fs.readFileSync(out+'/recordings.json')).filter(r=>r.kind!==process.env.ENCOUNTER_KIND):[];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try{for(const [index,kind] of kinds.entries()){if(process.env.ENCOUNTER_KIND&&kind!==process.env.ENCOUNTER_KIND)continue;
 const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block',recordVideo:{dir:out+'/raw',size:{width:1280,height:720}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/client/playtest-app.ts*',async route=>{const response=await route.fetch();let body=await response.text();body+=`\nwindow.__capturePrepare=async(key)=>{paused=true;save.encounters=Object.fromEntries(Object.keys(names).map(k=>[k,'solo']));for(const d of document.querySelectorAll('dialog'))d.close();encounterActive=false;world.enemies=[];world.bullets=[];const {spawn}=await import('/src/shared/game.ts');const e=spawn(world,key==='worm'?'boss':key,0,key==='boss'||key==='worm'?-8:4,key==='worm'?'worm':'crown',0);controls.input.yaw=0;controls.input.pitch=0;view.render(world,'solo',0,0,0,undefined,false,false);window.__captureKey=key;if(key==='worm'){await view.foundryWorms.get(e.id).loading;view.render(world,'solo',0,0,0,undefined,false,false);}return {name:names[key],enemy:{kind:e.kind,x:e.x,y:e.y,z:e.z,segments:e.segments?.length},camera:view.camera.position.toArray()};};window.__captureBegin=()=>{delete save.encounters[window.__captureKey];encounter();return encounterActive;};\n`;await route.fulfill({response,body});});
 await page.goto('http://127.0.0.1:5351/?playtest=1');await page.locator('#solo').click();await page.locator('#pt-confirm').click();await page.locator('#pt-start').click();await page.locator('#pt-enter').waitFor({timeout:90000});await page.locator('#pt-enter').click();
 const fixture=await page.evaluate(k=>window.__capturePrepare(k),kind);await page.waitForTimeout(1800);
 await page.evaluate(()=>{window.capturePhases=[];const f=()=>{const d=document.querySelector('.pt-cutscene');if(d&&!window.capturePhases.includes(d.dataset.phase))window.capturePhases.push(d.dataset.phase);requestAnimationFrame(f)};requestAnimationFrame(f)});
 const started=Date.now();await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.__captureBegin()),true,kind+' visible');
 await page.locator('.pt-cutscene-ready').waitFor({timeout:15000});await page.waitForTimeout(4500);await page.screenshot({path:`${out}/${kind}.png`});const phases=await page.evaluate(()=>window.capturePhases);assert.deepEqual(phases,['freeze','bars','zoom','text']);assert.deepEqual(errors,[]);
 const video=page.video();await context.close();const duration=(Date.now()-started)/1000,path=await video.path();results.push({index,kind,...fixture,duration,path,phases,errors});fs.writeFileSync(out+'/recordings.json',JSON.stringify(results.sort((a,b)=>a.index-b.index),null,2));console.log('Recorded',kind,duration);
}}finally{await browser.close()}



