import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base='https://swarm-front.melosalife-24.workers.dev';
const out=process.env.SWARM_PUBLIC_UI_OUTPUT??'dist-validation/coop-comfort-20261031/release/public-ui';
mkdirSync(out,{recursive:true});
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 try{const r=await fetch(base+req.url,{signal:AbortSignal.timeout(30000)});res.writeHead(r.status,{'content-type':r.headers.get('content-type')??'application/octet-stream','cache-control':'no-store'});res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(502).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const local='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',args:[]});
const result={base,checkedAt:new Date().toISOString(),errors:[],passed:false,scope:'配信コード・GET専用中継・空プロファイル。実セーブ/本番部屋不使用。Safari実機ではない。'};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',hasTouch:true});
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(local+'/');
 await page.locator('#portrait').waitFor({state:'visible'});result.rootPortrait=await page.locator('#portrait').innerText();assert(result.rootPortrait.includes('横向き'));
 await page.screenshot({path:out+'/root-portrait.png'});
 await page.goto(local+'/front?solo=1');
 await page.locator('#portrait').waitFor({state:'visible'});result.frontPortrait=await page.locator('#portrait').innerText();assert(result.frontPortrait.includes('横向き'));
 await page.setViewportSize({width:844,height:390});await page.locator('#portrait').waitFor({state:'hidden'});
 await page.locator('#front-launch').waitFor();await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator('#front-prep-settings').click();await page.locator('[data-download-menu]').click();
 await page.locator('.download-pack').first().waitFor();
 result.downloadPacks=await page.locator('.download-pack').allTextContents();assert(result.downloadPacks.length>=3);
 result.downloadText=await page.locator('.download-dialog').innerText();assert(result.downloadText.includes('協力プレイには通信が必要'));
 await page.screenshot({path:out+'/download-menu.png'});
 await page.locator(':light(.download-dialog[open])').waitFor(); await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter')); await page.locator(':light(.download-dialog .dialog-close)').click(); await page.locator(':light(.download-dialog)').waitFor({state:'detached'});
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator(':light(#front-settings-back)').click();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator(':light(#front-launch)').click();await page.locator(':light([data-card])').first().waitFor();
 await page.waitForFunction(()=>!document.querySelector('.split-shutter,.menu-route-shutter'));
 await page.locator(':light([data-card])').first().click();
 await page.waitForFunction(()=>document.querySelector('.hud-rail')&&/^\d+ FPS$/.test(document.querySelector('.battle-fps')?.textContent??''));
 await page.waitForTimeout(2000);result.fps=await page.locator('.battle-fps').innerText();assert(parseInt(result.fps)>0);
 result.canvas=await page.locator('canvas').first().boundingBox();await page.screenshot({path:out+'/survival.png'});
 assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1;}
finally{writeFileSync(out+'/results.json',JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(result));
