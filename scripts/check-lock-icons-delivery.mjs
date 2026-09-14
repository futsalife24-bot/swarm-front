import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
// Read-only public asset verification. No browser or save fixture is used.
const origin='https://congressional-structured-thirty-keeping.trycloudflare.com';
const paths=['/assets/ui/weapon-locked.png','/assets/ui/weapon-unlocked.png','/index.html',...fs.readdirSync('dist/assets').filter(p=>/\.(js|css)$/.test(p)).map(p=>'/assets/'+p)];
const hash=b=>createHash('sha256').update(b).digest('hex');const assets=[];
for(const path of paths){const response=await fetch(origin+path);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),hash(fs.readFileSync('dist'+path)));assets.push({path,sha256:hash(bytes)});}
fs.writeFileSync('dist-validation/lock-icons/delivery.json',JSON.stringify({date:new Date().toISOString(),origin,readOnly:true,assets},null,2));
console.log(`PASS ${assets.length} public assets match tested dist; no save data sent.`);

