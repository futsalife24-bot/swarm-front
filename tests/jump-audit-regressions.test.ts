import { initWorm } from "../src/shared/worm";
import { expect, it } from "vitest";
import {
  addPlayer,
  blocked,
  createWorld,
  finish,
  neutral,
  spawn,
  step,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import { groundHeight } from "../src/shared/terrain";
import { ENEMIES } from "../src/shared/defs";
import { specialMotion } from "../src/shared/enemy-motion";
import { collectionStep, initSolo } from "../src/shared/solo-progression";
import { blankLevels, freshProgress } from "../src/client/progression-save";
import {
  readBattleCheckpoint,
  writeBattleCheckpoint,
} from "../src/client/battle-checkpoint";
import { predictPlayerMove } from "../src/client/player-prediction";

it.each([2, 7, 13, 14])(
  "restores buried checkpoint enemies and permits movement on stage %i",
  (stage) => {
    const w = createWorld("old-checkpoint", 17, stage),
      progress = freshProgress("normal");
    initSolo(w, stage, "normal", false, blankLevels());
    const p = addPlayer(w, "solo");
    w.phase = "battle";
    w.nextSpawn = 1e9;
    w.wave = 1;
    const blocks = mapFor(w).blocks;
    const points = Array.from({ length: 121 }, (_, n) => ({
      x: ((n % 11) - 5) * 8,
      z: (Math.floor(n / 11) - 5) * 8,
    }));
    const spot = points.find(
      (q) =>
        groundHeight(q.x, q.z, blocks) > 3 &&
        !blocked(q.x, q.z, 3, groundHeight(q.x, q.z, blocks), blocks),
    )!;
    expect(spot).toBeDefined();
    spawn(w, "ant", spot.x, spot.z);
    const e = w.enemies[0];
    e.x = spot.x;
    e.z = spot.z;
    e.y = 0;
    e.cool = 100;
    p.x = 0;
    p.z = 20;
    p.y = groundHeight(p.x, p.z, blocks);
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      },
    };
    expect(writeBattleCheckpoint(w, progress, storage)).toBe(true);
    const copy = readBattleCheckpoint(progress, storage)!.world;
    for (let n = 0; n < 60; n++) step(copy, {});
    const after = copy.enemies.find((a) => a.id === e.id)!;
    expect(after.y).toBeGreaterThanOrEqual(
      groundHeight(after.x, after.z, blocks) - 1e-6,
    );
    expect(Math.hypot(after.x - e.x, after.z - e.z)).toBeGreaterThan(1);
  },
);

it.each([2, 7, 13, 14])(
  "spider wall perches stay above local ground on stage %i",
  (stage) => {
    const w = createWorld("perch", 1, stage),
      p = addPlayer(w, "p"),
      blocks = mapFor(w).blocks;
    const b = blocks.find((b) => b.h > 5 && b.d > 6)!;
    expect(b).toBeDefined();
    spawn(w, "spider", 0, 0);
    const e = w.enemies[0];
    e.x = b.x + b.w / 2 + ENEMIES.spider.radius + 0.2;
    e.z = b.z;
    e.y = groundHeight(e.x, e.z, blocks);
    e.jump = 0;
    e.jumpWait = 10;
    e.wallCooldown = 0;
    expect(specialMotion(w, e, p, 0.05)).toBe(true);
    if (b.h - Math.max(b.terrainBase ?? 0, groundHeight(e.x, e.z, blocks)) > 5)
      expect(e.perch).toBeGreaterThan(0);
    for (let n = 0; n < 20; n++) {
      specialMotion(w, e, p, 0.05);
      expect(e.y).toBeGreaterThanOrEqual(groundHeight(e.x, e.z, blocks));
    }
  },
);

it("finishing during a jump lands during collection and allows another jump", () => {
  const w = createWorld("jump-victory", 1, 1);
  initSolo(w, 1, "normal", false, blankLevels());
  const p = addPlayer(w, "solo");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  step(w, { solo: { ...neutral(), jump: true } });
  expect(p.y).toBeGreaterThan(0);
  finish(w, true);
  for (let n = 0; n < 40; n++) collectionStep(w, neutral(), 0.05);
  expect(p.y).toBeCloseTo(groundHeight(p.x, p.z, mapFor(w).blocks));
  expect(p.verticalSpeed).toBe(0);
  collectionStep(w, { ...neutral(), jump: true }, 0.05);
  expect(p.y).toBeGreaterThan(0);
});

it("coop prediction preserves authoritative height near landing and across roof edges", () => {
  const p = { x: 0, z: 0, y: 0.1 };
  predictPlayerMove(p, 0.2, 0, []);
  expect(p.y).toBe(0.1);
  expect(p.x).toBeCloseTo(0.2);
  const roof = [{ x: 0, z: 0, w: 2, d: 2, h: 3.6 }];
  const q = { x: 1.4, z: 0, y: 3.6 };
  predictPlayerMove(q, 0.5, 0, roof);
  expect(q.x).toBeCloseTo(1.9);
  expect(q.y).toBe(3.6);
});

