import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bytes = fs.readFileSync(
  path.join(root, "public/assets/enemies/harrow_motion_v6.glb"),
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
  assert.ok(minimumY > -0.002, `${clip.name} stays above local ground plane`);
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
  if (!["Takeoff", "Land", "Dive", "StaggerFall"].includes(clip.name))
    assert.ok(loopError < 1e-4, `${clip.name} closed loop`);
  report.clips.push({
    name: clip.name,
    duration: clip.duration,
    paletteFrames: Math.round(clip.duration * 60) + 1,
    min: round(union.min),
    max: round(union.max),
    minimumY,
    maximumMinY,
    loopError,
  });
  for (const time of clip.name === "Attack"
    ? [0, 0.81, 1.29]
    : clip.name === "Threat"
      ? [2]
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
const out = path.join(root, "dist-validation/harrow");
fs.mkdirSync(out, { recursive: true });
// Exercise the actual TypeScript production adapter against the GLB over local HTTP.
const server = createServer((req, res) => {
  if (req.url !== "/assets/enemies/harrow_motion_v6.glb") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "model/gltf-binary",
    "Content-Length": bytes.length,
  });
  res.end(bytes);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, values) {
    this.type = type;
    Object.assign(this, values);
  }
};
try {
  const bundled = path.join(out, "production-motion.mjs");
  await build({
    entryPoints: [path.join(root, "src/client/hound-motion.ts")],
    outfile: bundled,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    define: {
      "import.meta.env.BASE_URL": JSON.stringify(
        `http://127.0.0.1:${server.address().port}/`,
      ),
    },
  });
  const { loadEnemyMotion, HoundMotionBatch } = await import(
    pathToFileURL(bundled).href
  );
  const asset = await loadEnemyMotion("harrow");
  assert.equal(asset.bones, 39);
  assert.equal(
    asset.meshes.reduce(
      (n, mesh) => n + mesh.geometry.attributes.position.count,
      0,
    ),
    meshes.reduce((n, mesh) => n + mesh.geometry.attributes.position.count, 0),
    "material merging preserves vertices",
  );
  const actualIndices = asset.meshes.reduce(
    (n, mesh) => n + mesh.geometry.index.count,
    0,
  );
  assert.equal(
    actualIndices,
    meshes.reduce((n, mesh) => n + mesh.geometry.index.count, 0),
    "material merging preserves triangles",
  );
  let paletteError = 0;
  const palette = asset.atlas.image.data,
    mat = new T.Matrix4(),
    sum = new T.Vector3(),
    q = new T.Vector3();
  for (const clip of animations) {
    const range = asset.ranges[clip.name === "Attack" ? "Lunge" : clip.name];
    for (const fraction of [0, 0.27, 0.43, 0.5, 1]) {
      const frame = Math.round(range.steps * fraction);
      setPose(clip, frame / 60);
      skeleton.update();
      for (const mesh of meshes) {
        const geo = mesh.geometry;
        for (let i = 0; i < geo.attributes.position.count; i += 37) {
          p.fromBufferAttribute(geo.attributes.position, i);
          q.copy(p);
          mesh.applyBoneTransform(i, q).applyMatrix4(mesh.matrixWorld);
          sum.set(0, 0, 0);
          for (let j = 0; j < 4; j++) {
            const weight = geo.attributes.skinWeight.getComponent(i, j);
            if (!weight) continue;
            const bone = geo.attributes.skinIndex.getComponent(i, j);
            mat.fromArray(
              palette,
              ((range.start + frame) * asset.bones + bone) * 16,
            );
            sum.addScaledVector(p.clone().applyMatrix4(mat), weight);
          }
          paletteError = Math.max(paletteError, sum.distanceTo(q));
        }
      }
    }
  }
  assert.ok(
    paletteError < 1e-4,
    `production palette matches native animation: ${paletteError}`,
  );
  const batch = new HoundMotionBatch(asset, 1);
  assert.equal(batch.parts.length, asset.meshes.length);
  batch.dispose();
  report.production = {
    drawMeshes: asset.meshes.length,
    triangles: actualIndices / 3,
    paletteError,
    rows: asset.atlas.image.height,
    bytes: palette.byteLength,
    batchCreatedAndDisposed: true,
  };
} finally {
  await new Promise((resolve) => server.close(resolve));
}
fs.writeFileSync(path.join(out, "asset.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
