import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='dist-work/run-transfer-20260913';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:820}});await page.goto('http://127.0.0.1:5340/scripts/run-transfer-review.html');await page.waitForFunction(()=>window.ready,null,{timeout:120000});await page.evaluate(()=>review.freeze());
 for(const key of ['jog','sprint']){
  const dir=`${out}/${key}-frames`;mkdirSync(dir,{recursive:true});let index=0;
  for(const view of ['side','back','game']){
   await page.evaluate(key=>review.reset(key,'rifle'),key);
   for(let f=0;f<120;f++){
    const data=await page.evaluate(view=>{review.tick(1/60);review.tick(1/60);review.draw(view);return review.canvas.toDataURL('image/jpeg',.9).split(',')[1]},view);
    writeFileSync(`${dir}/${String(index++).padStart(4,'0')}.jpg`,Buffer.from(data,'base64'));
   }
   console.log(key,view,index,'frames');
  }
 }
 writeFileSync(`${out}/video-capture.json`,JSON.stringify({fps:30,framesPerCandidate:360,seconds:12,capture:'Deterministic browser rendering; two runtime update steps of 1/60 per video frame. No interpolation or retiming.',views:['side','back','game'],speed:7,weapons:['rifle','rocket on back']},null,2));
}finally{await browser.close()}
