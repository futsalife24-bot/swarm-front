import { describe, expect, it } from "vitest";
import { STARTERS, LIMITS } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  fire,
  hurtEnemy,
  neutral,
  spawn,
  start,
  type Enemy,
  type World,
} from "../src/shared/game";
import {
  REBUILD_COMBAT_BALANCE as BALANCE,
  cleanRebuildEnemyStatus,
  collectRebuildXp,
  createRebuildCombatState,
  rebuildManualHit,
  type RebuildAttribution,
} from "../src/shared/rebuild-combat";

function fixture() {
  const w = createWorld("combat", 42);
  w.rebuild = createRebuildCombatState();
  const p = addPlayer(w, "player", [STARTERS[0], STARTERS[0]]);
  p.x = p.y = p.z = 0;
  start(w);
  return { w, p, r: w.rebuild };
}
function enemy(w: World, z = -5, hp = 1000, kind: Enemy["kind"] = "crawler") {
  const e = spawn(w, kind, 0, z, "crown", 0)!;
  e.x = 0;
  e.z = z;
  e.y = 0;
  e.size = 1;
  e.hp = e.maxHp = hp;
  return e;
}
function marked(w: World, e: Enemy, manualHits = 0) {
  w.rebuild!.enemyStatus[e.id] = { marked: true, manualHits, lastShot: -1 };
}
function hit(w: World, e: Enemy, shotId: number, damage = 1) {
  rebuildManualHit(w, e, damage, "player", shotId);
}
function bursts(w: World) {
  return w.events.filter((event) => event.type === "burst" && event.rebuild);
}
function secondaryHits(w: World) {
  return w.events.filter(
    (event) =>
      event.type === "hit" &&
      event.rebuild?.source !== "manual" &&
      event.rebuild,
  );
}

