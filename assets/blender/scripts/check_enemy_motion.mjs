import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='dist-validation/enemies-motion';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:960,height:540}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5198/assets/blender/preview-enemy-motion/index.html');await page.waitForFunction(()=>window.enemyMotion?.ready);
 await page.evaluate(()=>window.enemyMotion.setPlaying(false));
 const results=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const h=window.enemyMotion,results=[];
  for(const name of Object.keys(h.assets)){
   h.selectEnemy(name);const a=h.assets[name];a.mixer.stopAllAction();a.model.updateMatrixWorld(true);
   const meshes=[];a.model.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
   const original=(await new GLTFLoader().loadAsync('/assets/enemies/'+name+'_v1.glb')).scene;original.updateMatrixWorld(true);
   const origMeshes=[];original.traverse(o=>{if(o.isMesh)origMeshes.push(o)});
   const points=(ms,skin)=>{const pts=[];for(const m of ms){if(skin)m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const p=new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,i);if(skin)m.applyBoneTransform(i,p);p.applyMatrix4(m.matrixWorld);pts.push(p)}}return pts};
   const bounds=pts=>{const b=new T.Box3().setFromPoints(pts);return {min:b.min.toArray(),max:b.max.toArray()}};
   const neutral=bounds(points(meshes,true)),adopted=bounds(points(origMeshes,false));
   const triangles=ms=>ms.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
   const metrics={name,batches:meshes.length,triangles:triangles(meshes),adoptedTriangles:triangles(origMeshes),neutral,adopted,clips:[]};
   for(const clip of a.clips){
    h.select(clip.name);h.draw(0);const first=points(meshes,true);let minY=Infinity,maxDelta=0;
    for(let f=0;f<=Math.round(clip.duration*30);f++){h.draw(f/30);const ps=points(meshes,true);for(let i=0;i<ps.length;i++){if(!Number.isFinite(ps[i].lengthSq()))throw Error('Non-finite vertex');minY=Math.min(minY,ps[i].y);maxDelta=Math.max(maxDelta,ps[i].distanceTo(first[i]))}}
    h.draw(clip.duration);const last=points(meshes,true);const seam=Math.max(...last.map((p,i)=>p.distanceTo(first[i])));
    metrics.clips.push({name:clip.name,duration:clip.duration,minY,maxDelta,seam});
   }
   results.push(metrics);
  }return results;
 });
 writeFileSync(out+'/geometry-validation.json',JSON.stringify(results,null,2));
 for(const r of results){assert.equal(r.triangles,r.adoptedTriangles);for(const k of ['min','max'])r.neutral[k].forEach((v,i)=>assert.ok(Math.abs(v-r.adopted[k][i])<1e-4,`${r.name} neutral bounds`));for(const c of r.clips){assert.ok(c.minY>-.002,`${r.name} ${c.name} ground ${c.minY}`);assert.ok(c.maxDelta>.015,`${r.name} inert ${c.name}`);assert.ok(c.seam<.0001,`${r.name} ${c.name} seam ${c.seam}`)}}
 for(const name of ['prism','ray','foundry_zero']){
  for(const [mode,time] of [['Idle',1],['Locomotion',.65],['Attack',.8]]){await page.evaluate(({name,mode,time})=>{const h=window.enemyMotion;h.selectEnemy(name);h.select(mode);h.setView('oblique');h.draw(time)},{name,mode,time});await page.screenshot({path:`${out}/${name}/${mode}.png`})}
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:`${out}/${name}/mobile.png`});await page.setViewportSize({width:960,height:540});
 }
 assert.deepEqual(errors,[]);
 const before=JSON.parse(readFileSync(out+'/before-hashes.json','utf8')),changed=[];
 for(const [p,hash] of Object.entries(before)){if(createHash('sha256').update(readFileSync(p)).digest('hex')!==hash)changed.push(p)}
 assert.deepEqual(changed,[]);writeFileSync(out+'/preservation.json',JSON.stringify({checked:Object.keys(before).length,changed,pass:true},null,2));
 writeFileSync(out+'/checks.json',JSON.stringify({pass:true,errors,results},null,2));console.log('PASS',results);
}finally{await browser.close()}
