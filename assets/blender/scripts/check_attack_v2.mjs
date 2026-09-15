import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage();await p.goto('http://127.0.0.1:5198/assets/blender/preview-enemy-motion/index.html');await p.waitForFunction(()=>window.enemyMotion?.ready);
 const result=await p.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const h=window.enemyMotion;h.setPlaying(false);const unchanged=[];
  for(const n of ['ray','foundry_zero']){
   const old=await new GLTFLoader().loadAsync('/dist-validation/attack-v2/before/'+n+'_motion_v1.glb');
   for(const clipName of ['Idle','Locomotion']){
    const a=old.animations.find(c=>c.name===clipName),b=h.assets[n].clips.find(c=>c.name===clipName);let maxError=0;
    if(a.duration!==b.duration||a.tracks.length!==b.tracks.length)throw Error('Clip structure changed');
    for(const track of a.tracks){const other=b.tracks.find(t=>t.name===track.name);if(!other||other.values.length!==track.values.length)throw Error('Track changed');for(let i=0;i<track.values.length;i++)maxError=Math.max(maxError,Math.abs(track.values[i]-other.values[i]));}
    unchanged.push({name:n,clipName,maxError});
   }
  }
  h.selectEnemy('foundry_zero');h.select('Attack');h.draw(0);const model=h.assets.foundry_zero.model;
  const toes=Array.from({length:6},(_,i)=>model.getObjectByName('leg_'+i+'_toe'));const start=toes.map(o=>o.getWorldPosition(new T.Vector3()));let rearDrift=0,frontPeak=0,impactError=0;
  for(let f=0;f<=144;f++){h.draw(f/30);const positions=toes.map(o=>o.getWorldPosition(new T.Vector3()));for(let i=3;i<6;i++)rearDrift=Math.max(rearDrift,positions[i].distanceTo(start[i]));frontPeak=Math.max(frontPeak,Math.min(...positions.slice(0,3).map((v,i)=>v.y-start[i].y)));if(f===93)impactError=Math.max(...positions.map((v,i)=>Math.abs(v.y-start[i].y)));}
  return {unchanged,rearDrift,frontPeak,impactError,impactSeconds:3.1};
 });
 for(const c of result.unchanged)assert.ok(c.maxError<1e-5);
 assert.ok(result.rearDrift<1e-5);assert.ok(result.frontPeak>1.5);assert.ok(result.impactError<1e-5);
 const initial=JSON.parse(readFileSync('dist-validation/enemies-motion/artifact-hashes.json','utf8'));
 for(const path of ['public/assets/enemies/prism_motion_v1.glb','assets/blender/source/prism_motion_v1.blend'])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),initial[path]);
 writeFileSync('dist-validation/attack-v2/attack-validation.json',JSON.stringify({pass:true,...result,prismUnchanged:true},null,2));console.log('ATTACK PASS',result);
}finally{await browser.close()}
