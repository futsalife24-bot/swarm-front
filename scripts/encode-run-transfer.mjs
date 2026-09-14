import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const ffmpeg=process.argv[2];if(!ffmpeg)throw Error('Pass the installed ffmpeg executable path');
const dir='dist-work/run-transfer-20260913',report=[];
function run(args){const r=spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r}
for(const key of ['jog','sprint']){
 const file=`SwarmFront-${key}-vs-current-20260913.mp4`,path=dir+'/'+file;
 assert.equal(fs.readdirSync(`${dir}/${key}-frames`).filter(p=>p.endsWith('.jpg')).length,360);
 run(['-y','-framerate','30','-i',`${dir}/${key}-frames/%04d.jpg`,'-frames:v','360','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-an',path]);
 const decode=run(['-i',path,'-progress','pipe:1','-f','null','-']);assert.match(decode.stdout,/frame=360\s/);assert.match(decode.stderr,/1280x720/);assert.match(decode.stderr,/30 fps/);
 const frames=[12,24,36,48,132,144,156,168,252,264,276,288];
 run(['-y','-i',path,'-vf',`select='${frames.map(n=>`eq(n,${n})`).join('+')}',scale=320:180,tile=4x3`,'-frames:v','1',`${dir}/${key}-video-contact.jpg`]);
 report.push({key,file,bytes:fs.statSync(path).size,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex'),fps:30,frames:360,seconds:12,codec:'H264 yuv420p',width:1280,height:720,allFramesDecoded:true,contactSheetFrames:frames});console.log('Encoded and decoded',key,fs.statSync(path).size,'bytes');
}
fs.writeFileSync(dir+'/video-verification.json',JSON.stringify(report,null,2));
