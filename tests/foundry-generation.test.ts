import { expect, it } from "vitest";
import {
  addPlayer,
  blocked,
  createWorld,
  hurtEnemy,
  spawn,
  start,
  step,
  type Projectile,
} from "../src/shared/game";
import { pendingFoundryCount } from "../src/shared/foundry-spawning";
import { ENEMIES } from "../src/shared/defs";
import {
  MAPS,
  STAGES,
  mapFor,
  stageFor,
  troopCount,
} from "../src/shared/stages";
import { wormNodes } from "../src/shared/worm";

function field(stage = 6) {
  const w = createWorld("foundry", 719, stage),
    p = addPlayer(w, "p");
  start(w);
  w.enemies = [];
  w.projectiles = [];
  w.nextSpawn = 1e9;
  p.x = 0;
  p.z = 38;
  const e = spawn(w, "boss", 0, 0, "worm")!;
  for (const node of wormNodes(e)) node.acidAt = 1e9;
  return { w, p, e };
}

it("generates exactly the head-attached count for all 128 body destruction patterns, once", () => {
  for (let mask = 0; mask < 128; mask++) {
    const { w, p, e } = field();
    for (let part = 1; part <= 7; part++)
      if (mask & (1 << (part - 1))) hurtEnemy(w, e, 1e6, p.id, part);
    const firstCut =
      Array.from({ length: 7 }, (_, i) => i + 1).find(
        (part) => mask & (1 << (part - 1)),
      ) ?? 8;
    hurtEnemy(w, e, 1e6, p.id, 0);
    step(w, {}, 0.01);
    expect(w.foundrySpawned ?? 0, `mask ${mask}`).toBe(firstCut - 1);
    const generated = w.enemies.filter((enemy) => enemy.foundrySource === e.id);
    expect(generated).toHaveLength(firstCut - 1);
    for (const enemy of generated) {
      expect(mapFor(w).foundryAllowed).toContain(enemy.kind);
      expect(enemy.segments).toBeUndefined();
      expect(
        blocked(
          enemy.x,
          enemy.z,
          ENEMIES[enemy.kind].radius,
          enemy.y,
          mapFor(w).blocks,
        ),
      ).toBe(false);
    }
    hurtEnemy(w, e, 1e6, p.id, 0);
    step(w, {}, 0.01);
    expect(w.foundrySpawned ?? 0).toBe(firstCut - 1);
  }
});

it("same-tick head/body damage yields body-first results in either order; later cuts do not change the count", () => {
  for (const order of [
    [0, 4],
    [4, 0],
  ]) {
    const { w, p, e } = field();
    for (const part of order) hurtEnemy(w, e, 1e6, p.id, part);
    step(w, {}, 0.01);
    expect(w.foundrySpawned).toBe(3);
    expect(e.segments![4].partHp).toBeGreaterThan(0);
  }
  const { w, p, e } = field();
  hurtEnemy(w, e, 1e6, p.id, 0);
  step(w, {}, 0.01);
  hurtEnemy(w, e, 1e6, p.id, 4);
  step(w, {}, 0.01);
  expect(w.foundrySpawned).toBe(7);
});

it("head loss alone preserves movement mode; a body cut accelerates the remaining chains", () => {
  const { w, p, e } = field();
  hurtEnemy(w, e, 1e6, p.id, 0);
  expect(e.fractured).not.toBe(true);
  hurtEnemy(w, e, 1e6, p.id, 3);
  expect(e.fractured).toBe(true);
});

