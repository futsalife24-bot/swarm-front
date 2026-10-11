// Geometry/animation verification only. Real browser must decode/display textures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const dir=path.dirname(fileURLToPath(import.meta.url)),buffer=fs.readFileSync(path.join(dir,'harrow.glb'));
assert.equal(buffer.toString('ascii',0,4),'glTF');
const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
const loader=new GLTFLoader().register(()=>({name:'HEADLESS_GEOMETRY_ONLY',loadTexture:async()=>new T.Texture()}));
const asset=await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
const {scene,animations}=asset;scene.rotation.y=-Math.PI/2;scene.updateMatrixWorld(true);
const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
assert.equal(meshes.length,22);assert.equal(meshes[0].skeleton.bones.length,39);
for(const m of meshes){assert(m.bindMatrix.equals(meshes[0].bindMatrix));assert(m.matrixWorld.equals(meshes[0].matrixWorld));assert.deepEqual(m.skeleton.bones,meshes[0].skeleton.bones);const w=m.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);}
const durations={Idle:7,Locomotion:4.2,Attack:5.25,Threat:7,AirThreat:7,Spin:3,Takeoff:3.5,Flight:16.8,Glide:2.1,Dive:.9,StaggerFall:2.625,Land:1.75};
assert.deepEqual(animations.map(c=>c.name).sort(),Object.keys(durations).sort());
for(const c of animations)assert(Math.abs(c.duration-durations[c.name])<1e-5,`${c.name} duration ${c.duration}`);
const mixer=new T.AnimationMixer(scene),point=new T.Vector3(),root=scene.getObjectByName('Root');assert(root);
function pose(c,t){mixer.stopAllAction();const a=mixer.clipAction(c).reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);scene.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();}
function geometry(selected){const box=new T.Box3();let floorRadius=0;for(const m of selected)for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,point).applyMatrix4(m.matrixWorld);assert(Number.isFinite(point.lengthSq()));box.expandByPoint(point);if(point.y*1.95<2)floorRadius=Math.max(floorRadius,Math.hypot(point.x,point.z)*1.95);}return {min:box.min.toArray(),max:box.max.toArray(),floorRadius};}
const report={sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,meshes:meshes.length,bones:39,images:json.images?.length,triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0),clips:{},launchers:{},limits:'Headless parser bypasses texture decoding; actual browser visual QA is required.'};
for(const c of animations){pose(c,0);const rootRest=root.matrix.clone(),samples=[];const times=[0,c.duration*.25,c.duration*.5,c.duration*.75,c.duration];if(c.name==='Spin')times.push(1.15,1.675,2.2);if(c.name==='Threat'||c.name==='AirThreat')times.push(3.5);
for(const t of [...new Set(times)].sort((a,b)=>a-b)){pose(c,t);assert(root.matrix.equals(rootRest),`${c.name} root motion`);const bounds=geometry(meshes);const sample={time:t,bounds};if(c.name==='Spin'&&t>=1.15&&t<=2.2){sample.wings={};for(const side of ['L','R']){const selected=meshes.filter(m=>m.name.startsWith('Wing')&&m.name.endsWith(side));assert(selected.length);const g=geometry(selected);sample.wings[side]=g;assert(g.min[1]*1.95>=-.004,`${side} spin floor ${g.min[1]*1.95}`);assert(g.min[1]*1.95<.1);assert(g.floorRadius>=21.2,`${side} radius ${g.floorRadius}`);}}
if((c.name==='Threat'||c.name==='AirThreat')&&t===3.5){const tips=[];for(const m of meshes.filter(m=>m.name.startsWith('Launcher'))){const pos=m.geometry.attributes.position;let index=0;for(let i=1;i<pos.count;i++)if(pos.getY(i)>pos.getY(index))index=i;m.getVertexPosition(index,point).applyMatrix4(m.matrixWorld);tips.push({mesh:m.name,production:point.toArray(),authority:[point.x*1.95,point.y*1.95,-point.z*1.95]});}assert.equal(tips.length,10);report.launchers[c.name]=tips;}
samples.push(sample);}report.clips[c.name]={duration:c.duration,samples};}
fs.writeFileSync(path.join(dir,'review','asset-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:'PASS',sha256:report.sha256,meshes:report.meshes,bones:39,triangles:report.triangles,clips:animations.length,textureDecode:'browser required'}));
