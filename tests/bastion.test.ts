import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  enemyBodies,
  hurtEnemy,
  neutral,
  spawn,
  step,
  type Enemy,
  type World,
} from "../src/shared/game";
import {
  BASTION,
  bastionLanes,
  bastionReduction,
  bastionTier,
} from "../src/shared/bastion";
import { prepareState } from "../src/shared/state-wire";
import { mapFor } from "../src/shared/stages";
import { enemyReportId } from "../src/shared/enemy-identity";

const DT = 0.05;

function setup(players = 1, z = 12) {
  const w = createWorld("bastion-" + players, 7, 1);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  for (let i = 0; i < players; i++) {
    const p = addPlayer(w, "p" + i);
    Object.assign(p, { x: i * 1.5, y: 0, z, hp: 100000 });
  }
  const e = spawn(w, "bastion", 0, 0)!;
  e.active = true;
  return { w, e };
}
function tick(w: World, n = 1) {
  const inputs = Object.fromEntries(w.players.map((p) => [p.id, neutral()]));
  for (let i = 0; i < n; i++) step(w, inputs, DT);
}
// 実際のtick進行と同じ時刻列で、interval秒ごとに1回撃つ。
function sustained(
  w: World,
  e: Enemy,
  interval: number,
  seconds: number,
  damage = 10,
  owners = ["p0"],
) {
  let next = w.time;
  const end = w.time + seconds;
  const dealt: number[] = [];
  while (w.time < end - 1e-9) {
    tick(w);
    while (next <= w.time + 1e-9) {
      for (const owner of owners) {
        const before = e.hp;
        hurtEnemy(w, e, damage, owner, 0, "rifle");
        dealt.push(before - e.hp);
      }
      next += interval;
    }
  }
  return dealt;
}

