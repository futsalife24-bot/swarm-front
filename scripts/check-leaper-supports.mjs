import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='dist-validation/leaper-rods';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=JSON.parse(readFileSync('assets/blender/candidates/leaper/support-binding-v2/binding-checks.json','utf8'));
try{
 for(const variant of process.env.SUPPORTS_AFTER_ONLY?['after']:['before','after']){
  const context=await browser.newContext({viewport:{width:800,height:600}}),page=await context.newPage();
  if(variant==='before')await page.route('**/leaper_motion_v2.glb',r=>r.fulfill({body:readFileSync('public/assets/enemies/leaper_motion_v1.glb'),contentType:'model/gltf-binary'}));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5209/assets/blender/candidates/leaper/support-binding-v2/review.html');
  await page.waitForFunction(()=>window.review,{timeout:60000});
  for(const view of ['back','left','right','front'])for(const time of [.4,.825]){
   await page.evaluate(({view,time})=>window.review.draw(view,time),{view,time});
   await page.screenshot({path:`${out}/${variant}-${view}-${time}.png`});
  }
  const result=await page.evaluate(({repaired})=>{
   const {T,asset:a}=window.review,mesh=a.meshes.find(m=>m.name==='HOUND_skin_HOUND_edge_metal'),body=a.meshes[0].skeleton.bones.find(b=>b.name==='body');
   const m=new T.AnimationMixer(a.model),ids=repaired.flatMap(r=>r.ids),restInverse=body.matrixWorld.clone().invert();
   const indexed=new Set(mesh.geometry.index.array),referencedSupportVertices=ids.filter(i=>indexed.has(i)).length;
   const original=ids.map(i=>new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).applyMatrix4(restInverse));
   let worst=0;const perClip=[];
   for(const clip of a.clips){
    m.stopAllAction();const action=m.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();let error=0;
    for(let f=0;f<=Math.round(clip.duration*60);f++){
     m.setTime(f/60);a.model.updateMatrixWorld(true);mesh.skeleton.update();const inverse=body.matrixWorld.clone().invert();
     ids.forEach((i,k)=>{const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);error=Math.max(error,p.distanceTo(original[k]))});
    }
    perClip.push({clip:clip.name,error});worst=Math.max(worst,error);
   }
   m.stopAllAction();return {worst,perClip,referencedSupportVertices};
  },checks);
  if(variant==='after')assert.equal(result.referencedSupportVertices,0);else {assert.ok(result.worst>.1);assert.equal(result.referencedSupportVertices,192)}
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${variant}-checks.json`,JSON.stringify({pass:true,...result,errors},null,2));
  console.log(JSON.stringify({variant,...result}));await context.close();
 }
}finally{await browser.close()}