it("the 40-enemy cap retains pending spawns through snapshots and releases exactly seven", () => {
  const { w, p, e } = field();
  for (let i = 0; i < 39; i++) {
    const enemy = spawn(w, "crawler")!;
    enemy.cool = 1e9;
  }
  hurtEnemy(w, e, 1e6, p.id, 0);
  step(w, {}, 0.01);
  expect(w.enemies).toHaveLength(40);
  expect(pendingFoundryCount(w)).toBe(7);
  const copy = JSON.parse(JSON.stringify(w));
  for (const state of [w, copy]) {
    for (const victim of state.enemies
      .filter((enemy: { kind: string }) => enemy.kind !== "boss")
      .slice(0, 6))
      hurtEnemy(state, victim, 1e6, p.id);
    step(state, {}, 0.01);
  }
  expect(copy).toEqual(w);
  expect(w.enemies).toHaveLength(40);
  expect(w.foundrySpawned).toBe(6);
  expect(pendingFoundryCount(w)).toBe(1);
  hurtEnemy(
    w,
    w.enemies.find((enemy) => enemy.kind !== "boss" && !enemy.foundrySource)!,
    1e6,
    p.id,
  );
  step(w, {}, 0.01);
  expect(w.enemies).toHaveLength(40);
  expect(w.foundrySpawned).toBe(7);
  expect(pendingFoundryCount(w)).toBe(0);
});

it("pending generation survives the original boss and blocks final victory, including an empty permission list", () => {
  const { w, p, e } = field();
  const map = mapFor(w),
    allowed = map.foundryAllowed;
  try {
    map.foundryAllowed = [];
    w.wave = stageFor(w).waves.length;
    w.spawned = troopCount(stageFor(w).waves[w.wave - 1]);
    hurtEnemy(w, e, 1e6, p.id, 0);
    step(w, {}, 0.01);
    for (let part = 1; part <= 7; part++) hurtEnemy(w, e, 1e6, p.id, part);
    step(w, {}, 0.01);
    expect(w.enemies).toHaveLength(0);
    expect(pendingFoundryCount(w)).toBe(7);
    expect(w.phase).toBe("battle");
    expect(w.totalKills).toBe(1);
    map.foundryAllowed = ["spitter"];
    step(w, {}, 0.01);
    expect(w.enemies).toHaveLength(7);
    expect(w.phase).toBe("battle");
    expect(w.enemies.every((enemy) => enemy.kind === "spitter")).toBe(true);
    for (const enemy of w.enemies) hurtEnemy(w, enemy, 1e6, p.id);
    step(w, {}, 0.01);
    expect(w.phase).toBe("victory");
    expect(w.totalKills).toBe(8);
  } finally {
    map.foundryAllowed = allowed;
  }
});

it("permission lists use every existing normal type on that map and never a boss", () => {
  for (const [index, map] of MAPS.entries()) {
    const expected = new Set(
      STAGES.filter((s) => s.map === index).flatMap((s) =>
        s.waves.flatMap((w) =>
          Object.entries(w.troops)
            .filter(([, n]) => n > 0)
            .map(([kind]) => kind),
        ),
      ),
    );
    expect(new Set(map.foundryAllowed)).toEqual(expected);
    expect(map.foundryAllowed).not.toContain("boss");
  }
});

function laser(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 100,
    style: "laser",
    x: 0,
    y: 1.2,
    z: -1.5,
    dx: 0,
    dy: 0,
    dz: 60,
    life: 100 / 60,
    owner: "enemy",
    damage: 10,
    rocket: false,
    gravity: 0,
    ...overrides,
  };
}
it("fast lasers sweep the player instead of tunnelling, honor walls and stop at their exact range", () => {
  const { w, p } = field();
  w.enemies = [];
  p.x = 0;
  p.z = 0;
  w.projectiles = [laser()];
  const hp = p.hp;
  step(w, {}, 0.05);
  expect(p.hp).toBeCloseTo(hp - 10 * stageFor(w).damage);
  expect(w.projectiles).toHaveLength(0);
  const wall = mapFor(w).blocks[0];
  p.x = wall.x + wall.w / 2 + 1.5;
  p.z = wall.z;
  const before = p.hp;
  w.projectiles = [
    laser({ x: wall.x - wall.w / 2 - 1.5, z: wall.z, dx: 60, dz: 0 }),
  ];
  for (let i = 0; i < 20; i++) step(w, {}, 0.05);
  expect(p.hp).toBe(before);
  p.x = 0;
  p.z = 80;
  const q = laser({ z: 0, life: 0.01 });
  w.projectiles = [q];
  step(w, {}, 0.05);
  expect(q.z).toBeCloseTo(0.6);
  expect(w.projectiles).toHaveLength(0);
});