describe("BASTION hardening", () => {
  it("single, slow shots never harden and always take full damage", () => {
    for (const interval of [0.6, 0.8, 1.05]) {
      const { w, e } = setup();
      e.hp = e.maxHp = 1e6;
      const dealt = sustained(w, e, interval, 6, 30);
      expect(e.bastion!.armor, String(interval)).toBe(0);
      expect(dealt.every((d) => Math.abs(d - 30) < 1e-9)).toBe(true);
    }
  });

  it("sustained fire hardens in steps and never reduces more than 60%", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9; // 反撃なしで上限だけを見る
    const dealt = sustained(w, e, 0.07, 3, 10);
    expect(e.bastion!.armor).toBe(BASTION.max);
    expect(bastionTier(e.bastion!.armor)).toBe(3);
    expect(Math.min(...dealt)).toBeCloseTo(4, 6);
    expect(new Set(dealt.map((d) => d.toFixed(3)))).toEqual(
      new Set(["10.000", "8.000", "6.000", "4.000"]),
    );
  });

  it("caps the gain rate: 0→75 needs at least 0.8 s of chained hits", () => {
    for (const interval of [0.045, 0.07, 0.13]) {
      const { w, e } = setup();
      e.hp = e.maxHp = 1e6;
      e.bastion!.readyAt = 1e9;
      const start = w.time;
      let reached = Infinity;
      let next = w.time;
      while (w.time < start + 4) {
        tick(w);
        while (next <= w.time + 1e-9) {
          hurtEnemy(w, e, 10, "p0", 0, "rifle");
          next += interval;
        }
        if (e.bastion!.armor >= 75 && reached === Infinity)
          reached = w.time - start;
      }
      expect(reached, String(interval)).toBeGreaterThanOrEqual(0.8 - 1e-9);
      expect(reached, String(interval)).toBeLessThan(2);
    }
  });

  it("a shotgun blast is one hit group: one gain and one reduction for all pellets", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    e.bastion!.armor = 49; // 段階1。次の加算で段階2へ上がる位置
    e.bastion!.hitAt = w.time; // 連続中
    tick(w);
    const before = e.hp;
    for (let pellet = 0; pellet < 8; pellet++)
      hurtEnemy(w, e, 19, "p0", 0, "shotgun");
    expect(e.bastion!.armor).toBe(49 + BASTION.gain);
    // 全ペレットがtick開始時の段階1（20%）で軽減される。順序依存なし。
    expect(before - e.hp).toBeCloseTo(8 * 19 * 0.8, 6);
  });

  it("a blast never chains with itself: pellets of one tick are one starting hit", () => {
    const { w, e } = setup(2);
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    const blast = (owner: string) => {
      for (let pellet = 0; pellet < 8; pellet++)
        hurtEnemy(w, e, 19, owner, 0, "shotgun");
    };
    tick(w);
    blast("p0");
    expect(e.bastion!.armor).toBe(0);
    // 同じ散弾銃の次弾（0.8秒後）は連続にならない。
    tick(w, 16);
    blast("p0");
    expect(e.bastion!.armor).toBe(0);
    // 別の隊員の散弾が0.3秒以内に続くと、その斉射が1回だけ加算される。
    tick(w, 6);
    blast("p1");
    expect(e.bastion!.armor).toBe(BASTION.gain);
  });

  it("explosions, pierce and four co-op shooters in one tick add at most one step", () => {
    const { w, e } = setup(4);
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    e.bastion!.hitAt = w.time;
    tick(w);
    for (const owner of ["p0", "p1", "p2", "p3"]) {
      hurtEnemy(w, e, 10, owner, 0, "rifle");
      hurtEnemy(w, e, 40, owner); // 爆風・副次効果（weapon無し）
    }
    expect(e.bastion!.armor).toBe(BASTION.gain);
    // 次のtick（0.05秒後）は gainInterval 未満なので加算されない。
    tick(w);
    hurtEnemy(w, e, 10, "p1", 0, "rifle");
    expect(e.bastion!.armor).toBe(BASTION.gain);
    tick(w);
    hurtEnemy(w, e, 10, "p2", 0, "rifle");
    expect(e.bastion!.armor).toBe(2 * BASTION.gain);
  });

  it("tags hits with the armor step that reduced them (deflection sparks)", () => {
    const { w, e } = setup();
    e.hp = e.maxHp = 1e6;
    e.bastion!.readyAt = 1e9;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    expect(w.events.filter((v) => v.type === "hit").at(-1)!.guard).toBeUndefined();
    e.bastion!.armor = 80;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    const hit = w.events.filter((v) => v.type === "hit").at(-1)!;
    expect(hit.guard).toBe(3);
    expect(hit.amount).toBe(4);
  });

  it("zero damage neither chains nor delays recovery", () => {
    const { w, e } = setup();
    e.bastion!.armor = 40;
    e.bastion!.hitAt = w.time;
    tick(w);
    hurtEnemy(w, e, 0, "p0");
    expect(e.bastion!.hitAt).toBeLessThan(w.time);
    expect(e.bastion!.armor).toBe(40);
  });

  it("recovers after 1.2 s without hits and is fully soft within 3.7 s", () => {
    const { w, e } = setup();
    e.bastion!.readyAt = 1e9;
    e.bastion!.armor = 100;
    e.bastion!.hitAt = w.time;
    tick(w, Math.round(1.15 / DT));
    expect(e.bastion!.armor).toBe(100);
    tick(w, Math.round(0.3 / DT));
    expect(e.bastion!.armor).toBeLessThan(100);
    tick(w, Math.round(2.4 / DT));
    expect(e.bastion!.armor).toBe(0);
    expect(bastionReduction(e.bastion!)).toBe(0);
  });
});

