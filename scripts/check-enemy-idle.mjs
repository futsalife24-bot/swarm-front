import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/enemy-idle';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=d3d11']});
try {
const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5351/');await page.locator('#open-bestiary').waitFor();
const checks=await page.evaluate(async()=>{
const T=await import('/node_modules/three/build/three.module.js');
const {loadEnemyMotion}=await import('/src/client/hound-motion.ts');
const rows=[];
for(const name of ['pleat','hound','leaper','prism','ray','foundry_zero']){
 const a=await loadEnemyMotion(name),clip=a.clips.find(c=>c.name==='Idle'),m=new T.AnimationMixer(a.model),bones=a.meshes[0].skeleton.bones;
 const action=m.clipAction(clip);action.clampWhenFinished=true;action.setLoop(T.LoopOnce,1).play();
 const sample=t=>{m.setTime(t);a.model.updateMatrixWorld(true);return bones.map(b=>({name:b.name,p:b.getWorldPosition(new T.Vector3()).toArray(),q:b.getWorldQuaternion(new T.Quaternion()).toArray()}));};
 const start=sample(0);let minY=Infinity,maxFootDrift=0,movingBones=new Set();
 for(let f=0;f<=360;f+=6){const pose=sample(f/60);
 pose.forEach((b,i)=>{const d=new T.Vector3(...b.p).distanceTo(new T.Vector3(...start[i].p));if(b.name.endsWith('_toe'))maxFootDrift=Math.max(maxFootDrift,d);if(d>.02||1-Math.abs(new T.Quaternion(...b.q).dot(new T.Quaternion(...start[i].q)))>.002)movingBones.add(b.name);});
 for(const mesh of a.meshes){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);if(!Number.isFinite(p.lengthSq()))throw Error(name+' invalid vertex');minY=Math.min(minY,p.y);}}
 }
 const end=sample(6),seam=Math.max(...end.map((b,i)=>Math.max(new T.Vector3(...b.p).distanceTo(new T.Vector3(...start[i].p)),1-Math.abs(new T.Quaternion(...b.q).dot(new T.Quaternion(...start[i].q))))));
 if(seam>1e-4||maxFootDrift>1e-4||!movingBones.size)throw Error(JSON.stringify({name,seam,maxFootDrift,movingBones:[...movingBones]}));
 rows.push({name,seam,maxFootDrift,minY,movingBones:[...movingBones],duration:clip.duration});m.stopAllAction();
}
return rows;
});
fs.writeFileSync(out+'/numeric.json',JSON.stringify(checks,null,2));await page.reload();await page.locator('#open-bestiary').waitFor();await page.locator('h1').click();await page.waitForTimeout(500);await page.locator('#open-bestiary').click();
for(const kind of ['crawler','ant','spider','spitter','hornet','boss']){
 await page.locator(`[data-enemy="${kind}"]`).click();await page.waitForFunction(()=>document.querySelector('.enemy-viewport')?.dataset.asset==='ready',null,{timeout:90000});
 await page.locator('button[data-motion="idle"]').click();
 const a=await page.locator('.enemy-viewport').screenshot({path:`${out}/${kind}-a.png`});await page.waitForTimeout(1500);
 const b=await page.locator('.enemy-viewport').screenshot({path:`${out}/${kind}-b.png`});assert.ok(!a.equals(b),kind+' idle frozen');
 for(const mode of ['move','attack','idle']){await page.locator(`button[data-motion="${mode}"]`).click();await page.waitForTimeout(180);}
}
assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/checks.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();}
