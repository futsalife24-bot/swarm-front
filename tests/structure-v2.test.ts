import { expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  start,
  spawn,
  step,
  neutral,
  type Enemy,
  fire,
  eye,
} from "../src/shared/game";
import {
  selectStructureTarget,
  clusterPoint,
  foundryPhase,
} from "../src/shared/structure-ai";
import { specialMotion } from "../src/shared/enemy-motion";
import { ENEMIES } from "../src/shared/defs";
import { troopCount, stageFor, troopAt } from "../src/shared/stages";
import { enemyGeometry } from "../src/client/enemy-model";
import { enemySize } from "../src/shared/enemy-size";

function field(kind: Enemy["kind"] = "crawler", count = 4, stage = 1) {
  const w = createWorld("structure", 123, stage);
  for (let i = 0; i < count; i++) addPlayer(w, String.fromCharCode(97 + i));
  start(w);
  w.enemies = [];
  w.nextSpawn = 1e9;
  w.players.forEach((p, i) => {
    p.x = 0;
    p.z = i * 2;
  });
  spawn(w, kind, 0, -10, "crown");
  const e = w.enemies[0];
  e.active = true;
  e.cool = 0;
  return { w, e, p: w.players[0] };
}

it("NEAREST excludes down/disconnected players and ties use stable IDs", () => {
  const { w, e } = field();
  w.players[0].hp = 0;
  w.players[1].connected = false;
  w.players[2].z = w.players[3].z = 0;
  expect(selectStructureTarget(e, w.players, () => true)?.id).toBe("c");
  expect(
    selectStructureTarget(e, [...w.players].reverse(), () => true)?.id,
  ).toBe("c");
});
it("PRISM picks the farthest visible ranged player, otherwise NEAREST", () => {
  const { w, e } = field("spitter");
  w.players.forEach((p, i) => (p.z = i * 10));
  expect(selectStructureTarget(e, w.players, (p) => p.id !== "d")?.id).toBe(
    "c",
  );
  expect(selectStructureTarget(e, w.players, () => false)?.id).toBe("a");
  w.players.forEach((p) => (p.z = 0));
  expect(selectStructureTarget(e, w.players, () => true)?.id).toBe("a");
});
it("ISOLATED chooses average distance from teammates; solo and ties are defined", () => {
  const { w, e } = field("hornet");
  w.players[3].z = 30;
  expect(selectStructureTarget(e, w.players, () => true)?.id).toBe("d");
  expect(selectStructureTarget(e, [w.players[0]], () => true)?.id).toBe("a");
  w.players[3].hp = 0;
  w.players[2].connected = false;
  expect(selectStructureTarget(e, w.players, () => true)?.id).toBe("a");
});
it("CLUSTER finds a centre between separated players and ignores ineligible members", () => {
  const { w } = field();
  Object.assign(w.players[0], { x: -6, z: 0 });
  Object.assign(w.players[1], { x: 6, z: 0 });
  Object.assign(w.players[2], { x: 0, z: 4 });
  Object.assign(w.players[3], { x: 35, z: 30 });
  const point = clusterPoint(w.players)!;
  expect(
    w.players.filter((p) => Math.hypot(p.x - point.x, p.z - point.z) < 7),
  ).toHaveLength(3);
  expect(clusterPoint([...w.players].reverse())).toEqual(point);
  expect(clusterPoint([w.players[0]])).toEqual({ x: -6, z: 0 });
  w.players.forEach((p) => (p.hp = 0));
  expect(clusterPoint(w.players)).toBeUndefined();
});
it("RAY tracks its selected player then keeps the final 0.4 seconds fixed", () => {
  const { w, e, p } = field("hornet", 1);
  step(w, {});
  expect(e.wind).toBe(2.05);
  expect(e.targetId).toBe(p.id);
  p.x = 2;
  step(w, {});
  expect(e.tx).toBe(2);
  while (e.wind > 0.4) step(w, {});
  const aim = { x: e.tx, z: e.tz };
  p.x = 5;
  while (e.wind > 0) step(w, {});
  expect({ x: e.tx, z: e.tz }).toEqual(aim);
  expect(w.projectiles[0].gravity).toBe(0);
  expect(w.projectiles[0].dy).toBeLessThan(0);
  expect(specialMotion(w, e, p, 0.05)).toBe(false);
});
it("PRISM snapshots and retreats below 16m without changing damage", () => {
  const { w, e, p } = field("spitter", 1);
  e.cool = 5;
  const before = Math.hypot(e.x - p.x, e.z - p.z);
  step(w, {});
  expect(Math.hypot(e.x - p.x, e.z - p.z)).toBeGreaterThan(before);
  e.cool = 0;
  step(w, {});
  const aim = { x: e.tx, z: e.tz };
  p.x = 3;
  while (e.wind > 0) step(w, {});
  expect({ x: e.tx, z: e.tz }).toEqual(aim);
  expect(w.projectiles[0].damage).toBeCloseTo(
    ENEMIES.spitter.damage * enemySize(e),
  );
});
it("HOUND shockwave hits forward after .45 seconds, not behind or outside range", () => {
  const { w, e } = field();
  e.x = 0;
  e.z = -1;
  Object.assign(w.players[0], { x: 0, z: 1 });
  Object.assign(w.players[1], { x: 0, z: -3 });
  Object.assign(w.players[2], { x: 3, z: 1 });
  Object.assign(w.players[3], { x: 0, z: 8 });
  step(w, {});
  expect(e.wind).toBe(0.45);
  const hp = w.players.map((p) => p.hp);
  while (e.wind > 0) step(w, {});
  expect(w.players[0].hp).toBeCloseTo(
    hp[0] - ENEMIES.crawler.damage * enemySize(e),
  );
  expect(w.players.slice(1).map((p) => p.hp)).toEqual(hp.slice(1));
});
it("FOUNDRY phases preserve HP, damage and scheduled wave count", () => {
  const { w, e } = field("boss");
  expect(foundryPhase(e)).toBe(1);
  e.hp = e.maxHp * 0.6;
  expect(foundryPhase(e)).toBe(2);
  e.hp = e.maxHp * 0.3;
  step(w, {});
  expect(e.phase).toBe(3);
  const aim = clusterPoint(w.players)!;
  expect({ x: e.tx, z: e.tz }).toEqual(aim);
  expect(e.wind).toBe(3.1);
  expect(ENEMIES.boss.damage).toBe(40);
  expect(troopCount(stageFor(w).waves[0])).toBeGreaterThan(0);
});
it("fabrication spends exactly one existing PRISM slot and never adds an extra wave enemy", () => {
  const { w, e } = field("boss", 1, 3);
  e.hp = e.maxHp * 0.6;
  const wave = stageFor(w).waves[0];
  while (troopAt(wave, w.spawned) !== "spitter") w.spawned++;
  const before = w.spawned;
  w.nextSpawn = 0;
  step(w, {});
  expect(w.spawned).toBe(before + 1);
  expect(w.enemies).toHaveLength(2);
  expect(w.enemies[1].kind).toBe("spitter");
  expect(e.fabrication).toBeGreaterThan(0);
  expect(Math.hypot(w.enemies[1].x - e.x, w.enemies[1].z - e.z)).toBeLessThan(
    6,
  );
  w.spawned = troopCount(wave);
  w.nextSpawn = 0;
  for (let i = 0; i < 100; i++) step(w, {});
  expect(w.enemies).toHaveLength(2);
});
it("a RAY whose target disconnects keeps its last telegraph point until launch", () => {
  const { w, e } = field("hornet", 4);
  w.players[3].z = 10;
  step(w, {});
  expect(e.targetId).toBe("d");
  const aim = { x: e.tx, z: e.tz };
  w.players[3].connected = false;
  w.players[0].x = 6;
  while (e.wind > 0) step(w, {});
  expect({ x: e.tx, z: e.tz }).toEqual(aim);
  expect(e.targetId).toBe("d");
});
it.each([1, 4])(
  "%s-player authority survives JSON restore mid-telegraph in city and cave",
  (count) => {
    for (const stage of [1, 10])
      for (const kind of ["crawler", "spitter", "hornet", "boss"] as const) {
        const { w, e } = field(kind, count, stage);
        e.cool = 0;
        for (let i = 0; i < 20; i++) step(w, {});
        const copy = JSON.parse(JSON.stringify(w));
        for (let i = 0; i < 100; i++) {
          step(w, {});
          step(copy, {});
        }
        expect(copy).toEqual(w);
      }
  },
);
it.each(["crawler", "spitter", "hornet", "boss"] as const)(
  "%s geometry and existing aim centre remain hittable",
  (kind) => {
    const geo = enemyGeometry(kind);
    geo.computeBoundingBox();
    const bounds = geo.boundingBox!;
    expect(bounds.min.y).toBeLessThan(ENEMIES[kind].aim);
    expect(bounds.max.y).toBeGreaterThan(ENEMIES[kind].aim);
    expect([...geo.attributes.position.array].every(Number.isFinite)).toBe(
      true,
    );
    geo.dispose();
    const { w, e, p } = field(kind, 1);
    const hp = e.hp;
    fire(w, p, {
      ...neutral(),
      fire: true,
      yaw: 0,
      pitch: Math.atan2(eye(e) - 1.5, 10),
    });
    expect(e.hp).toBeLessThan(hp);
  },
);

