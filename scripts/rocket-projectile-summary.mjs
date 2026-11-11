// Combine unaltered captured frames for review; numbers are separate observations.
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import * as T from 'three';
const dir='dist-validation/rocket-projectile-ui-probe';
const input=JSON.parse(await fs.readFile(dir+'/report.json','utf8'));
const rows=[];
for(const r of input.records){
 const q=r.initial.projectile,draw=r.projectile,velocity=new T.Vector3(q.dx,q.dy,q.dz),axis=velocity.clone().normalize(),muzzle=new T.Vector3(...r.muzzle);
 const delta=new T.Vector3(draw.x-q.x,draw.y-q.y,draw.z-q.z),shot=r.shot;
 const geo=new T.IcosahedronGeometry(1,0),dummy=new T.Object3D();
 dummy.position.set(draw.x,draw.y,draw.z);dummy.scale.set(.2,.2,.65);
 dummy.rotation.set(-Math.atan2(draw.dy,Math.hypot(draw.dx,draw.dz)),Math.atan2(draw.dx,draw.dz),0,'YXZ');dummy.updateMatrix();
 const pos=geo.attributes.position,along=[];
 for(let i=0;i<pos.count;i++)along.push(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(dummy.matrix).sub(muzzle).dot(axis));
 const barrel=new T.Vector3(...r.barrel).normalize(),angle=T.MathUtils.radToDeg(barrel.angleTo(axis));
 rows.push({kind:r.kind,worldTimeAtInsertion:r.initial.worldTime,worldTimeAtDraw:r.worldTime,
  initial:[q.x,q.y,q.z],shotPosition:[shot.x,shot.y,shot.z],initialShotGap:Math.hypot(q.x-shot.x,q.y-shot.y,q.z-shot.z),
  travelMetres:delta.length(),travelTimeFromVelocity:delta.dot(velocity)/velocity.lengthSq(),
  centreAlong:r.alongMetres,sideFromMuzzleAxis:r.sideMetres,
  screenCentreGapPixels:Math.hypot(r.muzzleScreen[0]-r.projectileScreen[0],r.muzzleScreen[1]-r.projectileScreen[1]),
  barrelVelocityAngleDegrees:angle,meshStateDifference:r.meshStateDifference,
  meshExtentAlongMeasured:[r.meshVertexAlongMin,r.meshVertexAlongMax],meshExtentAlongReconstructed:[Math.min(...along),Math.max(...along)],errors:r.errors,warnings:r.warnings});
 geo.dispose();
}
await fs.writeFile(dir+'/summary.json',JSON.stringify({scope:'First actual renderer frames plus numerical measurements. Mesh projected extent uses actual renderer geometry and instance matrix; reconstructed value is a cross-check. Projection is not a collision or visibility test. No network, phone, multiple aims or complete flight.',rows},null,2));
const cells=await Promise.all(rows.map(async r=>{
 const b64=(await fs.readFile(`${dir}/${r.kind}-first.png`)).toString('base64'),name=r.kind==='rocket'?'RL-2 コメット':'RL-9 メテオ';
 const mm=(x)=>Math.abs(x*1000)<.5?'0':(x*1000).toFixed(0),p=r.screenCentreGapPixels.toFixed(1);
 return `<section><h2>${name}</h2><img src="data:image/png;base64,${b64}" alt="${name}の実ゲーム初回描画"><p>描画画像：通常の最初のフレーム（印・線の追加なし）</p><p>別途計測した弾体中心：銃口より前 ${mm(r.centreAlong)}mm、飛行軸の横 ${mm(r.sideFromMuzzleAxis)}mm</p><p>飛行方向に投影した最後端：銃口から ${mm(r.meshExtentAlongMeasured[0])}mm（交差判定ではない）</p><p>画面上の銃口と弾体中心の差 ${p}px。最初のtickで ${r.travelMetres.toFixed(1)}m 移動。</p></section>`;
}));
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#0b1922;color:#e5edf0;font:16px 'Yu Gothic UI',sans-serif}h1{font-size:22px;margin:0 0 6px}p{margin:5px 0}main{display:flex;gap:12px}section{width:560px}h2{font-size:18px}img{display:block;width:560px;height:auto}</style><body><h1>ロケット弾：初回描画と生成位置の観測</h1><p>画像は通常描画。数値は同じフレームの座標から計算した別の計測で、画像上の目視判定ではありません。</p><main>${cells.join('')}</main><p>仮保存を使ったローカル単独プレイ。実通信、実機、飛行全体と複数照準は未確認。</p></body></html>`;
const browser=await chromium.launch({channel:'chrome'});
try{const page=await browser.newPage({viewport:{width:1170,height:630},deviceScaleFactor:1});await page.setContent(html);await page.screenshot({path:dir+'/comparison.png',fullPage:true});}finally{await browser.close();}
console.log(JSON.stringify(rows.map(({kind,travelMetres,centreAlong,sideFromMuzzleAxis,screenCentreGapPixels,meshExtentAlongMeasured,meshExtentAlongReconstructed})=>({kind,travelMetres,centreAlong,sideFromMuzzleAxis,screenCentreGapPixels,meshExtentAlongMeasured,meshExtentAlongReconstructed}))));
