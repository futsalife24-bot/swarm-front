import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const dir=path.dirname(fileURLToPath(import.meta.url));
const loader=new GLTFLoader().register(()=>({name:'GEOMETRY_ONLY',loadTexture:async()=>new T.Texture()}));
async function read(name){const b=fs.readFileSync(name);return {bytes:b,asset:await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')}}
const {bytes,asset:{scene,animations}}=await read(path.join(dir,'harrow.glb'));
const old=(await read(path.join(dir,'../charakuru-20261011/harrow.glb'))).asset;
const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
assert.equal(meshes.length,22);assert.equal(meshes[0].skeleton.bones.length,39);
for(const mesh of meshes){const previous=old.scene.getObjectByName(mesh.name);assert(previous?.isSkinnedMesh);for(const name of ['position','normal','uv','skinIndex','skinWeight'])assert.deepEqual(mesh.geometry.attributes[name]?.array,previous.geometry.attributes[name]?.array,`${mesh.name}/${name} geometry changed`);assert.deepEqual(mesh.geometry.index?.array,previous.geometry.index?.array);}
const durations=JSON.parse(fs.readFileSync(path.join(dir,'build-report.json'),'utf8')).durations;
assert.deepEqual(animations.map(c=>c.name).sort(),Object.keys(durations).sort());
scene.rotation.y=-Math.PI/2;scene.updateMatrixWorld(true);
const mixer=new T.AnimationMixer(scene),root=scene.getObjectByName('Root'),v=new T.Vector3();
function pose(clip,time){mixer.stopAllAction();const a=mixer.clipAction(clip).reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(time);scene.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();}
const report={sha256:createHash('sha256').update(bytes).digest('hex'),geometryUnchanged:true,clips:{},launchers:{},limitations:'Texture decoding and visual quality require real browser inspection.'};
for(const clip of animations){
  assert(Math.abs(clip.duration-durations[clip.name])<1e-5,clip.name+' duration');
  for(const track of clip.tracks)for(const x of track.values)assert(Number.isFinite(x),clip.name+' non-finite track');
  pose(clip,0);const rootRest=root.matrix.clone();const rows=[];
  const times=[0,.25,.5,.75,1].map(t=>t*clip.duration);
  if(clip.name==='Spin')times.push(1.15,1.675,2.2);
  if(['Threat','AirThreat'].includes(clip.name))times.push(3.5);
  if(clip.name==='Snipe')times.push(2,2.72);
  if(clip.name==='BombPass')times.push(1.5,2.6,3.7);
  for(const time of [...new Set(times)].sort((a,b)=>a-b)){
    pose(clip,time);assert(root.matrix.equals(rootRest),clip.name+' root moved');
    const box=new T.Box3(),wings={};
    for(const mesh of meshes){const mb=new T.Box3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);assert(Number.isFinite(v.lengthSq()));mb.expandByPoint(v);}box.union(mb);if(mesh.name.startsWith('Wing'))wings[mesh.name]=mb.min.y*1.95;}
    if(['Idle','Locomotion','Threat','Snipe','Dash','Spin','Land'].includes(clip.name))assert(box.min.y*1.95>=-.06,`${clip.name} ${time} floor ${box.min.y*1.95}`);
    rows.push({time,min:box.min.toArray(),max:box.max.toArray(),wings});
    if((['Threat','AirThreat'].includes(clip.name)&&time===3.5)||(clip.name==='Snipe'&&time===2)||(clip.name==='BombPass'&&time===2.6)){
      const tips=[];
      for(const mesh of meshes.filter(m=>m.name.startsWith('Launcher'))){const p=mesh.geometry.attributes.position;let index=0;for(let i=1;i<p.count;i++)if(p.getY(i)>p.getY(index))index=i;mesh.getVertexPosition(index,v).applyMatrix4(mesh.matrixWorld);tips.push({mesh:mesh.name,production:v.toArray()});}
      assert.equal(tips.length,10);report.launchers[clip.name]=tips;
    }
  }
  report.clips[clip.name]=rows;
}
fs.writeFileSync(path.join(dir,'review/asset-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:true,sha256:report.sha256,geometryUnchanged:true,clips:animations.length}));
