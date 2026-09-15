import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='https://swarm-front.melosalife-24.workers.dev',hash=b=>createHash('sha256').update(b).digest('hex');
const paths=['/index.html',...fs.readdirSync('dist/assets').filter(n=>/\.(js|css)$/.test(n)).map(n=>'/assets/'+n),...fs.readdirSync('dist/assets/audio/ar-hit-v1').map(n=>'/assets/audio/ar-hit-v1/'+n)];
const rows=await Promise.all(paths.map(async path=>{const r=await fetch(base+path);assert.equal(r.status,200,path);const b=Buffer.from(await r.arrayBuffer());assert.equal(hash(b),hash(fs.readFileSync('dist'+path)),path);return {path,sha256:hash(b),bytes:b.length}}));
const r=await fetch(base+'/api/health');assert.equal(r.status,200);const health=await r.json();assert.equal(health.ok,true);
fs.writeFileSync('dist-validation/ar-hit/published-assets.json',JSON.stringify({version:'64e99a11-07cc-4ffd-81c5-a6ad8af3825a',rows,health},null,2));console.log('PASS',rows.length,'published assets match; health ok');
