import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const markers=['soldier-live-review','__soldier-proof','次の戦闘で10秒記録','motionReview'];
const files=[],violations=[];
async function scan(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){await scan(file);continue;}
  const relative=path.relative('dist',file).replaceAll('\\','/');
  const content=await fs.readFile(file);
  for(const marker of markers)if(relative.includes(marker)||content.includes(Buffer.from(marker)))violations.push({file:relative,marker});
  files.push({file:relative,bytes:content.length,sha256:crypto.createHash('sha256').update(content).digest('hex')});
 }
}
await scan('dist');
const result={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'dist配下の全ファイル名と全ファイル内容をバイト列で検査。JS以外のTS、生素材、HTML、JSONも対象。',markers,violations,files};
const out=process.argv[2]||'test-results/soldier-production-isolation.json';
await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({head:result.head,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),violations,out}));
if(violations.length)process.exitCode=1;
