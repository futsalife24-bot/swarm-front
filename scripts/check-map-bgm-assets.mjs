import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const ffmpeg=process.argv[2];
if(!ffmpeg)throw Error('Pass the installed ffmpeg executable path');
const file='docs/MAP-BGM-SOURCES.json',manifest=JSON.parse(fs.readFileSync(file,'utf8'));
const results=[];
for(const song of manifest.songs){
 const data=fs.readFileSync(song.file);
 assert.ok(data.subarray(0,8192).toString('utf8').includes(song.sunoUrl), 'Embedded song URL mismatch: '+song.file);
 const check=spawnSync(ffmpeg,['-hide_banner','-nostdin','-xerror','-i',song.file,'-map','0:a:0','-af','volumedetect','-f','null','-'],{encoding:'utf8',maxBuffer:2e6});
 assert.equal(check.status,0,check.stderr);
 const duration=/Duration: (\d+):(\d+):(\d+\.\d+)/.exec(check.stderr);
 const mean=/mean_volume: (-?[\d.]+) dB/.exec(check.stderr),peak=/max_volume: (-?[\d.]+) dB/.exec(check.stderr);
 assert.ok(duration&&mean&&peak,'Missing measurements');
 const durationSeconds=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);
 assert.ok(durationSeconds>60&&Number(mean[1])>-50&&Number(peak[1])<0,'Invalid or silent audio');
 const result={map:song.map,file:song.file,songId:song.songId,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),durationSeconds,meanDb:Number(mean[1]),peakDb:Number(peak[1]),fullDecodePassed:true};
 results.push(result);Object.assign(song,result);
}
manifest.status='downloaded-and-decoded';manifest.audioProcessing='Original MP3 bytes; no trimming, normalization or transcoding';
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
fs.mkdirSync('docs/evidence/map-bgm',{recursive:true});
fs.writeFileSync('docs/evidence/map-bgm/assets.json',JSON.stringify({pass:true,files:results},null,2)+'\n');
console.log(JSON.stringify({pass:true,files:results},null,2));
