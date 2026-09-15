import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{
 const b=readFileSync(p),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len)),bin=b.subarray(28+len);
 const values=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],size=({SCALAR:1,VEC3:3,VEC4:4,MAT4:16})[a.type],out=[];assert.equal(a.componentType,5126);for(let k=0;k<a.count;k++)for(let c=0;c<size;c++)out.push(bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||size*4)+c*4));return out};
 return {j,values,sha:sha(b)};
};
const results=[];
for(const [oldName,newName] of [['pleat_motion_v4','pleat_motion_v5'],['hound_motion_v1','leaper_motion_v1']]){
 const a=read(`public/assets/enemies/${oldName}.glb`),b=read(`public/assets/enemies/${newName}.glb`);let maxDifference=0,samples=0;
 for(const clip of a.j.animations){
  const next=b.j.animations.find(c=>c.name===clip.name);assert.ok(next);assert.equal(next.channels.length,clip.channels.length);
  for(const ch of clip.channels){
   const name=a.j.nodes[ch.target.node].name;
   const target=next.channels.find(c=>b.j.nodes[c.target.node].name===name&&c.target.path===ch.target.path);assert.ok(target,name);
   for(const key of ['input','output']){
    const first=a.values(clip.samplers[ch.sampler][key]),second=b.values(next.samplers[target.sampler][key]);assert.equal(first.length,second.length);
    first.forEach((v,i)=>{maxDifference=Math.max(maxDifference,Math.abs(v-second[i]));samples++});
   }
  }
 }
 assert.ok(maxDifference<1e-6);
 results.push({oldName,newName,oldSha:a.sha,newSha:b.sha,samples,maxAnimationDifference:maxDifference});
}
const unchanged=[];
for(const path of ['public/assets/enemies/hound_motion_v1.glb','assets/blender/source/hound_motion_v1.blend','public/assets/enemies/pleat_motion_v4.glb']){
 const current=sha(readFileSync(path)),head=sha(execFileSync('git',['show',`HEAD:${path}`],{maxBuffer:30*1024*1024}));assert.equal(current,head,path);unchanged.push({path,sha256:current});
}
writeFileSync('dist-validation/enemy-redesign/preservation.json',JSON.stringify({pass:true,results,unchanged},null,2));console.log(JSON.stringify({pass:true,results,unchanged}));
