import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader().register(() => ({
  name: "POSE_ONLY",
  loadTexture: async () => new T.Texture(),
}));
async function load(version) {
  const bytes = fs.readFileSync(
    `public/assets/enemies/harrow_motion_${version}.glb`,
  );
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  return {
    ...gltf,
    mixer: new T.AnimationMixer(gltf.scene),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
function pose(asset, name, time) {
  asset.mixer.stopAllAction();
  const action = asset.mixer
    .clipAction(asset.animations.find((c) => c.name === name))
    .reset()
    .setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  asset.mixer.setTime(time);
  asset.scene.updateMatrixWorld(true);
}
const old = await load("v12"),
  current = await load("v13");
pose(old, "Spin", 1.675);
pose(current, "Idle", 0);
const bones = [
  "Torso",
  "Head",
  "Tail.00",
  ...Array.from({ length: 6 }, (_, i) => `Neck.${String(i).padStart(2, "0")}`),
  ...[".L", ".R"].flatMap((s) => ["Wing upper" + s, "Wing fore" + s]),
];
const differences = Object.fromEntries(
  bones.map((name) => {
    const exportedName = T.PropertyBinding.sanitizeNodeName(name);
    const a = old.scene.getObjectByName(exportedName),
      b = current.scene.getObjectByName(exportedName);
    assert(a && b, name);
    return [name, a.quaternion.angleTo(b.quaternion)];
  }),
);
// Idle breathing may offset a neck segment slightly, but the former upright
// trunk/wing posture must not return. Compare actual exported bone rotations.
for (const [name, angle] of Object.entries(differences))
  assert(angle < 0.05, `${name} differs from v12 low Spin by ${angle}rad`);
const result = {
  pass: true,
  old: old.sha256,
  current: current.sha256,
  reference: { clip: "Spin", time: 1.675 },
  candidate: { clip: "Idle", time: 0 },
  radians: differences,
  limitation:
    "Pose equivalence is not user aesthetic approval; flight and attack motion require visual inspection.",
};
fs.mkdirSync("dist-validation/harrow-v13", { recursive: true });
fs.writeFileSync(
  "dist-validation/harrow-v13/posture-reference.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
