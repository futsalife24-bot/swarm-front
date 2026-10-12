// The original v6 inspection is preserved at scripts/check-harrow-v6-asset.mjs.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const source = "public/assets/enemies/harrow_motion_v14.glb";
const bytes = readFileSync(source);
// The headless check inspects geometry and animation; browser QA decodes the textures.
const loader = new GLTFLoader().register(() => ({
  name: "HEADLESS_GEOMETRY_ONLY",
  loadTexture: async () => new T.Texture(),
}));
const { scene, animations } = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  "",
);
const expected = [
  "Idle",
  "Locomotion",
  "Lunge",
  "Threat",
  "AirThreat",
  "Spin",
  "Takeoff",
  "Flight",
  "Glide",
  "Dive",
  "StaggerFall",
  "Land",
  "Dash",
  "Snipe",
  "BombPass",
  "TakeoffB",
  "TakeoffC",
  "TakeoffD",
];
const names = animations.map((clip) =>
  clip.name === "Attack" ? "Lunge" : clip.name,
);
assert.deepEqual(
  names.slice().sort(),
  expected.slice().sort(),
  "HARROW v14 clips",
);
const meshes = [];
scene.traverse((object) => {
  if (object instanceof T.SkinnedMesh) meshes.push(object);
});
assert.equal(meshes.length, 22, "HARROW v14 skinned mesh primitives");
assert.equal(meshes[0].skeleton.bones.length, 39, "HARROW v14 bones");
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
    meshes[0].skeleton.bones,
    `${mesh.name} bone order`,
  );
}
for (const clip of animations)
  assert.ok(
    Number.isFinite(clip.duration) && clip.duration > 0,
    `${clip.name} duration`,
  );
const result = {
  source,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  skinnedMeshes: meshes.length,
  bones: meshes[0].skeleton.bones.length,
  clips: Object.fromEntries(
    animations.map((clip) => [clip.name, clip.duration]),
  ),
  sharedBinding: true,
};
mkdirSync("dist-validation/harrow", { recursive: true });
writeFileSync(
  "dist-validation/harrow/v14-asset.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
