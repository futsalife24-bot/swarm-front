import { expect, it } from "vitest";
import {
  createWorld,
  addPlayer,
  finish,
  step,
  type Enemy,
} from "../src/shared/game";
import {
  CALYX,
  stepCalyx,
  stepPollen,
  advancePollen,
  pollenContains,
  pollenRadius,
} from "../src/shared/calyx";
import { StructureMotionController } from "../src/client/structure-motion";
import { reportPose } from "../src/client/enemy-report-motion";
import { prepareState } from "../src/shared/state-wire";
import { STAGES } from "../src/shared/stages";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CalyxEffects } from "../src/client/calyx-effects";
import { ReportEffects } from "../src/client/enemy-report-motion";
import { mapFor } from "../src/shared/stages";
import { initDailyDefense } from "../src/shared/daily-defense";
import { initSolo } from "../src/shared/solo-progression";
import { blankLevels } from "../src/client/progression-save";
import { settings } from "../src/shared/progression";
import * as T from "three";

it("shows pollen on an elevated support and does not show a projectile for a report slam", () => {
  const { w } = setup(),
    roof = mapFor(w).blocks[0];
  w.time = 1;
  w.pollen = [
    { id: 1, x: roof.x, y: roof.h + 0.03, z: roof.z, born: 0, damage: 4 },
  ];
  const effects = new CalyxEffects();
  effects.update(w);
  const mist = effects.root.children.find(
    (o) => o instanceof T.Points,
  ) as T.Points;
  expect(mist.geometry.drawRange.count).toBeGreaterThan(0);
  expect(mist.geometry.attributes.position.getY(0)).toBeGreaterThan(roof.h);
  const report = new ReportEffects();
  report.update("calyx", false, "attack", 1.1);
  expect(report.root.children[0].visible).toBe(true);
  expect(report.root.children.slice(1).every((o) => !o.visible)).toBe(true);
  report.update("calyx", false, "attack", 4.7);
  expect(report.root.children[1].visible).toBe(true);
  report.dispose();
});

