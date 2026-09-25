import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const bytes = fs.readFileSync(
  path.join(root, "assets/blender/candidates/harrow/v10/harrow.glb"),
);
const { scene, animations } = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
scene.rotation.y = -Math.PI / 2;
scene.updateMatrixWorld(true);
const meshes = [];
scene.traverse((o) => {
  if (o.isSkinnedMesh) meshes.push(o);
});
assert.equal(
  meshes.length,
  186,
  "184 authored objects include a three-primitive body",
);
const skeleton = meshes[0].skeleton;
assert.equal(skeleton.bones.length, 39);
assert.deepEqual(
  animations.map((c) => c.name).sort(),
  [
    "Attack",
    "Idle",
    "Locomotion",
    "Threat",
    "AirThreat",
    "Spin",
    "Takeoff",
    "Flight",
    "Glide",
    "Dive",
    "StaggerFall",
    "Land",
  ].sort(),
);
for (const mesh of meshes) {
  assert.ok(
    mesh.bindMatrix.equals(meshes[0].bindMatrix),
    `${mesh.name} bind matrix`,
  );
  assert.ok(
    mesh.matrixWorld.equals(meshes[0].matrixWorld),
    `${mesh.name} world matrix`,
  );
  assert.deepEqual(
    mesh.skeleton.bones,
    skeleton.bones,
    `${mesh.name} bone order`,
  );
}
const mixer = new T.AnimationMixer(scene);
const p = new T.Vector3();
const round = (v) => v.toArray().map((n) => Number(n.toFixed(6)));
const boundsOf = (selected) => {
  const box = new T.Box3();
  for (const mesh of selected) {
    mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      p.fromBufferAttribute(mesh.geometry.attributes.position, i);
      mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld);
      assert.ok(
        Number.isFinite(p.lengthSq()),
        `${mesh.name} finite vertex ${i}`,
      );
      box.expandByPoint(p);
    }
  }
  return box;
};
const setPose = (clip, t) => {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(t);
  scene.updateMatrixWorld(true);
};
const bonePoint = (name) =>
  round(scene.getObjectByName(name).getWorldPosition(new T.Vector3()));
const socketBounds = (prefix) => {
  const box = boundsOf(meshes.filter((m) => m.name.startsWith(prefix)));
  return {
    min: round(box.min),
    max: round(box.max),
    center: round(box.getCenter(new T.Vector3())),
  };
};
const report = {
  sha256: createHash("sha256").update(bytes).digest("hex"),
  units:
    "Unscaled authored meters after game-axis Y rotation -PI/2; forward -Z",
  meshes: meshes.length,
  bones: skeleton.bones.length,
  sharedBinding: true,
  clips: [],
  sockets: [],
};
for (const clip of animations) {
  const union = new T.Box3();
  let minimumY = Infinity,
    maximumMinY = -Infinity;
  // Verify every vertex at 10 Hz, every bone at the production palette's 60 Hz.
  for (let f = 0; f <= Math.round(clip.duration * 60); f++) {
    setPose(clip, Math.min(clip.duration, f / 60));
    for (const bone of skeleton.bones)
      assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
    if (f % 6 === 0) {
      const box = boundsOf(meshes);
      minimumY = Math.min(minimumY, box.min.y);
      maximumMinY = Math.max(maximumMinY, box.min.y);
      union.union(box);
    }
  }
  const worldGroundClearance = minimumY * 1.95 + (["Flight", "AirThreat"].includes(clip.name) ? 34.5 : 0);
  if (worldGroundClearance < -0.004) console.log(`GROUND_FAIL ${clip.name} ${worldGroundClearance}`);
  if (["Idle", "Locomotion", "Attack", "Threat", "Spin"].includes(clip.name))
    assert.ok(maximumMinY < 0.002, `${clip.name} ground contact`);
  setPose(clip, 0);
  const initial = skeleton.bones.map((b) => b.matrixWorld.clone());
  setPose(clip, clip.duration);
  const loopError = Math.max(
    ...skeleton.bones.flatMap((b, j) =>
      b.matrixWorld.elements.map((n, k) =>
        Math.abs(n - initial[j].elements[k]),
      ),
    ),
  );
  if (!["Takeoff", "Land", "Dive", "StaggerFall", "Glide"].includes(clip.name))
    assert.ok(loopError < 1e-4, `${clip.name} closed loop`);
  report.clips.push({
    name: clip.name,
    duration: clip.duration,
    paletteFrames: Math.round(clip.duration * 60) + 1,
    min: round(union.min),
    max: round(union.max),
    minimumY,
    worldGroundClearance,
    maximumMinY,
    loopError,
  });
  for (const time of clip.name === "Attack"
    ? [0, 1.4175, 2.2575]
    : clip.name === "Threat"
      ? [3.5]
      : [0]) {
    setPose(clip, time);
    report.sockets.push({
      clip: clip.name,
      time,
      headBone: bonePoint("Head"),
      jawBone: bonePoint("Jaw"),
      skull: socketBounds("Skull"),
      jaw: socketBounds("Jaw"),
      prismL: socketBounds("PRISM_shoulderL"),
      prismR: socketBounds("PRISM_shoulderR"),
    });
  }
}
const out = path.join(root, "dist-validation/harrow-v10");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "asset.json"), JSON.stringify(report, null, 2));
for (const clip of report.clips) assert.ok(clip.worldGroundClearance > -.004, `${clip.name} stays above game ground: ${clip.worldGroundClearance}`);
console.log(JSON.stringify(report.clips.map(({ name, duration, minimumY, loopError }) => ({ name, duration, minimumY, loopError })), null, 2));
