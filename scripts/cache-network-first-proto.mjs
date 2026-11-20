// Isolated proposal only. Product files and real user data are not modified.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const resource='/assets/weapons/unique-v1/medic_0.glb';
const other='/assets/weapons/realism-v2/rifle_0.glb';
const old=execFileSync('git',['show',`1cf64f2:public${resource}`]);
const current=await fs.readFile('public'+resource), otherOld=await fs.readFile('public'+other);
assert.notEqual(hash(old),hash(current));
const source=await fs.readFile('public/sw.js','utf8');
const marker='  event.respondWith(\n    cachedAsset(request).then((cached) =>';
assert(source.includes(marker));
const candidate=`  // Prototype: only the new-weapon GLB paths are network-first.
  if (url.pathname.startsWith(new URL("assets/weapons/unique-v1/", scope).pathname) && url.pathname.endsWith(".glb")) {
    event.respondWith((async () => {
      try {
        const response = await fetch(new Request(request, { cache: "no-cache" }));
        if (response.status !== 200) throw new Error("not a complete response");
        const bytes = await response.clone().arrayBuffer();
        if (bytes.byteLength < 12) throw new Error("short GLB");
        const header = new DataView(bytes);
        if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) throw new Error("bad GLB header");
        try {
          const preload = await caches.open(PRELOAD), shell = await caches.open(CACHE);
          // Never serve older preload after a new valid network response.
          if (await preload.match(request)) await preload.put(request, response.clone());
          await shell.put(request, response.clone());
        } catch { /* network response remains usable */ }
        return response;
      } catch { return (await cachedAsset(request)) ?? Response.error(); }
    })());
    return;
  }
`;
const sw=source.replace(marker,candidate+marker);
let mode='503', delay=0, assetRequests=0, bytesSent=0, otherRequests=0, failWrites=false;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(failWrites?sw.replace('if (await preload.match(request)) await preload.put(request, response.clone());','if (await preload.match(request)) throw new Error("simulated write failure");'):sw)}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>cache prototype</title>')}
  if(url.pathname===resource){assetRequests++;return setTimeout(()=>{if(mode==='503')return void res.writeHead(503).end();const body=mode==='bad'?Buffer.from('not a valid glb'):current;bytesSent+=body.length;res.writeHead(200,{'Content-Type':'model/gltf-binary'}).end(body)},delay)}
  if(url.pathname===other){otherRequests++;return void res.writeHead(200).end(Buffer.from('unexpected'))}
  res.writeHead(404).end();
});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome'});
 const context=await browser.newContext(), page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async({resource,other,old,otherOld})=>{
   const response=x=>new Response(Uint8Array.from(atob(x),c=>c.charCodeAt(0)),{status:200,headers:{'content-type':'model/gltf-binary'}});
   for(const name of ['swarm-front-preload-v1','swarm-front-shell-v1']){
    const c=await caches.open(name);await c.put(resource,response(old));await c.put(other,response(otherOld));
   }
 },{resource,other,old:old.toString('base64'),otherOld:otherOld.toString('base64')});
 const read=path=>page.evaluate(async path=>{const start=performance.now(),r=await fetch(path),b=await r.arrayBuffer();return{status:r.status,bytes:b.byteLength,ms:performance.now()-start,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')}},path);
 const httpFailure=await read(resource);assert.equal(httpFailure.sha256,hash(old));
 await context.setOffline(true);const oldOffline=await read(resource);assert.equal(oldOffline.sha256,hash(old));await context.setOffline(false);
 mode='bad';const bad=await read(resource);assert.equal(bad.sha256,hash(old));
 mode='ok';delay=200;const priorCount=assetRequests,priorBytes=bytesSent;
 const first=await read(resource),second=await read(resource);assert.equal(first.sha256,hash(current));assert.equal(second.sha256,hash(current));
 const traffic={requests:assetRequests-priorCount,bytes:bytesSent-priorBytes,firstMs:first.ms,secondMs:second.ms,serverArtificialDelayMs:delay};
 const cacheHashes=await page.evaluate(async resource=>{const out={};for(const n of ['swarm-front-preload-v1','swarm-front-shell-v1']){const r=await(await caches.open(n)).match(resource),b=await r.arrayBuffer();out[n]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')}return out},resource);
 assert(Object.values(cacheHashes).every(x=>x===hash(current)));
 await context.setOffline(true);const newOffline=await read(resource);assert.equal(newOffline.sha256,hash(current));await context.setOffline(false);
 const otherResponse=await read(other);assert.equal(otherResponse.sha256,hash(otherOld));assert.equal(otherRequests,0);
 // Separate browser context: simulate the PRELOAD write rejecting before SHELL write.
 failWrites=true;delay=0;const failureContext=await browser.newContext(), failurePage=await failureContext.newPage();
 await failurePage.goto(base+'/');await failurePage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});await failurePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await failurePage.evaluate(async({resource,old})=>{const bytes=Uint8Array.from(atob(old),c=>c.charCodeAt(0));for(const name of ['swarm-front-preload-v1','swarm-front-shell-v1'])await(await caches.open(name)).put(resource,new Response(bytes,{status:200}))},{resource,old:old.toString('base64')});
 const getFailure=()=>failurePage.evaluate(async resource=>{const r=await fetch(resource),b=await r.arrayBuffer();return{status:r.status,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')}},resource);
 const afterWriteFailure=await getFailure();assert.equal(afterWriteFailure.sha256,hash(current));await failureContext.setOffline(true);const offlineAfterWriteFailure=await getFailure();assert.equal(offlineAfterWriteFailure.sha256,hash(old));await failureContext.close();
 assert.deepEqual(errors,[]);
 await fs.mkdir('dist-validation/cache-network-first-proto',{recursive:true});
 const result={scope:'isolated localhost; memory-modified SW; one old MD-4 in both caches; other asset seeded; no product modifications, actual phone or external network',httpFailure,oldOffline,bad,first,second,traffic,cacheHashes,newOffline,otherRequests,simulatedPreloadWriteFailure:{online:afterWriteFailure,offline:offlineAfterWriteFailure},errors};
 await fs.writeFile('dist-validation/cache-network-first-proto/report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r))}
