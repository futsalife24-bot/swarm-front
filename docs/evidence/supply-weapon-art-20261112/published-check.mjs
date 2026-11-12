import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://swarm-front.melosalife-24.workers.dev';
const report=JSON.parse(fs.readFileSync('docs/evidence/supply-weapon-art-20261112/render.json','utf8'));
const files=report.records.map(x=>'/supply-reveal/assets/'+x.file);
files.push('/index.html','/front.html','/sw.js','/asset-download-manifest.json','/supply-reveal/core.js','/assets/playtest-app-B9YQ9rYU.js');
const hash=b=>createHash('sha256').update(b).digest('hex');
const assets=[];
for (const path of files) {
  const response=await fetch(base+path);
  assert.equal(response.status,200,path);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(hash(bytes),hash(fs.readFileSync('dist'+path)),path);
  if(path.endsWith('.webp')) {
    assert.match(response.headers.get('content-type')??'',/^image\/webp/i,path);
    const expected=report.records.find(x=>path.endsWith('/'+x.file));
    assert.equal(hash(bytes),expected.sha256,path);
  }
  assets.push({path,bytes:bytes.length,sha256:hash(bytes),contentType:response.headers.get('content-type')});
}
const health=await fetch(base+'/api/health');
assert.equal(health.status,200);const body=await health.json();assert.equal(body.ok,true);
fs.writeFileSync('docs/evidence/supply-weapon-art-20261112/published.json',JSON.stringify({date:new Date().toISOString(),base,source:'2dca748c85502038c05a387af05dc79ff170c6c1',health:{status:health.status,ok:body.ok},assets},null,2)+'\n');
console.log('PASS',report.records.length,'weapon images and',files.length-report.records.length,'application files match build; health OK');
