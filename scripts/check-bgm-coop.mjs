import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:5367',endpoint='http://127.0.0.1:8797';
const key=/^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(fs.readFileSync('.dev.vars','utf8'))?.[1];
assert.ok(key);
const r=await fetch(endpoint+'/rooms',{method:'POST',headers:{'X-Room-Creation-Key':key}});assert.ok(r.ok);
const {code}=await r.json();
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:844,height:390},serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','BGM確認'));
 await page.goto(origin+'/#'+code);
 await page.locator('.coop-advanced summary').click();await page.locator('#endpoint').fill(endpoint);
 await page.waitForFunction(()=>document.querySelector('audio[data-bgm]')?.dataset.track==='prepare');
 await page.locator('#launch').click();await page.locator('.lobby').waitFor({timeout:60000});
 await page.waitForFunction(()=>{const a=document.querySelector('audio[data-bgm]');return a?.dataset.track==='lobby'&&!a.paused&&a.currentTime>0});
 await page.screenshot({path:'dist-validation/bgm/coop-lobby.png'});
 await page.locator('#begin:not(:disabled)').click();
 await page.waitForFunction(()=>window.__swarm?.screen==='battle',null,{timeout:90000});
 assert.equal(await page.locator('audio[data-bgm]').evaluate(a=>a.paused&&!a.getAttribute('src')),true);
 assert.deepEqual(errors,[]);fs.writeFileSync('dist-validation/bgm/coop.json',JSON.stringify({realWorker:true,lobbyPlayed:true,battleStopped:true,errors},null,2));console.log('PASS real Worker: prepare -> lobby -> battle, BGM stopped, no errors');
}finally{await browser.close();}