describe("BASTION counter volley", () => {
  function hardened(armor: number) {
    const s = setup();
    s.e.hp = s.e.maxHp = 1e6;
    s.e.bastion!.armor = armor;
    s.e.bastion!.hitAt = s.w.time;
    s.e.bastion!.aimReadyAt = 1e9; // 照準弾を除外
    return s;
  }

  it("telegraphs 0.8 s of body motion, then 0.8 s of red lanes, then fires", () => {
    const { w, e } = hardened(80);
    const start = w.time;
    tick(w);
    expect(e.bastion!.phase).toBe("brace");
    const position = { x: e.x, z: e.z };
    while (e.bastion!.phase === "brace") tick(w);
    expect(w.time - start).toBeCloseTo(BASTION.brace + DT, 6);
    expect(e.bastion!.volley!.count).toBe(BASTION.volley.low);
    const committed = structuredClone(e.bastion!.volley!);
    const lanes = bastionLanes(committed, mapFor(w).blocks);
    expect(w.projectiles.filter((q) => q.style === "bastion")).toHaveLength(0);
    while (e.bastion!.phase === "warn") {
      expect(e.bastion!.volley).toEqual(committed);
      tick(w);
    }
    expect(e.bastion!.phase).toBe("open");
    expect({ x: e.x, z: e.z }).toEqual(position); // 予兆中は移動しない
    const shots = w.projectiles.filter((q) => q.style === "bastion");
    expect(shots).toHaveLength(BASTION.volley.low);
    // 発射位置・方向は赤い予告のレーンと一致（発射tick分だけ前進済み）。
    shots.forEach((q, i) => {
      const yaw = Math.atan2(q.dx, q.dz);
      expect(Math.cos(yaw - lanes[i].yaw)).toBeCloseTo(1, 9);
      expect(q.y).toBeCloseTo(lanes[i].from.y, 6);
    });
  });

  it("keeps hardening during the body wind-up: firing on doubles the volley", () => {
    const { w, e } = hardened(76);
    tick(w);
    expect(e.bastion!.phase).toBe("brace");
    while (e.bastion!.phase === "brace") {
      tick(w);
      hurtEnemy(w, e, 10, "p0", 0, "rifle");
    }
    expect(e.bastion!.volley!.count).toBe(BASTION.volley.full);
    // 赤表示中の被弾は数を変えない。
    const armor = e.bastion!.armor;
    tick(w);
    hurtEnemy(w, e, 10, "p0", 0, "rifle");
    expect(e.bastion!.armor).toBe(armor);
  });

  it("opens for 2.2 s with no reduction or hardening, then waits for the cooldown", () => {
    const { w, e } = hardened(100);
    while (e.bastion!.phase !== "open") tick(w);
    const opened = w.time;
    expect(e.bastion!.armor).toBe(0);
    expect(bastionReduction(e.bastion!)).toBe(0);
    const before = e.hp;
    sustained(w, e, 0.07, 1.5, 10);
    expect(e.bastion!.armor).toBe(0);
    expect(before - e.hp).toBeCloseTo(10 * Math.round(1.5 / 0.07 + 1), -1);
    while (e.bastion!.phase === "open") tick(w);
    expect(w.time - opened).toBeCloseTo(BASTION.open, 1);
    // 開放後すぐに75へ戻しても、発射から6秒経つまで次の予兆へ入らない。
    e.bastion!.armor = 90;
    e.bastion!.hitAt = w.time;
    tick(w);
    expect(e.bastion!.phase).toBe("guard");
    expect(e.bastion!.readyAt - opened).toBeCloseTo(BASTION.counterCooldown, 6);
  });

  it("never fires after death and starts every spawn soft", () => {
    const { w, e } = hardened(100);
    tick(w, 5);
    expect(e.bastion!.phase).toBe("brace");
    hurtEnemy(w, e, 1e9, "p0");
    tick(w, 60);
    expect(w.enemies).toHaveLength(0);
    expect(w.projectiles.filter((q) => q.style === "bastion")).toHaveLength(0);
    const again = spawn(w, "bastion", 0, 0)!;
    expect(again.id).not.toBe(e.id);
    expect(again.bastion).toMatchObject({ armor: 0, phase: "guard", counters: 0 });
  });

  it("two bastions keep independent armor and timers", () => {
    const { w, e } = setup();
    const other = spawn(w, "bastion", 6, 0)!;
    other.active = true;
    e.hp = e.maxHp = other.hp = other.maxHp = 1e6;
    e.bastion!.readyAt = other.bastion!.readyAt = 1e9;
    sustained(w, e, 0.07, 2, 10);
    expect(e.bastion!.armor).toBe(BASTION.max);
    expect(other.bastion!.armor).toBe(0);
    expect(other.bastion!.hitAt).toBeUndefined();
  });

  it("is avoidable: a soldier between lanes is not hit, one on a lane is", () => {
    for (const onLane of [false, true]) {
      const { w, e } = hardened(80);
      const p = w.players[0];
      tick(w);
      while (e.bastion!.phase === "brace") tick(w);
      const lane = bastionLanes(e.bastion!.volley!, mapFor(w).blocks)[0];
      const yaw =
        lane.yaw + (onLane ? 0 : Math.PI / BASTION.volley.low);
      Object.assign(p, {
        x: e.x + Math.sin(yaw) * 8,
        z: e.z + Math.cos(yaw) * 8,
        hp: 1000,
      });
      tick(w, Math.round((BASTION.warn + 2) / DT));
      expect(p.hp < 1000, String(onLane)).toBe(onLane);
    }
  });

  it("adjacent lanes leave a 2 m wide gap beyond 3.9 m even at full volley", () => {
    const gap = (r: number, n: number) => 2 * r * Math.sin(Math.PI / n) - 2;
    expect(gap(3.9, BASTION.volley.full)).toBeGreaterThan(0);
    expect(gap(10, BASTION.volley.full)).toBeGreaterThan(3);
  });
});

