import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const label=process.argv[2]??'before',dir='dist-validation/trooper-polish';mkdirSync(dir,{recursive:true});
const b=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:1100,height:900}});await p.clock.install();await p.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');await p.waitForFunction(()=>window.trooperQA);await p.clock.pauseAt(new Date((await p.evaluate(()=>Date.now()))+1000));
 const data=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{createWorld,addPlayer}=await import('/src/shared/game.ts');
  const q=trooperQA,t=q.trooper,p=addPlayer(createWorld('audit',1),'p'),out=[];p.x=0;p.z=0;
  q.set('Weapon_Idle_Rifle',0);const restHead=t.model.getObjectByName('Head').getWorldQuaternion(new T.Quaternion()),restMuzzle=t.hand.getWorldQuaternion(new T.Quaternion());t.update(p,0,0,'audit',1/60);
  for(let i=0;i<120;i++){
   p.z-=7/60;t.update(p,0,i/60,'audit',1/60);
   const pos=n=>t.model.getObjectByName(n).getWorldPosition(new T.Vector3()),hip=pos('Pelvis'),head=pos('Head'),chest=pos('Chest');
   out.push({hip:hip.y,headTilt:T.MathUtils.radToDeg(restHead.angleTo(t.model.getObjectByName('Head').getWorldQuaternion(new T.Quaternion()))),muzzleTilt:T.MathUtils.radToDeg(restMuzzle.angleTo(t.hand.getWorldQuaternion(new T.Quaternion()))),lean:T.MathUtils.radToDeg(Math.atan2(-(head.z-hip.z),head.y-hip.y)),chestLean:T.MathUtils.radToDeg(Math.atan2(-(chest.z-hip.z),chest.y-hip.y)),left:pos('Foot_L').toArray(),right:pos('Foot_R').toArray()});
  }
  return {samples:out,hipRange:Math.max(...out.map(s=>s.hip))-Math.min(...out.map(s=>s.hip)),lean:[Math.min(...out.map(s=>s.lean)),Math.max(...out.map(s=>s.lean))],chestLean:[Math.min(...out.map(s=>s.chestLean)),Math.max(...out.map(s=>s.chestLean))],clips:[...t.clips.keys()]};
 });
 writeFileSync(`${dir}/${label}-runtime.json`,JSON.stringify(data,null,2));console.log({label,hipRange:data.hipRange,lean:data.lean,chestLean:data.chestLean});
 if(label==='after'){
  const settled=data.samples.slice(12);assert.ok(data.hipRange<.08);
  assert.ok(settled.every(s=>s.chestLean>15&&s.chestLean<19));
  assert.ok(settled.every(s=>s.headTilt<1&&s.muzzleTilt<1),'level gaze and muzzle while torso leans');
 }
 for(const view of ['front','back','side']){await p.evaluate(view=>{trooperQA.view(view);trooperQA.set('Weapon_Idle_Rifle',0);document.querySelector('aside').style.display='none'},view);await p.screenshot({path:`${dir}/${label}-${view}.png`});}
}finally{await b.close()}
