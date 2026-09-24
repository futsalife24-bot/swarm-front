import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const source = "assets/blender/candidates/harrow/v6/harrow.glb";
const bytes = fs.readFileSync(source),
  g = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
g.scene.rotation.y = -Math.PI / 2;
g.scene.updateMatrixWorld(true);
const meshes = [];
g.scene.traverse((o) => {
  if (o.isSkinnedMesh) meshes.push(o);
});
const mixer = new T.AnimationMixer(g.scene),
  p = new T.Vector3(),
  report = {
    meshes: meshes.length,
    bones: meshes[0].skeleton.bones.length,
    clips: [],
  };
assert.equal(meshes.length, 186);
assert.equal(report.bones, 39);
assert.equal(g.animations.length, 11);
for (const clip of g.animations) {
  const samples = [];
  mixer.stopAllAction();
  const a = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
  a.clampWhenFinished = true;
  a.play();
  for (const fraction of [0, 0.222222, 0.5, 0.777778, 1]) {
    mixer.setTime(clip.duration * fraction);
    g.scene.updateMatrixWorld(true);
    const box = new T.Box3(),
      wings = { L: new T.Box3(), R: new T.Box3() };
    let lowestMesh = "";
    for (const m of meshes) {
      m.skeleton.update();
      for (let i = 0; i < m.geometry.attributes.position.count; i++) {
        p.fromBufferAttribute(m.geometry.attributes.position, i);
        m.applyBoneTransform(i, p).applyMatrix4(m.matrixWorld);
        assert.ok(Number.isFinite(p.lengthSq()));
        if (p.y < box.min.y) lowestMesh = m.name;
        box.expandByPoint(p);
        if (m.name.startsWith("Wing") || m.name.startsWith("Launcher")) {
          const side = m.name.split("__")[0].endsWith("L") ? "L" : "R";
          wings[side].expandByPoint(p);
        }
      }
    }
    samples.push({
      t: clip.duration * fraction,
      min: box.min.toArray(),
      max: box.max.toArray(),
      lowestMesh,
      wingMinY: { L: wings.L.min.y, R: wings.R.min.y },
    });
  }
  report.clips.push({ name: clip.name, duration: clip.duration, samples });
}
fs.writeFileSync(
  "dist-validation/harrow/v6-asset.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    report.clips.map((c) => ({
      name: c.name,
      minY: Math.min(...c.samples.map((s) => s.min[1])),
      maxWingMinY: Math.max(...c.samples.map((s) => s.wingMinY.L)),
      minWingMinY: Math.min(...c.samples.map((s) => s.wingMinY.L)),
    })),
    null,
    2,
  ),
);
