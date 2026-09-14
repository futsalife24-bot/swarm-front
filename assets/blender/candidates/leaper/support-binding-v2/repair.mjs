// Reproducible post-export fix: remove two orphaned halo supports only.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const source=readFileSync('public/assets/enemies/leaper_motion_v1.glb');
const size=source.readUInt32LE(12),g=JSON.parse(source.subarray(20,20+size)),bin=28+size;
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(source),'3b0f46e012b0d1eebe3db54dc1e7fe85b0f90f901081d5dad8139c30cb0b57f0');
const skin=g.skins[0],joint=name=>skin.joints.findIndex(i=>g.nodes[i].name===name);
function accessor(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],n={VEC3:3,VEC4:4}[a.type],bytes={5121:1,5123:2,5126:4}[a.componentType];return {a,n,bytes,start:bin+(v.byteOffset||0)+(a.byteOffset||0),stride:v.byteStride||n*bytes}}
const p=g.meshes.flatMap(m=>m.primitives).find(p=>g.materials[p.material].name==='HOUND_edge_metal');
const pos=accessor(p.attributes.POSITION),joints=accessor(p.attributes.JOINTS_0),weights=accessor(p.attributes.WEIGHTS_0);
assert.equal(pos.a.componentType,5126);assert.equal(weights.a.componentType,5126);assert.ok([5121,5123].includes(joints.a.componentType));
const readJoint=joints.bytes===1?'readUInt8':'readUInt16LE';
const repaired=[];
for(const [name,center] of [['front_L_upper',[-.215,1.265,.325]],['front_R_upper',[.475,1.22,.445]]]){
 const ids=[];let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pos.a.count;i++){
  const xyz=[0,1,2].map(k=>source.readFloatLE(pos.start+i*pos.stride+k*4));
  if(xyz[2]<=0||source[readJoint](joints.start+i*joints.stride)!==joint(name))continue;
  assert.equal(source.readFloatLE(weights.start+i*weights.stride),1);
  for(let k=1;k<4;k++)assert.equal(source.readFloatLE(weights.start+i*weights.stride+k*4),0);
  ids.push(i);xyz.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v)});
 }
 assert.equal(ids.length,96);center.forEach((v,k)=>assert.ok(Math.abs((min[k]+max[k])/2-v)<1e-5));
 repaired.push({part:name==='front_L_upper'?'ring_support_L':'ring_support_R',incorrectBone:name,vertices:ids.length,center,ids});
}
const removed=new Set(repaired.flatMap(r=>r.ids));
const index=g.accessors[p.indices],view=g.bufferViews[index.bufferView],bytes={5123:2,5125:4}[index.componentType];
assert.ok(bytes);const start=(view.byteOffset||0)+(index.byteOffset||0),read=bytes===2?'readUInt16LE':'readUInt32LE',write=bytes===2?'writeUInt16LE':'writeUInt32LE';
const binary=Buffer.from(source.subarray(bin)),keep=[];let removedTriangles=0;
for(let i=0;i<index.count;i+=3){
 const triangle=[0,1,2].map(k=>binary[read](start+(i+k)*bytes));
 if(triangle.some(v=>removed.has(v))){assert.ok(triangle.every(v=>removed.has(v)));removedTriangles++}
 else keep.push(...triangle);
}
assert.ok(removedTriangles>0);keep.forEach((v,i)=>binary[write](v,start+i*bytes));
const originalCount=index.count;index.count=keep.length;
// Only the target primitive's indices/count change; all vertex, skin, texture,
// animation and other primitive bytes are preserved exactly.
for(let i=0;i<binary.length;i++)if(binary[i]!==source[bin+i])assert.ok(i>=start&&i<start+keep.length*bytes);
let json=Buffer.from(JSON.stringify(g));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,binHeader,binary]);
const dir='assets/blender/candidates/leaper/support-binding-v2';
writeFileSync(`${dir}/leaper_motion_v2.glb`,output);
writeFileSync(`${dir}/binding-checks.json`,JSON.stringify({pass:true,before:hash(source),after:hash(output),removedTriangles,originalCount,retainedCount:keep.length,repaired},null,2));
console.log(JSON.stringify({pass:true,before:hash(source),after:hash(output),removedTriangles}));
