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
const asset = process.argv.find((a) => a.startsWith("--asset="))?.slice(8);
const output = process.argv.find((a) => a.startsWith("--output="))?.slice(9);
if (!asset || !output) throw new Error("Provide --asset and --output");
const character = await geometry(asset),
  mixer = new T.AnimationMixer(character.scene);
function meshData(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isSkinnedMesh) o.skeleton.update();
  });
  const result = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const vertices = [],
      triangles = [],
      vertexRegions = [],
      regions = [],
      v = new T.Vector3(),
      g = o.geometry;
    for (let i = 0; i < g.attributes.position.count; i++) {
      o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
      vertices.push(v.toArray());
      let region = "static";
      if (o.isSkinnedMesh) {
        const weights = new T.Vector4().fromBufferAttribute(
          g.attributes.skinWeight,
          i,
        );
        const joints = new T.Vector4().fromBufferAttribute(
          g.attributes.skinIndex,
          i,
        );
        const strongest = [0, 1, 2, 3].reduce((a, b) =>
          weights.getComponent(b) > weights.getComponent(a) ? b : a,
        );
        const bone = o.skeleton.bones[joints.getComponent(strongest)].name;
        region = /Hand_|Thumb|Index|Middle|Ring|Little/.test(bone)
          ? `hand_${bone.endsWith("_R") ? "R" : "L"}`
          : /UpperArm_|LowerArm_|Clavicle_/.test(bone)
            ? `arm_${bone.endsWith("_R") ? "R" : "L"}`
            : /UpperLeg_|LowerLeg_|Foot_|Toe_/.test(bone)
              ? "legs"
              : /Head|Neck/.test(bone)
                ? "head"
                : "trunk";
      }
      vertexRegions.push(region);
    }
    const count = g.index?.count ?? g.attributes.position.count;
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((j) => (g.index ? g.index.getX(i + j) : i + j));
      triangles.push(ids);
      regions.push(
        [...new Set(ids.map((j) => vertexRegions[j]))].sort().join("+"),
      );
    }
    result.push({ name: o.name, vertices, triangles, regions });
  });
  return result;
}
const weapons = {};
for (const kind of ["rifle", "shotgun", "rocket"]) {
  const gun = (await geometry(`public/assets/weapons/realism-v2/${kind}_0.glb`))
    .scene;
  gun.rotation.set(Math.PI / 2, 0, 0);
  gun.scale.set(1, 1, 1);
  gun.position.set(0, 0, 0);
  weapons[kind] = meshData(gun);
}
const poses = [];
const poseSpecs = [
  ["Trial_Weapon_Idle_Rifle", 0],
  ["Trial_Switch_1_to_2", 0.45],
  ["Trial_Switch_1_to_2", 0.6],
];
if (process.argv.includes("--evade")) {
  for (const name of [
    "Trial_Dodge_Roll",
    "Trial_Dodge_Roll_Shotgun",
    "Trial_Dodge_Roll_Rocket",
  ])
    for (const fraction of [0.25, 0.5, 0.75]) poseSpecs.push([name, fraction]);
}
for (const [name, fraction] of poseSpecs) {
  mixer.stopAllAction();
  const clip = T.AnimationClip.findByName(character.animations, name);
  const action = mixer.clipAction(clip).reset().setLoop(T.LoopOnce, 1).play();
  action.clampWhenFinished = true;
  action.time = clip.duration * fraction;
  mixer.update(0);
  character.scene.updateMatrixWorld(true);
  const sockets = Object.fromEntries(
    ["BackWeaponSocket", "BackWeaponSocket_2", "Chest"].map((n) => [
      n,
      character.scene.getObjectByName(n).matrixWorld.toArray(),
    ]),
  );
  poses.push({ name, fraction, sockets, body: meshData(character.scene) });
}
await fs.writeFile(
  output,
  JSON.stringify({
    scope:
      "Three.js authored poses and exact runtime weapon root rotation; no runtime cross-fade.",
    sha256: createHash("sha256")
      .update(await fs.readFile(asset))
      .digest("hex"),
    weapons,
    poses,
  }),
);
console.log(
  JSON.stringify({
    poses: poses.length,
    bodyMeshes: poses[0].body.map((m) => m.name),
    output,
  }),
);
