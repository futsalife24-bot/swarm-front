import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='dist-validation/report-films-v2/videos',dest='public/assets/encounters/report-v2';
const ffmpeg=path.resolve('../references/pps-video-20260911/tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const rows=JSON.parse(fs.readFileSync(out+'/recordings.json'));assert.equal(rows.length,7);fs.mkdirSync(dest,{recursive:true});
function run(args){const r=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r;}
for(const row of rows){
 const file=dest+'/'+row.kind+'.mp4';assert.equal(row.idleDuration,6);assert.ok(row.duration>8&&row.duration<20);
 run(['-y','-sseof',String(-row.duration),'-i',row.path,'-an','-vf','fps=30','-c:v','libx264','-threads','2','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',file]);
 const decoded=run(['-i',file,'-f','null','-']);assert.match(decoded.stderr,/1280x720/);assert.match(decoded.stderr,/30 fps/);
 run(['-y','-i',file,'-vf','fps=1,scale=320:180,tile=5x2','-frames:v','1',out+'/'+row.kind+'-contact.jpg']);
 row.file=file;row.bytes=fs.statSync(file).size;row.sha256=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 console.log('PASS encoded/decoded',row.kind,row.bytes);
}
fs.writeFileSync(out+'/video-verification.json',JSON.stringify({version:'report-v2',width:1280,height:720,fps:30,allDecoded:true,rows},null,2));
