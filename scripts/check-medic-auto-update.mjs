import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const resource = '/assets/weapons/unique-v1/medic_0.glb';
const previous = execFileSync('git',['show',`1cf64f2:public${resource}`]);
const current = await fs.readFile('public'+resource);
assert.notEqual(hash(previous),hash(current));
const sw = await fs.readFile('public/sw.js','utf8');
let version = 0, assetRequests = 0, swRequests = 0;
const html='<!doctype html><meta charset="utf-8"><title>isolated cache lifecycle</title>';
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/sw.js'){swRequests++;res.setHeader('Content-Type','text/javascript');return res.end(sw+(version?'\n// isolated SW byte update\n':''));}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}
  if(url.pathname===resource){assetRequests++;res.setHeader('Content-Type','model/gltf-binary');return res.end(current);}
  res.writeHead(404);res.end();
});
let browser;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome'});
  const context=await browser.newContext(), page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(async({resource,base64})=>{
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    await (await caches.open('swarm-front-preload-v1')).put(resource,new Response(bytes,{status:200,headers:{'Content-Type':'model/gltf-binary'}}));
  },{resource,base64:previous.toString('base64')});
  const observe=()=>page.evaluate(async resource=>{
    const response=await fetch(resource),bytes=await response.arrayBuffer();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    return {status:response.status,bytes:bytes.byteLength,sha256:hash};
  },resource);
  const before=await observe();
  assert.equal(before.sha256,hash(previous));
  version=1;
  const controllerChanged=await page.evaluate(async()=>{
    const r=await navigator.serviceWorker.getRegistration();
    const oldController=navigator.serviceWorker.controller;
    const changed=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('controllerchange timeout')),20000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
    });
    await r.update();
    await changed;
    return !!navigator.serviceWorker.controller && navigator.serviceWorker.controller!==oldController;
  });
  assert.equal(controllerChanged,true);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const after=await observe();
  assert.equal(after.sha256,hash(previous));assert.equal(assetRequests,0);assert.deepEqual(errors,[]);
  const report={scope:'isolated local origin, real SW, one prior GLB in preload cache, unchanged app code; comment-only SW byte update triggers controllerchange; then normal reload and fetch. No product deploy, actual phone or real network.',oldRevision:'1cf64f2',oldBytes:previous.length,currentBytes:current.length,oldSha256:hash(previous),currentSha256:hash(current),before,controllerChanged,swRequests,after,assetNetworkRequests:assetRequests,errors};
  await fs.mkdir('dist-validation/weapon-cache-auto-update',{recursive:true});
  await fs.writeFile('dist-validation/weapon-cache-auto-update/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
