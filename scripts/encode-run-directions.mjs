import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const exe=process.argv[2],dir='dist-work/run-transfer-20260913/directions',capture=JSON.parse(fs.readFileSync(dir+'/capture.json')),reports=[];
function run(args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return r}
for(const c of capture.reports){const {key,frames}=c,file=`SwarmFront-${key}-directions-transitions.mp4`,path=dir+'/'+file;
 assert.equal(fs.readdirSync(`${dir}/${key}-frames`).filter(x=>x.endsWith('.jpg')).length,frames);
 run(['-y','-framerate','30','-i',`${dir}/${key}-frames/%04d.jpg`,'-frames:v',String(frames),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-an',path]);
 const decoded=run(['-i',path,'-progress','pipe:1','-f','null','-']);assert.match(decoded.stdout,new RegExp(`frame=${frames}\\s`));
 const selected=[105,165,225,285,345,405,465,495,555,585,615,645];run(['-y','-i',path,'-vf',`select='${selected.map(n=>`eq(n,${n})`).join('+')}',scale=480:270,tile=3x4`,'-frames:v','1',`${dir}/${key}-contact.jpg`]);
 reports.push({key,file,bytes:fs.statSync(path).size,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex'),fps:30,frames,seconds:frames/30,decodedAllFrames:true,sections:c.sections});console.log(key,frames,'frames verified');}
fs.writeFileSync(dir+'/videos.json',JSON.stringify(reports,null,2));