// Audit regressions: assert trajectories and actual damage, not only intent.
it("RAY shoots vertically down at speed 19 and hits the stationary player", () => {
  const { w, e, p } = field("hornet", 1);
  Object.assign(e, {
    x: 0,
    z: 0,
    y: 8,
    wind: 0.01,
    tx: 0,
    tz: 0,
    targetId: p.id,
  });
  const hp = p.hp;
  step(w, {});
  const q = w.projectiles[0];
  expect(q.dx).toBe(0);
  expect(q.dz).toBe(0);
  expect(q.dy).toBe(-19);
  for (let i = 0; i < 15; i++) step(w, {});
  expect(p.hp).toBeCloseTo(hp - ENEMIES.hornet.damage * enemySize(e));
});
it("RAY near-vertical shots have finite normalized 3D speed", () => {
  const { w, e, p } = field("hornet", 1);
  Object.assign(e, {
    x: 0,
    z: 0,
    y: 8,
    wind: 0.01,
    tx: 0.001,
    tz: 0.001,
    targetId: p.id,
  });
  step(w, {});
  const q = w.projectiles[0];
  expect(Math.hypot(q.dx, q.dy, q.dz)).toBeCloseTo(19);
  expect(Math.hypot(q.dx, q.dz)).toBeLessThan(0.01);
});
it("RAY uses roof height for line of fire and rejects an intersecting building", async () => {
  const { rayVisible, visible } = await import("../src/shared/game");
  const { e, p } = field("hornet", 1);
  Object.assign(e, { x: 0, z: 0, y: 20 });
  Object.assign(p, { x: 20, z: 0 });
  const blocks = [{ x: 5, z: 0, w: 2, d: 4, h: 3 }];
  expect(visible(e, p, blocks)).toBe(true); // relative-height ray clears the low wall
  expect(rayVisible(e, p, blocks)).toBe(true);
  blocks[0].h = 30;
  expect(rayVisible(e, p, blocks)).toBe(false);
});
it("FOUNDRY scores only players reachable by its damage rule", () => {
  const { w, e } = field("boss", 4);
  Object.assign(e, { x: 18, z: 8 });
  Object.assign(w.players[0], { x: 0, z: 18 });
  w.players.slice(1).forEach((p, i) => Object.assign(p, { x: 49, z: 6 + i }));
  step(w, {});
  expect({ x: e.tx, z: e.tz }).toEqual({ x: 0, z: 18 });
  const hp = w.players.map((p) => p.hp);
  while (e.wind > 0) step(w, {});
  expect(w.players[0].hp).toBeCloseTo(hp[0] - 40 * enemySize(e));
  expect(w.players.slice(1).map((p) => p.hp)).toEqual(hp.slice(1));
});
it("linked foundry targets a real member when the cluster centre is empty", async () => {
  const { clusterMember } = await import("../src/shared/structure-ai");
  const { w } = field("boss", 3);
  Object.assign(w.players[0], { x: -6, z: 0 });
  Object.assign(w.players[1], { x: 6, z: 0 });
  Object.assign(w.players[2], { x: 0, z: 6 });
  const point = clusterMember(w.players)!;
  expect(w.players.some((p) => p.x === point.x && p.z === point.z)).toBe(true);
  expect(clusterMember([...w.players].reverse())).toEqual(point);
});
it("energy impacts and trails leave no liquid residue and expire promptly", async () => {
  const { CombatEffects } = await import("../src/client/combat-effects");
  const T = await import("three");
  const effects = new CombatEffects(new T.Scene());
  effects.event({ id: 1, type: "acid", x: 0, y: 0, z: 0 });
  expect(
    effects.items.every((e) => e.kind === "flash" || e.kind === "spark"),
  ).toBe(true);
  expect(
    effects.items.map((e) => e.mesh.material.color.getHex()),
  ).not.toContain(0x9bcf36);
  effects.update(0.2);
  expect(effects.items).toHaveLength(0);
  effects.trails(
    [
      {
        id: 1,
        x: 0,
        y: 1,
        z: 0,
        dx: 0,
        dy: -19,
        dz: 0,
        life: 1,
        damage: 12,
        owner: "enemy",
        rocket: false,
      },
    ],
    0.05,
  );
  expect(effects.items[0].mesh.material.color.getHex()).toBe(0x65edff);
});
it("current changelog contains no legacy creature descriptions", async () => {
  const { CHANGELOG } = await import("../src/client/changelog");
  expect(JSON.stringify(CHANGELOG)).not.toMatch(
    /巨大ミミズ|アリの巣|蜂|蟻|蜘蛛|甲虫|噛みつき|酸/,
  );
});
