import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const dir='assets/blender/candidates/foundry-zero/segmented-v1';
const base=process.argv[2]??'http://127.0.0.1:5199';
mkdirSync(`${dir}/review`,{recursive:true});
const bytes=readFileSync(`${dir}/foundry_zero_segmented_v1.glb`);
const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const previewBytes=readFileSync(`${dir}/foundry_zero_articulation_preview.glb`);
const previewDoc=JSON.parse(previewBytes.subarray(20,20+previewBytes.readUInt32LE(12)).toString());
const binary={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
  meshes:doc.meshes.length,primitives:doc.meshes.reduce((n,m)=>n+m.primitives.length,0),
  triangles:doc.meshes.reduce((n,m)=>n+m.primitives.reduce((v,p)=>v+doc.accessors[p.indices].count/3,0),0),
  materials:doc.materials.length,nodes:doc.nodes.length,skins:doc.skins?.length??0,
  animations:doc.animations?.length??0,previewAnimations:previewDoc.animations?.map(a=>a.name)};
assert.equal(binary.skins,0);assert.equal(binary.animations,0);assert.deepEqual(binary.previewAnimations,['ArticulationPreview']);
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/${dir}/index.html`);await page.waitForFunction(()=>window.foundryCandidate?.ready);
  await page.evaluate(()=>window.foundryCandidate.setPlaying(false));
  const geometry=await page.evaluate(async()=>{
    const T=await import('/node_modules/three/build/three.module.js');
    const h=window.foundryCandidate;h.select('neutral');h.draw(0);const asset=h.neutral.scene;
    const units=Array.from({length:8},(_,i)=>asset.getObjectByName(i?`FZ_BODY_${String(i).padStart(2,'0')}`:'FZ_HEAD'));
    const root=asset.getObjectByName('FOUNDRY_ZERO_ROOT');const legs=[],meshes=[];
    asset.traverse(o=>{if(/_LEG_[LR][123]$/.test(o.name))legs.push(o);if(o.isMesh)meshes.push(o)});
    const bounds=new T.Box3().setFromObject(asset),result={unitNames:units.map(u=>u?.name),unitParentNames:units.map(u=>u?.parent?.name),legs:legs.length,
      meshes:meshes.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},unitTranslations:units.map(u=>u.position.toArray()),
      connectorPivot:asset.getObjectByName('FZ_BODY_01_CONNECTOR').position.toArray(),positiveDeterminants:meshes.every(o=>o.matrixWorld.determinant()>0),
      mainBoneCount:0,maxFootDrift:0,maxUpperJointGap:0,maxLowerJointGap:0,previewMinY:Infinity,nonfinite:0,clipDuration:h.clip.duration,drawCalls:h.renderer.info.render.calls};
    const v=new T.Vector3(),end=new T.Vector3(),foot=new T.Vector3();
    result.combatLasers=[];
    for(let i=0;i<units.length;i++){
      const unit=units[i],pivot=unit.getObjectByName(i?unit.name+'_LASER':'FZ_HEAD_CENTRAL_LASER');
      const muzzle=unit.getObjectByName(i?unit.name+'_LASER_MUZZLE':'FZ_HEAD_CENTRAL_MUZZLE');
      if(!pivot||!muzzle)throw new Error('Missing combat laser for '+unit.name);
      muzzle.getWorldPosition(v);const before=v.clone();const rest=pivot.quaternion.clone();
      pivot.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),new T.Vector3(.7,.2,-.5).normalize());
      asset.updateMatrixWorld(true);muzzle.getWorldPosition(v);
      const aimOriginDrift=v.distanceTo(before);
      pivot.quaternion.copy(rest);asset.updateMatrixWorld(true);
      const direction=new T.Vector3(0,0,-1),ray=new T.Raycaster(before.clone().addScaledVector(direction,.005),direction,0,.12);
      const forwardOccluders=ray.intersectObject(unit,true).map(hit=>({name:hit.object.name,distance:hit.distance}));
      result.combatLasers.push({unit:unit.name,pivot:pivot.name,muzzle:muzzle.name,unitLocal:pivot.position.toArray(),muzzleLocal:muzzle.position.toArray(),aimOriginDrift,forwardOccluders});
    }
    h.select('flex');
    for(let frame=0;frame<=240;frame++){
      const t=frame/60;h.mixer.setTime(t);h.preview.scene.updateMatrixWorld(true);
      if(frame%4===0)h.preview.scene.traverse(o=>{if(!o.isMesh)return;const ps=o.geometry.attributes.position;for(let i=0;i<ps.count;i++){v.fromBufferAttribute(ps,i).applyMatrix4(o.matrixWorld);result.previewMinY=Math.min(result.previewMinY,v.y);if(!Number.isFinite(v.x+v.y+v.z))result.nonfinite++}});
      for(const leg of legs){
        const originalUpper=asset.getObjectByName(leg.name+'_UPPER'),originalLower=asset.getObjectByName(leg.name+'_LOWER'),originalFoot=asset.getObjectByName(leg.name+'_FOOT');
        const upper=h.preview.scene.getObjectByName(leg.name+'_UPPER'),lower=h.preview.scene.getObjectByName(leg.name+'_LOWER'),toe=h.preview.scene.getObjectByName(leg.name+'_FOOT');
        originalFoot.getWorldPosition(foot);toe.getWorldPosition(v);if(v.distanceTo(foot)>result.maxFootDrift){result.maxFootDrift=v.distanceTo(foot);result.worstFoot={frame,name:toe.name,actual:v.toArray(),expected:foot.toArray(),unitPosition:toe.parent.parent.position.toArray()}};
        end.copy(originalLower.position).sub(originalUpper.position);upper.localToWorld(end);lower.getWorldPosition(v);result.maxUpperJointGap=Math.max(result.maxUpperJointGap,end.distanceTo(v));
        end.copy(originalFoot.position).sub(originalLower.position);lower.localToWorld(end);toe.getWorldPosition(v);result.maxLowerJointGap=Math.max(result.maxLowerJointGap,end.distanceTo(v));
      }
    }
    h.select('neutral');h.draw(0);return result;
  });
  writeFileSync(`${dir}/browser-validation-latest.json`,JSON.stringify({binary,geometry,errors},null,2));
  // glTF loader can expose multi-material Blender objects as Groups. Object contract survives.
  assert.deepEqual(geometry.unitNames,['FZ_HEAD',...Array.from({length:7},(_,i)=>`FZ_BODY_${String(i+1).padStart(2,'0')}`)]);
  assert.ok(geometry.unitParentNames.every(n=>n==='FOUNDRY_ZERO_ROOT'));
  assert.equal(geometry.legs,34);assert.equal(geometry.nonfinite,0);assert.ok(geometry.positiveDeterminants);
  assert.ok(Math.abs(geometry.bounds.min[1])<.0001);assert.ok(geometry.previewMinY>=-.006);
  assert.ok(geometry.maxFootDrift<.008,`foot drift ${geometry.maxFootDrift}`);
  assert.ok(geometry.maxUpperJointGap<.008,`upper joint gap ${geometry.maxUpperJointGap}`);
  assert.ok(geometry.maxLowerJointGap<.008,`lower joint gap ${geometry.maxLowerJointGap}`);
  assert.ok(Math.abs(geometry.clipDuration-4)<.0001);
  assert.equal(geometry.combatLasers.length,8);
  for(const [i,laser] of geometry.combatLasers.entries()){
    assert.ok(laser.aimOriginDrift<.00001);
    assert.deepEqual(laser.forwardOccluders,[],`Muzzle opening obstructed: ${laser.unit}`);
    assert.ok(laser.muzzleLocal.every(v=>Math.abs(v)<.00001));
    const expected=i?[0,2.68,-.62]:[0,1.65,-1.66];assert.ok(laser.unitLocal.every((v,j)=>Math.abs(v-expected[j])<.00001));
  }
  for(const view of ['oblique','side','front','rear','top','head','body','game']){
    await page.evaluate(view=>{const h=window.foundryCandidate;h.select('neutral');h.setView(view);h.draw(0)},view);
    await page.screenshot({path:`${dir}/review/${view}.png`});
  }
  await page.evaluate(()=>{const h=window.foundryCandidate;h.setView('oblique');h.setMono(true);h.draw(0)});
  await page.screenshot({path:`${dir}/review/silhouette.png`});
  await page.evaluate(()=>{const h=window.foundryCandidate;h.setMono(false);h.setSplit(true);h.draw(0)});
  await page.screenshot({path:`${dir}/review/separated.png`});
  await page.evaluate(()=>{const h=window.foundryCandidate;h.setSplit(false);h.select('flex');h.draw(1.1)});
  await page.screenshot({path:`${dir}/review/flex.png`});
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{const h=window.foundryCandidate;h.select('neutral');h.setView('oblique');h.draw(0)});
  await page.screenshot({path:`${dir}/review/mobile.png`});
  assert.deepEqual(errors,[]);
  const report={binary,geometry,browserErrors:errors,method:'Exported GLB reloaded by native GLTFLoader; AnimationMixer sampled at 60Hz over one 4s loop. Static and movement review PNGs saved.',
    limits:['Draw calls measured in dedicated two-asset preview with shadows; not an integrated performance result','No real mobile FPS or thermals measured','No combat behavior or head/body collision compatibility is asserted']};
  writeFileSync(`${dir}/browser-validation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
