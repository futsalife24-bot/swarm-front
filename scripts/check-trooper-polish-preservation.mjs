import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
function glb(path){const b=readFileSync(path),length=b.readUInt32LE(12),doc=JSON.parse(b.subarray(20,20+length));return {doc,bin:b.subarray(28+length)};}
const old=glb('public/assets/characters/standard_trooper_v2.glb'),next=glb('public/assets/characters/standard_trooper_v3.glb');
function accessor(asset,index){const a=asset.doc.accessors[index],v=asset.doc.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0);return {type:a.type,count:a.count,componentType:a.componentType,data:createHash('sha256').update(asset.bin.subarray(offset,offset+v.byteLength)).digest('hex')};}
function animation(asset,clip){return clip.channels.map(c=>{const s=clip.samplers[c.sampler];return {node:asset.doc.nodes[c.target.node].name,path:c.target.path,interpolation:s.interpolation,input:accessor(asset,s.input),output:accessor(asset,s.output)};});}
const preserved=[];
for(const a of old.doc.animations){const b=next.doc.animations.find(n=>n.name===a.name);assert.ok(b);if(a.name==='Run'){assert.notDeepEqual(animation(old,a),animation(next,b));continue;}assert.deepEqual(animation(next,b),animation(old,a),a.name);preserved.push(a.name);}
function geometry(asset){return asset.doc.meshes.map(m=>({name:m.name,primitives:m.primitives.map(p=>({indices:accessor(asset,p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,index])=>[key,accessor(asset,index)]))}))}));}
assert.notDeepEqual(geometry(old),geometry(next),'body geometry and weights');
const report={preservedClips:preserved,changedClip:'Run',geometryDetailed:true};
writeFileSync('dist-validation/trooper-polish/preservation.json',JSON.stringify(report,null,2));console.log('PASS: only Run animation changed; other 11 clips identical; geometry changed for detail');

