import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=process.argv[2]??'http://127.0.0.1:5348',out='dist-validation/weapon-realism',isPublic=base.startsWith('https:');
const hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['/index.html',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'/assets/'+p),...fs.readdirSync('dist/assets/weapons/realism-v2').map(p=>'/assets/weapons/realism-v2/'+p)];
const assets=[];
for(const path of paths){const r=await fetch(base+path);assert.equal(r.status,200,path);const b=Buffer.from(await r.arrayBuffer());assert.equal(hash(b),hash(fs.readFileSync('dist'+path)),path);assets.push({path,bytes:b.length,sha256:hash(b)});}
const b=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
const rows=[];
try{
 for(const [width,height] of [[844,390],[1280,720]]){
  const page=await b.newPage({viewport:{width,height},hasTouch:true,serviceWorkers:'block'}),errors=[],loaded=[];
  await page.addLocatorHandler(page.locator('#pt-intro-skip'),async()=>{await page.locator('#pt-intro-skip').tap();}); page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/realism-v2/'))loaded.push({url:r.url(),status:r.status()});});
  await page.goto(base+'/?playtest=1');await page.locator('#solo').tap();await page.locator('#pt-confirm').tap();await page.locator('#pt-start').tap();
  await page.locator('#pt-enter').waitFor({state:'visible',timeout:90000});await page.locator('#pt-enter').tap();await page.locator('#pt-tutorial-skip').tap();
  await page.waitForTimeout(2800);await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>typeof window.__playtest),'undefined');
  const ammo=async()=>parseInt(await page.locator('.ammo-line b').innerText());
  await page.locator('#fire').tap();await page.waitForTimeout(200);const before=await ammo();const fireBox=await page.locator('#fire').boundingBox();const touch=await page.context().newCDPSession(page);await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fireBox.x+fireBox.width/2,y:fireBox.y+fireBox.height/2,id:1}]});await page.waitForTimeout(300);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);const after=await ammo();assert.ok(after<before,`shot ${before} -> ${after}`);
  await page.locator('#swap').tap();await page.waitForTimeout(1100);
  await page.screenshot({path:`${out}/${isPublic?'published':'built'}-${width}.png`});
  await page.locator('#pause').tap();await page.locator('#pt-resume').waitFor();
  assert.ok(loaded.length>=3&&loaded.every(r=>r.status===200));assert.deepEqual(errors,[]);
  rows.push({width,height,battle:true,shot:{before,after},paused:true,loaded,errors});await page.close();
 }
 if(isPublic){const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);}
 fs.writeFileSync(`${out}/${isPublic?'published':'built'}.json`,JSON.stringify({date:new Date().toISOString(),url:base+'/?playtest=1',assets,rows},null,2));
 console.log('PASS',assets.length,'matching assets; 2 viewport launch/fire/pause; no page errors',base);
}finally{await b.close();}






