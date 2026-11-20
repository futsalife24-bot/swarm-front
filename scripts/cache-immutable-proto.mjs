// Isolated experiment: preserve both immutable revisions; never alter product or user caches.
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { generateAssetDownloadManifest, verifyAssetDownloadManifest } from '../scripts/asset-download-manifest.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const out = 'dist-validation/cache-immutable-proto', root = out + '/public';
await fs.mkdir(root + '/assets/weapons/unique-v1', { recursive: true });
await fs.mkdir(root + '/assets/weapons/realism-v2', { recursive: true });
const old = [], current = [], oldUrls = [], newUrls = [];
for (let i = 0; i < 5; i++) {
  const name = `assets/weapons/unique-v1/medic_${i}.glb`;
  const a = execFileSync('git', ['show', `1cf64f2:public/${name}`]);
  const b = await fs.readFile('public/' + name);
  assert.notEqual(sha(a), sha(b));
  old.push(a); current.push(b);
  oldUrls.push(name.replace('.glb', `-${sha(a)}.glb`));
  newUrls.push(name.replace('.glb', `-${sha(b)}.glb`));
  await fs.writeFile(root + '/' + oldUrls[i], a);
  await fs.writeFile(root + '/' + newUrls[i], b);
}
const original = 'assets/weapons/realism-v2/rifle_0.glb';
const rifle = await fs.readFile('public/' + original);
await fs.writeFile(root + '/' + original, rifle);
const packs = values => [
  { id: 'app', label: 'app', description: 'fixture', urls: [] },
  { id: 'common', label: 'common', description: 'fixture', urls: [...values, original] },
];
const previous = generateAssetDownloadManifest({ development: true, assetRoot: root, packs: packs(oldUrls) });
const next = generateAssetDownloadManifest({ development: true, assetRoot: root, packs: packs(newUrls) });
const rows = m => m.packs.find(p => p.id === 'common').assets;
for (let i = 0; i < 5; i++) {
  assert.equal(rows(previous).find(r => r.url === oldUrls[i]).sha256, sha(old[i]));
  assert.equal(rows(next).find(r => r.url === newUrls[i]).sha256, sha(current[i]));
}
async function audit(label, manifest) {
  const dir = out + '/' + label;
  await fs.mkdir(dir + '/assets/weapons/unique-v1', { recursive: true });
  await fs.mkdir(dir + '/assets/weapons/realism-v2', { recursive: true });
  for (const url of [...oldUrls, ...newUrls, original]) await fs.copyFile(root + '/' + url, dir + '/' + url);
  await fs.writeFile(dir + '/asset-download-manifest.json', JSON.stringify(manifest));
  return verifyAssetDownloadManifest(dir);
}
const oldAudit = await audit('old-build', previous), newAudit = await audit('new-build', next);
const fixture = await build({ stdin: { contents: `import {AssetDownloadStore,validateDownloadManifest} from './src/client/asset-download.ts';window.Store=AssetDownloadStore;window.validate=validateDownloadManifest;`, resolveDir: process.cwd(), sourcefile: 'immutable-fixture.js' }, bundle: true, format: 'esm', platform: 'browser', write: false });
const sw = await fs.readFile('public/sw.js', 'utf8');
const files = new Map([...oldUrls.map((u,i)=>[u,old[i]]), ...newUrls.map((u,i)=>[u,current[i]]), [original,rifle]]);
let requests = [];
const server = http.createServer((req,res) => {
  const u = new URL(req.url,'http://localhost');
  res.setHeader('Cache-Control','no-store');
  if (u.pathname === '/') return void res.end('<!doctype html><script type="module" src="/bundle.js"></script>');
  if (u.pathname === '/sw.js') { res.setHeader('Content-Type','text/javascript'); return void res.end(sw); }
  if (u.pathname === '/bundle.js') { res.setHeader('Content-Type','text/javascript'); return void res.end(fixture.outputFiles[0].contents); }
  const file = u.pathname.slice(1);
  if (!files.has(file)) return void res.writeHead(404).end();
  requests.push(file + u.search); res.setHeader('Content-Type','model/gltf-binary'); res.end(files.get(file));
});
let browser;
try {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({channel:'chrome'});
  async function setup() {
    const context = await browser.newContext(), page = await context.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(base); await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.Store);
    return {context,page,errors};
  }
  const view = await setup();
  const observe = (page,url)=>page.evaluate(async url=>{try{const r=await fetch(url),b=await r.arrayBuffer();return{ok:r.ok,status:r.status,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){return{ok:false,error:String(e)}}},url);
  const validation=await view.page.evaluate(({oldManifest,newManifest,base})=>({old:!!window.validate(oldManifest,new URL(base)),next:!!window.validate(newManifest,new URL(base))}),{oldManifest:previous,newManifest:next,base}); assert(validation.old&&validation.next);
  await view.page.evaluate(async ({urls,data,original,rifle})=>{const c=await caches.open('swarm-front-preload-v1'); const response=s=>new Response(Uint8Array.from(atob(s),x=>x.charCodeAt(0)),{status:200});for(let i=0;i<urls.length;i++)await c.put(urls[i],response(data[i]));await c.put(original,response(rifle))},{urls:oldUrls,data:old.map(b=>b.toString('base64')),original,rifle:rifle.toString('base64')});
  await view.context.setOffline(true);
  const oldOfflineBefore = await observe(view.page,oldUrls[0]), newOfflineBefore = await observe(view.page,newUrls[0]);
  assert.equal(oldOfflineBefore.sha256,sha(old[0]));assert.equal(newOfflineBefore.ok,false);
  await view.context.setOffline(false);
  const oldCold = await setup(); const beforeOldCold=requests.length;
  const oldColdResult = await observe(oldCold.page,oldUrls[0]);
  assert.equal(oldColdResult.sha256,sha(old[0]));assert.equal(requests.length-beforeOldCold,1);
  const oldAsset=rows(previous).find(r=>r.url===oldUrls[0]);
  const oldDownload=await oldCold.page.evaluate(async a=>{try{await new window.Store(new URL('/',location.href)).download([a],new AbortController().signal,()=>{});return{accepted:true}}catch(e){return{accepted:false,error:String(e)}}},oldAsset);assert(oldDownload.accepted);
  const beforeFirst=requests.length;
  for(let i=0;i<5;i++)assert.equal((await observe(view.page,newUrls[i])).sha256,sha(current[i]));
  const firstRequests=requests.length-beforeFirst;
  const beforeRepeat=requests.length;
  for(let i=0;i<5;i++)assert.equal((await observe(view.page,newUrls[i])).sha256,sha(current[i]));
  const repeatRequests=requests.length-beforeRepeat;
  const newAssets=rows(next).filter(r=>newUrls.includes(r.url));
  const beforeDownload=requests.length;
  const savedCount=await view.page.evaluate(async assets=>{const store=new window.Store(new URL('/',location.href));await store.download(assets,new AbortController().signal,()=>{});return (await store.saved(assets)).size},newAssets);
  const downloadRequests=requests.length-beforeDownload;assert.equal(savedCount,5);
  await view.context.setOffline(true);
  for(let i=0;i<5;i++)assert.equal((await observe(view.page,newUrls[i])).sha256,sha(current[i]));
  assert.equal((await observe(view.page,oldUrls[0])).sha256,sha(old[0]));assert.equal((await observe(view.page,original)).sha256,sha(rifle));
  assert.equal(firstRequests,5);assert.equal(repeatRequests,0);assert.equal(downloadRequests,0);assert.deepEqual(view.errors,[]);assert.deepEqual(oldCold.errors,[]);
  const report={scope:'Isolated local server, unchanged SW and asset store; old and new immutable physical files both deployed in test. Five MD-4 variants and one existing rifle. No product deployment, CDN, real device, or old browser.',oldAudit,newAudit,validation,oldOfflineBefore,newOfflineBefore,oldColdResult,oldDownload,firstRequests,repeatRequests,downloadRequests,savedCount,newOfflineMatches:5,oldOfflineStillMatches:true,rifleOfflineMatches:true,storage:{oldBytes:old.reduce((n,b)=>n+b.length,0),newBytes:current.reduce((n,b)=>n+b.length,0),physicalFiles:10},errors:[...view.errors,...oldCold.errors]};
  await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
} finally {await browser?.close();await new Promise(r=>server.close(r));}
