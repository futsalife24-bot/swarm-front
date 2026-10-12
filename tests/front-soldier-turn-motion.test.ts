import { beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { StandardTrooper } from "../src/client/standard-trooper";
import { TURN_REST_PHASE, type TurnInPlace } from "../src/client/turn-in-place";
import { addPlayer, createWorld } from "../src/shared/game";
import { EVADE_DURATION, HEAVY_HIT_DURATION } from "../src/shared/defs";

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

type Internals = { turn: TurnInPlace; moveYaw: number };
function fixture() {
  const p = addPlayer(createWorld("turn-motion", 42), "p");
  const actor = new StandardTrooper({
    character,
    weapons: {
      rifle: new T.Group(),
      shotgun: new T.Group(),
      rocket: new T.Group(),
    },
  });
  // The renderer rotates an outer group by the drawn facing.
  const root = new T.Group();
  root.add(actor.model);
  let time = 0;
  const update = (yaw: number, dt = 1 / 60) => {
    time += dt;
    const before = JSON.stringify(p);
    root.rotation.set(0, -yaw, 0);
    actor.update(p, yaw, time, "turn-motion", dt);
    root.updateMatrixWorld(true);
    // Presentation only: the authority state is never written.
    expect(JSON.stringify(p)).toBe(before);
  };
  const feet = () =>
    ["Foot_L", "Foot_R"].map((n) =>
      actor.model.getObjectByName(n)!.getWorldPosition(new T.Vector3()),
    );
  const inner = actor as unknown as Internals;
  return { p, actor, update, feet, inner };
}

it("keeps both boots planted while a small aim change twists the hips", () => {
  const { actor, update, feet, inner } = fixture();
  for (let i = 0; i < 30; i++) update(0);
  const start = feet();
  let slide = 0;
  for (let i = 1; i <= 24; i++) {
    const before = feet();
    update((0.5 * i) / 24);
    feet().forEach(
      (f, k) => (slide = Math.max(slide, f.distanceTo(before[k]))),
    );
  }
  expect(inner.turn.stepping).toBe(false);
  expect(slide).toBeLessThan(0.004);
  // The hips pivot slightly off the root axis, so a 0.5 rad twist leaves about
  // 1 cm of drift; turning the whole body moved each boot several times that.
  feet().forEach((f, k) => expect(f.distanceTo(start[k])).toBeLessThan(0.02));
  actor.dispose();
});

it("steps with the walk legs and lands both boots before the idle legs return", () => {
  const { actor, update, inner } = fixture();
  for (let i = 0; i < 30; i++) update(0);
  const walk = actor.clips.get("Lower_Walk")!;
  let stepped = 0,
    last = -1;
  for (let i = 0; i < 60; i++) {
    update(1.4);
    const action = actor.mixer.existingAction(walk);
    if (inner.turn.stepping) {
      stepped++;
      expect(action?.isRunning()).toBe(true);
      // The step legs only move forward through the cycle.
      const phase = inner.turn.cycle;
      if (last >= 0) expect((phase - last + 1) % 1).toBeLessThan(0.5);
      last = phase;
    }
  }
  expect(stepped).toBeGreaterThan(3);
  // Two feet for a 1.4 rad turn, finishing in double support.
  expect(inner.turn.cycle).toBeCloseTo(TURN_REST_PHASE, 6);
  expect(Math.abs(inner.moveYaw)).toBeLessThan(0.05);
  expect(
    actor.mixer.existingAction(actor.clips.get("Lower_Idle")!)?.isRunning(),
  ).toBe(true);
  actor.dispose();
});

it("keeps the upper-body origin when the step legs take over during a reload", () => {
  const { p, actor, update, inner } = fixture();
  p.reload = 1;
  for (let i = 0; i < 30; i++) update(0);
  const spine = actor.model.getObjectByName("Spine")!;
  const before = spine.position.clone();
  update(1.2);
  expect(inner.turn.stepping).toBe(true);
  expect(spine.position.distanceTo(before)).toBeLessThan(0.002);
  // The V9-only idle origin offset is not part of the shipped soldier.
  expect(actor.model.userData.trooperDesignVersion).not.toBe(9);
  actor.dispose();
});

it("eases the twist out through a heavy hit and resumes square without a jump", () => {
  const { p, actor, update, inner } = fixture();
  for (let i = 0; i < 30; i++) update(0);
  for (let i = 0; i < 10; i++) update(0.45);
  expect(inner.moveYaw).toBeCloseTo(0.45, 2);
  let previous = inner.moveYaw,
    jump = 0;
  const frames = Math.ceil(HEAVY_HIT_DURATION * 60) + 20;
  for (let i = 0; i < frames; i++) {
    p.heavyHit = Math.max(0, HEAVY_HIT_DURATION - i / 60);
    update(0.45);
    jump = Math.max(jump, Math.abs(inner.moveYaw - previous));
    previous = inner.moveYaw;
  }
  expect(jump).toBeLessThan(0.08);
  // After the hit the feet were picked up square under the body.
  expect(Math.abs(inner.moveYaw)).toBeLessThan(0.02);
  expect(inner.turn.feetYaw).toBeCloseTo(0.45, 2);
  actor.dispose();
});

it("eases the twist out into a dodge instead of snapping it", () => {
  const { p, actor, update, inner } = fixture();
  for (let i = 0; i < 30; i++) update(0);
  for (let i = 0; i < 10; i++) update(-0.5);
  let previous = inner.moveYaw,
    jump = 0;
  for (let i = 0; i < 8; i++) {
    p.evade = Math.max(0, EVADE_DURATION - i / 60);
    update(-0.5);
    jump = Math.max(jump, Math.abs(inner.moveYaw - previous));
    previous = inner.moveYaw;
  }
  expect(jump).toBeLessThan(0.08);
  actor.dispose();
});

it("re-squares the feet after a long frame gap", () => {
  const { actor, update, inner } = fixture();
  for (let i = 0; i < 30; i++) update(0);
  update(0.5, 2);
  expect(inner.turn.stepping).toBe(false);
  expect(Math.abs(inner.moveYaw)).toBeLessThan(1e-6);
  actor.dispose();
});
