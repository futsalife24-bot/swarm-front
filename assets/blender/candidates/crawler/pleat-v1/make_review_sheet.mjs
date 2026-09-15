import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const dir='assets/blender/candidates/crawler/pleat-v1';
const browser=await chromium.launch({channel:'chrome'});
try{
 const p=await browser.newPage();await p.goto('http://127.0.0.1:5199/e2e/structure-fixture.html');
 const png=await p.evaluate(async dir=>{
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=700;const ctx=canvas.getContext('2d');ctx.fillStyle='#101918';ctx.fillRect(0,0,1440,700);
  ctx.fillStyle='#e7ebda';ctx.font='32px sans-serif';ctx.fillText('PLEAT / 保存動画からの動作比較',30,48);
  ctx.font='17px sans-serif';ctx.fillStyle='#b2c3ae';ctx.fillText('上段：四肢の送りと背の折り畳み　下段：溜め → 衝撃 → 復帰　／　同じカメラ・照明・縮尺',30,82);
  const video=document.createElement('video');video.muted=true;video.src='/'+dir+'/review/pleat_motion_side.mp4';document.body.append(video);
  await new Promise((ok,no)=>{video.onloadeddata=ok;video.onerror=no});
  const samples=[[4.03,'追跡 0.03s'],[4.23,'追跡 0.23s'],[4.43,'追跡 0.43s'],[8.30,'溜め 0.30s'],[8.47,'衝撃直後 0.47s'],[8.95,'復帰 0.95s']];
  for(const [i,[t,label]] of samples.entries()){
   video.currentTime=t;await new Promise(ok=>video.onseeked=ok);await video.play();await new Promise(ok=>video.requestVideoFrameCallback(ok));video.pause();
   const x=(i%3)*480,y=110+Math.floor(i/3)*280;
   ctx.drawImage(video,0,56,960,444,x,y,480,222);ctx.fillStyle='#dae4cf';ctx.font='22px sans-serif';ctx.fillText(label,x+22,y+252);
  }
  return canvas.toDataURL('image/png').split(',')[1];
 },dir);
 writeFileSync(dir+'/review/motion-sheet.png',Buffer.from(png,'base64'));
}finally{await browser.close()}