it.each([1, 3, 8, 12])(
  "rescues checkpoint enemies inside newly added structures on stage %i",
  (stage) => {
    const w = createWorld("old-building-checkpoint", 17, stage),
      progress = freshProgress("normal");
    initSolo(w, stage, "normal", false, blankLevels());
    const p = addPlayer(w, "solo");
    w.phase = "battle";
    w.wave = 1;
    w.nextSpawn = 1e9;
    const blocks = mapFor(w).blocks;
    const b = blocks.find(
      (b) => b.x === (stage === 1 ? 83 : 82) && b.z === (stage === 1 ? -40 : 0),
    )!;
    expect(b).toBeDefined();
    spawn(w, "ant", 0, 0);
    const e = w.enemies[0];
    Object.assign(e, { x: b.x, z: b.z, y: 0, cool: 100 });
    p.x = b.x - 24;
    p.z = b.z;
    p.y = 0;
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      },
    };
    expect(writeBattleCheckpoint(w, progress, storage)).toBe(true);
    const copy = readBattleCheckpoint(progress, storage)!.world;
    step(copy, {});
    const after = copy.enemies.find((a) => a.id === e.id)!;
    expect(blocked(after.x, after.z, ENEMIES.ant.radius, after.y, blocks)).toBe(
      false,
    );
    for (let n = 0; n < 200; n++) step(copy, {});
    expect(Math.hypot(after.x - e.x, after.z - e.z)).toBeGreaterThan(1);
    expect(after.hp).toBeGreaterThan(0);
  },
);

it("rescues dormant enemies and segmented bodies from a new building", () => {
  const w = createWorld("old-chain", 17, 3),
    p = addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  p.x = 0;
  p.z = 60;
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  e.active = false;
  e.x = 82;
  e.z = 0;
  e.y = 0;
  for (const n of e.segments!) {
    n.x = 82;
    n.z = 0;
    n.y = 0;
  }
  step(w, {});
  for (const n of [e, ...e.segments!])
    expect(blocked(n.x, n.z, ENEMIES.boss.radius, n.y, mapFor(w).blocks)).toBe(
      false,
    );
});

it("does not lift a normally colliding ground enemy onto a nearby roof", () => {
  const w = createWorld("wall-clearance", 17, 3);
  addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const b = mapFor(w).blocks.find((b) => b.x === 82 && b.z === 0)!;
  spawn(w, "ant", 0, 0);
  const e = w.enemies[0];
  Object.assign(e, {
    x: b.x + b.w / 2 + ENEMIES.ant.radius * 0.8,
    z: 0,
    y: 0,
    active: false,
  });
  step(w, {});
  expect(e.y).toBe(0);
});

it("resumes an active saved worm whose ground trail crosses an added annex", () => {
  const w = createWorld("old-worm-trail", 17, 3);
  const p = addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  p.x = 60;
  p.z = -40;
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  e.active = true;
  const nodes = [e, ...e.segments!];
  for (const [i, n] of nodes.entries()) {
    n.x = 82;
    n.z = -i * 3.2;
    n.y = 0;
    n.trailOwner = 0;
    n.trailOffset = i * 3.2;
    n.groundPath = undefined;
    n.groundGoal = undefined;
  }
  e.trail = [
    { x: 82, z: -35 },
    { x: 82, z: 0 },
  ];
  const original = { x: e.x, z: e.z };
  for (let n = 0; n < 100; n++) step(w, {});
  expect(Math.hypot(e.x - original.x, e.z - original.z)).toBeGreaterThan(1);
});

it.each([18, 20])(
  "a dormant checkpoint worm resumes legal ground motion on stage %i",
  (stage) => {
    const w = createWorld("old-dormant-chain", 17, stage),
      progress = freshProgress("normal");
    initSolo(w, stage, "normal", false, blankLevels());
    const p = addPlayer(w, "solo");
    w.phase = "battle";
    w.wave = 1;
    w.nextSpawn = 1e9;
    p.x = 0;
    p.z = 60;
    spawn(w, "boss", 0, 0, "worm");
    const e = w.enemies[0];
    e.active = false;
    const nodes = [e, ...e.segments!];
    for (const [i, n] of nodes.entries()) {
      n.x = 82;
      n.z = -i * 3.2;
      n.y = 0;
      n.trailOwner = 0;
      n.trailOffset = i * 3.2;
      n.groundPath = undefined;
      n.groundGoal = undefined;
    }
    e.trail = [
      { x: 82, z: -35 },
      { x: 82, z: 0 },
    ];
    initWorm(e);
    e.segments![3].partHp = 0;
    const partsBefore = nodes.map((n) => n.partHp);
    const values = new Map<string, string>();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
      removeItem: (k: string) => {
        values.delete(k);
      },
    };
    expect(writeBattleCheckpoint(w, progress, storage)).toBe(true);
    const copy = readBattleCheckpoint(progress, storage)!.world;
    step(copy, {});
    const restored = copy.enemies.find((n) => n.id === e.id)!;
    expect(restored.active).toBe(false);
    copy.players[0].x = 65;
    copy.players[0].z = 0;
    copy.players[0].y = 0;
    step(copy, {});
    expect(restored.active).toBe(true);
    const recovered = { x: restored.x, z: restored.z };
    for (let n = 0; n < 100; n++) step(copy, {});
    expect(
      Math.hypot(restored.x - recovered.x, restored.z - recovered.z),
    ).toBeGreaterThan(1);
    expect([restored, ...restored.segments!].map((n) => n.partHp)).toEqual(
      partsBefore,
    );
  },
);
