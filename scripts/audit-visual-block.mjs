import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const dir='dist-validation/visual-block-v2';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5341/prototypes/visual-block/');await page.waitForFunction(()=>window.visualBlock?.ready,null,{timeout:90000});
 await page.evaluate(()=>{visualBlock.mode(true);visualBlock.inspect=true});await page.waitForTimeout(1000);await page.screenshot({path:`${dir}/equipment-close.png`});
 // Sample every original authored clip, in the actual skinned model with the new attachments.
 const clips=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const v=visualBlock,t=v.r.players.get('local').userData.trooper,c=v.costume,result=[];
  const pointSegment=(p,a,b)=>{const ab=b.clone().sub(a),u=T.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return p.distanceTo(a.clone().addScaledVector(ab,u));};
  for(const clip of t.assets.character.animations){
   const name=clip.name.replace(/^Trial_/,'');let minArmGap=Infinity,finite=true,nearest;
   const steps=name.startsWith('Switch_')?32:16;
   for(let k=0;k<=steps;k++){
    if(name.startsWith('Switch_'))t.sampleSwitch(name.includes('1_to_2')?0:1,k/steps*.5);else t.sample(name,k/steps*clip.duration);
    t.model.updateMatrixWorld(true);
    for(const bone of t.bones)finite&&=bone.matrixWorld.elements.every(Number.isFinite);
    for(const part of c.parts){
     const bi=c.source.skeleton.bones.findIndex(b=>b.name===part.bone),bone=c.source.skeleton.bones[bi],inv=c.source.skeleton.boneInverses[bi];
     for(const x of [-.5,0,.5])for(const y of [-.5,0,.5])for(const z of [-.5,0,.5]){
      const p=new T.Vector3(...part.pos).add(new T.Vector3(x*part.size[0],y*part.size[1],z*part.size[2])).applyMatrix4(inv).applyMatrix4(bone.matrixWorld);
      finite&&=p.toArray().every(Number.isFinite);
      for(const side of ['L','R']){
       const a=t.model.getObjectByName('LowerArm_'+side).getWorldPosition(new T.Vector3()),b=t.model.getObjectByName('Hand_'+side).getWorldPosition(new T.Vector3());
       const gap=pointSegment(p,a,b)-.045;if(gap<minArmGap){minArmGap=gap;nearest={part:part.name,side,frame:k};}
      }
     }
    }
   }
   result.push({name,samples:steps+1,finite,minForearmCapsuleGap:minArmGap,nearest});
  }
  return {clips:result,maxClothDisplacement:c.maxDisplacement,sourceGeometryPreserved:c.source.geometry!==c.original,clothVertices:c.cloth.attributes.position.count};
 });
 assert.equal(clips.clips.length,18);assert.ok(clips.clips.every(c=>c.finite));assert.ok(clips.maxClothDisplacement<=.0121);
 assert.ok(clips.clips.every(c=>c.minForearmCapsuleGap>.003),'new carrier clears forearm sampling capsules');
 await page.reload();await page.waitForFunction(()=>window.visualBlock?.ready);await page.evaluate(()=>{visualBlock.mode(true);visualBlock.crowd()});await page.waitForTimeout(1000);
 await page.screenshot({path:`${dir}/40-enemies.png`});
 const crowd=[];
 for(const mode of [false,true]){
  await page.evaluate(v=>{visualBlock.reset();visualBlock.crowd();visualBlock.mode(v);visualBlock.clearMetrics();visualBlock.paused=false},mode);
  await page.keyboard.down('Space');await page.waitForTimeout(5000);await page.keyboard.up('Space');await page.evaluate(()=>visualBlock.paused=true);
  crowd.push(await page.evaluate(()=>({enemies:visualBlock.world.enemies.length,metrics:visualBlock.metrics()})));
 }
 // The introduced curb surface must actually lift the displayed feet, not only paint a step.
 await page.evaluate(()=>{visualBlock.reset();visualBlock.mode(true);const p=visualBlock.world.players[0];p.x=25;p.z=8;const a=visualBlock.r.players.get('local');a.position.set(25,0,8);});await page.waitForTimeout(500);
 const curb=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),v=visualBlock,t=v.r.players.get('local').userData.trooper;return {rootY:v.r.players.get('local').position.y,feet:['L','R'].map(s=>t.model.getObjectByName('Foot_'+s).getWorldPosition(new T.Vector3()).toArray())}});
 assert.ok(curb.rootY>.15);await page.screenshot({path:`${dir}/curb-contact.png`});assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/audit.json`,JSON.stringify({clips,crowd,curb,errors},null,2));console.log(JSON.stringify({clips,crowd,curb,errors},null,2));
}finally{await browser.close()}
