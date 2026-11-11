import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const out='docs/evidence/supply-last-skip-20261111';fs.mkdirSync(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/supply-reveal/gacha.css"><body style="margin:0"><script type="module">import{createSupplyReveal}from'/supply-reveal/runtime.js';window.reveal=createSupplyReveal(document.body,{sound:false,warm:false});await reveal.ready;window.ready=true;</script>`;
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/probe'){res.setHeader('content-type','text/html');res.end(html);return;}const file=path.resolve('public','.'+url.pathname);if(!file.startsWith(path.resolve('public')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome'});const rows=[];
try{
 for(const [width,height]of[[844,390],[640,360]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/probe`);await page.waitForFunction(()=>window.ready);
 const play=async(types,manual=true,effect=0)=>page.evaluate(async({types,manual,effect})=>{reveal.setReduced(false);await reveal.play(types.map((v,i)=>v==='B'?{type:'buddy',name:'バディ確認',art:'b-tatara'}:{type:'weapon',rarity:v,name:v+'確認'+i,art:'w-rifle'}),{effects:effect,silent:true,manual});}, {types,manual,effect});
 const state=()=>page.evaluate(()=>reveal.state());
 await play([...Array(9).fill('N'),'SR']);await page.evaluate(()=>reveal.skip());assert.equal((await state()).waiting,'final');
 await play(['SSR','N','B',...Array(6).fill('N'),'SR']);await page.evaluate(()=>reveal.skip());
 for(let i=0;i<2;i++){
  const before=await state();assert.equal(before.waiting,'cut');assert.equal(await page.evaluate(i=>Math.abs(reveal.state().t-reveal.model().cuts[i].tDone)<1e-4,i),true);
  await expect(page.locator('.gx-actions [data-id="close"]')).toBeHidden();
  await page.evaluate(()=>reveal.skip());assert.equal((await state()).t,before.t);
  if(i===0){await page.screenshot({path:`${out}/${width}-ssr-stop.png`});await page.evaluate(()=>reveal.setReduced(true));assert.equal((await state()).waiting,'cut');}
  await page.waitForTimeout(550);await page.evaluate(()=>reveal.tap());
 }
 assert.equal((await state()).waiting,'final');await expect(page.locator('.gx-actions [data-id="close"]')).toBeVisible();
 await play(['B']);await page.evaluate(()=>reveal.skip());assert.equal((await state()).waiting,'cut');await page.waitForTimeout(550);await page.evaluate(()=>reveal.tap());assert.equal((await state()).waiting,'final');
 // 通常再生で既に確認したSSRをスキップ後に重ねて表示しない。
 await play(['SSR','N','B',...Array(6).fill('N'),'SR'],false);await page.evaluate(()=>reveal.setFast(true));let tries=0;
 while((await state()).waiting!=='cut'){assert(tries++<150);await page.evaluate(()=>reveal.tap());await page.waitForTimeout(230);}
 await page.waitForTimeout(550);await page.evaluate(()=>{reveal.tap();reveal.skip();});
 assert.equal(await page.evaluate(()=>Math.abs(reveal.state().t-reveal.model().cuts[1].tDone)<1e-4),true);
 if(width===844){
  await play(['SSR','N','B',...Array(6).fill('N'),'SR'],false,9);await page.evaluate(()=>reveal.setFast(true));let n=0;
  while(await page.evaluate(()=>reveal.state().t<=reveal.model().cuts[0].tDone)){assert(n++<150);await page.evaluate(()=>reveal.tap());await page.waitForTimeout(230);}
  await page.evaluate(()=>reveal.skip());assert.equal(await page.evaluate(()=>reveal.state().waiting==='cut'&&Math.abs(reveal.state().t-reveal.model().cuts[0].tDone)<1e-4),true);
 }
 assert.deepEqual(errors,[]);rows.push({width,height,srOnlyFinal:true,multipleCuts:true,repeatSkipHeld:true,reducedHeld:true,singleBuddy:true,noRepeatedConfirmed:true,errors});await page.close();
 }
 fs.writeFileSync(`${out}/skip-cuts.json`,JSON.stringify({passed:true,rows},null,2));console.log(JSON.stringify({passed:true,rows}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
