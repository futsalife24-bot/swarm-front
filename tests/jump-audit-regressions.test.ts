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
