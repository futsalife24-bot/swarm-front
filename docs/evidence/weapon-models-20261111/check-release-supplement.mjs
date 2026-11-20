import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const hash=b=>createHash('sha256').update(b).digest('hex');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifestBytes=fs.readFileSync('dist/asset-download-manifest.json');
const manifest=JSON.parse(manifestBytes);
const items=manifest.packs.flatMap(p=>p.assets);
const assets=[];
for(const dir of ['realism-v2','unique-v1'])for(const name of fs.readdirSync('dist/assets/weapons/'+dir).filter(p=>p.endsWith('.glb'))){
 const path='assets/weapons/'+dir+'/'+name;
 const bytes=fs.readFileSync('dist/'+path),sha256=hash(bytes);
 assert.equal(hash(fs.readFileSync('public/'+path)),sha256,path);
 const item=items.find(a=>a.url===path);assert.ok(item,path);
 assert.equal(item.sha256,sha256,path);assert.equal(item.bytes,bytes.length,path);
 assert.equal(bytes.readUInt32LE(0),0x46546c67,path);assert.equal(bytes.readUInt32LE(4),2,path);assert.equal(bytes.readUInt32LE(8),bytes.length,path);
 assets.push({path,bytes:bytes.length,sha256});
}
assert.equal(assets.length,60);
assert.equal(hash(fs.readFileSync('dist/sw.js')),hash(fs.readFileSync('public/sw.js')));
const report={date:new Date().toISOString(),head,count:assets.length,manifestRevision:manifest.revision,manifestSha256:hash(manifestBytes),swSha256:hash(fs.readFileSync('dist/sw.js')),assets};
const base=process.argv[2];
if(base){
 const r=await fetch(base+'/manifest.webmanifest');assert.equal(r.status,200);
 const b=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type');
 assert.match(type,/application\/(manifest\+json|json)/i);assert.equal(hash(b),hash(fs.readFileSync('dist/manifest.webmanifest')));
 assert.equal(JSON.parse(b).orientation,'landscape');
 report.webmanifest={url:base+'/manifest.webmanifest',status:r.status,contentType:type,bytes:b.length,sha256:hash(b),orientation:'landscape'};
 const health=await fetch(base+'/api/health');assert.equal(health.status,200);const body=await health.json();assert.equal(body.ok,true);
 report.health={status:health.status,ok:body.ok};
}
fs.writeFileSync('dist-validation/weapon-final-audit/'+(base?'published-supplement':'main-build-assets')+'.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS',assets.length,'GLB build/public/manifest; SW matches source',base?'published webmanifest and health':'');
