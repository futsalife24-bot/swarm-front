import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const output='dist-validation/coop-comfort-20261030/release';
const base='https://swarm-front.melosalife-24.workers.dev';
const manifest=JSON.parse(readFileSync('dist/asset-download-manifest.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const entries=manifest.packs.find(p=>p.id==='app').assets.map(a=>a.url);
const paths=[...new Set([...entries,'asset-download-manifest.json','sw.js','manifest.webmanifest'])];
const files=paths.map(url=>{const path=url.split('?')[0];const bytes=readFileSync(`dist/${path}`);return {url,path,bytes:bytes.length,sha256:sha(bytes)};});
const isPublic=process.argv[2]==='--public';
const stored=isPublic?JSON.parse(readFileSync(`${output}/build-manifest.json`,'utf8')):null;
const source=stored?.source??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(stored&&(stored.revision!==manifest.revision||JSON.stringify(stored.files)!==JSON.stringify(files)))throw Error('照合用manifestと現在のdistが異なります');
if(!isPublic)writeFileSync(`${output}/build-manifest.json`,JSON.stringify({source,revision:manifest.revision,files},null,2));
if(process.argv[2]!=='--public'){
 console.log(JSON.stringify({source,revision:manifest.revision,files:files.length,publicChecked:false}));
}else{
 const workerVersion=process.argv[3];if(!workerVersion)throw Error('Worker Versionが必要です');
 const checks=[];let next=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<files.length){const file=files[next++];try{const r=await fetch(`${base}/${file.url}`,{cache:'no-store',signal:AbortSignal.timeout(30000)});const bytes=Buffer.from(await r.arrayBuffer());checks.push({...file,status:r.status,publicSha256:sha(bytes),pass:r.ok&&sha(bytes)===file.sha256});}catch(e){checks.push({...file,pass:false,error:String(e)});}}}));
 const r=await fetch(`${base}/api/health`,{cache:'no-store',signal:AbortSignal.timeout(20000)});const health={status:r.status,body:await r.json()};
 const pass=checks.every(x=>x.pass)&&health.status===200&&health.body.ok===true;
 writeFileSync(`${output}/delivery.json`,JSON.stringify({checkedAt:new Date().toISOString(),source,revision:manifest.revision,workerVersion,base,pass,health,checks},null,2));
 console.log(JSON.stringify({pass,health,files:checks.length,failed:checks.filter(x=>!x.pass)}));if(!pass)process.exitCode=1;
}
