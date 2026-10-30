import { describe, expect, it } from "vitest";
import { STARTERS, stats } from "../src/shared/defs";
import { mapFor } from "../src/shared/stages";
import {
  addPlayer,
  createWorld,
  enemyBodies,
  neutral,
  spawn,
  start,
  step,
  type World,
} from "../src/shared/game";

const DT = 0.05;

function fixture() {
  const w = createWorld("player-projectile-pressure", 42);
  const p = addPlayer(w, "p");
  start(w);
  Object.assign(p, { x: 0, y: 0, z: 0 });
  p.weapons = [{ ...STARTERS[2] }, { ...STARTERS[0] }];
  p.ammo = [stats(p.weapons[0]).mag, stats(p.weapons[1]).mag];
  w.nextSpawn = 1e9;
  w.enemies = [];
  w.projectiles = [];
  w.events = [];
  return { w, p };
}

function enemyRounds(w: World, count: number) {
  for (let n = 0; n < count; n++)
    w.projectiles.push({
      id: ++w.serial,
      x: 20,
      y: 20,
      z: 20,
      dx: 1,
      dy: 0,
      dz: 0,
      life: 10,
      owner: "enemy",
      damage: 1,
      rocket: false,
    });
}

function fireInput() {
  return { ...neutral(), seq: 1, fire: true };
}

