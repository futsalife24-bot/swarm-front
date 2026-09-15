import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root='assets/blender/candidates/crawler/pleat-audit';
const snapshot=root+'/integration-v2-typecheck';
fs.mkdirSync(snapshot,{recursive:true});
for(const item of ['src','server','tsconfig.json','tsconfig.worker.json'])fs.cpSync(item,path.join(snapshot,item),{recursive:true});
fs.copyFileSync(root+'/integration-v2/game.ts.proposed.txt',snapshot+'/src/shared/game.ts');
fs.copyFileSync(root+'/integration-v2/render.ts.proposed.txt',snapshot+'/src/client/render.ts');
const logs=[];
for(const config of ['tsconfig.json','tsconfig.worker.json']){
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p',snapshot+'/'+config],{encoding:'utf8'});
 logs.push({config,status:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.message});
}
fs.writeFileSync(root+'/integration-v2-typecheck.json',JSON.stringify({scope:'copied source snapshot with two proposal overlays; original sources unchanged',logs},null,2));
console.log(JSON.stringify(logs));process.exitCode=logs.some(r=>r.status!==0)?1:0;