describe("P1a action-origin explosions", () => {
  it("keeps ordinary hurtEnemy behavior outside the prototype", () => {
    const w = createWorld("legacy", 9);
    addPlayer(w, "player");
    const e = enemy(w);
    hit(w, e, 1, 10);
    expect(e.hp).toBe(990);
    expect(w.events.at(-1)?.rebuild).toBeUndefined();
  });
  it("hooks real rifle fire and assigns a new origin to every trigger", () => {
    const { w, p, r } = fixture();
    r.levels.fuse = 1;
    const e = enemy(w, -6);
    fire(w, p, neutral());
    expect(r.shotSerial).toBe(1);
    expect(r.enemyStatus[e.id]).toMatchObject({
      marked: true,
      manualHits: 1,
      lastShot: 1,
    });
    p.cool = 0;
    fire(w, p, neutral());
    expect(r.shotSerial).toBe(2);
    expect(r.manualHits).toBe(2);
    expect(bursts(w)).toHaveLength(1);
    expect(bursts(w)[0].rebuild).toMatchObject({
      originId: 2,
      source: "fuse",
      depth: 0,
    });
    expect(p.ammo[0]).toBe(30);
  });
  it("blast-core triggers only from a manual kill and attributes secondary kills without recursion", () => {
    const { w, r } = fixture();
    r.levels["blast-core"] = 1;
    const root = enemy(w, -5, 1),
      a = enemy(w, -7, 20),
      b = enemy(w, -9, 20),
      outside = enemy(w, -16, 20);
    hit(w, root, 17);
    expect(w.totalKills).toBe(3);
    expect(r.secondaryKills).toBe(2);
    expect(r.explosions).toBe(1);
    expect(outside.hp).toBe(20);
    const kills = w.events.filter((e) => e.type === "kill");
    expect(kills.map((e) => e.rebuild?.source)).toEqual([
      "manual",
      "blast-core",
      "blast-core",
    ]);
    expect(
      kills.every((e) => e.rebuild?.originId === 17 && e.owner === "player"),
    ).toBe(true);
    expect(kills.map((e) => e.rebuild?.targetId)).toEqual([
      root.id,
      a.id,
      b.id,
    ]);
    expect(w.drops).toEqual([]);
    expect(r.xpOrbs.reduce((sum, orb) => sum + orb.value, 0)).toBe(6);
  });
  it("fuse works alone, consumes the mark on the next trigger, and does not recount pellets", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    const root = enemy(w);
    hit(w, root, 1, 2);
    hit(w, root, 1, 2);
    hit(w, root, 1, 2);
    expect(root.hp).toBe(994);
    expect(r.manualHits).toBe(1);
    expect(r.enemyStatus[root.id]).toMatchObject({
      marked: true,
      manualHits: 1,
    });
    expect(r.explosions).toBe(0);
    hit(w, root, 2, 2);
    hit(w, root, 2, 2);
    expect(root.hp).toBe(956);
    expect(r.manualHits).toBe(2);
    expect(r.enemyStatus[root.id].marked).toBe(false);
    expect(r.explosions).toBe(1);
    hit(w, root, 3, 2);
    expect(r.enemyStatus[root.id].marked).toBe(true);
  });
  it("compression works alone on every third distinct hit on the same enemy", () => {
    const { w, r } = fixture();
    r.levels["compressed-charge"] = 1;
    const a = enemy(w),
      b = enemy(w, -7);
    hit(w, a, 1);
    hit(w, b, 2);
    hit(w, a, 3);
    hit(w, a, 3);
    expect(r.explosions).toBe(0);
    hit(w, a, 4);
    expect(r.explosions).toBe(1);
    expect(bursts(w)[0].rebuild?.source).toBe("compressed-charge");
    expect(b.hp).toBe(957);
    expect(r.enemyStatus[b.id].manualHits).toBe(1);
    for (const id of [5, 6, 7]) hit(w, a, id);
    expect(r.explosions).toBe(2);
  });
  it.each(["fuse", "blast-core"] as const)(
    "merges compression with %s into one wider explosion",
    (card) => {
      const { w, r } = fixture();
      r.levels[card] = 1;
      r.levels["compressed-charge"] = 1;
      const root = enemy(w, -5, card === "blast-core" ? 1 : 1000);
      const far = enemy(w, -12);
      marked(w, root, 2);
      hit(w, root, 9);
      expect(r.explosions).toBe(1);
      expect(bursts(w)[0].radius).toBe(BALANCE.compressedRadius);
      expect(far.hp).toBe(958);
      expect(
        secondaryHits(w).filter((e) => e.rebuild?.targetId === far.id),
      ).toHaveLength(1);
    },
  );
  it("a core blast applies marks but cannot itself detonate or advance hit counters", () => {
    const { w, r } = fixture();
    r.levels["blast-core"] = 1;
    r.levels.fuse = 1;
    r.levels["compressed-charge"] = 1;
    r.evolved = true;
    const root = enemy(w, -5, 1),
      nearby = enemy(w, -8),
      outside = enemy(w, -14);
    hit(w, root, 1);
    expect(r.enemyStatus[nearby.id]).toMatchObject({
      marked: true,
      manualHits: 0,
    });
    expect(r.enemyStatus[outside.id]?.marked ?? false).toBe(false);
    expect(r.explosions).toBe(1);
    hit(w, nearby, 2);
    expect(r.explosions).toBe(2);
    expect(r.enemyStatus[nearby.id].manualHits).toBe(1);
  });
  it("does not relay marks newly created by another impact of the same origin", () => {
    const { w, r } = fixture();
    r.levels["blast-core"] = 1;
    r.levels.fuse = 1;
    r.evolved = true;
    const root = enemy(w, 0, 1),
      a = enemy(w, -4),
      b = enemy(w, -2);
    hit(w, root, 1);
    expect(r.enemyStatus[a.id].marked).toBe(true);
    expect(r.enemyStatus[b.id].marked).toBe(true);
    hit(w, a, 1);
    expect(r.explosions).toBe(2);
    expect(bursts(w).some((event) => event.rebuild?.source === "chain")).toBe(
      false,
    );
    expect(r.enemyStatus[b.id].marked).toBe(true);
  });
  it("requires evolution for propagation and never treats secondary damage as a manual trigger", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    const root = enemy(w, 0),
      neighbor = enemy(w, -5);
    marked(w, root);
    marked(w, neighbor);
    hit(w, root, 1);
    expect(r.explosions).toBe(1);
    expect(r.enemyStatus[neighbor.id]).toMatchObject({
      marked: true,
      manualHits: 0,
    });
  });
  it("propagates only to depth two, dedupes overlap, and preserves the manual origin", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    r.evolved = true;
    const targets = [0, -5, -10, -15, -20].map((z) => enemy(w, z));
    targets.forEach((e) => marked(w, e));
    w.time = 8;
    hit(w, targets[0], 77);
    expect(bursts(w).map((e) => e.rebuild?.depth)).toEqual([0, 1, 2]);
    expect(bursts(w).map((e) => e.rebuild?.source)).toEqual([
      "fuse",
      "chain",
      "chain",
    ]);
    expect(bursts(w).every((e) => e.rebuild?.originId === 77)).toBe(true);
    expect(secondaryHits(w).map((e) => e.rebuild?.targetId)).toEqual(
      targets.slice(0, 4).map((e) => e.id),
    );
    expect(new Set(secondaryHits(w).map((e) => e.rebuild?.targetId)).size).toBe(
      4,
    );
    expect(targets.map((e) => e.hp)).toEqual([965, 966, 966, 966, 1000]);
    expect(r.enemyStatus[targets[3].id].marked).toBe(true);
    expect(r.lastChain).toBe(3);
    expect(r.maxChain).toBe(3);
    expect(r.lastChainAt).toBe(8);
    expect(r.firstEffectAt).toBe(8);
  });
  it("lets a marked enemy killed by the initiating burst relay exactly once", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    r.evolved = true;
    const root = enemy(w, 0),
      relay = enemy(w, -5, 20),
      far = enemy(w, -10, 20);
    [root, relay, far].forEach((e) => marked(w, e));
    hit(w, root, 3);
    expect(r.explosions).toBe(3);
    expect(r.secondaryKills).toBe(2);
    expect(w.totalKills).toBe(2);
    expect(r.manualHits).toBe(1);
    expect(r.xpOrbs).toHaveLength(2);
  });
  it("does not advance a target twice if an origin is delivered again after another origin", () => {
    const { w, r } = fixture();
    r.levels["compressed-charge"] = 1;
    const root = enemy(w);
    hit(w, root, 1);
    hit(w, root, 2);
    hit(w, root, 1);
    expect(root.hp).toBe(997); // Repeated physical impacts remain physical damage.
    expect(r.manualHits).toBe(2);
    expect(r.enemyStatus[root.id].manualHits).toBe(2);
    expect(r.explosions).toBe(0);
  });
  it("blocks blast damage through buildings and outside three-dimensional range", () => {
    const { w, r } = fixture();
    r.levels["blast-core"] = 1;
    const root = enemy(w, -5, 1),
      high = enemy(w, -5),
      outside = enemy(w, -11);
    high.y = 20;
    hit(w, root, 1);
    expect(high.hp).toBe(1000);
    expect(outside.hp).toBe(1000);
    // The existing visibility rule is used at both projectile and explosion paths.
    const { w: wallWorld, r: wallRules } = fixture();
    wallRules.levels["blast-core"] = 1;
    const wallRoot = enemy(wallWorld, 0, 1),
      wallTarget = enemy(wallWorld, 0);
    wallRoot.x = 32;
    wallTarget.x = 36;
    wallRoot.z = wallTarget.z = 0;
    hit(wallWorld, wallRoot, 2);
    expect(wallTarget.hp).toBe(1000);
  });
  it("keeps rule damage independent from visual event retirement", () => {
    function scenario(retire: boolean) {
      const { w, r } = fixture();
      r.levels.fuse = 1;
      r.evolved = true;
      const targets = Array.from({ length: 20 }, (_, i) => enemy(w, -(i % 5)));
      targets.forEach((e) => marked(w, e));
      if (!retire)
        for (let i = 0; i < LIMITS.events; i++)
          w.events.push({
            id: ++w.eventSerial,
            type: "burst",
            x: 0,
            y: 0,
            z: 0,
          });
      hit(w, targets[0], 8);
      return {
        hp: targets.map((e) => e.hp),
        chain: r.maxChain,
        kills: w.totalKills,
      };
    }
    expect(scenario(true)).toEqual(scenario(false));
  });
  it("bounds all secondary effects from one origin and records exhausted work", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    const root = enemy(w, 0);
    // Stress the guard above the normal 40-enemy cap without changing spawn limits.
    for (let i = 0; i < 130; i++) w.enemies.push({ ...root, id: ++w.serial });
    marked(w, root);
    hit(w, root, 9);
    expect(
      r.explosions +
        w.enemies.filter((e) => e.hp < e.maxHp - (e === root ? 1 : 0)).length,
    ).toBeLessThanOrEqual(BALANCE.effectBudget);
    expect(r.effectBudgetExhaustions).toBe(1);
    const after = w.enemies.map((e) => e.hp);
    hit(w, root, 9);
    expect(w.enemies.slice(1).map((e) => e.hp)).toEqual(after.slice(1));
  });
  it.each([NaN, Infinity, -1, 0])(
    "ignores invalid damage %s without creating effects",
    (damage) => {
      const { w, r } = fixture();
      r.levels.fuse = 1;
      const root = enemy(w);
      hit(w, root, 1, damage);
      expect(root.hp).toBe(1000);
      expect(r.manualHits).toBe(0);
      expect(w.events).toEqual([]);
    },
  );
  it("ignores already dead targets and cleans removed enemy status", () => {
    const { w, r } = fixture();
    r.levels.fuse = 1;
    const root = enemy(w);
    hit(w, root, 1);
    root.hp = 0;
    hit(w, root, 2);
    expect(r.manualHits).toBe(1);
    w.enemies = [];
    cleanRebuildEnemyStatus(w);
    expect(r.enemyStatus).toEqual({});
  });
});

