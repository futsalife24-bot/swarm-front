import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { STARTERS, stats, LIMITS, ENEMIES } from "../src/shared/defs";
import {
  blocked,
  hurtEnemy,
  neutral,
  spawn,
  validInput,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";
import { maxHp } from "../src/shared/solo-progression";
import { prepareState } from "../src/shared/state-wire";
import { type RebuildUpgradeId } from "../src/shared/rebuild-upgrades";
import {
  REBUILD_RUN_CONFIG as CONFIG,
  chooseRebuildUpgrade,
  createRebuildRun,
  getRebuildRunView,
  rerollRebuildRunOffer,
  stepRebuildRun,
  type RebuildRun,
} from "../src/shared/rebuild-run";
import { pilot } from "./bot";

function combat(seed = 42): RebuildRun {
  const run = createRebuildRun({ runId: `run-${seed}`, seed });
  expect(chooseRebuildUpgrade(run, "blast-core")).toBe(true);
  return run;
}
function boundary(run: RebuildRun, index: number, xp = 0) {
  run.boundaryIndex = index;
  run.world.time = CONFIG.selectionBoundaries[index];
  if (xp)
    run.world.rebuild!.xpOrbs.push({
      id: ++run.world.serial,
      x: 80,
      y: 0,
      z: -80,
      value: xp,
    });
  stepRebuildRun(run);
}
function chooseAll(run: RebuildRun) {
  while (run.phase === "selection")
    expect(chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId)).toBe(
      true,
    );
}
function offerCard(run: RebuildRun, card: RebuildUpgradeId) {
  if (!run.upgrades.offer!.cardIds.includes(card)) {
    // Choose a deterministic seed that offers the target; no test-only mutation of
    // the runtime catalog or selection validator is needed for rank-effect tests.
    throw new Error(
      `Required fixture card ${card} not offered: ${run.upgrades.offer!.cardIds}`,
    );
  }
  expect(chooseRebuildUpgrade(run, card)).toBe(true);
}
afterEach(() => vi.unstubAllGlobals());

