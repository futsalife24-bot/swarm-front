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
  process.argv.find((arg) => arg.startsWith("--asset="))?.slice(8) ??
  "public/assets/characters/swarm-soldier.glb";
const character = await geometry(asset);
const mixer = new T.AnimationMixer(character.scene),
  results = [],
  weaponHashes = {},
  rarityGeometry = {};
function positionDigest(scene) {
  scene.updateMatrixWorld(true);
  const hash = createHash("sha256");
  scene.traverse((object) => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh || object.morphTargetInfluences?.length)
      throw new Error("Weapon equivalence requires static geometry");
    const position = object.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const vertex = new T.Vector3().fromBufferAttribute(position, i);
      vertex.applyMatrix4(object.matrixWorld);
      hash.update(JSON.stringify(vertex.toArray()));
    }
  });
  return hash.digest("hex");
}
if (process.argv.includes("--reposition")) {
  const angle = Number(
    process.argv
      .find((arg) => arg.startsWith("--back-angle="))
      ?.split("=")[1] ?? -0.45,
  );
  const height = Number(
    process.argv
      .find((arg) => arg.startsWith("--back-height="))
      ?.split("=")[1] ?? 0.08,
  );
  mixer
    .clipAction(
      T.AnimationClip.findByName(
        character.animations,
        "Trial_Weapon_Idle_Rifle",
      ),
    )
    .play();
  mixer.update(0);
  character.scene.updateMatrixWorld(true);
  const chest = character.scene
    .getObjectByName("Chest")
    .getWorldPosition(new T.Vector3());
  const transforms = [];
  for (const [i, name] of [
    "BackWeaponSocket",
    "BackWeaponSocket_2",
  ].entries()) {
    const bone = character.scene.getObjectByName(name);
    const matrix = new T.Matrix4()
      .makeRotationZ(i === 0 ? angle : -angle)
      .multiply(new T.Matrix4().makeRotationY(-Math.PI / 2));
    matrix.setPosition(
      chest.clone().add(new T.Vector3(i === 0 ? 0.14 : -0.14, height, 0.1)),
    );
    matrix.premultiply(bone.parent.matrixWorld.clone().invert());
    transforms.push([bone, matrix]);
  }
  mixer.stopAllAction();
  for (const clip of character.animations)
    clip.tracks = clip.tracks.filter(
      (track) => !/^BackWeaponSocket/.test(track.name),
    );
  for (const [bone, matrix] of transforms)
    matrix.decompose(bone.position, bone.quaternion, bone.scale);
}
for (const kind of ["rifle", "shotgun", "rocket"]) {
  const weaponPath = `public/assets/weapons/realism-v2/${kind}_0.glb`;
  weaponHashes[kind] = createHash("sha256")
    .update(await fs.readFile(weaponPath))
    .digest("hex");
  const gun = (await geometry(weaponPath)).scene;
  const referenceDigest = positionDigest(gun);
  rarityGeometry[kind] = [];
  for (let rarity = 1; rarity <= 4; rarity++) {
    const path = `public/assets/weapons/realism-v2/${kind}_${rarity}.glb`;
    weaponHashes[`${kind}_${rarity}`] = createHash("sha256")
      .update(await fs.readFile(path))
      .digest("hex");
    const digest = positionDigest((await geometry(path)).scene);
    rarityGeometry[kind].push({
      rarity,
      digest,
      matchesRarity0: digest === referenceDigest,
    });
  }
  if (process.argv.includes("--diagnostic")) {
    gun.rotation.set(Math.PI / 2, 0, 0);
    gun.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(gun, true);
    console.log(
      kind,
      "socket-local bounds",
      box.min.toArray(),
      box.max.toArray(),
    );
  }
  for (const socket of [
    "RightHandWeaponSocket",
    "BackWeaponSocket",
    "BackWeaponSocket_2",
  ]) {
    character.scene.getObjectByName(socket).add(gun);
    gun.position.set(0, 0, 0);
    gun.rotation.set(Math.PI / 2, 0, 0);
    for (const name of ["Down", "Trial_Dodge_Roll"]) {
      const clip = T.AnimationClip.findByName(character.animations, name);
      const rows = [],
        count = Math.ceil(clip.duration * 240);
      for (let sample = 0; sample <= count; sample++) {
        mixer.stopAllAction();
        const action = mixer
          .clipAction(clip)
          .reset()
          .setLoop(T.LoopOnce, 1)
          .play();
        action.clampWhenFinished = true;
        action.time = (clip.duration * sample) / count;
        mixer.update(0);
        character.scene.updateMatrixWorld(true);
        const box = new T.Box3().setFromObject(gun, true);
        if (
          process.argv.includes("--diagnostic") &&
          kind === "rifle" &&
          name === "Down" &&
          sample === count
        )
          console.log(
            socket,
            "final socket/chest",
            gun.parent.getWorldPosition(new T.Vector3()).toArray(),
            character.scene
              .getObjectByName("Chest")
              .getWorldPosition(new T.Vector3())
              .toArray(),
          );
        rows.push({
          fraction: sample / count,
          minY: box.min.y,
          maxY: box.max.y,
        });
      }
      results.push({
        kind,
        socket,
        clip: name,
        minimum: Math.min(...rows.map((row) => row.minY)),
        samples: rows,
      });
    }
  }
  gun.removeFromParent();
}
const sha256 = createHash("sha256")
  .update(await fs.readFile(asset))
  .digest("hex");
const runtimeAssetUrlMatches =
  asset === "public/assets/characters/swarm-soldier.glb"
    ? (await fs.readFile("src/client/standard-trooper.ts", "utf8")).includes(
        `swarm-soldier.glb?v=${sha256}`,
      )
    : null;
const reportName =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ??
  (process.argv.includes("--reposition")
    ? "soldier-weapon-ground-candidate.json"
    : process.argv.some((arg) => arg.startsWith("--asset="))
      ? "soldier-weapon-ground-export.json"
      : "soldier-weapon-ground.json");
await fs.writeFile(
  reportName,
  JSON.stringify(
    {
      asset,
      sha256,
      runtimeAssetUrlMatches,
      weaponHashes,
      rarityGeometry,
      sampleRate: 240,
      toleranceMetres: 0.002,
      experimentalReposition: process.argv.includes("--reposition"),
      scope:
        "Authored clip transforms plus runtime attachment basis; rarity 0 sampled for three weapon families, rarities 1–4 checked for identical static geometry; no gameplay blends or terrain.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(({ samples, ...row }) => row),
    null,
    2,
  ),
);
if (
  process.argv.includes("--strict") &&
  (runtimeAssetUrlMatches === false ||
    Object.values(rarityGeometry).some((rows) =>
      rows.some((row) => !row.matchesRarity0),
    ) ||
    results.some((row) => row.minimum < -0.002))
)
  process.exitCode = 1;
