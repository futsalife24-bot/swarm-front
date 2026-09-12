import {chromium} from '@playwright/test';
import fs from 'node:fs';
const dir=process.argv[2]??'assets/blender/candidates/crawler/pleat-audit';
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage(); await page.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
 const data=await page.evaluate(async dir=>{
  const canvas=document.createElement('canvas');canvas.width=1266;canvas.height=650;const ctx=canvas.getContext('2d');ctx.fillStyle='#122020';ctx.fillRect(0,0,1266,650);
  const durations={};
  for(const [row,name] of ['current','proposed'].entries()){
   const video=document.createElement('video');video.muted=true;video.src='/'+dir+'/integration-videos/'+name+'.webm';document.body.append(video);
   await new Promise((ok,no)=>{video.onloadeddata=ok;video.onerror=no});
   if(!Number.isFinite(video.duration)){video.currentTime=1e8;await new Promise(ok=>video.onseeked=ok);}
   durations[name]=video.duration;
   for(const [i,fraction] of [.14,.25,.30].entries()){
    video.currentTime=video.duration*fraction;await new Promise(ok=>video.onseeked=ok);
    const x=i*422,y=40+row*305;ctx.drawImage(video,x,y,422,195);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(name+' / '+video.currentTime.toFixed(2)+'s',x+10,y+222);
   }
  }
  return {durations,png:canvas.toDataURL('image/png').split(',')[1]};
 },dir);
 fs.writeFileSync(dir+'/integration-videos/sampled-frames.png',Buffer.from(data.png,'base64'));
 fs.writeFileSync(dir+'/integration-videos/video-metadata.json',JSON.stringify(data.durations,null,2));
} finally {await browser.close();}
