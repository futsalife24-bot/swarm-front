import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://swarm-front.melosalife-24.workers.dev';
const paths=['/index.html','/front.html','/sw.js','/asset-download-manifest.json',
 '/supply-reveal/gacha.css?v=20261112-3',...['core.js','effect-selection.js','kakutei-fx.js','reference-scenes.js','runtime.js','sfx.js'].map(x=>'/supply-reveal/'+x),
 ...fs.readdirSync('dist/assets').filter(x=>/\.(js|css)$/.test(x)).map(x=>'/assets/'+x)];
const hash=b=>createHash('sha256').update(b).digest('hex'),assets=[];
for(const path of paths){const r=await fetch(base+path);assert.equal(r.status,200,path);const b=Buffer.from(await r.arrayBuffer());assert.equal(hash(b),hash(fs.readFileSync('dist'+path.split('?')[0])),path);assets.push({path,bytes:b.length,sha256:hash(b),contentType:r.headers.get('content-type')});}
const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
fs.writeFileSync('docs/evidence/supply-reveal-improvements-20261112/published.json',JSON.stringify({date:new Date().toISOString(),base,source:'9c587395e98d932cb870df34d285bbe045291f4e',health:{status:health.status,ok:true},assets},null,2)+'\n');
console.log('PASS',assets.length,'public application files match build; health OK');