describe("P1a isolated run lifecycle", () => {
  it("starts one soldier with two independent standardized rifles and no combat before selection", () => {
    const before = JSON.stringify(STARTERS);
    const run = createRebuildRun({ runId: "isolated", seed: 42 });
    const p = run.world.players[0];
    expect(run.phase).toBe("selection");
    expect(run.world.time).toBe(0);
    expect(run.world.enemies).toEqual([]);
    expect(run.world.solo).toBeUndefined();
    expect(run.world.defense).toBeUndefined();
    expect(run.world.players).toHaveLength(1);
    expect(p.weapons).toHaveLength(2);
    expect(p.weapons[0]).not.toBe(p.weapons[1]);
    expect(p.weapons[0]).not.toBe(STARTERS[0]);
    expect(p.weapons.map((w) => stats(w))).toEqual([
      stats(STARTERS[0]),
      stats(STARTERS[0]),
    ]);
    expect(new Set(p.weapons.map((w) => w.id)).size).toBe(2);
    expect(JSON.stringify(STARTERS)).toBe(before);
    const snapshot = structuredClone(run.world);
    stepRebuildRun(run, { ...neutral(), fire: true, dodge: true }, 30);
    expect(run.world).toEqual(snapshot);
    expect(run.metrics.initialSelectionTime).toBe(30);
    expect(run.metrics.selectionTime).toBe(30);
    expect(rerollRebuildRunOffer(run)).toBe(false);
  });
  it.each([0, 42, 0x7fffffff, 0x80000000, 0xffffffff])(
    "accepts all uint32 seed boundaries: %s",
    (seed) => {
      const a = createRebuildRun({ runId: "seed", seed });
      const b = createRebuildRun({ runId: "seed", seed });
      expect(a).toEqual(b);
      expect(a.upgrades.rngState).toBe((seed ^ 0x51f15e) >>> 0);
    },
  );
  it.each([-1, 0x100000000, 0.5, NaN, Infinity])(
    "rejects invalid run seed %s",
    (seed) => expect(() => createRebuildRun({ seed })).toThrow(RangeError),
  );
  it("keeps private offers, request ledgers and offer RNG outside common state", () => {
    const run = createRebuildRun({ runId: "privacy", seed: 42 });
    const json = prepareState(run.world, 0, { room: "prototype" }).packet(
      run.world.players[0].id,
    );
    for (const field of [
      "offer",
      "offerId",
      "cardIds",
      "rngState",
      "processedRequestIds",
      "rerollsRemaining",
      "initialCardId",
      "upgrades",
    ])
      expect(JSON.parse(json).world).not.toHaveProperty(field);
    expect(json).not.toContain(run.upgrades.offer!.id);
    expect(JSON.parse(json).world.seed).toBe(0);
  });
  it.each([0, -1, NaN, Infinity])(
    "does not advance for invalid elapsed time %s",
    (dt) => {
      const run = combat();
      const snapshot = structuredClone(run);
      expect(stepRebuildRun(run, neutral(), dt)).toBe(run);
      expect(run).toEqual(snapshot);
    },
  );
  it("clamps a combat frame to 100ms and lands exactly on a selection boundary", () => {
    const run = combat();
    run.world.time = 29.98;
    run.world.rebuild!.xp = 12;
    stepRebuildRun(run, neutral(), 8);
    expect(run.world.time).toBe(30);
    expect(run.phase).toBe("selection");
    expect(run.boundaryIndex).toBe(1);
    expect(run.metrics.thresholdReachedAt[0]).toBe(30);
    chooseAll(run);
    stepRebuildRun(run, neutral(), 8);
    expect(run.world.time).toBe(30.1);
  });
  it("collects all boundary XP before granting rights and generating an offer", () => {
    const run = combat();
    expect(run.world.rebuild!.xp).toBe(0);
    boundary(run, 0, 36);
    expect(run.world.rebuild!.xpOrbs).toEqual([]);
    expect(run.world.rebuild!.xp).toBe(36);
    expect(run.upgrades.rightsGranted).toBe(2);
    expect(run.phase).toBe("selection");
    expect(run.metrics.thresholdReachedAt.slice(0, 2)).toEqual([30, 30]);
    expect(run.upgrades.offer?.revision).toBe(1);
    expect(chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId)).toBe(
      true,
    );
    expect(run.phase).toBe("selection");
    expect(run.upgrades.offer?.revision).toBe(2);
    expect(run.upgrades.rightsSpent).toBe(1);
    expect(chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId)).toBe(
      true,
    );
    expect(run.phase).toBe("combat");
    expect(run.upgrades.rightsSpent).toBe(2);
    expect(run.world.time).toBe(30);
    expect(run.upgrades.evolved).toBe(true);
    expect(run.metrics.evolutionAt).toBe(30);
  });
  it("skips a boundary with no earned right and never grants picks merely for elapsed time", () => {
    const run = combat();
    for (let i = 0; i < CONFIG.selectionBoundaries.length - 1; i++) {
      boundary(run, i);
      expect(run.phase).toBe("combat");
      expect(run.upgrades.offer).toBeNull();
      expect(run.upgrades.picks).toBe(1);
      expect(run.upgrades.rightsGranted).toBe(0);
    }
  });
  it("fully freezes enemies, projectiles, damage, recovery, cooldowns, spawns and combat clock during all owed choices", () => {
    const run = combat();
    boundary(run, 0, 36);
    const w = run.world,
      p = w.players[0];
    p.hp = 80;
    p.safe = 10;
    p.reload = 1;
    p.cool = 0.2;
    p.evade = 0.2;
    p.evadeCd = 1;
    p.swapCd = 1;
    spawn(w, "crawler", p.x, p.z);
    w.projectiles.push({
      id: ++w.serial,
      x: p.x,
      y: 1,
      z: p.z,
      dx: 10,
      dy: 0,
      dz: 0,
      life: 3,
      owner: "enemy",
      damage: 99,
      rocket: false,
    });
    w.pollen = [
      { id: ++w.serial, x: p.x, z: p.z, y: 0, born: 0, life: 5 },
    ] as typeof w.pollen;
    run.pendingSpawns.push({ x: 0, z: -50, at: w.time, kinds: ["crawler"] });
    const snapshot = structuredClone(w),
      spawns = structuredClone(run.pendingSpawns);
    for (let i = 0; i < 20; i++)
      stepRebuildRun(
        run,
        {
          ...neutral(),
          fire: true,
          reload: true,
          swap: true,
          dodge: true,
          mz: 1,
        },
        10,
      );
    expect(w).toEqual(snapshot);
    expect(run.pendingSpawns).toEqual(spawns);
    expect(run.metrics.selectionTime).toBe(200);
    expect(run.metrics.initialSelectionTime).toBe(0);
    expect(chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId)).toBe(
      true,
    );
    const afterFirst = structuredClone(w);
    stepRebuildRun(run, neutral(), 100);
    expect(w).toEqual(afterFirst);
    expect(run.phase).toBe("selection");
    expect(w.enemies).toHaveLength(1);
    expect(w.projectiles).toHaveLength(1);
  });
  it("updates armor HP only by the baseline delta and retains missing HP", () => {
    const run = combat();
    run.world.players[0].hp = 80;
    boundary(run, 0, 192);
    for (let i = 0; i < 2; i++)
      offerCard(run, run.upgrades.offer!.defaultCardId);
    const original = stats(STARTERS[0]);
    for (let rank = 1; rank <= 4; rank++) {
      offerCard(run, "armor");
      expect(maxHp(run.world)).toBeCloseTo(160 + 8 * rank);
      expect(run.world.players[0].hp).toBeCloseTo(80 + 8 * rank);
      expect(stats(run.world.players[0].weapons[0])).toEqual(original);
    }
    expect(run.upgrades.picks).toBe(7);
    expect(run.phase).toBe("combat");
  });
  it.each(["reload", "magazine"] as const)(
    "applies all four %s ranks to both rifles from fixed baseline values",
    (card) => {
      const run = combat();
      boundary(run, 0, 192);
      for (let i = 0; i < 2; i++)
        offerCard(run, run.upgrades.offer!.defaultCardId);
      const base = stats(STARTERS[0]);
      for (let rank = 1; rank <= 4; rank++) {
        offerCard(run, card);
        for (const weapon of run.world.players[0].weapons) {
          const current = stats(weapon);
          expect(current.mag).toBe(
            card === "magazine"
              ? base.mag + Math.ceil(base.mag * 0.1) * rank
              : base.mag,
          );
          expect(current.reload).toBeCloseTo(
            card === "reload" ? base.reload * (1 - 0.05 * rank) : base.reload,
          );
        }
      }
      expect(run.world.players[0].ammo).toEqual([base.mag, base.mag]);
      expect(stats(STARTERS[0])).toEqual(base);
    },
  );
  it("retains ordinary manual movement, shooting, reload, dodge and two-slot switching", () => {
    const run = combat(),
      p = run.world.players[0];
    const initial = { x: p.x, z: p.z, ammo: p.ammo[0] };
    stepRebuildRun(run, { ...neutral(), fire: true, mx: 1, dodge: true });
    expect(p.ammo[0]).toBe(initial.ammo - 1);
    expect(p.x).not.toBe(initial.x);
    expect(p.evadeCd).toBeGreaterThan(0);
    stepRebuildRun(run, { ...neutral(), reload: true });
    expect(p.reload).toBeGreaterThan(0);
    stepRebuildRun(run, { ...neutral(), swap: true });
    expect(p.slot).toBe(1);
    expect(p.swapCd).toBeGreaterThan(0);
    expect(run.world.rebuild!.shotSerial).toBe(1);
  });
});

