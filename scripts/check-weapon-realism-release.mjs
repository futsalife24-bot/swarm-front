import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.argv[2]??'http://127.0.0.1:5348',out='dist-validation/weapon-realism',isPublic=base.startsWith('https:');
fs.mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['/index.html',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'/assets/'+p),...['realism-v2','unique-v1'].flatMap(dir=>fs.readdirSync('dist/assets/weapons/'+dir).map(p=>'/assets/weapons/'+dir+'/'+p))];
const assets=[];
for(const path of paths){const r=await fetch(base+path);assert.equal(r.status,200,path);const b=Buffer.from(await r.arrayBuffer());assert.equal(hash(b),hash(fs.readFileSync('dist'+path)),path);assets.push({path,bytes:b.length,sha256:hash(b)});}
const b=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const rows=[];
try{
 for(const [width,height] of [[844,390],[1280,720]]){
  const page=await b.newPage({viewport:{width,height},hasTouch:true,serviceWorkers:'block'}),errors=[],loaded=[];
  await page.addLocatorHandler(page.locator('css:light=#pt-intro-skip'),async()=>{await page.locator('css:light=#pt-intro-skip').tap();}); page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\/(realism-v2|unique-v1)\//.test(r.url()))loaded.push({url:r.url(),status:r.status()});});
  // Transitions retain the opening gesture briefly even after the next button
  // becomes visible. Wait for shutters and the guard to release; never force input.
  const settleMenu=async()=>{
   await page.waitForFunction(()=>!document.querySelector('.menu-route-shutter,.split-shutter'));
   await page.waitForTimeout(1500);
   await page.waitForFunction(()=>!document.querySelector('.menu-route-shutter,.split-shutter'));
  };
  await page.goto(base+'/?playtest=1');
  await page.locator('.title-entry-start').tap();
  await page.locator('.title-entry').waitFor({state:'detached'});
  await settleMenu();
  await page.locator('css:light=#solo').tap();
  await page.locator('css:light=#player-name').waitFor({state:'visible'});
  await settleMenu();
  await page.locator('css:light=#player-name').fill('ローカル検証');
  await page.locator('css:light=#player-name-form button[type="submit"]').tap();
  await page.locator('css:light=#player-name').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('swarm-front-player-name-v1')),'ローカル検証');
  await settleMenu();
  // The profile's automatic retry may be consumed by the input guard. A fresh
  // user tap is required only when the operation picker did not open.
  if(!await page.locator('css:light=[data-operation="advance"]').isVisible()){
   await page.locator('css:light=#solo').tap();
   await page.locator('css:light=[data-operation="advance"]').waitFor({state:'visible'});
   await settleMenu();
  }
  await page.locator('css:light=[data-operation="advance"]').tap();
  await page.locator('css:light=#pt-confirm').waitFor({state:'visible'});
  await settleMenu();
  await page.locator('css:light=#pt-confirm').tap();
  await page.locator('css:light=#pt-start').waitFor({state:'visible',timeout:30000});
  await settleMenu();
  await page.locator('css:light=#pt-start').tap();
  await page.locator('css:light=#pt-enter').waitFor({state:'visible',timeout:90000});
  await settleMenu();
  await page.locator('css:light=#pt-enter').tap();
  await page.locator('css:light=#pt-tutorial-skip').waitFor({state:'visible',timeout:30000});
  await settleMenu();
  await page.locator('css:light=#pt-tutorial-skip').tap();
  await page.waitForTimeout(2800);await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>typeof window.__playtest),'undefined');
  const ammo=async()=>parseInt(await page.locator('css:light=.ammo-line b').innerText());
  await page.locator('css:light=#fire').tap();await page.waitForTimeout(200);const before=await ammo();const fireBox=await page.locator('css:light=#fire').boundingBox();const touch=await page.context().newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fireBox.x+fireBox.width/2,y:fireBox.y+fireBox.height/2,id:1}]});await page.waitForTimeout(300);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);const after=await ammo();assert.ok(after<before,`shot ${before} -> ${after}`);
  await page.locator('css:light=#swap').tap();await page.waitForTimeout(1100);
  await page.screenshot({path:`${out}/${isPublic?'published':'built'}-${width}.png`});
  await page.locator('css:light=#pause').tap();await page.locator('css:light=#pt-resume').waitFor();
  assert.ok(loaded.length>=3&&loaded.every(r=>r.status===200));assert.deepEqual(errors,[]);
  rows.push({width,height,battle:true,shot:{before,after},paused:true,loaded,errors});await page.close();
 }
 if(isPublic){const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);}
 fs.writeFileSync(`${out}/${isPublic?'published':'built'}.json`,JSON.stringify({date:new Date().toISOString(),url:base+'/?playtest=1',assets,rows},null,2));
 console.log('PASS',assets.length,'matching assets; 2 viewport launch/fire/pause; no page errors',base);
}finally{await b.close();}






