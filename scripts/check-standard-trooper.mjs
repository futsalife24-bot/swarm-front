import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/standard-trooper';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1200,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5314/assets/blender/preview-trooper/');
 await page.waitForFunction(()=>window.trooperQA,{timeout:60000});
 const cases=[['front','Weapon_Idle_Rifle',0],['back','Weapon_Idle_Rifle',0],['side','Weapon_Idle_Rifle',0],['oblique','Run',.16],['oblique','Fire_Rifle',.04],['oblique','Fire_Shotgun',.16],['oblique','Fire_Rocket',.2],['back','Switch_1_to_2',.45],['back','Switch_1_to_2',.60],['oblique','Dodge_Roll',1/6],['oblique','Hit_Heavy',.35],['oblique','Hit_Heavy',.83]];
 for(let i=0;i<cases.length;i++){
  const [v,n,t]=cases[i];await page.evaluate(([v,n,t])=>{trooperQA.weapon(n.endsWith('Rocket')?'rocket':n.endsWith('Shotgun')?'shotgun':'rifle');trooperQA.view(v);trooperQA.set(n,t)},[v,n,t]);
  await page.screenshot({path:`${dir}/${String(i).padStart(2,'0')}-${v}-${n}.png`});
 }
 const stats=await page.evaluate(()=>trooperQA.stats());
 const independent=await page.evaluate(()=>{
  const original=trooperQA.trooper,other=new original.constructor(original.assets);
  other.sample('Idle',0);const before=other.bones.map(b=>b.matrixWorld.elements.slice());
  original.sample('Dodge_Roll',.16);other.model.updateMatrixWorld(true);
  const result=other.bones.every((b,i)=>b!==original.bones[i]&&b.matrixWorld.elements.every((v,j)=>Math.abs(v-before[i][j])<1e-8));
  other.dispose();return result;
 });
 const probes=await page.evaluate(()=>{
  const {trooper:t}=trooperQA;const result=[];
  for(const from of [0,1])for(const time of [.45,.60]){
   t.sampleSwitch(from,time);t.model.updateMatrixWorld(true);
   const slot=time===.45?from:1-from,hand=t.hand.matrixWorld.elements,back=t.back[slot].matrixWorld.elements;
   result.push({from,time,positionError:Math.hypot(hand[12]-back[12],hand[13]-back[13],hand[14]-back[14]),matrixError:Math.max(...hand.map((v,i)=>Math.abs(v-back[i])))});
  }
  return result;
 });
 writeFileSync(`${dir}/viewer-validation.json`,JSON.stringify({stats,probes,independent,errors},null,2));
 assert.ok(independent,'Player skeletons must be independent');assert.deepEqual(errors,[]);assert.ok(probes.every(p=>p.positionError<.001 && p.matrixError<.001),'Socket handoff must be continuous');console.log(JSON.stringify({stats,probes,independent,errors}));
}finally{await browser.close()}
