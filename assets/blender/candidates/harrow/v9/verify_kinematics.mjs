import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const bytes = fs.readFileSync("assets/blender/candidates/harrow/v9/harrow.glb");
const g = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
g.scene.rotation.y = -Math.PI / 2;
const mixer = new T.AnimationMixer(g.scene);
const meshes = [];
g.scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
const skeleton = meshes[0].skeleton;
const scale = 1.95;
const setPose = (name, t) => {
  mixer.stopAllAction();
  const action = mixer.clipAction(g.animations.find(c => c.name === name)).reset().setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play(); mixer.setTime(t); g.scene.updateMatrixWorld(true); skeleton.update();
};
const report = {sha256: createHash("sha256").update(bytes).digest("hex"), scale, authorSpeed: .64 / scale, worldSpeed: .64, walkPeriod: 4.2, stanceFraction: .72, flight: {}, spin: {}, walk: {maxPlantedWorldDisplacement: 0, samples: 0, legs: []}};
const phase = { ForelimbL3: 0, HindlimbR3: .25, ForelimbR3: .5, HindlimbL3: .75 };
const bones = Object.entries(phase).map(([name, offset]) => {
  const bone = skeleton.bones.find(b => b.name.replaceAll(".", "").replaceAll("_", "") === name);
  assert.ok(bone, name); report.walk.legs.push(bone.name); return {bone, offset, previous: null};
});
for (let frame = 0; frame <= 168; frame++) {
  const t = frame / 40; setPose("Locomotion", t);
  for (const leg of bones) {
    const p = leg.bone.getWorldPosition(new T.Vector3()).multiplyScalar(scale);
    p.z -= .64 * t;
    const phase = (t / 4.2 + leg.offset) % 1;
    if (leg.previous && phase < .72 && leg.previous.phase < phase) {
      const displacement = leg.previous.p.distanceTo(p);
      report.walk.maxPlantedWorldDisplacement = Math.max(report.walk.maxPlantedWorldDisplacement, displacement);
      report.walk.samples++;
    }
    leg.previous = {p, phase};
  }
}
assert.ok(report.walk.maxPlantedWorldDisplacement < .00001, JSON.stringify(report.walk));
const p = new T.Vector3();
report.spin={duration:3,turnInterval:[1.15,2.20],authorityTurnRadians:Math.PI*2,rootYawBaked:false,samples:[],minimumY:Infinity,maxCoreDistance:0};
for(let frame=0;frame<=120;frame++){
const time=frame/40;setPose("Spin",time);
const wings = {L: {minY: Infinity, maxRadius: 0, lowWingRadius: 0}, R: {minY: Infinity, maxRadius: 0, lowWingRadius: 0}};
for (const mesh of meshes) {
 const isWing=/^(Wing|Launcher)/.test(mesh.name);
  const side = mesh.name.split("__")[0].endsWith("L") ? "L" : "R";
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    p.fromBufferAttribute(mesh.geometry.attributes.position, i);
    mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
    report.spin.minimumY=Math.min(report.spin.minimumY,p.y);
    if(mesh.name.startsWith('Unified')){
      const torso=skeleton.bones.findIndex(b=>b.name==='Torso');let weight=0;
      for(let j=0;j<4;j++)if(mesh.geometry.attributes.skinIndex.getComponent(i,j)===torso)weight+=mesh.geometry.attributes.skinWeight.getComponent(i,j);
      if(weight>=.95)report.spin.maxCoreDistance=Math.max(report.spin.maxCoreDistance,p.distanceTo(new T.Vector3(0,8.19,0)));
    }
    if(!isWing)continue;
    const r = Math.hypot(p.x, p.z), wing = wings[side];
    if (p.y < wing.minY) {wing.minY = p.y; wing.contactPoint = p.toArray();}
    wing.maxRadius = Math.max(wing.maxRadius, r);
    if (p.y < 2) wing.lowWingRadius = Math.max(wing.lowWingRadius, r);
  }
}
report.spin.samples.push({time,wings});
}
report.spin.activeLowRadiusMin=Math.min(...report.spin.samples.filter(s=>s.time>=1.15&&s.time<=2.2).flatMap(s=>Object.values(s.wings).map(w=>w.lowWingRadius)));
assert.ok(report.spin.activeLowRadiusMin>=21.2,'low wing sweep preserves the established physical reach throughout the turn');
assert.ok(report.spin.minimumY>-.004,JSON.stringify({minimumY:report.spin.minimumY}));
assert.ok(report.spin.maxCoreDistance<6.63,'ground spin body core stays hittable');
const flightBounds = new T.Box3();
for (let frame = 0; frame <= 168; frame += 4) {
  setPose("Flight", frame / 40);
  for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    p.fromBufferAttribute(mesh.geometry.attributes.position, i);
    mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
    flightBounds.expandByPoint(p);
  }
}
report.flight = {min: flightBounds.min.toArray(), max: flightBounds.max.toArray(), center: flightBounds.getCenter(new T.Vector3()).toArray(), size: flightBounds.getSize(new T.Vector3()).toArray(), sampleHz:10};
report.airborneBody = {};
const torsoIndex=skeleton.bones.findIndex(b=>b.name==='Torso');
for (const clipName of ['Flight','AirThreat']) {
  const core=new T.Box3(), whole=new T.Box3();
  const clip=g.animations.find(c=>c.name===clipName);
  let coreVertices=0, sphereMisses=0, maxCoreDistance=0;
  const oldBodySphere=new T.Vector3(0,8.19,0);
  for (let frame=0;frame<=Math.round(clip.duration*10);frame++) {
    setPose(clipName,Math.min(clip.duration,frame/10));
    for (const mesh of meshes) for (let i=0;i<mesh.geometry.attributes.position.count;i++) {
      p.fromBufferAttribute(mesh.geometry.attributes.position,i);
      mesh.applyBoneTransform(i,p).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
      whole.expandByPoint(p);
      if (!mesh.name.startsWith('Unified')) continue;
      let torsoWeight=0;
      for (let j=0;j<4;j++) if(mesh.geometry.attributes.skinIndex.getComponent(i,j)===torsoIndex) torsoWeight+=mesh.geometry.attributes.skinWeight.getComponent(i,j);
      if(torsoWeight<.95) continue;
      core.expandByPoint(p);coreVertices++;
      const dist=p.distanceTo(oldBodySphere);maxCoreDistance=Math.max(maxCoreDistance,dist);
      if(dist>6.63)sphereMisses++;
    }
  }
  assert.ok(coreVertices>0);
  const describe=b=>({min:b.min.toArray(),max:b.max.toArray(),center:b.getCenter(new T.Vector3()).toArray(),size:b.getSize(new T.Vector3()).toArray()});
  report.airborneBody[clipName]={method:'Unified torso/neck mesh vertices with Torso weight >= .95, excluding neck influence, wings, limbs and tail; scale 1.95 and neutral game heading',core:describe(core),whole:describe(whole),coreVertices,maxCoreDistanceFromPreviousBodySphere:maxCoreDistance,verticesOutsidePreviousBodySphere:sphereMisses};
}
fs.writeFileSync("dist-validation/harrow-v9/kinematics.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