function setup() {
  const w = createWorld("calyx", 1, 1);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 9999;
  const p = addPlayer(w, "a");
  Object.assign(p, { x: 0, y: 0, z: 2 });
  const e: Enemy = {
    id: 10,
    kind: "calyx",
    x: 0,
    y: 0,
    z: 0,
    hp: 360,
    maxHp: 360,
    cool: 0,
    wind: 0,
    tx: 0,
    tz: 0,
    hurt: 0,
  };
  w.enemies = [e];
  return { w, p, e };
}
it("retains every slam warning at the supported enemy and cloud limits", () => {
  const { w, e } = setup();
  w.time = 2;
  w.pollen = Array.from({ length: 16 }, (_, i) => ({
    id: 100 + i,
    x: 0,
    y: 0.03,
    z: 0,
    born: 0,
    damage: 4,
  }));
  w.enemies = Array.from({ length: settings(7, "normal").enemyCap }, (_, i) => ({
    ...e,
    id: i + 1,
    x: -90 + (i % 10) * 18,
    z: 35 + Math.floor(i / 10) * 12,
    calyx: { kind: "Slam" as const, started: 1.5, fired: false, yaw: 0 },
  }));
  const fx = new CalyxEffects();
  fx.update(w);
  const batches = fx.root.children.filter(
    (o) => o instanceof T.InstancedMesh,
  ) as T.InstancedMesh[];
  for (const actor of w.enemies) {
    let near = 0;
    for (const batch of batches) {
      const matrices = batch.instanceMatrix.array;
      for (let i = 0; i < batch.count; i++)
        if (
          Math.hypot(
            matrices[i * 16 + 12] - actor.x,
            matrices[i * 16 + 14] - actor.z,
          ) <= 4.1
        )
          near++;
    }
    expect(near).toBeGreaterThan(0);
  }
});
it("does not damage the defense armory twice when already in the target list", () => {
  const { w, e } = setup();
  initSolo(w, 1, "normal", false, blankLevels());
  initDailyDefense(w, "2026-09-20");
  w.phase = "battle";
  const armory = w.defense!.armory;
  Object.assign(armory, { x: 0, y: 0, z: 2 });
  const hp = armory.hp;
  w.time = 1;
  e.calyx = { kind: "Slam", started: 0, fired: false, yaw: 0 };
  stepCalyx(w, e, armory, [armory], 0.05);
  expect(hp - armory.hp).toBe(24);
  w.pollen = [{ id: 50, x: 0, y: 0.03, z: 2, born: 0, damage: 4 }];
  stepPollen(w, [armory], 0.05);
  expect(hp - armory.hp).toBe(28);
});
it("locks a forward slam, hits once at 1s and holds still through recovery", () => {
  const { w, p, e } = setup(),
    back = addPlayer(w, "b");
  Object.assign(back, { x: 0, y: 0, z: -2 });
  stepCalyx(w, e, p, w.players, 0.05);
  expect(e.calyx?.kind).toBe("Slam");
  w.time = 0.99;
  stepCalyx(w, e, p, w.players, 0.05);
  expect(p.hp).toBe(160);
  w.time = 1;
  stepCalyx(w, e, p, w.players, 0.01);
  expect(p.hp).toBe(136);
  expect(back.hp).toBe(160);
  w.time = 2;
  stepCalyx(w, e, back, w.players, 1);
  expect(p.hp).toBe(136);
  expect([e.x, e.z]).toEqual([0, 0]);
  expect(e.calyx).toBeDefined();
  w.time = 2.2;
  stepCalyx(w, e, p, w.players, 0.2);
  expect(e.calyx).toBeUndefined();
});
it("fires a ballistic sac at the stored position, not a moving target, with a 12s cooldown", () => {
  const { w, p, e } = setup();
  p.z = 12;
  stepCalyx(w, e, p, w.players, 0.05);
  expect(e.calyx?.kind).toBe("PollenShot");
  p.x = 8;
  w.time = 1.59;
  stepCalyx(w, e, p, w.players, 0.05);
  expect(w.projectiles).toHaveLength(0);
  w.time = 1.6;
  stepCalyx(w, e, p, w.players, 0.01);
  expect(w.projectiles).toHaveLength(1);
  const q = w.projectiles[0];
  expect(q.dx).toBe(0);
  expect(q.style).toBe("pollen");
  expect(e.pollenReadyAt).toBe(13.6);
  for (let i = 0; i < 40 && q.life > 0; i++) {
    w.time += 0.05;
    advancePollen(w, q, 0.05);
  }
  expect(w.pollen).toHaveLength(1);
  expect(w.pollen![0].z).toBeCloseTo(12, 0);
});
it("expands to 9m, excludes walls and other floors, and expires at 8s", () => {
  const c = { id: 1, x: 0, y: 0.03, z: 0, born: 0, damage: 4 };
  expect(pollenRadius(c, 0.5)).toBe(4.5);
  expect(pollenRadius(c, 1)).toBe(9);
  expect(pollenRadius(c, 8)).toBe(0);
  expect(pollenContains(c, { x: 5, y: 0, z: 0 }, 1, [])).toBe(true);
  expect(pollenContains(c, { x: 5, y: 3, z: 0 }, 1, [])).toBe(false);
  expect(
    pollenContains(c, { x: 5, y: 0, z: 0 }, 1, [
      { x: 2, z: 0, w: 1, d: 8, h: 5 },
    ]),
  ).toBe(false);
  expect(pollenContains(c, { x: 9.1, y: 0, z: 0 }, 1, [])).toBe(false);
});
it("nonstacking damage is invariant to tick subdivision and respects leaving and dodge", () => {
  const simulate = (dt: number) => {
    const { w, p } = setup();
    p.z = 0;
    w.pollen = [
      { id: 1, x: 0, y: 0.03, z: 0, born: 0, damage: 4 },
      { id: 2, x: 0, y: 0.03, z: 0, born: 0.2, damage: 4 },
    ];
    for (let i = 1; i <= Math.round(2 / dt); i++) {
      w.time = i * dt;
      stepPollen(w, w.players, dt);
    }
    return { w, p };
  };
  const a = simulate(0.05),
    b = simulate(0.1);
  expect(a.p.hp).toBe(144);
  expect(b.p.hp).toBe(a.p.hp);
  a.p.evade = 0.3;
  a.w.time = 2.5;
  stepPollen(a.w, a.w.players, 0.5);
  expect(a.p.hp).toBe(144);
  a.p.evade = 0;
  a.p.x = 20;
  a.w.time = 3;
  stepPollen(a.w, a.w.players, 0.5);
  expect(a.p.hp).toBe(144);
});
it("clouds survive their owner's death but clear on wave intermission and terminal state", () => {
  const { w, p, e } = setup();
  w.time = 1;
  w.pollen = [{ id: 1, x: 0, y: 0.03, z: 0, born: 0, damage: 4 }];
  e.hp = 0;
  stepPollen(w, [p], 0.5);
  expect(p.hp).toBe(156);
  expect(w.pollen).toHaveLength(1);
  w.waveClearAt = 1;
  stepPollen(w, [p], 0.05);
  expect(w.pollen).toHaveLength(0);
  w.pollen = [{ id: 2, x: 0, y: 0.03, z: 0, born: 1, damage: 4 }];
  finish(w, false);
  expect(w.pollen).toHaveLength(0);
});
it("authoritative step and both recipients preserve the same attack/cloud snapshot", () => {
  const { w, p, e } = setup();
  step(w, {}, 0.05);
  expect(e.calyx?.kind).toBe("Slam");
  w.pollen = [{ id: 25, x: 0, y: 0.03, z: 0, born: 0.02, damage: 4 }];
  addPlayer(w, "b");
  const packet = prepareState(w, 0, {
    members: [],
    stage: 1,
    preparationGeneration: 1,
  });
  for (const id of [p.id, "b"]) {
    const state = JSON.parse(packet.packet(id)).world;
    expect(state.pollen).toEqual(w.pollen);
    expect(state.enemies[0].calyx).toEqual(e.calyx);
  }
});
it("plays both authored attacks from snapshot time and distance-driven walking", () => {
  const c = new StructureMotionController("calyx"),
    b = { setPose() {} };
  for (const kind of ["Slam", "PollenShot"] as const) {
    c.update(
      b,
      [
        {
          slot: 0,
          id: 1,
          moving: false,
          distance: 0,
          wind: 0,
          cool: 0,
          worldTime: 12,
          calyx: { kind, started: 10, fired: true, yaw: 0 },
        },
      ],
      0.016,
    );
    expect(c.states.get(1)?.clip).toBe(kind);
    expect(c.states.get(1)?.time).toBe(2);
  }
  c.update(
    b,
    [{ slot: 0, id: 1, moving: true, distance: 0.65, wind: 0, cool: 0 }],
    0.016,
  );
  expect(c.states.get(1)?.time).toBe(1);
  expect(reportPose("calyx", "attack", 1).clip).toBe("Slam");
  expect(reportPose("calyx", "attack", 4.6).clip).toBe("PollenShot");
});
it("ships the independently audited GLB unchanged with four clips and 16 bones", () => {
  const bytes = readFileSync("public/assets/enemies/calyx_motion_v1.glb");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "ef8d7944603d409fff242895c0f2fda56e00ace5b7c052e130fc707b53b39083",
  );
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  expect(gltf.animations.map((a: { name: string }) => a.name).sort()).toEqual([
    "Idle",
    "Locomotion",
    "PollenShot",
    "Slam",
  ]);
  expect(gltf.skins[0].joints).toHaveLength(16);
  expect(STAGES.findIndex((s) => s.waves.some((w) => w.troops.calyx))).toBe(6);
});
