import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-work/run-transfer-20260913/directions';mkdirSync(out,{recursive:true});
// Hard input changes, no custom easing. The existing runtime owns all blending.
const normal=[['停止',1,0,0],['前進',2,0,-1],['右へ横移動',2,1,0],['右斜め前',2,1,-1],['後ろ移動（全候補で現行クリップ）',2,0,1],['左斜め後ろ（現行クリップ）',2,-1,1],['左へ横移動',2,-1,0],['前進へ切替',2,0,-1],['停止へ移行',1,0,0],['再び前進',1,0,-1],['停止',1,0,0]];
const slow=[['前進',1,0,-1],['右へ方向転換',1,1,0],['後退へ方向転換',1,0,1],['停止へ移行',1,0,0]];
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const reports=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:820}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5340/scripts/run-transfer-review.html');await page.waitForFunction(()=>window.ready,null,{timeout:120000});await page.evaluate(()=>review.freeze());
 for(const key of ['jog','sprint']){
  const dir=`${out}/${key}-frames`;mkdirSync(dir,{recursive:true});let index=0;const samples=[],sections=[];
  for(const [schedule,rate] of [[normal,1],[slow,.5]]){
   await page.evaluate(key=>{review.reset(key,'rifle');for(let i=0;i<30;i++)review.tick(1/60,false)},key);
   for(const [label,seconds,x,z] of schedule){
    sections.push({start:index/30,label,rate,direction:{x,z}});
    for(let f=0;f<seconds*30;f++){
     const result=await page.evaluate(({x,z,label,rate})=>{for(let i=0;i<2;i++)review.tick(rate/60,!!(x||z),{x,z});review.draw('oblique',`${rate===1?'通常速度':'0.5倍・移行確認'} | ${label} | 移動中 7 m/s | 照準は前方に固定`);return {image:review.canvas.toDataURL('image/jpeg',.9).split(',')[1],state:review.models().map(t=>({mode:t.lowerMode,blend:t.lowerBlend,moveYaw:t.moveYaw,finite:t.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite)),feet:t.feet.map(l=>l.foot.getWorldPosition(l.lastP.clone()).sub(t.model.position).toArray())}))}},{x,z,label,rate});
     assert.ok(result.state.every(s=>s.finite));samples.push({frame:index,...{state:result.state}});writeFileSync(`${dir}/${String(index++).padStart(4,'0')}.jpg`,Buffer.from(result.image,'base64'));
    }console.log(key,label,rate,index);
   }
  }
  reports.push({key,frames:index,fps:30,seconds:index/30,sections,samples});writeFileSync(out+'/capture.json',JSON.stringify({reports,errors,scope:'Actual StandardTrooper.update; prescribed displacement input; not an authoritative network session. Same gear, fixed aim, camera follows each character identically. No custom transition smoothing.'},null,2));
 }assert.deepEqual(errors,[]);
}finally{await browser.close()}
