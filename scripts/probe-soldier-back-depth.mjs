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
const output =
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ??
  "soldier-back-depth-probe.json";
const character = await geometry(asset),
  mixer = new T.AnimationMixer(character.scene),
  weapons = {};
for (const kind of ["rifle", "shotgun", "rocket"]) {
  const gun = (await geometry(`public/assets/weapons/realism-v2/${kind}_0.glb`))
    .scene;
  gun.rotation.set(Math.PI / 2, 0, 0);
  gun.updateMatrixWorld(true);
  weapons[kind] = [];
  gun.traverse((o) => {
    if (o.isMesh)
      for (let i = 0; i < o.geometry.attributes.position.count; i++)
        weapons[kind].push(
          new T.Vector3()
            .fromBufferAttribute(o.geometry.attributes.position, i)
            .applyMatrix4(o.matrixWorld),
        );
  });
}
function pose(clip, time) {
  mixer.stopAllAction();
  const a = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1).play();
  a.clampWhenFinished = true;
  a.time = time;
  mixer.update(0);
  character.scene.updateMatrixWorld(true);
}
pose(
  T.AnimationClip.findByName(character.animations, "Trial_Weapon_Idle_Rifle"),
  0,
);
const chest = character.scene.getObjectByName("Chest");
const backLocal = new T.Vector3(0, 0, 1).transformDirection(
  chest.matrixWorld.clone().invert(),
);
const results = [];
for (const name of ["Trial_Dodge_Roll", "Down"]) {
  const clip = T.AnimationClip.findByName(character.animations, name),
    count = Math.ceil(clip.duration * 240);
  for (const depth of [0, 0.2]) {
    const lows = {};
    for (const socket of ["BackWeaponSocket", "BackWeaponSocket_2"])
      for (const kind of Object.keys(weapons))
        lows[socket + "/" + kind] = {
          minY: Infinity,
          fraction: 0,
          minAnchorY: Infinity,
        };
    for (let i = 0; i <= count; i++) {
      pose(clip, (clip.duration * i) / count);
      const shift = backLocal
        .clone()
        .transformDirection(chest.matrixWorld)
        .multiplyScalar(depth);
      for (const socket of ["BackWeaponSocket", "BackWeaponSocket_2"]) {
        const matrix = character.scene
          .getObjectByName(socket)
          .matrixWorld.clone();
        matrix.elements[12] += shift.x;
        matrix.elements[13] += shift.y;
        matrix.elements[14] += shift.z;
        const e = matrix.elements;
        for (const [kind, vertices] of Object.entries(weapons)) {
          const low = Math.min(
            ...vertices.map(
              (v) => e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13],
            ),
          );
          const row = lows[socket + "/" + kind];
          if (low < row.minY) {
            row.minY = low;
            row.fraction = i / count;
          }
          row.minAnchorY = Math.min(row.minAnchorY, e[13]);
        }
      }
    }
    results.push({
      clip: name,
      additionalBackDepthMetres: depth,
      sampleRate: 240,
      cases: lows,
    });
  }
}
const report = {
  scope:
    "Authored clip floor probe with runtime weapon attachment basis. Diagnostic offsets are not applied.",
  sha256: createHash("sha256")
    .update(await fs.readFile(asset))
    .digest("hex"),
  results,
};
await fs.writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(results));
