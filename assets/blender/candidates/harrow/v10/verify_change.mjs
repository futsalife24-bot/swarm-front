import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
const here=path.dirname(fileURLToPath(import.meta.url));
async function load(version){const b=fs.readFileSync(path.join(here,'..',version,'harrow.glb'));return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const old=await load('v9'),now=await load('v10');
const meshes=g=>{const map=new Map();g.scene.traverse(o=>{if(o.isSkinnedMesh)map.set(o.name,o);});return map;};
const before=meshes(old),after=meshes(now);let preserved=0,changed=0;
for(const [name,m] of before){const n=after.get(name);assert(n,name);if(name.startsWith('Unified')){changed++;continue;}
 for(const attr of Object.keys(m.geometry.attributes))assert.deepEqual(n.geometry.attributes[attr].array,m.geometry.attributes[attr].array,`${name} ${attr}`);
 assert.deepEqual(n.geometry.index?.array,m.geometry.index?.array,`${name} faces`);preserved++;
}
assert.equal(changed,3);assert.equal(preserved,183);
let degenerateBodyFaces=0;
const a=new Vector3(),b=new Vector3(),c=new Vector3();
for(const [name,m] of after){for(const attr of Object.values(m.geometry.attributes))assert(Array.from(attr.array).every(Number.isFinite),`${name} finite attributes`);if(!name.startsWith('Unified'))continue;const p=m.geometry.attributes.position,index=m.geometry.index;
 for(let i=0;i<(index?.count??p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-20)degenerateBodyFaces++;}}
assert.equal(degenerateBodyFaces,0,'No zero-area body triangles');
const preservedClips=[];
for(const c of old.animations){if(['Flight','AirThreat'].includes(c.name))continue;const n=now.animations.find(a=>a.name===c.name);assert.equal(n.duration,c.duration);assert.equal(n.tracks.length,c.tracks.length);
 for(let i=0;i<c.tracks.length;i++){assert.equal(n.tracks[i].name,c.tracks[i].name);assert.deepEqual(n.tracks[i].times,c.tracks[i].times);assert.equal(n.tracks[i].values.length,c.tracks[i].values.length);for(let j=0;j<c.tracks[i].values.length;j++)assert(Math.abs(n.tracks[i].values[j]-c.tracks[i].values[j])<1e-5,`${c.name} ${c.tracks[i].name}`);}preservedClips.push(c.name);}
const build=JSON.parse(fs.readFileSync(path.join(here,'build-report.json'),'utf8'));
for(const [side,schedule] of Object.entries(build.wing_schedules)){assert.equal(schedule.length,side==='.L'?7:5);assert(new Set(schedule.map(s=>s[1].toFixed(3))).size>3);assert(Math.max(...schedule.map(s=>s[1]))/Math.min(...schedule.map(s=>s[1]))>1.25);assert(Math.abs(schedule.at(-1)[0]+schedule.at(-1)[1]-16.8)<1e-8);}
const flight=now.animations.find(c=>c.name==='Flight');assert(Math.abs(flight.duration-16.8)<1e-5);
for(const tr of flight.tracks.filter(t=>t.name.startsWith('Torso.'))){for(let i=tr.getValueSize();i<tr.values.length;i++)assert(Math.abs(tr.values[i]-tr.values[i%tr.getValueSize()])<1e-6,'Core-supported torso stays steady');}
const report={glb_sha256:createHash('sha256').update(fs.readFileSync(path.join(here,'harrow.glb'))).digest('hex'),unchanged_non_body_meshes:preserved,body_primitives:changed,degenerate_body_faces:degenerateBodyFaces,unchanged_clips:preservedClips,flight_seconds:flight.duration,independent_cycle_counts:[7,5],steady_torso:true};
const out=path.resolve(here,'../../../../../dist-validation/harrow-v10');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'change-check.json'),JSON.stringify(report,null,2));console.log(report);
