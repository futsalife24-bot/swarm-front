import { expect, it } from "vitest";
import { STARTERS, WEAPONS } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  enemyBodies,
  eye,
  fire,
  neutral,
  spawn,
  step,
} from "../src/shared/game";
import { TRAINING_MAP } from "../src/shared/stages";
import { initWorm } from "../src/shared/worm";

const kinds = ["rocket", "heavy", "grenade", "sticky"] as const;
function fixture(kind: (typeof kinds)[number], segmented = false) {
  const w = createWorld(`foundry-${kind}`, 723, segmented ? 6 : 11);
  w.training = !segmented;
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const p = addPlayer(w, "p");
  p.x = p.z = p.y = 0;
  p.weapons[p.slot] = { ...STARTERS[0], id: kind, kind };
  p.ammo[p.slot] = 100;
  const e = spawn(
    w,
    "boss",
    0,
    segmented ? 0 : -18,
    segmented ? "worm" : "crown",
  )!;
  if (segmented) initWorm(e);
  e.cool = 999;
  return { w, p, e };
}

it.each(kinds)(
  "%sの実射が通常型FOUNDRY ZEROの表面へ直撃してHPを減らす",
  (kind) => {
    const { w, p, e } = fixture(kind);
    expect(enemyBodies(e)[0].radius).toBe(12);
    const shape = WEAPONS[kind],
      distance = Math.hypot(e.x - p.x, e.z - p.z),
      rise = eye(e) - 1.5;
    let pitch = Math.atan2(rise, distance);
    if ("gravity" in shape) {
      const v2 = shape.speed ** 2,
        g = shape.gravity;
      const discriminant = v2 ** 2 - g * (g * distance ** 2 + 2 * rise * v2);
      expect(discriminant).toBeGreaterThan(0);
      pitch = Math.atan((v2 - Math.sqrt(discriminant)) / (g * distance));
    }
    const hp = e.hp;
    fire(w, p, { ...neutral(), fire: true, pitch });
    expect(w.projectiles).toHaveLength(1);
    for (let n = 0; n < 120 && w.projectiles.length; n++)
      step(w, { p: neutral() });
    expect(w.projectiles).toHaveLength(0);
    expect(w.events.some((event) => event.type === "burst")).toBe(true);
    expect(e.hp).toBeLessThan(hp);
  },
);

it.each(kinds)("%sの爆風は表面から減衰し、範囲外と壁の向こうは無効", (kind) => {
  const losses: number[] = [];
  for (const fraction of [0.1, 0.8, 1.1]) {
    const { w, p, e } = fixture(kind);
    fire(w, p, { ...neutral(), fire: true });
    const q = w.projectiles[0],
      b = enemyBodies(e)[0];
    Object.assign(q, {
      x: b.x + b.radius + q.radius! * fraction,
      y: b.y,
      z: b.z,
      dx: 0,
      dy: 0,
      dz: 0,
      gravity: 0,
      life: 0,
    });
    const hp = e.hp;
    step(w, { p: neutral() });
    losses.push(hp - e.hp);
  }
  expect(losses[0]).toBeGreaterThan(losses[1]);
  expect(losses[1]).toBeGreaterThan(0);
  expect(losses[2]).toBe(0);
  const { w, p, e } = fixture(kind);
  fire(w, p, { ...neutral(), fire: true });
  const q = w.projectiles[0],
    b = enemyBodies(e)[0];
  Object.assign(q, {
    x: b.x + b.radius + 1,
    y: b.y,
    z: b.z,
    dx: 0,
    dy: 0,
    dz: 0,
    gravity: 0,
    life: 0,
  });
  const wall = { x: b.x + b.radius + 0.5, z: b.z, w: 0.2, d: 8, h: 30 };
  TRAINING_MAP.blocks.push(wall);
  try {
    const hp = e.hp;
    step(w, { p: neutral() });
    expect(e.hp).toBe(hp);
  } finally {
    TRAINING_MAP.blocks.splice(TRAINING_MAP.blocks.indexOf(wall), 1);
  }
});

it.each(kinds)(
  "%sの連鎖爆発も通常型の表面へ届き、範囲外には届かない",
  (kind) => {
    for (const outside of [false, true]) {
      const losses: number[] = [];
      for (const chain of [false, true]) {
        const { w, p, e } = fixture(kind);
        fire(w, p, { ...neutral(), fire: true });
        const q = w.projectiles[0],
          b = enemyBodies(e)[0],
          radius = (q.radius! * 3.5) / 6.5;
        const target = spawn(
          w,
          "ant",
          b.x + b.radius + radius * (outside ? 1.2 : 0.5),
          b.z,
        )!;
        target.y += b.y - eye(target);
        target.hp = 1;
        Object.assign(q, {
          x: target.x,
          y: eye(target),
          z: target.z,
          dx: 0.001,
          dy: 0,
          dz: 0,
          gravity: 0,
          life: 2,
          chain,
        });
        const hp = e.hp;
        step(w, { p: neutral() });
        expect(target.hp).toBeLessThanOrEqual(0);
        losses.push(hp - e.hp);
      }
      if (outside) expect(losses[1]).toBeCloseTo(losses[0]);
      else expect(losses[1]).toBeGreaterThan(losses[0]);
    }
  },
);

it("連結形態の大型頭部でも表面への爆発を受け、破壊済みの節を連鎖処理しても落ちない", () => {
  const { w, p, e } = fixture("grenade", true);
  e.size = 2;
  fire(w, p, { ...neutral(), fire: true });
  const q = w.projectiles[0],
    b = enemyBodies(e)[0];
  Object.assign(q, {
    x: b.x + b.radius,
    y: b.y,
    z: b.z,
    dx: 0,
    dy: 0,
    dz: 0,
    gravity: 0,
    life: 0,
  });
  const hp = e.partHp!;
  step(w, { p: neutral() });
  expect(e.partHp).toBeLessThan(hp);
  e.hp = e.partHp = 0;
  e.segments!.forEach((part) => (part.partHp = 0));
  const target = spawn(w, "ant", b.x + b.radius + 1, b.z)!;
  target.y += b.y - eye(target);
  target.hp = 1;
  w.projectiles.push({
    ...q,
    id: ++w.serial,
    x: target.x,
    y: eye(target),
    z: target.z,
    life: 2,
    chain: true,
  });
  expect(() => step(w, { p: neutral() })).not.toThrow();
});
