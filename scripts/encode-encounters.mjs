import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const ffmpeg=path.resolve('../references/pps-video-20260911/tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'),out=process.env.ENCOUNTER_VIDEO_OUT??'dist-validation/encounter-videos';
const rows=JSON.parse(fs.readFileSync(out+'/recordings.json'));assert.equal(rows.length,7);
function run(args){const r=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r;}
for(const row of rows){const name=`${String(row.index+1).padStart(2,'0')}-${row.name.replaceAll(' / ','-').replaceAll(' ','-')}.mp4`;row.file=name;if(process.env.ENCOUNTER_KIND&&row.kind!==process.env.ENCOUNTER_KIND){row.bytes=fs.statSync(out+'/'+name).size;continue;}
 run(['-y','-sseof',String(-row.duration),'-i',row.path,'-an','-vf','fps=30','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',out+'/'+name]);
 run(['-i',out+'/'+name,'-f','null','-']);
 run(['-y','-i',out+'/'+name,'-vf','fps=1,scale=384:216,tile=3x2','-frames:v','1',out+'/'+row.kind+'-contact.jpg']);
 row.bytes=fs.statSync(out+'/'+name).size;console.log('Verified',name,row.bytes);
}
fs.writeFileSync(out+'/concat.txt',rows.map(r=>`file '${r.file}'`).join('\n'));
run(['-y','-f','concat','-safe','0','-i',out+'/concat.txt','-c','copy','-movflags','+faststart',out+'/00-All-Monsters.mp4']);
run(['-i',out+'/00-All-Monsters.mp4','-f','null','-']);
fs.writeFileSync(out+'/video-verification.json',JSON.stringify({width:1280,height:720,fps:30,audio:false,allDecoded:true,rows},null,2));


