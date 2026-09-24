import fs from "node:fs";
import assert from "node:assert/strict";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const b = fs.readFileSync("assets/blender/candidates/harrow/v7/harrow.glb");
const g = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  "",
);
g.scene.rotation.y = -Math.PI / 2;
const mixer = new T.AnimationMixer(g.scene);
mixer.clipAction(g.animations.find((c) => c.name === "Threat")).play();
mixer.setTime(3.5);
g.scene.updateMatrixWorld(true);
const report = [];
g.scene.traverse((mesh) => {
  if (!mesh.isSkinnedMesh || !mesh.name.startsWith("Launcher")) return;
  mesh.skeleton.update();
  const box = new T.Box3(),
    positions = [],
    geo = mesh.geometry;
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const p = new T.Vector3().fromBufferAttribute(geo.attributes.position, i);
    mesh.applyBoneTransform(i, p).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(p);
    positions.push(p.toArray());
  }
  let tips;
  if (mesh.name.includes("Carmine")) {
    const count = positions.length,
      parents = Array.from({ length: count }, (_, i) => i),
      seen = new Map();
    const find = (i) =>
      parents[i] === i ? i : (parents[i] = find(parents[i]));
    const join = (a, b) => {
      parents[find(a)] = find(b);
    };
    for (let i = 0; i < count; i++) {
      const key = positions[i].map((v) => v.toFixed(5)).join(",");
      if (seen.has(key)) join(i, seen.get(key));
      else seen.set(key, i);
    }
    for (let i = 0; i < geo.index.count; i += 3) {
      join(geo.index.getX(i), geo.index.getX(i + 1));
      join(geo.index.getX(i), geo.index.getX(i + 2));
    }
    const groups = new Map();
    for (let i = 0; i < count; i++) {
      const k = find(i);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    }
    tips = [...groups.values()].map((ids) => {
      const minX = Math.min(...ids.map((i) => geo.attributes.position.getX(i)));
      const end = ids.filter(
        (i) => Math.abs(geo.attributes.position.getX(i) - minX) < 1e-5,
      );
      const tip = new T.Vector3();
      for (const i of end) tip.add(new T.Vector3().fromArray(positions[i]));
      tip.divideScalar(end.length);
      return {
        authoredGameAxis: tip.toArray(),
        gameScale195: tip.clone().multiplyScalar(1.95).toArray(),
        vertices: ids.length,
      };
    });
    assert.equal(
      tips.length,
      5,
      "Each wing has five physically separate warheads",
    );
  }
  report.push({
    name: mesh.name,
    min: box.min.toArray(),
    max: box.max.toArray(),
    center: box.getCenter(new T.Vector3()).toArray(),
    tips,
  });
});
fs.mkdirSync("dist-validation/harrow-v7", { recursive: true });
fs.writeFileSync(
  "dist-validation/harrow-v7/launchers.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    report.map(({ positions, ...r }) => r),
    null,
    2,
  ),
);
