import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='assets/blender/candidates/crawler/pleat-v4/adoption/published';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
try{for(const [width,height] of [[1280,720],[844,390]]){
 const p=await browser.newPage({viewport:{width,height}}),errors=[],loaded=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.url().includes('/assets/enemies/'))loaded.push({url:r.url(),status:r.status()});});
 await p.goto('https://swarm-front.melosalife-24.workers.dev');await p.locator('#open-bestiary').click();
 for(const id of ['crawler','ant','spider','hornet','spitter','boss']){
  await p.locator(`[data-enemy="${id}"]`).click();const text=await p.locator('.enemy-description').innerText();
  assert.doesNotMatch(text,/[0-9０-９]|回避|避け|対処|散開|離れすぎず/);
  if(id==='crawler'){assert.match(text,/PLEAT/);await p.waitForResponse(r=>r.url().endsWith('pleat_motion_v4.glb')&&r.ok()).catch(()=>{});await p.screenshot({path:dir+`/report-${width}.png`});}
 }
 assert.deepEqual(errors,[]);assert.ok(loaded.some(r=>r.url.endsWith('pleat_motion_v4.glb')&&r.status===200));
 results.push({width,height,loaded,errors});await p.close();
}fs.writeFileSync(dir+'/report-results.json',JSON.stringify(results,null,2));console.log('Report PASS');}finally{await browser.close();}

