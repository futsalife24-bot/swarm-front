import { expect, it } from "vitest";
import { createFrontRun } from "../src/shared/front-run";
import { FRONT_RUN_CONFIG } from "../src/shared/front-run";
import { ENEMIES, stats } from "../src/shared/defs";
import { frontDedicatedSurvivalScale } from "../src/shared/front-survival";
import {
  frontEnemyFrozen,
  frontManualHit,
  tickFrontEffects,
} from "../src/shared/front-combat";
import {
  neutral,
  spawn,
  step,
  type Enemy,
  type World,
} from "../src/shared/game";
import { mapFor, stageFor } from "../src/shared/stages";

function make(players = 1, enabled = true) {
  const run = createFrontRun({
    runId: "elements",
    seed: 42,
    fusion: true,
    ...(enabled ? { survivalBuildVersion: 1 as const } : {}),
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i}` })),
  });
  const w = run.world;
  return { w, combat: w.front!.players.p0 };
}
function enemy(w: World, x = 25, z = 25, kind: Enemy["kind"] = "crawler") {
  const e = spawn(w, kind, x, z)!;
  e.hp = e.maxHp = 1000;
  return e;
}
function hit(w: World, e: Enemy, owner = "p0", shot = 1) {
  frontManualHit(w, e, 1, owner, shot);
}
it("燃焼は再命中で期限だけ更新し、既存tickを延期せず、死亡後は重複しない", () => {
  const { w, combat } = make();
  combat.levels["fire-rounds"] = 2;
  const e = enemy(w);
  hit(w, e);
  w.time = 0.4;
  hit(w, e, "p0", 2);
  w.time = 0.5;
  tickFrontEffects(w);
  expect(e.hp).toBe(1000 - 2 - 9);
  w.time = 3.4;
  tickFrontEffects(w);
  expect(e.hp).toBe(1000 - 2 - 9 * 6);
  w.time = 4;
  tickFrontEffects(w);
  expect(e.hp).toBe(1000 - 2 - 9 * 6);
  e.hp = 1;
  hit(w, e, "p0", 3);
  const kills = w.totalKills;
  w.time = 5;
  tickFrontEffects(w);
  expect(w.totalKills).toBe(kills);
});
it("燃焼撃破は通常の撃破・経験値経路を一度だけ通る", () => {
  const { w, combat } = make();
  combat.levels["fire-rounds"] = 3;
  const e = enemy(w);
  e.hp = 13;
  hit(w, e);
  w.time = 0.5;
  tickFrontEffects(w);
  expect(e.hp).toBe(0);
  expect(w.totalKills).toBe(1);
  expect(combat.secondaryKills).toBe(1);
  expect(combat.effects).toBe(1);
  expect(w.front!.orbs.length + w.front!.xp).toBeGreaterThan(0);
  w.time = 1;
  tickFrontEffects(w);
  expect(w.totalKills).toBe(1);
});
it("氷結は初回命中、解除後2秒の共有耐性、停止中の移動停止", () => {
  const { w, combat } = make(2);
  combat.levels["frost-rounds"] = 3;
  w.front!.players.p1.levels["frost-rounds"] = 3;
  const e = enemy(w, 15, 15);
  e.active = true;
  const before = { x: e.x, z: e.z, cool: e.cool };
  hit(w, e, "p0", 1);
  expect(frontEnemyFrozen(w, e)).toBe(true);
  expect(w.front!.freezes?.[e.id]).toEqual({ until: 1, readyAt: 3 });
  step(w, { p0: neutral(), p1: neutral() }, 0.1);
  expect({ x: e.x, z: e.z, cool: e.cool }).toEqual(before);
  w.time = 1;
  expect(frontEnemyFrozen(w, e)).toBe(false);
  hit(w, e, "p1", 2);
  expect(frontEnemyFrozen(w, e)).toBe(false);
  w.time = 3;
  hit(w, e, "p1", 3);
  expect(frontEnemyFrozen(w, e)).toBe(true);
});
it("初期の通常サイズ敵は専用ライフル24ダメージの初撃後に生きて停止する", () => {
  const { w, combat } = make();
  combat.levels["frost-rounds"] = 1;
  const p = w.players[0],
    e = spawn(w, "crawler", 15, 15, "crown", 0)!;
  const damage = stats(p.weapons[0]).damage;
  e.hp = e.maxHp =
    ENEMIES.crawler.hp *
    w.scale *
    stageFor(w).hp *
    e.size! *
    FRONT_RUN_CONFIG.normalHpMultiplier *
    frontDedicatedSurvivalScale(w.time).hp;
  expect(damage).toBe(24);
  expect(e.hp).toBeGreaterThan(damage);
  frontManualHit(w, e, damage, p.id, 1);
  expect(e.hp).toBeGreaterThan(0);
  expect(frontEnemyFrozen(w, e)).toBe(true);
  expect(w.front!.freezes?.[e.id]).toEqual({ until: 0.5, readyAt: 2.5 });
  expect(w.events.filter((v) => v.frontEffect === "freeze")).toHaveLength(1);
});
it("ボス級と分節敵は氷結しない", () => {
  const { w, combat } = make();
  combat.levels["frost-rounds"] = 3;
  for (const kind of ["boss", "harrow", "bastion", "calyx"] as const) {
    const e = enemy(w, 25 + w.enemies.length * 3, 25, kind);
    for (let i = 0; i < 3; i++) hit(w, e, "p0", ++w.front!.shotSerial);
    expect(frontEnemyFrozen(w, e)).toBe(false);
  }
  const worm = spawn(w, "boss", 48, 25, "worm")!;
  for (let i = 0; i < 3; i++) hit(w, worm, "p0", ++w.front!.shotSerial);
  expect(frontEnemyFrozen(w, worm)).toBe(false);
});
it("電撃は近い順に上限まで、同距離はID順、二次効果から再帰しない", () => {
  const { w, combat } = make();
  combat.levels["chain-lightning"] = 1;
  const es = [
    enemy(w, 25, 25),
    enemy(w, 27, 25),
    enemy(w, 23, 25),
    enemy(w, 29, 25),
  ];
  for (let i = 1; i <= 3; i++) hit(w, es[0], "p0", i);
  expect(es.map((e) => 1000 - e.hp)).toEqual([3, 18, 0, 18]);
  expect(
    w.events.filter((e) => e.frontEffect === "chain-lightning"),
  ).toHaveLength(2);
  expect(
    w.events
      .filter((e) => e.frontEffect === "chain-lightning")
      .every((e) => e.type === "burst"),
  ).toBe(true);
  expect(combat.statuses[es[1].id]).toBeUndefined();
});
it("電撃3段階は最大4体、各30ダメージで打ち止め", () => {
  const { w, combat } = make();
  combat.levels["chain-lightning"] = 3;
  const es = Array.from({ length: 6 }, (_, i) => enemy(w, 25 + i * 2, 25));
  for (let i = 1; i <= 3; i++) hit(w, es[0], "p0", i);
  expect(es.map((e) => 1000 - e.hp)).toEqual([3, 30, 30, 30, 30, 0]);
});
it("電撃は異なる敵への手動3命中でも発動し、同一貫通射撃では一度だけ", () => {
  const { w, combat } = make();
  combat.levels["chain-lightning"] = 1;
  const es = Array.from({ length: 8 }, (_, i) => enemy(w, 25 + i * 2, 25));
  for (let i = 0; i < 6; i++) hit(w, es[i], "p0", 1);
  expect(combat.manualHits).toBe(6);
  expect(combat.lightningHits).toBe(0);
  expect(
    w.events.filter((e) => e.frontEffect === "chain-lightning"),
  ).toHaveLength(2);
  hit(w, es[6], "p0", 2);
  hit(w, es[7], "p0", 3);
  hit(w, es[0], "p0", 4);
  expect(
    w.events.filter((e) => e.frontEffect === "chain-lightning"),
  ).toHaveLength(4);
});
it("電撃で倒した敵は副次撃破を記録し、経験値は既存経路で一度だけ", () => {
  const { w, combat } = make();
  combat.levels["chain-lightning"] = 1;
  const source = enemy(w),
    victim = enemy(w, 27, 25);
  victim.hp = 10;
  for (let i = 1; i <= 3; i++) hit(w, source, "p0", i);
  expect(victim.hp).toBeLessThanOrEqual(0);
  expect(w.totalKills).toBe(1);
  expect(combat.secondaryKills).toBe(1);
  expect(combat.effects).toBe(1);
  expect(w.front!.orbs.length + w.front!.xp).toBeGreaterThan(0);
});
it("同一射撃の多段命中は属性回数を増やさず、壁越しに連鎖しない", () => {
  const { w, combat } = make();
  combat.levels["fire-rounds"] = 1;
  combat.levels["chain-lightning"] = 1;
  const b = mapFor(w).blocks[0],
    first = enemy(w),
    hidden = enemy(w, 27, 25);
  first.x = b.x - b.w / 2 - 0.85;
  first.z = b.z - b.d / 2 + 0.9;
  hidden.x = b.x - b.w / 2 + 0.9;
  hidden.z = b.z - b.d / 2 - 0.85;
  first.y = hidden.y = 0;
  for (let i = 0; i < 3; i++) hit(w, first, "p0", 1);
  expect(combat.lightningHits).toBe(1);
  hit(w, first, "p0", 2);
  hit(w, first, "p0", 3);
  expect(hidden.hp).toBe(1000);
  expect(
    w.events.filter((e) => e.frontEffect === "chain-lightning"),
  ).toHaveLength(0);
});
it("古い状態の任意フィールド欠落と旧作戦の境界を守る", () => {
  const { w, combat } = make(1, false);
  combat.levels["fire-rounds"] = 3;
  combat.levels["frost-rounds"] = 3;
  combat.levels["chain-lightning"] = 3;
  const e = enemy(w),
    other = enemy(w, 27, 25);
  for (let i = 1; i <= 3; i++) hit(w, e, "p0", i);
  w.time = 1;
  tickFrontEffects(w);
  expect(e.hp).toBe(997);
  expect(other.hp).toBe(1000);
  expect(frontEnemyFrozen(w, e)).toBe(false);
  const current = make().w;
  const old = enemy(current);
  current.front!.players.p0.statuses[old.id] = {
    marked: false,
    hits: 0,
    lastShot: -1,
  };
  tickFrontEffects(current);
  expect(old.hp).toBe(1000);
});
