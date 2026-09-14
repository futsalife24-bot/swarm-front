import { chromium } from '@playwright/test';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/foundry-irregular-gait';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/scripts/preview-foundry-gait.html');
 await page.waitForFunction(()=>window.gaitPreview);
 const replay=await page.evaluate(()=>{
  const h=window.gaitPreview;h.setPlaying(false);
  const sample=()=>{h.draw(-1);h.draw(0);const values=[];for(let i=1;i<=180;i++){h.draw(i/60);if(i%15===0)h.view.root.traverse(o=>{if(o.name.endsWith('_FOOT'))values.push(...o.position.toArray(),...o.quaternion.toArray())})}return values};
  const a=sample(),b=sample();return {count:a.length,maxDifference:Math.max(...a.map((v,i)=>Math.abs(v-b[i])))};
 });
 assert.equal(replay.maxDifference,0);
 for(const [name,frame] of [['early',18],['later',43]]){
  await page.evaluate(frame=>{const h=window.gaitPreview;h.draw(0);for(let i=1;i<=frame;i++)h.draw(i/60)},frame);
  const png=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png'));
  writeFileSync(`${out}/${name}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/preview.json`,JSON.stringify({pass:true,replay,errors},null,2));console.log(JSON.stringify({pass:true,replay}));
}finally{await browser.close()}
