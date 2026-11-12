// 実ローカルWorkerと本体UIで確認。公開データ・実プレイヤーの券は使わない。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from '@playwright/test';
const require=createRequire(import.meta.url), wrangler=join(dirname(require.resolve('wrangler/package.json')),'bin/wrangler.js');
const port=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const origin=`http://127.0.0.1:${port}`, out='dist-validation/supply-reveal-improvements';await fs.mkdir(out,{recursive:true});
const password='test-only-random-developer-password',hash=createHash('sha256').update(password).digest('hex');
console.log('START ローカルWorker');
const worker=spawn(process.execPath,[wrangler,'dev','--local','--ip','127.0.0.1','--port',String(port),'--persist-to',`${out}/worker-${process.pid}`,'--config','wrangler.production.jsonc','--var',`DEVELOPER_PASSWORD_HASH:${hash}`],{stdio:'ignore'});
let ready=false;for(let i=0;i<160;i++){if(worker.exitCode!==null)throw Error(`ローカルWorker起動失敗 ${worker.exitCode}`);try{if((await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready){worker.kill();throw Error('ローカルWorker起動期限超過');}console.log('PASS ローカルWorker');
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11','--mute-audio']}), cases=[];
async function settle(page){await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));}
async function tap(page,selector){await settle(page);await page.locator(selector).click();}
async function title(page){if(await page.locator('.title-entry-start').isVisible()){await page.locator('.title-entry-start').click();await page.locator('dialog.title-entry').waitFor({state:'detached'});}if(await page.locator('#landscape-start').isVisible())await page.locator('#landscape-start').click();}
async function results(page){await page.locator('.gx-root:not([hidden])').waitFor();await tap(page,'.gx-skip');for(let i=0;i<16;i++){if(await page.locator('.gx-actions [data-id="close"]').isVisible())break;await page.waitForTimeout(600);if(await page.locator('.gx-actions [data-id="close"]').isVisible())break;await page.locator('.gx-root').click({position:{x:320,y:345}});}await page.locator('.gx-actions [data-id="close"]').waitFor({state:'visible'});assert.equal(await page.locator('.gx-tile').count(),10);}
try{
 for(const viewport of process.env.SUPPLY_NORMAL_ONLY ? [] : [{width:844,height:390},{width:640,height:360}]){
  console.log('START 試しガチャ本体',viewport.width);
  const context=await browser.newContext({viewport}), page=await context.newPage(), errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  const login=await context.request.post(origin+'/api/developer/login',{headers:{Origin:origin},data:{password}});assert.equal(login.ok(),true);
  await page.goto(origin+'/?developer=1&base=1',{waitUntil:'domcontentloaded'});
  let cacheCheck=null;
  if(viewport.width===844){
   await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('SW起動期限超過')),60000))]);});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   cacheCheck=await page.evaluate(async()=>{const c=await caches.open('swarm-front-shell-v1');await c.put('/supply-reveal/gacha.css',new Response('/* OLD-CSS */',{headers:{'Content-Type':'text/css'}}));const old=await (await fetch('/supply-reveal/gacha.css')).text(),fresh=await (await fetch('/supply-reveal/gacha.css?v=20261112-2')).text();return {controlled:!!navigator.serviceWorker.controller,old:old.includes('OLD-CSS'),fresh:fresh.includes('.gx-final .gx-list'),font:fresh.includes('./assets/Rajdhani-Bold.ttf')};});
   assert.deepEqual(cacheCheck,{controlled:true,old:true,fresh:true,font:true});
  }
  await title(page);await page.locator('#pt-base-supply').waitFor();await tap(page,'#pt-base-supply');await page.locator('[data-supply-preview-play]').waitFor();
  const before=await page.evaluate(()=>JSON.stringify({...localStorage}));await page.selectOption('[data-supply-preview-select]','10');await tap(page,'[data-supply-preview-play]');await results(page);
  const rows=await page.locator('.gx-tile').allTextContents();await page.screenshot({path:`${out}/game-preview-${viewport.width}.png`});
  await page.locator('.gx-tile[data-type="weapon"]').first().click();await page.locator('css:light=dialog.weapon-detail-dialog[open]').waitFor();await settle(page);await page.screenshot({path:`${out}/game-weapon-${viewport.width}.png`});await page.locator('css:light=dialog.weapon-detail-dialog .dialog-close').click();await page.waitForFunction(()=>!document.querySelector('dialog.weapon-detail-dialog'));await settle(page);
  await page.locator('.gx-tile[data-type="buddy"]').first().click();await page.locator('css:light=dialog.supply-buddy-dialog[open] .bd-detail').waitFor({timeout:10000});await settle(page);const name=await page.locator('css:light=dialog.supply-buddy-dialog .bd-detail').innerText();assert.ok(name.includes('タタラ'));await page.screenshot({path:`${out}/game-buddy-${viewport.width}.png`});await page.locator('css:light=dialog.supply-buddy-dialog .dialog-close').click();await page.waitForFunction(()=>!document.querySelector('dialog.supply-buddy-dialog'));await settle(page);
  assert.deepEqual(await page.locator('.gx-tile').allTextContents(),rows);await page.locator('.gx-actions [data-id="close"]').click();assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);assert.deepEqual(errors,[]);
  cases.push({mode:'preview',viewport,cacheCheck,details:['weapon','buddy'],rows:rows.length,saveUnchanged:true,errors});await context.close();console.log('PASS 試しガチャ本体',viewport.width);
 }
 console.log('START 通常補給本体');
 const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('swarm-front-player-name-v1','補給検証'));await page.goto(origin+'/?base=1',{waitUntil:'domcontentloaded'});await title(page);await page.locator('#pt-confirm').waitFor({state:'visible'});await tap(page,'#pt-confirm');
 if(!await page.locator('#pt-base-buddy').count())await tap(page,'#pt-base');await page.locator('#pt-base-buddy').waitFor();await tap(page,'#pt-base-buddy');await tap(page,'[data-bd="starter-pick"][data-id="tatara"]');await tap(page,'[data-bd="starter-confirm"]');await tap(page,'#pt-base');await tap(page,'#pt-base-supply');
 await page.locator('[data-supply-count]').filter({hasText:'10枚'}).waitFor();await tap(page,'[data-supply-draw="10"]');await results(page);const rows=await page.locator('.gx-tile').allTextContents();
 for(let i=0;i<3;i++){await page.locator('.gx-tile[data-type="weapon"]').first().click();await page.locator('css:light=dialog.weapon-detail-dialog[open]').waitFor();await settle(page);await page.locator('css:light=dialog.weapon-detail-dialog .dialog-close').click();await page.waitForFunction(()=>!document.querySelector('dialog.weapon-detail-dialog'));await settle(page);}assert.deepEqual(await page.locator('.gx-tile').allTextContents(),rows);
 await page.screenshot({path:out+'/game-normal-844.png'});await page.locator('.gx-actions [data-id="close"]').click();await page.locator('[data-supply-feedback]').filter({hasText:'補給を受領しました。'}).waitFor();assert.deepEqual(errors,[]);cases.push({mode:'normal-local-worker',rows:rows.length,ack:true,errors});await context.close();console.log('PASS 通常補給本体');
 await fs.writeFile(out+'/game-report.json',JSON.stringify({cases},null,2));
} finally {await browser.close();worker.kill();}
