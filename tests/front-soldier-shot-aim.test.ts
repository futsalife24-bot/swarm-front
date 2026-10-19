import { beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { StandardTrooper, weaponBore } from "../src/client/standard-trooper";
import { addPlayer, createWorld } from "../src/shared/game";

let character: GLTF;
beforeAll(async () => {
  // Keep the exact skin and clips. Node cannot decode browser image resources.
  const raw = await readFile("public/assets/characters/swarm-soldier.glb");
  const size = raw.readUInt32LE(12);
  const doc = JSON.parse(raw.subarray(20, 20 + size).toString());
  delete doc.images;
  delete doc.textures;
  delete doc.materials;
  for (const mesh of doc.meshes)
    for (const primitive of mesh.primitives) delete primitive.material;
  let text = Buffer.from(JSON.stringify(doc));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]);
  const tail = raw.subarray(20 + size),
    header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + tail.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const buffer = Buffer.concat([header, text, tail]);
  character = await new GLTFLoader().parseAsync(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    "",
  );
});

// A stand-in weapon: grip at the root, barrel along -z.
function gun() {
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(0.06, 0.12, 0.8));
  body.position.z = -0.3;
  g.add(body);
  return g;
}

function fixture() {
  const p = addPlayer(createWorld("shot-aim", 7), "p");
  const actor = new StandardTrooper({
    character,
    weapons: { rifle: gun(), shotgun: gun(), rocket: gun() },
  });
  const root = new T.Group();
  root.add(actor.model);
  let time = 0,
    frame = 0;
  // Keeps firing (a cooldown bump every 6 frames), as the authority reports it.
  const update = (dt = 1 / 60) => {
    time += dt;
    p.cool = frame++ % 6 === 0 ? 0.1 : 0;
    root.rotation.set(0, 0, 0);
    actor.update(p, 0, time, "shot-aim", dt);
    root.updateMatrixWorld(true);
  };
  const offLine = (target: T.Vector3) =>
    actor.barrel()!.angleTo(target.clone().sub(actor.muzzle()!));
  return { p, actor, update, offLine };
}

it("reads the barrel direction from the weapon's long axis", () => {
  const bore = weaponBore(gun());
  expect(bore.forward.toArray()).toEqual([0, 0, -1]);
  expect(bore.muzzle.z).toBeCloseTo(-0.7, 5);
});

it("turns the upper body so the barrel lies on a shot bent down by aim assist", () => {
  const { p, actor, update, offLine } = fixture();
  // A twin fed the same frames without shot lines: the input-aim pose.
  const twin = fixture();
  for (let i = 0; i < 60; i++) (update(), twin.update());
  // Input pitch stays level; the reported shot goes down to a crawler 4 m ahead.
  const target = actor.muzzle()!.add(new T.Vector3(0.6, -1.6, -4));
  expect(p.pitch).toBe(0);
  expect(offLine(target)).toBeGreaterThan(0.2);
  actor.aimAt([target]);
  (update(), twin.update());
  expect(offLine(target)).toBeLessThan(0.03);
  // A few frames later it still holds the line.
  for (let i = 0; i < 10; i++) (update(), twin.update());
  expect(offLine(target)).toBeLessThan(0.03);
  // Without further shot lines it eases back to the input aim.
  for (let i = 0; i < 50; i++) (update(), twin.update());
  expect(actor.barrel()!.angleTo(twin.actor.barrel()!)).toBeLessThan(0.002);
  actor.dispose();
  twin.actor.dispose();
});

it("aligns in the frame the facing snaps to the shot", () => {
  const { p, actor, update, offLine } = fixture();
  for (let i = 0; i < 60; i++) update();
  const root = actor.model.parent!;
  // As the renderer does on a shot: new facing set, world matrices not yet refreshed.
  const yaw = 0.4;
  const target = new T.Vector3(Math.sin(yaw) * 20, 0.6, -Math.cos(yaw) * 20);
  actor.aimAt([target]);
  root.rotation.set(0, -yaw, 0);
  p.cool = 0.1;
  actor.update(p, yaw, 2, "shot-aim", 1 / 60);
  expect(offLine(target)).toBeLessThan(0.03);
  actor.dispose();
});

it("follows a shot aimed upward at a flier", () => {
  const { actor, update, offLine } = fixture();
  for (let i = 0; i < 60; i++) update();
  const target = actor.muzzle()!.add(new T.Vector3(-1, 6, -9));
  actor.aimAt([target]);
  update();
  expect(offLine(target)).toBeLessThan(0.03);
  actor.dispose();
});
