// 局所検証: 完成前のためST-3欠落を明示。製品manifestの完成判定ではない。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import { build } from 'esbuild';
import { collectCurrentAssetPacks } from '../scripts/asset-download-catalog.mjs';
import { generateAssetDownloadManifest } from '../scripts/asset-download-manifest.mjs';

const root=process.cwd(), out=path.join(root,'dist-validation','weapon-catalog-partial-audit');
await fs.mkdir(out,{recursive:true});
const packs=collectCurrentAssetPacks(root), common=packs.find(p=>p.id==='common');
assert.ok(common);
const listed=common.urls.filter(u=>u.startsWith('assets/weapons/'));
assert.equal(listed.length,60); assert.equal(new Set(listed).size,60);
const missing=[];
for(const url of listed){try{await fs.access(path.join(root,'public',url));}catch(e){if(e.code==='ENOENT')missing.push(url);else throw e;}}
const expectedMissing=Array.from({length:5},(_,i)=>`assets/weapons/unique-v1/sticky_${i}.glb`);
if(missing.length){
 if(!process.argv.includes('--available'))throw Error('未生成: '+missing.join(','));
 assert.deepEqual([...missing].sort(),[...expectedMissing].sort());
}
let fullFailure='';
let fullManifest;
try {fullManifest=generateAssetDownloadManifest({root,development:true,packs});}
catch(e){fullFailure=e.message;}
if(missing.length)assert.match(fullFailure,/Missing or unreadable runtime asset: assets\/weapons\/unique-v1\/sticky_0\.glb/);
else {assert.equal(fullFailure,'');assert.ok(fullManifest);}

// 本番の全packを保持し、欠落した5件だけをメモリ内コピーから除外。
const partial=packs.map(p=>({...p,urls:p.urls.filter(url=>!missing.includes(url))}));
const manifest=missing.length?generateAssetDownloadManifest({root,development:true,packs:partial}):fullManifest;
const rows=manifest.packs.find(p=>p.id==='common').assets.filter(a=>a.url.startsWith('assets/weapons/'));
assert.equal(rows.length,60-missing.length);
const failures=[];
for(const row of rows){const data=await fs.readFile(path.join(root,'public',row.url));
 if(data.length!==row.bytes || crypto.createHash('sha256').update(data).digest('hex')!==row.sha256)failures.push(row.url);}
assert.deepEqual(failures,[]);

// 製品の Kind→URL 関数自体で得た60種類と正本カタログを比較。
const entry=`import {KINDS} from './src/shared/defs.ts';import {weaponModelUrl} from './src/client/weapon-model-url.ts'; export const urls=KINDS.flatMap(k=>[0,1,2,3,4].map(i=>weaponModelUrl(k,i).replace(/^\\//,'')));`;
const output=path.join(out,'runtime-urls.mjs');
await build({stdin:{contents:entry,resolveDir:root,sourcefile:'runtime-urls.ts'},bundle:true,format:'esm',platform:'node',outfile:output,define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'}});
const {urls}=await import(pathToFileURL(output));
assert.equal(urls.length,60);assert.equal(new Set(urls).size,60);
assert.deepEqual([...urls].sort(),[...listed].sort());
const result={scope:missing.length?'Diagnostic only: production catalog and manifest generator; only absent ST-3 files removed from in-memory inputs. No complete manifest, final build, deployed assets, service worker or physical device.':'Development manifest only; no final build, deployed assets, service worker or physical device.',catalogCount:listed.length,runtimeUrlCount:urls.length,missing,fullFailure,partialManifestWeaponCount:rows.length,allSizesAndHashesMatch:failures.length===0,rows};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({catalog:listed.length,runtime:urls.length,missing:missing.length,fullFailure,partial:rows.length,failures:failures.length}));
