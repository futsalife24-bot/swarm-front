import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://swarm-front.melosalife-24.workers.dev';
const html=readFileSync('dist/index.html','utf8');
const paths=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(x=>x[1]);
paths.push('/assets/characters/standard_trooper_v7.glb','/assets/characters/standard_trooper_v5.json',...['rifle','shotgun','rocket'].map(x=>`/assets/characters/standard_${x}_v4.glb`));
const hash=x=>createHash('sha256').update(x).digest('hex');const report={base,assets:[]};
for(const path of paths){const r=await fetch(base+path);assert.equal(r.status,200,`${path} HTTP ${r.status}`);const data=Buffer.from(await r.arrayBuffer());const actual=hash(data);assert.equal(actual,hash(readFileSync('dist'+path)),path);report.assets.push({path,bytes:data.length,sha256:actual,matches:true})}
const r=await fetch(base+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).ok,true);report.health={status:200,ok:true};report.passed=true;report.version=process.argv[2]??null;report.date=new Date().toISOString();
writeFileSync('dist-validation/stage-clear/published-assets.json',JSON.stringify(report,null,2));console.log('PUBLIC ASSETS AND HEALTH PASS',report.assets.length);


