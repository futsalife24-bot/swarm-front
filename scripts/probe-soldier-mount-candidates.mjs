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

const asset = "public/assets/characters/swarm-soldier.glb";
const dir = process.argv.find((a) => a.startsWith("--directory="))?.slice(12);
if (!dir) throw Error("--directory is required");
const search = JSON.parse(
  await fs.readFile(`${dir}/back-mount-search.json`, "utf8"),
);
const sha = createHash("sha256")
  .update(await fs.readFile(asset))
  .digest("hex");
if (search.sha256 !== sha) throw Error("Search/source SHA mismatch");
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
const idleChest = chest.matrixWorld.clone(),
  invIdleChest = idleChest.clone().invert();
const candidates = search.candidates
  .filter((r) => r.intersectingKinds === 0)
  .map((r) => {
    const original = character.scene
      .getObjectByName(r.socket)
      .matrixWorld.clone();
    const delta = invIdleChest
      .clone()
      .multiply(new T.Matrix4().fromArray(r.idleWorldMatrix))
      .multiply(original.invert())
      .multiply(idleChest);
    return { ...r, delta, minimum: Infinity, worst: null };
  });
for (const name of ["Trial_Dodge_Roll", "Down"]) {
  const clip = T.AnimationClip.findByName(character.animations, name),
    count = Math.ceil(clip.duration * 240);
  for (let i = 0; i <= count; i++) {
    pose(clip, (clip.duration * i) / count);
    const invChest = chest.matrixWorld.clone().invert();
    for (const c of candidates) {
      const matrix = chest.matrixWorld
          .clone()
          .multiply(c.delta)
          .multiply(invChest)
          .multiply(character.scene.getObjectByName(c.socket).matrixWorld),
        e = matrix.elements;
      for (const [kind, vertices] of Object.entries(weapons))
        for (const v of vertices) {
          const y = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13];
          if (y < c.minimum) {
            c.minimum = y;
            c.worst = {
              clip: name,
              fraction: i / count,
              weapon: kind,
              anchorY: e[13],
            };
          }
        }
    }
  }
}
candidates.sort((a, b) => b.minimum - a.minimum);
const results = candidates.map(({ delta, ...r }) => r);
await fs.writeFile(
  `${dir}/back-mount-floor-search.json`,
  JSON.stringify(
    {
      sha256: sha,
      scope:
        "Idle collision-free candidates tested against existing authored roll/down socket animation at 240Hz. No runtime changes.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    count: results.length,
    best: results.slice(0, 4).map(({ idleWorldMatrix, ...r }) => r),
  }),
);
