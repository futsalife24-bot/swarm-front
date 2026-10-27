import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-fps';
const server=await createServer({server:{port:5197,strictPort:true},cacheDir:'dist-fps/vite-cache'});
await server.listen();
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const results=[];
try {
 for(const [width,height,frameRate] of [[844,390,60],[640,360,30]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(rate=>localStorage.setItem('swarm-front-rebuild-settings-v1',JSON.stringify({sensitivity:1,fireSensitivity:1,gyroEnabled:false,gyroSensitivity:1,volume:0,bgmVolume:1,seVolume:1,quality:1,frameRate:rate})),frameRate);
  const page=await context.newPage();page.setDefaultTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5197/front.html?solo=1');
  await page.locator(':light(#front-launch)').waitFor();
  assert(await page.locator('.battle-fps').isHidden());
  await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
  await page.locator(':light(#front-launch)').click();
  await page.locator(':light([data-card])').first().waitFor();
  await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
  await page.locator(':light([data-card])').first().click();
  await page.waitForFunction(()=>/^\d+ FPS$/.test(document.querySelector('.battle-fps')?.textContent??''));
  await page.waitForTimeout(3000);
  const label=page.locator('.battle-fps');
  const reading=await label.innerText();const box=await label.boundingBox();
  assert(parseInt(reading)>0 && parseInt(reading)<=frameRate+2);
  assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
  assert.equal(await label.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await page.screenshot({path:`${out}/${width}-${frameRate}.png`});
  await page.locator('#pause').click();
  await page.waitForFunction(()=>document.querySelector('.battle-fps')?.textContent==='— FPS');
  assert.deepEqual(errors,[]);
  results.push({width,height,frameRate,reading,box,paused:'— FPS',errors});
  await context.close();
 }
 // 長停止を除外せず、描画回数/実時間で表示することをブラウザ内で検査する。
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5197/front.html');
 const sample=await page.evaluate(async()=>{
  const {BattleFps}=await import('/src/client/battle-fps.ts');const fps=new BattleFps();
  const text=()=>document.querySelector('.battle-fps:last-child').textContent;
  fps.update(0,100,true,true);fps.update(1000,130,true,true);const thirty=text();
  fps.update(6000,135,true,true);const stall=text();
  fps.update(7000,135,true,false);const pause=text();
  fps.update(8000,135,true,true);fps.update(9000,195,true,true);return {thirty,stall,pause,resume:text()};
 });assert.deepEqual(sample,{thirty:'30 FPS',stall:'1 FPS',pause:'— FPS',resume:'60 FPS'});
 fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,sample},null,2));console.log(JSON.stringify({results,sample}));
} finally {await browser.close();await server.close();}
