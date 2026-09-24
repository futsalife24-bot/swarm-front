import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const bytes = fs.readFileSync("assets/blender/candidates/harrow/v7/harrow.glb");
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
setPose("Spin", 3.15);
const wings = {L: {minY: Infinity, maxRadius: 0, lowWingRadius: 0}, R: {minY: Infinity, maxRadius: 0, lowWingRadius: 0}};
for (const mesh of meshes.filter(m => /^(Wing|Launcher)/.test(m.name))) {
  const side = mesh.name.split("__")[0].endsWith("L") ? "L" : "R";
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    p.fromBufferAttribute(mesh.geometry.attributes.position, i);
    mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld).multiplyScalar(scale);
    const r = Math.hypot(p.x, p.z), wing = wings[side];
    if (p.y < wing.minY) {wing.minY = p.y; wing.contactPoint = p.toArray();}
    wing.maxRadius = Math.max(wing.maxRadius, r);
    if (p.y < 2) wing.lowWingRadius = Math.max(wing.lowWingRadius, r);
  }
}
report.spin = {clipTime: 3.15, groundInterval: [1.4,4.9], authorityTurnRadians: Math.PI * 2, wings};
for (const w of Object.values(wings)) assert.ok(Math.abs(w.minY - .039) < .00001);
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
fs.writeFileSync("dist-validation/harrow-v7/kinematics.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
