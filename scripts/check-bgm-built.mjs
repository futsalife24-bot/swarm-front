import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.BGM_BUILT_ORIGIN || 'http://127.0.0.1:5368';
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)||origin==='https://swarm-front.melosalife-24.workers.dev');
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:844,height:390}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console',m.text());});
const playing=track=>page.waitForFunction(t=>{const a=document.querySelector('audio[data-bgm]');return a?.dataset.track===t&&!a.paused&&a.currentTime>0},track);
try{
 await page.goto(origin);await page.locator('#home-tutorial').click();await playing('title');await page.keyboard.press('Escape');
 await page.locator('#open-bestiary').click();if(await page.locator('#pt-confirm').count())await page.locator('#pt-confirm').click();await playing('report');await page.locator('#report-close').click();await playing('title');
 await page.locator('#open-armory').click();if(await page.locator('#pt-confirm').count())await page.locator('#pt-confirm').click();await playing('base');await page.locator('#pt-base-growth').click();await playing('base');await page.keyboard.press('Escape');await page.locator('#pt-gear').click();await playing('prepare');
 console.log('UI passed');await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('SW readiness timeout')),15000))]));await page.reload();await page.locator('#home-tutorial').click();await playing('title');
 const range=await page.evaluate(async()=>{const r=await fetch('/assets/audio/bgm-v1/clear.mp3',{headers:{Range:'bytes=0-1023'}});return {controlled:!!navigator.serviceWorker.controller,status:r.status,bytes:(await r.arrayBuffer()).byteLength};});
 assert.ok(range.controlled);assert.ok([200,206].includes(range.status));assert.ok(range.bytes>0);assert.deepEqual(errors,[]);
 const label=origin.startsWith('https')?'published':'built';fs.writeFileSync(`dist-validation/bgm/${label}.json`,JSON.stringify({origin,realUI:true,serviceWorker:range,errors},null,2));console.log(JSON.stringify({pass:true,origin,range}));
}catch(e){console.log('debug',await page.locator('audio[data-bgm]').evaluate(a=>({track:a.dataset.track,paused:a.paused,error:a.error?.code})),await page.locator('dialog[open]').allTextContents());throw e;}finally{await browser.close();}
