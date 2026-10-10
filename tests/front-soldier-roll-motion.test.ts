import { beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { StandardTrooper } from "../src/client/standard-trooper";
import { addPlayer, createWorld } from "../src/shared/game";
import { EVADE_DURATION } from "../src/shared/defs";

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
function fixture() {
  const p = addPlayer(createWorld("roll-motion", 42), "p");
  const actor = new StandardTrooper({
    character,
    weapons: {
      rifle: new T.Group(),
      shotgun: new T.Group(),
      rocket: new T.Group(),
    },
  });
  const update = (time: number, run = "roll-motion") => {
    const before = JSON.stringify(p);
    actor.update(p, p.yaw, time, run, 1 / 60);
    expect(JSON.stringify(p)).toBe(before);
  };
  return { p, actor, update };
}

it("spends the authority evade window on rotation and lets the following stance settle", () => {
  const { p, actor, update } = fixture();
  update(0);
  p.evade = EVADE_DURATION;
  update(1 / 60);
  for (let frame = 1; frame <= 18; frame++) {
    p.evade = Math.max(0, EVADE_DURATION - frame / 60);
    update((frame + 1) / 60);
  }
  const sampled = actor.mixer.existingAction(actor.clips.get("Dodge_Roll")!);
  expect(sampled?.time).toBeGreaterThan(0.8);
  expect(sampled?.time).toBeLessThan(0.91);
  const pelvis = actor.model.getObjectByName("Pelvis")!;
  const from = pelvis.quaternion.clone();
  p.evade = 0;
  update(20 / 60);
  expect(pelvis.quaternion.angleTo(from)).toBeLessThan(0.12);
  for (let frame = 21; frame <= 34; frame++) update(frame / 60);
  expect(actor.model.rotation.y).toBe(0);
  actor.dispose();
});

it("reflects shooting, switching and movement immediately during recovery without mutating authority", () => {
  const { p, actor, update } = fixture();
  update(0);
  p.evade = 0.02;
  p.x = 0.2;
  update(1 / 60);
  p.evade = 0;
  p.cool = 0.13;
  p.x += 0.1;
  update(2 / 60);
  expect(
    actor.mixer
      .existingAction(actor.clips.get("Upper_Fire_Rifle")!)
      ?.isRunning(),
  ).toBe(true);
  expect(
    actor.mixer.existingAction(actor.clips.get("Lower_Run")!)?.isRunning(),
  ).toBe(true);
  p.slot = 1;
  p.swapCd = 0.4;
  update(3 / 60);
  expect(
    actor.mixer
      .existingAction(actor.clips.get("Upper_Switch_1_to_2")!)
      ?.isRunning(),
  ).toBe(true);
  actor.dispose();
});

it("keeps the captured roll axis through recovery and clears it on new roll, death and run boundary", () => {
  for (const interruption of ["roll", "death", "run"] as const) {
    const { p, actor, update } = fixture();
    update(0);
    p.evade = 0.05;
    p.x = 0.5;
    update(1 / 60);
    expect(actor.model.rotation.y).toBeCloseTo(-Math.PI / 2);
    p.evade = 0;
    update(2 / 60);
    expect(Math.abs(actor.model.rotation.y)).toBeGreaterThan(1);
    if (interruption === "roll") {
      p.evade = EVADE_DURATION;
      p.z -= 0.5;
    } else if (interruption === "death") p.hp = 0;
    update(3 / 60, interruption === "run" ? "new-run" : "roll-motion");
    expect(actor.model.rotation.y).toBe(0);
    for (const bone of actor.bones)
      expect(bone.quaternion.toArray().every(Number.isFinite)).toBe(true);
    actor.dispose();
  }
});

it("returns the firing axis to aim immediately even while side-roll legs are recovering", () => {
  const directions: T.Vector3[] = [];
  for (const side of [false, true]) {
    const { p, actor, update } = fixture();
    update(0);
    p.evade = 0.02;
    if (side) p.x += 0.5;
    else p.z -= 0.5;
    update(1 / 60);
    p.evade = 0;
    p.cool = 0.13;
    update(2 / 60);
    directions.push(
      new T.Vector3(1, 0, 0).applyQuaternion(
        actor.hand.getWorldQuaternion(new T.Quaternion()),
      ),
    );
    actor.dispose();
  }
  expect(directions[0].angleTo(directions[1])).toBeLessThan(0.01);
});
