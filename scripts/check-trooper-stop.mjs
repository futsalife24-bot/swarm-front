import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/trooper-stop';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1000,height:750}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5330/assets/blender/candidates/trooper/stance-v7/review.html');await page.waitForFunction(()=>window.ready,{timeout:120000});
 const report=await page.evaluate(()=>{
  window.measuring=true;const cases=[];
  for(const kind of ['rifle','shotgun','rocket'])for(const direction of [[0,-1],[0,1],[1,0],[-1,0],[.707,-.707]])for(const fps of [30,60,120])for(const frames of [9,12,16,21]){
   qa.reset(kind,direction);let before;for(let f=0;f<frames;f++)before=qa.tick(true,1/fps);
   const sequence=[before];for(let f=0;f<Math.ceil(.35*fps);f++)sequence.push(qa.tick(false,1/fps));
   const last=sequence.at(-1),minSole=Math.min(...sequence.flatMap(s=>Object.values(s.sole))),maxFootStep=Math.max(...sequence.slice(1).flatMap((s,i)=>s.feet.map((foot,j)=>Math.hypot(...foot.map((v,k)=>v-sequence[i].feet[j][k])))));
   cases.push({kind,direction,fps,frames,minSole,maxFootStep,settled:last.lowerBlend===1,width:Math.abs(last.feet[0][0]-last.feet[1][0]),finite:sequence.every(s=>s.finite), landingStep:Math.max(...sequence[Math.ceil(.18*fps)].feet.map((foot,j)=>Math.hypot(...foot.map((v,k)=>v-sequence[Math.ceil(.18*fps)-1].feet[j][k]))))});
   // Repeated short release/restart and a stationary reload must not restart the lower transition.
   for(let i=0;i<6;i++){qa.tick(true,1/fps);qa.tick(false,1/fps)}qa.p().reload=.4;qa.tick(false,1/fps);qa.p().reload=0;
  }
  window.measuring=false;return {cases};
 });
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({...report,errors},null,2));
 await page.evaluate(()=>{qa.reset();for(let i=0;i<18;i++)qa.tick(false);qa.view(false)});await page.screenshot({path:`${dir}/stance-front.png`});
 await page.evaluate(()=>qa.view(true));await page.screenshot({path:`${dir}/stance-side.png`});
 await page.evaluate(()=>{qa.reset('rifle',[1,0]);for(let i=0;i<16;i++)qa.tick(true);qa.view(false)});await page.screenshot({path:`${dir}/stop-0.png`});
 for(let i=1;i<=6;i++){await page.evaluate(()=>{qa.tick(false);qa.tick(false);qa.view(false)});await page.screenshot({path:`${dir}/stop-${i}.png`})}
 assert.deepEqual(errors,[]);assert.ok(report.cases.every(c=>c.finite&&c.settled&&c.width>.50&&c.minSole>-.005&&c.landingStep<.06),JSON.stringify(report.cases.filter(c=>!c.finite||!c.settled||c.width<=.50||c.minSole<=-.005||c.landingStep>=.06)));
 console.log('PASS',report.cases.length,'stop cases', 'minimum sole',Math.min(...report.cases.map(c=>c.minSole)),'maximum frame step',Math.max(...report.cases.map(c=>c.maxFootStep)));
}finally{await browser.close()}


