import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('.',import.meta.url));
const server=spawn(process.execPath,[here+'server.mjs'],{env:{...process.env,BUDDY_PORT:'4320'},windowsHide:true});
process.on('exit',()=>server.kill());await new Promise(r=>server.stdout.once('data',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:4320');await page.waitForFunction(()=>window.ready);
 await page.selectOption('#motion','Palm');await page.selectOption('#view','back');await page.selectOption('#count','4');
 assert.equal(await page.evaluate(()=>buddy.buddies.filter(b=>b.visible).length),4);
 await page.click('#pause');assert.equal(await page.locator('#pause').textContent(),'再生');
 await page.click('#pause');assert.equal(await page.locator('#pause').textContent(),'一時停止');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto('http://127.0.0.1:4320/review.html');
 await page.waitForFunction(()=>document.querySelector('video').readyState>=1);
 await page.evaluate(()=>document.querySelector('video').play());
 await page.waitForFunction(()=>document.querySelector('video').currentTime>1);
 const video=await page.evaluate(()=>{const v=document.querySelector('video');v.pause();return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,error:v.error};});
 assert.equal(video.duration,12);assert.equal(video.error,null);assert.equal(video.width,960);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(here+'review/ui-validation.json',JSON.stringify({viewport:[640,360],dropdowns:true,pauseResume:true,noHorizontalOverflow:true,video,errors},null,2));
 console.log(JSON.stringify(video));
}finally{await browser.close();server.kill();}
