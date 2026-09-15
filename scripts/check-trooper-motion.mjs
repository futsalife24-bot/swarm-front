import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1000,height:900}});
 await page.clock.install();
 await page.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');
 await page.waitForFunction(()=>window.trooperQA);
 await page.clock.pauseAt(new Date(Date.now()+200));
 const results=[];
 for (const [label,dx,dz] of [['forward',0,-1],['right',1,0],['backward',0,1],['left',-1,0],['diagonal',1,-1]]) {
  const result=await page.evaluate(async({label,dx,dz})=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {createWorld,addPlayer}=await import('/src/shared/game.ts');
   const qa=window.trooperQA;qa.set('Idle',0);
   const p=addPlayer(createWorld('qa',1),'p');p.x=0;p.z=0;
   const t=qa.trooper, samples=[];
   t.update(p,0,0,label,1/60);
   for(let i=0;i<32;i++) {
    p.x+=dx/Math.hypot(dx,dz)*.1;p.z+=dz/Math.hypot(dx,dz)*.1;
    t.update(p,0,i/60,label,1/60);
    const foot=n=>t.model.getObjectByName(n).getWorldPosition(new T.Vector3());
    const l=foot('Foot_L'),r=foot('Foot_R');
    samples.push({separation:((l.x-r.x)*dx+(l.z-r.z)*dz)/Math.hypot(dx,dz),leftHeight:l.y,leftTravel:(l.x*dx+l.z*dz)/Math.hypot(dx,dz),phase:t.locomotion,yaw:t.moveYaw});
   }
   qa.renderer.render(qa.scene,qa.camera);
   return {label,samples};
  },{label,dx,dz});
  assert.ok(Math.max(...result.samples.map(s=>s.separation))>.1,label+' left leads');
  assert.ok(Math.min(...result.samples.map(s=>s.separation))<-.1,label+' right leads');
  const planted=result.samples.slice(1).map((s,i)=>({s,prev:result.samples[i]})).filter(({s,prev})=>s.leftHeight<.14&&prev.leftHeight<.14);
  assert.ok(planted.length>3,label+' planted samples');
  assert.ok(planted.reduce((sum,{s,prev})=>sum+s.leftTravel-prev.leftTravel,0)<0,label+' planted foot travels backward');
  await page.screenshot({path:`dist-validation/trooper-motion/${label}.png`});
  results.push(result);
 }
 writeFileSync('dist-validation/trooper-motion/directions.json',JSON.stringify(results,null,2));
 console.log('PASS: alternating feet along all five movement directions');
} finally {await browser.close();}