describe("P1a XP instead of loot", () => {
  it("awards XP once per killed enemy and attributes only real secondary kills", () => {
    const { w, r } = fixture();
    for (const [i, kind] of (
      ["crawler", "spitter", "boss", "harrow"] as const
    ).entries()) {
      const e = enemy(w, -20, 1, kind);
      const origin: RebuildAttribution = {
        originId: i,
        source: i ? "chain" : "manual",
        depth: i ? 1 : 0,
      };
      hurtEnemy(w, e, 1, "player", 0, "rifle", origin);
      hurtEnemy(w, e, 1, "player", 0, "rifle", origin);
    }
    expect(w.totalKills).toBe(4);
    expect(r.secondaryKills).toBe(3);
    expect(r.xpOrbs.reduce((sum, orb) => sum + orb.value, 0)).toBe(45);
    expect(w.drops).toEqual([]);
    expect(w.pending.player).toEqual([]);
    expect(w.rewards).toEqual({});
  });
  it("collects nearby XP, sweeps the rest at resupply, and never collects twice", () => {
    const { w, r, p } = fixture();
    r.xpOrbs = [
      { id: 1, x: 3, y: 0, z: 4, value: 2 },
      { id: 2, x: 0, y: 0, z: 5.01, value: 3 },
    ];
    expect(collectRebuildXp(w)).toBe(2);
    expect(r.xp).toBe(2);
    expect(r.xpOrbs).toHaveLength(1);
    expect(collectRebuildXp(w)).toBe(0);
    p.hp = 0;
    expect(collectRebuildXp(w, true)).toBe(0);
    p.hp = 1;
    expect(collectRebuildXp(w, true)).toBe(3);
    expect(r.xp).toBe(5);
    expect(r.xpOrbs).toEqual([]);
  });
  it("caps orb records without losing any earned XP", () => {
    const { w, r } = fixture();
    for (let i = 0; i < BALANCE.maxOrbs + 10; i++) {
      w.enemies = [];
      const e = enemy(w, -20, 1);
      hurtEnemy(w, e, 1, "player");
    }
    expect(r.xpOrbs).toHaveLength(BALANCE.maxOrbs);
    expect(r.xpOrbs.reduce((sum, orb) => sum + orb.value, 0)).toBe(
      (BALANCE.maxOrbs + 10) * 2,
    );
    expect(collectRebuildXp(w, true)).toBe(340);
  });
});
