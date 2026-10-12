// The original v6 launcher inspection is preserved at scripts/check-harrow-v6-launchers.mjs.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { build } from "esbuild";

const source = "public/assets/enemies/harrow_motion_v14.glb";
const bytes = readFileSync(source);
const loader = new GLTFLoader().register(() => ({
  name: "HEADLESS_GEOMETRY_ONLY",
  loadTexture: async () => new T.Texture(),
}));
const { scene, animations } = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
scene.rotation.y = -Math.PI / 2;
scene.updateMatrixWorld(true);
const mixer = new T.AnimationMixer(scene);
const meshes = [];
scene.traverse((object) => {
  if (object instanceof T.SkinnedMesh && object.name.startsWith("Launcher"))
    meshes.push(object);
});
assert.equal(meshes.length, 10, "five launchers on each wing");

mkdirSync("dist-validation/harrow", { recursive: true });
const sharedBundle = "dist-validation/harrow/harrow-shared-launcher-check.mjs";
await build({
  entryPoints: ["src/shared/harrow.ts"],
  outfile: sharedBundle,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
const { HARROW, harrowMissileOrigins, harrowSnipeOrigins, harrowBombOrigins } =
  await import(pathToFileURL(path.resolve(sharedBundle)).href);

const samples = [
  {
    clip: "Threat",
    time: 3.5,
    shared: harrowMissileOrigins(
      { x: 0, y: 0, z: 0, harrowAirborne: false },
      0,
    ),
  },
  {
    clip: "AirThreat",
    time: 3.5,
    shared: harrowMissileOrigins({ x: 0, y: 0, z: 0, harrowAirborne: true }, 0),
  },
  {
    clip: "Snipe",
    time: 2,
    shared: harrowSnipeOrigins({ x: 0, y: 0, z: 0 }, 0),
  },
  {
    clip: "BombPass",
    time: 2.6,
    shared: harrowBombOrigins({ x: 0, y: 0, z: 0 }, 0),
  },
];
const point = new T.Vector3();
const report = {};
for (const sample of samples) {
  const clip = animations.find((animation) => animation.name === sample.clip);
  assert.ok(clip, `${sample.clip} clip`);
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(sample.time);
  scene.updateMatrixWorld(true);
  const measured = meshes.map((mesh) => {
    mesh.skeleton.update();
    const position = mesh.geometry.getAttribute("position");
    let tip = 0;
    for (let i = 1; i < position.count; i++)
      if (position.getY(i) > position.getY(tip)) tip = i;
    const local = mesh
      .getVertexPosition(tip, point)
      .applyMatrix4(mesh.matrixWorld);
    // Renderer places HARROW at PI - heading; compare world points at heading 0.
    return [
      -local.x * HARROW.scale,
      local.y * HARROW.scale,
      -local.z * HARROW.scale,
    ];
  });
  const unmatched = [...measured];
  const errors = sample.shared.map((origin) => {
    const distances = unmatched.map((tip) =>
      Math.hypot(tip[0] - origin.x, tip[1] - origin.y, tip[2] - origin.z),
    );
    const nearest = distances.indexOf(Math.min(...distances));
    const distance = distances[nearest];
    unmatched.splice(nearest, 1);
    return distance;
  });
  const maximumError = Math.max(...errors);
  assert.ok(
    maximumError < 0.1,
    `${sample.clip} launcher alignment ${maximumError}m`,
  );
  report[sample.clip] = {
    time: sample.time,
    maximumError,
    measured,
    shared: sample.shared,
  };
}
writeFileSync(
  "dist-validation/harrow/v14-launchers.json",
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(report).map(([clip, value]) => [clip, value.maximumError]),
    ),
  ),
);
