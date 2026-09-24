import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const load=async(version)=>{
 const bytes=fs.readFileSync(`assets/blender/candidates/harrow/${version}/harrow.glb`);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
 return {...gltf,meshes,sha256:createHash('sha256').update(bytes).digest('hex')};
};
const old=await load('v8'), next=await load('v9');
assert.equal(next.meshes.length,old.meshes.length);
let attributes=0,values=0;
for(let i=0;i<old.meshes.length;i++){
 const a=old.meshes[i],b=next.meshes[i];assert.equal(a.name,b.name);
 assert.deepEqual(a.bindMatrix.elements,b.bindMatrix.elements);
 assert.deepEqual(a.matrixWorld.elements,b.matrixWorld.elements);
 assert.deepEqual(a.geometry.index.array,b.geometry.index.array);
 for(const key of Object.keys(a.geometry.attributes)){
  assert.deepEqual(a.geometry.attributes[key].array,b.geometry.attributes[key].array,`${a.name}/${key}`);attributes++;
 }
 const material=m=>({name:m.name,color:m.color.toArray(),emissive:m.emissive.toArray(),metalness:m.metalness,roughness:m.roughness,opacity:m.opacity,side:m.side});
 assert.deepEqual(material(a.material),material(b.material));
}
const unchanged=[];
for(const a of old.animations){
 const b=next.animations.find(c=>c.name===a.name);assert.ok(b);
 if(a.name==='Spin'){assert.equal(b.duration,3);continue;}
 assert.equal(a.duration,b.duration,a.name);assert.equal(a.tracks.length,b.tracks.length,a.name);
 for(let i=0;i<a.tracks.length;i++){
  const x=a.tracks[i],y=b.tracks[i];assert.equal(x.name,y.name);
  assert.deepEqual(x.times,y.times,`${a.name}/${x.name}/times`);
  assert.deepEqual(x.values,y.values,`${a.name}/${x.name}/values`);values+=x.values.length;
 }
 unchanged.push({name:a.name,duration:a.duration,tracks:a.tracks.length});
}
const report={previousSha256:old.sha256,sha256:next.sha256,method:'Exact typed-array equality, not approximate pose sampling',meshes:old.meshes.length,attributes,animationValuesCompared:values,unchangedClips:unchanged};
fs.writeFileSync('dist-validation/harrow-v9/v8-unchanged.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
