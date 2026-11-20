// Isolated experiment: actual SW and download store; product files are not edited.
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {generateAssetDownloadManifest,verifyAssetDownloadManifest} from '../scripts/asset-download-manifest.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const out='dist-validation/cache-revision-proto', oldRoot=out+'/old-public', currentRoot='public';
await fs.mkdir(oldRoot+'/assets/weapons/unique-v1',{recursive:true});
await fs.mkdir(oldRoot+'/assets/weapons/realism-v2',{recursive:true});
const names=Array.from({length:5},(_,i)=>`assets/weapons/unique-v1/medic_${i}.glb`);
const original='assets/weapons/realism-v2/rifle_0.glb';
const old=[],current=[];
for(const file of names){const a=execFileSync('git',['show',`1cf64f2:public/${file}`]);const b=await fs.readFile('public/'+file);assert.notEqual(hash(a),hash(b));old.push(a);current.push(b);await fs.writeFile(oldRoot+'/'+file,a)}
const rifle=await fs.readFile('public/'+original);await fs.writeFile(oldRoot+'/'+original,rifle);
const urls=bytes=>names.map((n,i)=>`${n}?v=${hash(bytes[i])}`);
const oldUrls=urls(old),newUrls=urls(current);
const packs=values=>[{id:'app',label:'app',description:'fixture',urls:[]},{id:'common',label:'common',description:'fixture',urls:[...values,original]}];
const previous=generateAssetDownloadManifest({development:true,assetRoot:oldRoot,packs:packs(oldUrls)}), next=generateAssetDownloadManifest({development:true,assetRoot:currentRoot,packs:packs(newUrls)});
const rows=m=>m.packs.find(p=>p.id==='common').assets;
for(let i=0;i<5;i++){const a=rows(previous).find(r=>r.url===oldUrls[i]),b=rows(next).find(r=>r.url===newUrls[i]);assert.equal(a.sha256,hash(old[i]));assert.equal(b.sha256,hash(current[i]))}
async function verify(label,m,source){const dir=out+'/'+label;await fs.mkdir(dir+'/assets/weapons/unique-v1',{recursive:true});await fs.mkdir(dir+'/assets/weapons/realism-v2',{recursive:true});for(let i=0;i<5;i++)await fs.writeFile(dir+'/'+names[i],source[i]);await fs.writeFile(dir+'/'+original,rifle);await fs.writeFile(dir+'/asset-download-manifest.json',JSON.stringify(m));return verifyAssetDownloadManifest(dir)}
const oldAudit=await verify('old-build',previous,old),newAudit=await verify('new-build',next,current);
const mixed=out+'/old-build/assets/weapons/unique-v1/medic_0.glb';await fs.writeFile(mixed,current[0]);let mismatchCaught=false;try{verifyAssetDownloadManifest(out+'/old-build')}catch{mismatchCaught=true}assert(mismatchCaught);await fs.writeFile(mixed,old[0]);
const compiled=await build({stdin:{contents:`import {AssetDownloadStore,validateDownloadManifest} from './src/client/asset-download.ts';window.Store=AssetDownloadStore;window.validate=validateDownloadManifest;`,resolveDir:process.cwd(),sourcefile:'revision-fixture.js'},bundle:true,format:'esm',platform:'browser',write:false});
const sw=await fs.readFile('public/sw.js','utf8');let requests=[];
const server=http.createServer(async(req,res)=>{let u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');if(u.pathname==='/')return void res.end('<!doctype html><script type="module" src="/bundle.js"></script>');if(u.pathname==='/sw.js'){res.setHeader('Content-Type','text/javascript');return void res.end(sw)}if(u.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');return void res.end(compiled.outputFiles[0].contents)}let i=names.indexOf(u.pathname.slice(1));if(i!==-1){requests.push(u.pathname+u.search);res.setHeader('Content-Type','model/gltf-binary');return void res.end(current[i])}if(u.pathname==='/'+original){requests.push(u.pathname+u.search);return void res.end(rifle)}res.writeHead(404).end()});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:'chrome'});const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.Store);
 await page.evaluate(async({oldUrls,oldData,original,rifle})=>{let c=await caches.open('swarm-front-preload-v1');const response=s=>new Response(Uint8Array.from(atob(s),c=>c.charCodeAt(0)),{status:200});for(let i=0;i<5;i++)await c.put(oldUrls[i],response(oldData[i]));await c.put(original,response(rifle))},{oldUrls,oldData:old.map(b=>b.toString('base64')),original,rifle:rifle.toString('base64')});
 const observe=url=>page.evaluate(async url=>{try{const r=await fetch(url),b=await r.arrayBuffer();return{ok:r.ok,status:r.status,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){return{ok:false,error:String(e)}}},url);
 const validation=await page.evaluate(({oldManifest,newManifest,base})=>{const b=new URL(base);return {old:!!window.validate(oldManifest,b),next:!!window.validate(newManifest,b)}},{oldManifest:previous,newManifest:next,base});assert(validation.old&&validation.next);
 await context.setOffline(true);const oldOfflineBefore=await observe(oldUrls[0]),newOfflineBefore=await observe(newUrls[0]);assert.equal(oldOfflineBefore.sha256,hash(old[0]));assert.equal(newOfflineBefore.ok,false);await context.setOffline(false);
 const initialRequests=requests.length,first=[];for(const u of newUrls)first.push(await observe(u));assert(first.every((r,i)=>r.sha256===hash(current[i])));const firstRequests=requests.length-initialRequests;
 const beforeSecond=requests.length;for(let i=0;i<5;i++)assert.equal((await observe(newUrls[i])).sha256,hash(current[i]));const repeatRequests=requests.length-beforeSecond;
 await context.setOffline(true);const offline=[];for(let i=0;i<5;i++)offline.push(await observe(newUrls[i]));assert(offline.every((r,i)=>r.sha256===hash(current[i])));assert.equal((await observe(oldUrls[0])).sha256,hash(old[0]));assert.equal((await observe(original)).sha256,hash(rifle));await context.setOffline(false);
 // An old URL is not an immutable asset on a static server: evict only its cached key.
 await page.evaluate(async u=>{for(const n of ['swarm-front-preload-v1','swarm-front-shell-v1'])await(await caches.open(n)).delete(u)},oldUrls[0]);
 const oldCold=await observe(oldUrls[0]);assert.equal(oldCold.sha256,hash(current[0]));assert.notEqual(oldCold.sha256,hash(old[0]));
 // AssetDownloadStore rejects a stale manifest rather than silently saving mismatched bytes.
 await page.evaluate(async u=>{for(const n of ['swarm-front-preload-v1','swarm-front-shell-v1'])await(await caches.open(n)).delete(u)},oldUrls[0]);
 const oldAsset=rows(previous).find(r=>r.url===oldUrls[0]);
 const oldDownload=await page.evaluate(async a=>{try{await new window.Store(new URL('/',location.href)).download([a],new AbortController().signal,()=>{});return{accepted:true}}catch(e){return{accepted:false,error:String(e)}}},oldAsset);assert.equal(oldDownload.accepted,false);
 assert.equal(firstRequests,5);assert.equal(repeatRequests,0);assert.deepEqual(errors,[]);
 const report={scope:'Isolated localhost, unchanged actual SW and asset store. MD-4 five versions and one original rifle; old/new manifests generated from supplied diagnostic packs, not full product manifests. No production changes, deployed Worker/CDN, phone, or real client.',oldAudit,newAudit,mismatchCaught,validation,oldOfflineBefore,newOfflineBefore,firstRequests,repeatRequests,newOfflineMatches:offline.length,oldCachedStillMatches:true,rifleCachedMatches:true,oldUrlColdReturnsCurrent:oldCold.sha256===hash(current[0]),oldDownload,errors};
 await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(r=>server.close(r))}
