import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// CPU geometry inspection: skip textures but retain the exact scene/skin/clip transforms.
async function geometry(path) {
  const raw = await fs.readFile(path),
    size = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + size));
  delete json.images;
  delete json.textures;
  delete json.materials;
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]);
  const tail = raw.subarray(20 + size),
    header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + tail.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const buffer = Buffer.concat([header, text, tail]);
  return new GLTFLoader().parseAsync(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    "",
  );
}

const asset =
  process.argv.find((a) => a.startsWith("--asset="))?.slice(8) ??
  "public/assets/characters/swarm-soldier.glb";
const profile =
  process.argv.find((a) => a.startsWith("--profile="))?.slice(10) ?? "Rifle";
if (!["Rifle", "Shotgun", "Rocket"].includes(profile))
  throw Error("Unknown weapon profile");
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (!output) throw Error("--output is required");
const c = await geometry(asset),
  m = new T.AnimationMixer(c.scene),
  rows = [];
const names = [
  "Hand",
  "Index1",
  "Middle1",
  "Little1",
  "Thumb1",
  "Index3",
  "Middle3",
  "Little3",
];
function sample(name, fraction) {
  const clip = T.AnimationClip.findByName(c.animations, name);
  m.stopAllAction();
  const a = m.clipAction(clip).reset().play();
  a.time = clip.duration * fraction;
  m.update(0);
  c.scene.updateMatrixWorld(true);
  const inv = c.scene
      .getObjectByName("RightHandWeaponSocket")
      .matrixWorld.clone()
      .invert(),
    points = {};
  for (const side of ["R", "L"])
    for (const n of names)
      points[n + "_" + side] = c.scene
        .getObjectByName(n + "_" + side)
        .getWorldPosition(new T.Vector3())
        .applyMatrix4(inv)
        .toArray();
  return points;
}
const idle = sample(`Trial_Weapon_Idle_${profile}`, 0),
  clip = T.AnimationClip.findByName(
    c.animations,
    profile === "Rifle" ? "Trial_Dodge_Roll" : `Trial_Dodge_Roll_${profile}`,
  );
const count = Math.ceil(clip.duration * 240),
  maxima = { R: 0, L: 0 };
const socketNames = [
  "RightHandWeaponSocket",
  "BackWeaponSocket",
  "BackWeaponSocket_2",
];
const socketPathMaxComponentDelta = Object.fromEntries(
  socketNames.map((name) => [name, 0]),
);
for (let i = 0; i <= count; i++) {
  const points = sample(clip.name, i / count),
    deltas = { R: 0, L: 0 };
  const matrices = Object.fromEntries(
    socketNames.map((name) => [
      name,
      c.scene.getObjectByName(name).matrixWorld.toArray(),
    ]),
  );
  sample("Trial_Dodge_Roll", i / count);
  for (const name of socketNames) {
    const baseline = c.scene.getObjectByName(name).matrixWorld.elements;
    socketPathMaxComponentDelta[name] = Math.max(
      socketPathMaxComponentDelta[name],
      ...matrices[name].map((v, j) => Math.abs(v - baseline[j])),
    );
  }
  for (const side of ["R", "L"])
    for (const n of names) {
      const key = n + "_" + side,
        d = new T.Vector3()
          .fromArray(points[key])
          .distanceTo(new T.Vector3().fromArray(idle[key]));
      deltas[side] = Math.max(deltas[side], d);
      maxima[side] = Math.max(maxima[side], d);
    }
  rows.push({ fraction: i / count, maxBoneFrameDifferenceMetres: deltas });
}
const result = {
  sha256: createHash("sha256")
    .update(await fs.readFile(asset))
    .digest("hex"),
  scope:
    "Authored roll compared with the same weapon profile idle, hand/finger joints in the weapon socket frame. Measures relative consistency only, not glove surface contact or gameplay blends.",
  profile,
  sampleRate: 240,
  maxima,
  socketPathMaxComponentDelta,
  idleJointPositionsInWeaponFrame: idle,
  samples: rows,
};
await fs.writeFile(output, JSON.stringify(result, null, 2));
console.log(
  JSON.stringify({ samples: rows.length, maxima, socketPathMaxComponentDelta }),
);
