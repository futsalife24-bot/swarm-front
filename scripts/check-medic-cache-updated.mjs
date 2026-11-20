// Isolated origin: actual service worker and download store, no player saves.
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const kinds=['medic'];
const original=['rifle','shotgun','rocket'], assets=[], missing=[];
for(const kind of kinds){
  const dir=original.includes(kind)?'realism-v2':'unique-v1', files=[];
  try {
    for(let grade=0;grade<5;grade++){
      const url=`assets/weapons/${dir}/${kind}_${grade}.glb`;
      const data=await fs.readFile(path.join('public',url));
      files.push({url,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
    }
    assets.push(...files);
  } catch(e) { if(e.code==='ENOENT') missing.push(kind); else throw e; }
}
if(missing.length&&!process.argv.includes('--available')) throw Error(`未生成: ${missing.join(',')}`);
const out='dist-validation/weapon-cache-medic-update'; await fs.mkdir(out,{recursive:true});
const compiled=await build({stdin:{contents:`import {AssetDownloadStore} from './src/client/asset-download.ts'; window.store=new AssetDownloadStore(new URL('/',location.href));`,resolveDir:process.cwd(),sourcefile:'weapon-cache-fixture.js'},bundle:true,format:'esm',platform:'browser',write:false});
const html='<!doctype html><meta charset="utf-8"><title>武器キャッシュ検証</title><script type="module" src="/bundle.js"></script>';
const root=path.resolve('public/assets/weapons');
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/')return void res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html);
  if(url.pathname==='/bundle.js')return void res.writeHead(200,{'Content-Type':'text/javascript'}).end(compiled.outputFiles[0].contents);
  if(url.pathname==='/sw.js')return void res.writeHead(200,{'Content-Type':'text/javascript'}).end(await fs.readFile('public/sw.js'));
  if(!url.pathname.startsWith('/assets/weapons/'))return void res.writeHead(404).end();
  const file=path.resolve(root,url.pathname.slice('/assets/weapons/'.length));
  if(!file.startsWith(root+path.sep))return void res.writeHead(403).end();
  try {res.writeHead(200,{'Content-Type':'model/gltf-binary'}).end(await fs.readFile(file));}
  catch {res.writeHead(404).end();}
});
let browser;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome'});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
  const oldReport=JSON.parse(await fs.readFile('docs/evidence/weapon-models-20261111/weapon-catalog-55-report.json','utf8'));
  const oldData=assets.map(a=>{
    const b=execFileSync('git',['show',`1cf64f2:public/${a.url}`]);
    const row=oldReport.rows.find(r=>r.url===a.url);assert.ok(row);
    assert.equal(b.length,row.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),row.sha256);
    assert.notEqual(row.sha256,a.sha256);
    return {url:a.url,sha256:row.sha256,base64:b.toString('base64')};
  });
  const result=await page.evaluate(async({assets,oldData})=>{
    for(const old of oldData){
      const key=new URL(old.url,location.href).href,bytes=Uint8Array.from(atob(old.base64),c=>c.charCodeAt(0));
      for(const name of ['swarm-front-shell-v1','swarm-front-preload-v1'])
        await (await caches.open(name)).put(key,new Response(bytes,{headers:{'content-type':'model/gltf-binary'}}));
    }
    const before=[];
    for(const old of oldData){
      const bytes=await (await fetch(new URL(old.url,location.href))).arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
      before.push({url:old.url,bytes:bytes.byteLength,hashMatch:hash===old.sha256});
    }
    const preSaved=(await window.store.saved(assets)).size;
    let progress;await window.store.download(assets,new AbortController().signal,p=>{progress=p;});
    const afterSaved=(await window.store.saved(assets)).size;
    return {controlled:!!navigator.serviceWorker.controller,before,preSaved,afterSaved,progress};
  },{assets,oldData});
  assert.equal(result.controlled,true);assert.ok(result.before.every(x=>x.hashMatch));assert.equal(result.preSaved,0);
  assert.equal(result.afterSaved,assets.length);assert.equal(result.progress.completed,assets.length);
  await context.setOffline(true);
  const offline=await page.evaluate(async(assets)=>{
    const rows=[];
    for(const a of assets){
      const response=await fetch(new URL(a.url,location.href));
      const data=await response.arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
      rows.push({url:a.url,ok:response.ok,bytes:data.byteLength,expectedBytes:a.bytes,hashMatch:hash===a.sha256});
    }
    return rows;
  },assets);
  assert.ok(offline.every(r=>r.ok&&r.bytes===r.expectedBytes&&r.hashMatch));assert.deepEqual(errors,[]);
  const report={scope:'Actual service worker and download store at isolated local origin; 5 real previous MD-4 GLBs in both caches, manually requested update; no product manifest, real device or deployed Worker.',oldRevision:'1cf64f2',before:result.before,controlled:result.controlled,preSaved:result.preSaved,afterSaved:result.afterSaved,offlineRows:offline,errors};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({files:offline.length,oldFilesVerified:result.before.length,staleReplaced:true,offlineMatches:offline.length,errors}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
