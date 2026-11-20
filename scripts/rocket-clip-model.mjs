// 数値だけの隔離試作。実Renderer・当たり判定・通信は変更しない。
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';

const input=JSON.parse(await fs.readFile('docs/evidence/weapon-models-20261111/rocket-projectile-ui-report.json','utf8'));
const geometry=new T.IcosahedronGeometry(1,0),points=geometry.attributes.position;
function values(record,planeShift=0){
 const q=record.projectile,dir=new T.Vector3(q.dx,q.dy,q.dz).normalize();
 const muzzle=new T.Vector3(...record.muzzle).addScaledVector(dir,planeShift);
 const make=(zScale,forward)=>{
  const object=new T.Object3D();object.position.set(q.x,q.y,q.z).addScaledVector(dir,forward);
  object.scale.set(.2,.2,.65*zScale);object.rotation.set(-Math.atan2(q.dy,Math.hypot(q.dx,q.dz)),Math.atan2(q.dx,q.dz),0,'YXZ');object.updateMatrix();
  const projections=[];for(let i=0;i<points.count;i++)projections.push(new T.Vector3().fromBufferAttribute(points,i).applyMatrix4(object.matrix).sub(muzzle).dot(dir));
  return {min:Math.min(...projections),max:Math.max(...projections)};
 };
 const original=make(1,0),min=original.min,max=original.max;
 if(max<=0)return {planeShift,original,hidden:true};
 if(min>=0)return {planeShift,original,scaled:original,scale:1,forward:0};
 const scale=max/(max-min),forward=-min/2,scaled=make(scale,forward);
 assert.ok(Math.abs(scaled.min)<1e-5,'後端は平面に乗る');
 assert.ok(Math.abs(scaled.max-original.max)<1e-5,'先端の位置は同じ');
 return {planeShift,original,scaled,scale,forward};
}
const rows=input.records.map(r=>({kind:r.kind,baseline:values(r),muzzleForward20cm:values(r,.2),muzzleBackward20cm:values(r,-.2)}));
const heavy=rows.find(r=>r.kind==='heavy'),rocket=rows.find(r=>r.kind==='rocket');
assert.ok(heavy.baseline.scale<1&&heavy.baseline.scale>0);
assert.ok(rocket.muzzleForward20cm.scale<1,'全弾に適用すると既存RL-2にも影響');
// The legal 8-step RL-9 speed modification yields the same speed as base RL-2.
const speedExample={heavyBase:20,heavySpeedMod:8,heavyResult:20*(1+8*.05),rocketBase:28};
assert.equal(speedExample.heavyResult,speedExample.rocketBase);
const result={scope:'Geometric reconstruction of two captured first frames only. Axial scaling is a visual approximation, not a polygon clip or an actual game rendering. Moving muzzle examples modify the comparison plane hypothetically. No gameplay, network, real device, body collision, animation, or quality claim.',rows,speedExample};
await fs.mkdir('dist-validation/rocket-clip-model',{recursive:true});
await fs.writeFile('dist-validation/rocket-clip-model/report.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
