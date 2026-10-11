import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://swarm-front.melosalife-24.workers.dev';
const files=['index.html','front.html',...(await readdir('dist/assets')).filter(x=>/\.(js|css)$/.test(x)).map(x=>'assets/'+x),'assets/enemies/harrow_motion_v11.glb'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const checks=[];
for (const file of files) { const r=await fetch(base+'/'+file); const b=Buffer.from(await r.arrayBuffer()); const local=hash(await readFile('dist/'+file)); const remote=hash(b);checks.push({file,status:r.status,local,remote,pass:r.ok&&local===remote}); }
const h=await fetch(base+'/api/health');const health={status:h.status,body:await h.json()};
const result={at:new Date().toISOString(),base,source:'d7600e74eb85d27c061006be6350997409a24941',version:'00096fb9-7d27-447a-b52f-d816fcddc025',health,pass:checks.every(x=>x.pass)&&health.body.ok,checks};
await writeFile('docs/evidence/harrow-v11-release-20261012/delivery.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:result.pass,files:checks.length,health,failed:checks.filter(x=>!x.pass)}));if(!result.pass)process.exitCode=1;