describe("手動の実体弾が敵弾密集と通過判定で消えない", () => {
  it.each([0, 100])(
    "敵弾%d個でも消費したロケットが生成され、敵へ着弾する",
    (count) => {
      const { w, p } = fixture();
      const target = spawn(w, "ant", 0, -12)!;
      // 攻撃予告中の通常個体にして、移動AIと新たな敵弾を切り離す。
      target.wind = 100;
      enemyRounds(w, count);
      const ammo = p.ammo[0];
      const hp = target.hp;

      step(w, { p: fireInput() }, DT);

      expect(p.ammo[0]).toBe(ammo - 1);
      expect(
        w.events.filter((e) => e.type === "shot" && e.owner === p.id),
      ).toHaveLength(1);
      expect(w.projectiles.filter((q) => q.owner === p.id)).toHaveLength(1);
      for (let n = 0; n < 20; n++) step(w, { p: neutral() }, DT);
      expect(target.hp).toBeLessThan(hp);
    },
  );

  it("1tickの始点と終点が敵球の外でも、途中で交差したロケットは直撃する", () => {
    const { w, p } = fixture();
    const target = spawn(w, "ant", 0, -0.7)!;
    target.wind = 100;
    const initialBody = enemyBodies(target)[0];
    // 通常ロケットの移動距離1.4mの中央で敵球の端を横切る。
    target.x = initialBody.radius - 0.05;
    const body = enemyBodies(target)[0];
    const shotY = p.y! + 1.5;
    const weapon = stats(p.weapons[0]);
    if (!("speed" in weapon) || !weapon.speed)
      throw new Error("試験武器は通常の実体弾である必要があります");
    const travel = weapon.speed * DT;
    const radial = Math.hypot(body.x, body.y - shotY);
    const startDistance = Math.hypot(radial, body.z);
    const endDistance = Math.hypot(radial, body.z + travel);
    expect(radial).toBeLessThan(body.radius);
    expect(-body.z).toBeGreaterThan(0);
    expect(-body.z).toBeLessThan(travel);
    expect(startDistance).toBeGreaterThan(body.radius);
    expect(endDistance).toBeGreaterThan(body.radius);
    const hp = target.hp;

    step(w, { p: fireInput() }, DT);

    expect(target.hp).toBeLessThan(hp);
    expect(w.projectiles.some((q) => q.owner === p.id)).toBe(false);
    expect(w.events.some((e) => e.type === "burst" && e.owner === p.id)).toBe(
      true,
    );
  });

  it.each([false, true])(
    "敵配列の反転=%sでも最初の球面で着弾し、直撃した個体だけからchainが起きる",
    (reverse) => {
      const { w, p } = fixture();
      p.weapons[0] = { ...p.weapons[0], rarity: 1, effect: "chain" };
      const near = spawn(w, "ant", 0, -2)!;
      const far = spawn(w, "ant", 0, -2.5)!;
      // 同じ個体倍率に揃え、中心順と球面の入射順が逆転しない条件を作る。
      far.size = near.size;
      near.wind = far.wind = 100;
      const body = enemyBodies(near)[0];
      if (reverse) w.enemies.reverse();

      // 水平の自動照準補助を使わず、通常ロケットを固定角で撃つ。
      step(w, { p: { ...fireInput(), pitch: 0.3 } }, DT);

      const bursts = w.events.filter((e) => e.type === "burst");
      expect(bursts).toHaveLength(2);
      expect(
        Math.hypot(
          bursts[0].x - body.x,
          bursts[0].y - body.y,
          bursts[0].z - body.z,
        ),
      ).toBeCloseTo(body.radius, 8);
      expect(bursts[1].z).toBe(near.z);
      expect(w.projectiles.some((q) => q.owner === p.id)).toBe(false);
    },
  );

  it("同じ移動区間内の敵球より手前に壁があれば、壁で爆発して壁越しに直撃しない", () => {
    const { w, p } = fixture();
    const target = spawn(w, "ant", 0, -2.7)!;
    target.wind = 100;
    const hp = target.hp;
    const blocks = mapFor(w).blocks;
    const wall = { x: 0, z: -0.85, w: 10, d: 0.1, h: 4 };
    blocks.push(wall);
    try {
      step(w, { p: fireInput() }, DT);

      const burst = w.events.find((e) => e.type === "burst")!;
      expect(burst).toBeDefined();
      expect(burst.z).toBeCloseTo(-0.8, 8);
      expect(target.hp).toBe(hp);
      expect(w.projectiles.some((q) => q.owner === p.id)).toBe(false);
    } finally {
      blocks.splice(blocks.indexOf(wall), 1);
    }
  });

  it("床の先で敵球と交差しても床で停止し、その敵をchainの直撃元にしない", () => {
    const { w, p } = fixture();
    step(w, { p: fireInput() }, DT);
    const round = w.projectiles.find((q) => q.owner === p.id)!;
    const target = spawn(w, "ant", 0, -0.9)!;
    target.wind = 100;
    const speed = Math.hypot(round.dx, round.dy, round.dz);
    const pitch = -0.04;
    // すでに合法に生成された弾の飛行中状態。床直前からの浅い進入を固定する。
    Object.assign(round, {
      x: 0,
      y: 0.01,
      z: 0,
      dx: 0,
      dy: Math.sin(pitch) * speed,
      dz: -Math.cos(pitch) * speed,
      chain: true,
    });
    const body = enemyBodies(target)[0];
    const afterFloor = { z: -0.8, y: 0.01 + 0.8 * Math.tan(pitch) };
    expect(afterFloor.y).toBeLessThan(0);
    expect(
      Math.hypot(body.z - afterFloor.z, body.y - afterFloor.y),
    ).toBeLessThan(body.radius);
    const expectedZ = 0.01 / Math.tan(pitch);
    w.events = [];

    step(w, { p: neutral() }, DT);

    const bursts = w.events.filter((e) => e.type === "burst");
    expect(bursts).toHaveLength(1);
    expect(bursts[0].y).toBe(0);
    expect(bursts[0].z).toBeCloseTo(expectedZ, 5);
    expect(w.projectiles.some((q) => q.owner === p.id)).toBe(false);
  });

  it.each([false, true])(
    "速度0でも座標をNaNにせず、敵球内=%sに応じて静止または着弾する",
    (inside) => {
      const { w, p } = fixture();
      const target = spawn(w, "ant", 10, -10)!;
      target.wind = 100;
      step(w, { p: fireInput() }, DT);
      const round = w.projectiles.find((q) => q.owner === p.id)!;
      Object.assign(round, { dx: 0, dy: 0, dz: 0 });
      if (inside) {
        const body = enemyBodies(target)[0];
        Object.assign(round, { x: body.x, y: body.y, z: body.z });
      }
      const before = { x: round.x, y: round.y, z: round.z };
      w.events = [];

      step(w, { p: neutral() }, DT);

      expect([round.x, round.y, round.z].every(Number.isFinite)).toBe(true);
      expect({ x: round.x, y: round.y, z: round.z }).toEqual(before);
      expect(w.projectiles.includes(round)).toBe(!inside);
      expect(w.events.some((e) => e.type === "burst")).toBe(inside);
      if (!inside) {
        round.life = 0;
        step(w, { p: neutral() }, DT);
        expect(w.projectiles.includes(round)).toBe(false);
        expect([round.x, round.y, round.z].every(Number.isFinite)).toBe(true);
      }
    },
  );

  it.each(["cool", "reload", "swapCd", "ammo"] as const)(
    "敵弾上限を分離しても、既存の%sによる発射拒否を維持する",
    (blockedBy) => {
      const { w, p } = fixture();
      const target = spawn(w, "ant", 0, -12)!;
      target.wind = 100;
      enemyRounds(w, 100);
      if (blockedBy === "ammo") p.ammo[0] = 0;
      else p[blockedBy] = 0.5;
      const ammo = p.ammo[0];

      step(w, { p: fireInput() }, DT);

      expect(p.ammo[0]).toBe(ammo);
      expect(w.projectiles.some((q) => q.owner === p.id)).toBe(false);
      expect(w.events.some((e) => e.type === "shot" && e.owner === p.id)).toBe(
        false,
      );
    },
  );
});