describe("P1a final resupply, win/loss and isolation", () => {
  it("sweeps final XP, processes every banked right at frozen 5:45 and then immediately spawns the boss", () => {
    const run = combat();
    run.pendingSpawns.push({ x: 0, z: -50, at: 345, kinds: ["crawler"] });
    const lingering = spawn(run.world, "crawler", 0, -30)!;
    boundary(run, 6, 192);
    expect(run.finalResupplyDone).toBe(true);
    expect(run.phase).toBe("selection");
    expect(run.bossId).toBeNull();
    expect(run.metrics.xpAtFinalResupply).toBe(192);
    expect(run.upgrades.rightsGranted).toBe(6);
    expect(run.pendingSpawns).toEqual([]);
    for (let i = 0; i < 6; i++) {
      expect(run.bossId).toBeNull();
      const oldTime = run.world.time;
      chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId);
      expect(run.world.time).toBe(oldTime);
    }
    expect(run.phase).toBe("boss");
    expect(run.world.time).toBe(345);
    expect(run.world.enemies).toContain(lingering);
    const boss = run.world.enemies.find((e) => e.id === run.bossId)!;
    expect(boss.kind).toBe("boss");
    expect(boss.hp).toBe(CONFIG.bossHp);
    expect(boss.maxHp).toBe(CONFIG.bossHp);
    expect(run.metrics.picksAtFinalResupply).toBe(7);
    expect(run.metrics.evolutionAt).toBe(345);
  });
  it("spawns the boss without a pause if final XP earns no additional rights", () => {
    const run = combat();
    boundary(run, 6);
    expect(run.phase).toBe("boss");
    expect(run.bossId).not.toBeNull();
    expect(run.world.time).toBe(345);
    expect(run.upgrades.picks).toBe(1);
    expect(run.metrics.picksAtFinalResupply).toBe(1);
  });
  it("records boss-era XP only as score without new rights or selection stops", () => {
    const run = combat();
    boundary(run, 6);
    const p = run.world.players[0];
    run.world.rebuild!.xpOrbs.push({
      id: ++run.world.serial,
      x: p.x,
      y: 0,
      z: p.z,
      value: 192,
    });
    stepRebuildRun(run);
    expect(run.world.rebuild!.xp).toBe(192);
    expect(run.upgrades.rightsGranted).toBe(0);
    expect(run.phase).toBe("boss");
    expect(getRebuildRunView(run).nextXpThreshold).toBeNull();
    expect(getRebuildRunView(run).rightsPending).toBe(0);
    expect(run.metrics.thresholdReachedAt).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
  it("wins on boss death without waiting for adds and grants no loot, pending items or rewards", () => {
    const run = combat();
    boundary(run, 6);
    const boss = run.world.enemies.find((e) => e.id === run.bossId)!;
    spawn(run.world, "crawler", 0, -40);
    const p = run.world.players[0];
    run.world.pending[p.id] = [structuredClone(STARTERS[0])];
    run.world.rewards[p.id] = [structuredClone(STARTERS[0])];
    hurtEnemy(run.world, boss, CONFIG.bossHp, p.id);
    stepRebuildRun(run);
    expect(run.phase).toBe("victory");
    expect(run.world.phase).toBe("victory");
    expect(run.metrics.endedAt).toBeCloseTo(345.05);
    expect(run.world.enemies.some((e) => e.hp > 0)).toBe(true);
    expect(run.world.pending[p.id]).toEqual([]);
    expect(run.world.rewards).toEqual({});
    expect(run.world.drops).toEqual([]);
    expect(run.world.rebuild!.xp).toBe(20);
    expect(run.upgrades.rightsGranted).toBe(0);
    const snapshot = structuredClone(run);
    stepRebuildRun(run, { ...neutral(), fire: true }, 10);
    expect(run).toEqual(snapshot);
    expect(chooseRebuildUpgrade(run, "armor")).toBe(false);
    expect(rerollRebuildRunOffer(run)).toBe(false);
  });
  it("ends on soldier death and does not revive through selection or grant rewards", () => {
    const run = combat();
    run.world.players[0].hp = 0;
    stepRebuildRun(run);
    expect(run.phase).toBe("defeat");
    expect(run.metrics.endedAt).toBe(0.05);
    expect(run.world.rewards).toEqual({});
    const snapshot = structuredClone(run);
    stepRebuildRun(run);
    expect(run).toEqual(snapshot);
  });
  it("warns for the final minute and enforces the exact 9:00 hard timeout", () => {
    const run = combat();
    boundary(run, 6);
    run.world.time = 479.95;
    stepRebuildRun(run);
    expect(run.world.time).toBe(480);
    expect(run.status).toContain("60秒");
    run.world.time = 539.99;
    stepRebuildRun(run, neutral(), 1);
    expect(run.world.time).toBe(540);
    expect(run.phase).toBe("defeat");
    expect(run.metrics.endedAt).toBe(540);
    expect(run.world.rewards).toEqual({});
  });
  it("retry starts with no carried XP, upgrades, enemies, evolution or request history", () => {
    const previous = combat();
    boundary(previous, 0, 192);
    chooseAll(previous);
    previous.world.players[0].hp = 0;
    stepRebuildRun(previous);
    const next = createRebuildRun({ runId: "retry", seed: 42 });
    expect(next.world.rebuild!.xp).toBe(0);
    expect(next.upgrades.picks).toBe(0);
    expect(next.upgrades.processedRequestIds).toEqual([]);
    expect(next.upgrades.rerollsRemaining).toBe(2);
    expect(next.world.enemies).toEqual([]);
    expect(next.metrics.evolutionAt).toBeNull();
    expect(next.world.players[0].hp).toBe(160);
    expect(next.world.rebuild!.levels).not.toBe(previous.world.rebuild!.levels);
  });
  it("never reads or writes legacy browser storage throughout a run lifecycle", () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const run = combat();
    boundary(run, 0, 192);
    chooseAll(run);
    boundary(run, 6);
    hurtEnemy(
      run.world,
      run.world.enemies.find((e) => e.id === run.bossId)!,
      CONFIG.bossHp,
      run.world.players[0].id,
    );
    stepRebuildRun(run);
    createRebuildRun();
    for (const method of Object.values(storage))
      expect(method).not.toHaveBeenCalled();
    for (const name of ["rebuild-run", "rebuild-combat", "rebuild-upgrades"]) {
      const source = readFileSync(
        new URL(`../src/shared/${name}.ts`, import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(
        /(?:localStorage|sessionStorage|indexedDB|from\s+["'][^"']*(?:\/save|progression-save))/,
      );
    }
  });
});

describe("P1a spawns and ordinary-input playability sample", () => {
  it("never relocates the blocked second spitter from (24.7,36) onto a soldier at (0,-86)", () => {
    const run = combat(),
      w = run.world,
      p = w.players[0];
    Object.assign(p, { x: 0, y: 0, z: -86 });
    w.time = 120;
    run.boundaryIndex = 3;
    run.spawnIndex = 12;
    run.nextSpawnAt = 120;
    // Prevent AI movement without replacing the authored city with TRAINING_MAP.
    p.connected = false;
    const existing = spawn(w, "crawler", 0, -50)!;
    const oldEnemy = structuredClone(existing);
    expect(blocked(22, 36, 2, 0, mapFor(w).blocks)).toBe(false);
    expect(
      blocked(
        24.7,
        36,
        ENEMIES.spitter.radius,
        ENEMIES.spitter.cruise,
        mapFor(w).blocks,
      ),
    ).toBe(true);
    stepRebuildRun(run);
    expect(run.pendingSpawns).toHaveLength(1);
    const pending = run.pendingSpawns[0];
    expect(pending.kinds).toEqual(["crawler", "spitter"]);
    expect(pending).not.toMatchObject({ x: 22, z: 36 });
    const warnings = w.events.filter(
      (event) => event.type === "burst" && event.radius === 2,
    );
    expect(warnings.map(({ x, z }) => ({ x, z }))).toEqual(
      pending.kinds.map((_, index) => ({
        x: pending.x + index * 2.7,
        z: pending.z,
      })),
    );
    w.time = 121.6;
    stepRebuildRun(run);
    expect(w.enemies).toContain(existing);
    expect(existing).toEqual(oldEnemy);
    for (const e of w.enemies.filter((e) => e !== existing)) {
      expect(Math.hypot(e.x - p.x, e.z - p.z)).toBeGreaterThanOrEqual(
        CONFIG.minSpawnDistance,
      );
      expect(
        warnings.some((warning) => warning.x === e.x && warning.z === e.z),
      ).toBe(true);
    }
    expect(w.enemies).toHaveLength(3);
  });
  it("revalidates each pending kind/offset immediately before spawn without moving existing enemies", () => {
    const run = combat(),
      w = run.world,
      p = w.players[0];
    Object.assign(p, { x: 0, y: 0, z: -86 });
    w.time = 121.6;
    p.connected = false;
    run.boundaryIndex = 3;
    run.spawnIndex = 12;
    run.nextSpawnAt = 130;
    run.pendingSpawns = [
      { x: 22, z: 36, at: 121.5, kinds: ["crawler", "spitter"] },
    ];
    const existing = spawn(w, "crawler", 0, -50)!;
    stepRebuildRun(run);
    expect(w.enemies).toContain(existing);
    expect(
      w.enemies
        .filter((e) => e !== existing)
        .map(({ kind, x, z }) => ({ kind, x, z })),
    ).toEqual([{ kind: "crawler", x: 22, z: 36 }]);
    expect(run.pendingSpawns).toEqual([]);
  });
  it.each([0, 120, 210, 346])(
    "keeps every scheduled per-kind offset at its own safe warning across ingress entries at %ss",
    (time) => {
      const positions = [
        { x: 0, z: -86 },
        { x: 22, z: 36 },
        { x: -22, z: 36 },
        { x: 0, z: 68 },
        { x: 0, z: 0 },
        { x: 0, z: -56 },
        { x: 90, z: 100 },
        { x: 16, z: 0 },
        { x: 16.001, z: 0 },
        { x: -16, z: 0 },
        { x: 18.7, z: 0 },
        { x: 0, z: 16 },
        { x: 0, z: 15.999 },
      ];
      for (const position of positions)
        for (let ordinal = 0; ordinal < 24; ordinal++) {
          const run = combat(),
            w = run.world,
            p = w.players[0];
          Object.assign(p, position, {
            y: supportHeight(position.x, position.z, mapFor(w).blocks),
          });
          w.time = time;
          p.connected = false;
          run.boundaryIndex = CONFIG.selectionBoundaries.filter(
            (boundary) => boundary <= time,
          ).length;
          run.spawnIndex = ordinal;
          run.nextSpawnAt = time;
          stepRebuildRun(run);
          expect(run.pendingSpawns).toHaveLength(1);
          const pending = run.pendingSpawns[0];
          const expected = pending.kinds.map((kind, index) => ({
            kind,
            x: pending.x + index * 2.7,
            z: pending.z,
          }));
          const warnings = w.events.filter(
            (event) => event.type === "burst" && event.radius === 2,
          );
          expect(warnings).toHaveLength(expected.length);
          for (const target of expected) {
            const { radius, cruise } = ENEMIES[target.kind];
            const y =
              supportHeight(target.x, target.z, mapFor(w).blocks) + cruise;
            expect(
              blocked(target.x, target.z, radius, cruise, mapFor(w).blocks),
            ).toBe(false);
            expect(
              blocked(target.x, target.z, radius, y, mapFor(w).blocks),
            ).toBe(false);
            expect(
              Math.hypot(target.x - p.x, target.z - p.z),
            ).toBeGreaterThanOrEqual(CONFIG.minSpawnDistance);
            expect(
              warnings.some(
                (warning) => warning.x === target.x && warning.z === target.z,
              ),
            ).toBe(true);
          }
          w.time = pending.at;
          stepRebuildRun(run);
          expect(w.enemies.map(({ kind, x, z }) => ({ kind, x, z }))).toEqual(
            expected,
          );
          for (const e of w.enemies)
            expect(e.y).toBe(
              supportHeight(e.x, e.z, mapFor(w).blocks) +
                ENEMIES[e.kind].cruise,
            );
        }
    },
  );
  it.each([
    { x: 0, z: -86 },
    { x: 0, z: -36 },
    { x: 0, z: 0 },
    { x: 0, z: 36 },
    { x: 0, z: 100 },
    { x: 90, z: 100 },
  ])(
    "prevalidates boss placement and preserves the battlefield near %j",
    (position) => {
      const run = combat(),
        w = run.world,
        p = w.players[0];
      Object.assign(p, position, {
        y: supportHeight(position.x, position.z, mapFor(w).blocks),
      });
      const existing = spawn(w, "crawler", 0, -20)!;
      const oldEnemy = structuredClone(existing);
      w.projectiles.push({
        id: ++w.serial,
        x: 0,
        y: 1,
        z: -10,
        dx: 1,
        dy: 0,
        dz: 0,
        life: 3,
        owner: "enemy",
        damage: 1,
        rocket: false,
      });
      const oldProjectiles = structuredClone(w.projectiles);
      boundary(run, 6);
      const boss = w.enemies.find((enemy) => enemy.id === run.bossId)!;
      expect(boss).toBeDefined();
      expect(Math.hypot(boss.x - p.x, boss.z - p.z)).toBeGreaterThanOrEqual(
        CONFIG.minSpawnDistance,
      );
      expect(
        blocked(
          boss.x,
          boss.z,
          ENEMIES.boss.radius,
          ENEMIES.boss.cruise,
          mapFor(w).blocks,
        ),
      ).toBe(false);
      expect(
        w.events.some(
          (event) =>
            event.type === "burst" &&
            event.radius === 8 &&
            event.x === boss.x &&
            event.z === boss.z,
        ),
      ).toBe(true);
      expect(existing).toEqual(oldEnemy);
      expect(w.projectiles).toEqual(oldProjectiles);
    },
  );
  it("telegraphs spawns, enforces actual minimum distance, and stays within reserved capacity", () => {
    const run = combat();
    stepRebuildRun(run);
    expect(run.world.enemies).toEqual([]);
    expect(run.pendingSpawns).toHaveLength(1);
    expect(run.pendingSpawns[0].at).toBe(CONFIG.spawnWarning);
    const warning = run.world.events.find(
      (e) => e.type === "burst" && e.radius === 2,
    )!;
    expect(warning).toBeDefined();
    run.world.training = true;
    for (let i = 0; i < 3000; i++) {
      const old = new Set(run.world.enemies.map((e) => e.id));
      stepRebuildRun(run);
      const p = run.world.players[0];
      for (const e of run.world.enemies.filter((e) => !old.has(e.id))) {
        expect(Math.hypot(e.x - p.x, e.z - p.z)).toBeGreaterThanOrEqual(
          CONFIG.minSpawnDistance,
        );
      }
      expect(run.world.enemies.length).toBeLessThanOrEqual(CONFIG.enemyCap);
    }
    expect(run.world.enemies).toHaveLength(CONFIG.enemyCap);
    expect(run.world.enemies.length).toBeLessThan(LIMITS.enemies);
  });
  it("drops a pending ingress if the soldier moved inside its safety radius", () => {
    const run = combat();
    stepRebuildRun(run);
    const pending = run.pendingSpawns[0],
      p = run.world.players[0];
    p.x = pending.x;
    p.z = pending.z;
    run.world.time = pending.at;
    stepRebuildRun(run);
    expect(run.world.enemies).toEqual([]);
  });
  it("measures a deterministic normal-input run without changing HP, clock, enemy stats or XP", () => {
    const run = createRebuildRun({ runId: "pilot-4520", seed: 4520 });
    let ticks = 0;
    while (run.phase !== "victory" && run.phase !== "defeat" && ticks < 11000) {
      if (run.phase === "selection") {
        expect(
          chooseRebuildUpgrade(run, run.upgrades.offer!.defaultCardId),
        ).toBe(true);
      } else {
        const input = pilot(run.world, run.world.players[0].id);
        expect(validInput(input)).toBe(true);
        stepRebuildRun(run, input, 0.05);
        ticks++;
      }
    }
    const result = {
      seed: 4520,
      phase: run.phase,
      combatTime: run.world.time,
      firstEffectAt: run.metrics.firstEffectAt,
      evolutionAt: run.metrics.evolutionAt,
      evolvedCombatTime: run.metrics.evolvedCombatTime,
      picks: run.upgrades.picks,
      xpAtFinalResupply: run.metrics.xpAtFinalResupply,
      kills: run.metrics.kills,
      maxEnemies: run.metrics.maxEnemies,
      maxChain: run.world.rebuild!.maxChain,
      hp: run.world.players[0].hp,
    };
    console.info(
      "P1a normal-input sample (not a human-fun or mobile-performance verdict)",
      JSON.stringify(result),
    );
    expect(run.phase).toBe("victory");
    expect(run.world.time).toBeLessThanOrEqual(CONFIG.hardTimeout);
    expect(run.metrics.firstEffectAt).not.toBeNull();
    expect(run.metrics.firstEffectAt!).toBeLessThan(60);
    expect(run.upgrades.picks).toBe(7);
    expect(run.metrics.evolutionAt).not.toBeNull();
    expect(run.metrics.evolutionAt!).toBeLessThanOrEqual(270);
    expect(run.metrics.evolvedCombatTime).toBeGreaterThanOrEqual(60);
    expect(run.metrics.maxEnemies).toBeLessThanOrEqual(CONFIG.enemyCap + 1);
    expect(run.world.rewards).toEqual({});
  }, 30000);
});