describe("BASTION integration", () => {
  it("survives the snapshot encoder and stays out of encounter records", () => {
    const { w, e } = setup();
    e.bastion!.armor = 62.5;
    const packet = JSON.parse(
      prepareState(w, 0, { room: "test" }).packet("p0"),
    );
    expect(packet.world.enemies[0].bastion).toEqual(
      JSON.parse(JSON.stringify(e.bastion)),
    );
    expect(enemyReportId(e)).toBeUndefined();
  });

  it("spikes extend the hit body only as far as their roots", () => {
    const { e } = setup();
    const soft = enemyBodies(e)[0].radius;
    e.bastion!.armor = 100;
    expect(enemyBodies(e)[0].radius).toBeCloseTo(soft + BASTION.spikePad, 9);
    e.bastion!.phase = "open";
    expect(enemyBodies(e)[0].radius).toBeCloseTo(soft, 9);
  });

  it("real rifle fire through step() hardens it; a sniper or a shotgun does not", () => {
    for (const kind of ["rifle", "sniper", "shotgun"] as const) {
      const { w, e } = setup(1, 10);
      e.hp = e.maxHp = 1e6;
      e.bastion!.readyAt = 1e9;
      e.bastion!.aimReadyAt = 1e9;
      const p = w.players[0];
      p.weapons = [
        { id: "a", kind, rarity: 0, power: 1, effect: "none" },
        { id: "b", kind, rarity: 0, power: 1, effect: "none" },
      ];
      p.ammo = [999, 999];
      for (let i = 0; i < 40; i++) {
        // 中心へ向けたまま撃ち続ける（敵は周回するので毎tick照準を更新）。
        const yaw = Math.atan2(e.x - p.x, -(e.z - p.z));
        const pitch = Math.atan2(
          e.y + BASTION.hover - ((p.y ?? 0) + 1.5),
          Math.hypot(e.x - p.x, e.z - p.z),
        );
        p.ammo = [999, 999];
        step(w, { p0: { ...neutral(), fire: true, yaw, pitch } }, DT);
      }
      expect(e.hp, kind).toBeLessThan(1e6);
      if (kind === "rifle") expect(e.bastion!.armor).toBeGreaterThanOrEqual(75);
      else expect(e.bastion!.armor).toBe(0);
    }
  });
});
