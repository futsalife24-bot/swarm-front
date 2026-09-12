import { expect, it } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
  fire,
  blocked,
  hurtEnemy,
  enemyBodies,
} from "../src/shared/game";
import { moveWorm, wormNodes, wormSpeed } from "../src/shared/worm";
import { pursuitDirection, specialMotion } from "../src/shared/enemy-motion";
import { ENEMIES } from "../src/shared/defs";
import { mapFor } from "../src/shared/stages";
function field(stage = 1) {
  const w = createWorld("enemies", 11, stage),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.x = 0;
  p.z = 0;
  return { w, p };
}
it("worm cuts remove only the hit segment, accelerate both chains, and award one final kill", () => {
  const { w, p } = field(6);
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  expect(wormSpeed(e)).toBeCloseTo(4.2);
  hurtEnemy(w, e, 1e6, p.id, 4);
  expect(enemyBodies(e).map((b) => b.part)).toEqual([0, 1, 2, 3, 5, 6, 7]);
  expect(e.hp).toBeCloseTo((e.maxHp * 7) / 8);
  expect(w.totalKills).toBe(0);
  expect(wormSpeed(e)).toBeCloseTo(8.4);
  const before = wormNodes(e).map((n) => ({ ...n }));
  for (let n = 0; n < 100; n++) {
    w.time += 0.05;
    moveWorm(w, e, 0.05);
  }
  for (const i of [0, 5]) {
    const node = wormNodes(e)[i];
    expect(
      Math.hypot(node.x - before[i].x, node.z - before[i].z),
    ).toBeGreaterThan(10);
  }
  hurtEnemy(w, e, 1e6, p.id, 0);
  expect(e.hp).toBeGreaterThan(0);
  expect(wormSpeed(e)).toBeCloseTo(8.4);
  for (let i = 1; i < 8; i++) hurtEnemy(w, e, 1e6, p.id, i);
  expect(e.hp).toBe(0);
  expect(enemyBodies(e)).toHaveLength(0);
  expect(w.totalKills).toBe(1);
  expect(p.kills).toBe(1);
});
it.each([6, 10, 13, 16, 20])(
  "worm roams safely through stage %s with altitude and survives snapshot replay",
  (stage) => {
    const { w } = field(stage);
    spawn(w, "boss", 0, -35, "worm");
    const e = w.enemies[0];
    let minX = e.x,
      maxX = e.x,
      minZ = e.z,
      maxZ = e.z,
      maxY = 0;
    for (let n = 0; n < 2400; n++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
      minZ = Math.min(minZ, e.z);
      maxZ = Math.max(maxZ, e.z);
      maxY = Math.max(maxY, e.y);
      for (const [i, node] of wormNodes(e).entries())
        expect(
          blocked(node.x, node.z, i === 0 ? 4 : 2.2, node.y, mapFor(w).blocks),
        ).toBe(false);
    }
    expect(maxX - minX).toBeGreaterThan(45);
    expect(maxZ - minZ).toBeGreaterThan(45);
    expect(maxY).toBeGreaterThan(2);
    const copy = JSON.parse(JSON.stringify(w));
    moveWorm(w, e, 0.05);
    moveWorm(copy, copy.enemies[0], 0.05);
    expect(copy.enemies[0]).toEqual(e);
  },
);
it("every surviving worm node fires aimed acid while moving", () => {
  const { w, p } = field(6);
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  p.x = 8;
  p.z = 8;
  moveWorm(w, e, 0);
  for (const node of wormNodes(e)) node.acidAt = 0;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(8);
  for (const q of w.projectiles) {
    const t = (p.x - q.x) / q.dx;
    expect(q.z + q.dz * t).toBeCloseTo(p.z);
    expect(q.y + q.dy * t - 0.5 * q.gravity! * t * t).toBeCloseTo(1.2);
  }
  hurtEnemy(w, e, 1e6, p.id, 3);
  w.projectiles = [];
  for (const node of wormNodes(e)) node.acidAt = 0;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(7);
});
it("a cave fragment can complete repeated circuits after a mid-corridor cut", () => {
  const { w, p } = field(10);
  spawn(w, "boss", 0, -35, "worm");
  const e = w.enemies[0];
  for (let n = 0; n < 500; n++) {
    w.time += 0.05;
    moveWorm(w, e, 0.05);
  }
  for (const i of [0, 1, 3, 4, 5, 6, 7]) hurtEnemy(w, e, 1e6, p.id, i);
  const node = e.segments![1];
  let minX = 100,
    maxX = -100,
    minZ = 100,
    maxZ = -100;
  for (let n = 0; n < 2400; n++) {
    w.time += 0.05;
    moveWorm(w, e, 0.05);
    w.projectiles = [];
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minZ = Math.min(minZ, node.z);
    maxZ = Math.max(maxZ, node.z);
  }
  expect(maxX - minX).toBeGreaterThan(45);
  expect(maxZ - minZ).toBeGreaterThan(45);
});
it("rocket blast damages nearby airborne segments but not the ground directly below", () => {
  const { w, p } = field(6);
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  e.y = 18;
  e.segments![0] = { x: 0, y: 18, z: -3 };
  e.segments![1] = { x: 0, y: 0, z: -3 };
  w.projectiles.push({
    id: ++w.serial,
    x: 0,
    y: 20,
    z: -3,
    dx: 0,
    dy: 0,
    dz: -1,
    life: 0,
    owner: p.id,
    damage: 100,
    rocket: true,
  });
  step(w, {}, 0.001);
  expect(e.partHp).toBeLessThan(e.maxHp / 8);
  expect(e.segments![0].partHp).toBeLessThan(e.maxHp / 8);
  expect(e.segments![1].partHp).toBe(e.maxHp / 8);
});
it.each([3, 5, 10, 17, 24, 30])(
  "airborne ant acid hits a stationary player at %sm",
  (distance) => {
    const { w, p } = field();
    spawn(w, "ant", 0, -distance);
    const ant = w.enemies[0];
    ant.wind = 0.01;
    ant.tx = p.x;
    ant.tz = p.z;
    const hp = p.hp;
    step(w, { p: neutral() });
    // Isolate the launched volley from subsequent attacks and movement.
    w.enemies = [];
    for (let i = 0; i < 70 && p.hp === hp; i++) step(w, { p: neutral() });
    expect(p.hp).toBeLessThan(hp);
    expect(w.events.some((e) => e.type === "acid" && e.y > 0.2)).toBe(true);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
  },
);

it("ground acid splash causes no damage even when the player stands on it", () => {
  const { w, p } = field();
  w.projectiles.push({
    id: 999,
    x: 0,
    y: 0.05,
    z: 0,
    dx: 0,
    dy: -2,
    dz: 0,
    gravity: 12,
    life: 1,
    owner: "enemy",
    damage: 20,
    rocket: false,
  });
  const hp = p.hp;
  step(w, { p: neutral() });
  expect(w.events.some((e) => e.type === "acid" && e.y === 0)).toBe(true);
  for (let i = 0; i < 20; i++) step(w, { p: neutral() });
  expect(p.hp).toBe(hp);
  expect(w.projectiles).toHaveLength(0);
});
it("acid rises, descends and splashes on the ground instead of flying indefinitely", () => {
  const { w, p } = field();
  spawn(w, "ant", 0, -10);
  const e = w.enemies[0];
  e.wind = 0.01;
  e.tx = 0;
  e.tz = 0;
  step(w, { p: neutral() });
  const q = w.projectiles[1];
  expect(q.gravity).toBe(12);
  expect(q.dy).toBeGreaterThan(0);
  const initialY = q.y;
  p.x = 20;
  e.cool = 100;
  let highest = q.y;
  let falling = false;
  for (let i = 0; i < 30 && w.projectiles.includes(q); i++) {
    step(w, { p: neutral() });
    highest = Math.max(highest, q.y);
    falling ||= q.dy < 0;
  }
  expect(highest).toBeGreaterThan(initialY + 0.25);
  expect(falling).toBe(true);
  expect(w.projectiles).not.toContain(q);
  expect(q.y).toBe(0);
  expect(w.events.some((e) => e.type === "acid" && e.y === 0)).toBe(true);
});

it("rocket impact reports its actual blast radius to the renderer", () => {
  const { w } = field();
  w.projectiles.push({
    id: 999,
    x: 0,
    y: 0.1,
    z: 0,
    dx: 0,
    dy: -10,
    dz: 0,
    life: 1,
    owner: "p",
    damage: 100,
    rocket: true,
  });
  step(w, { p: neutral() });
  expect(w.events.find((e) => e.type === "burst")?.radius).toBe(6.5);
});
it("ant fires a three-shot acid fan, bites nearby, and respects dodge", () => {
  const { w, p } = field();
  spawn(w, "ant", 0, -10);
  const e = w.enemies[0];
  e.wind = 0.01;
  e.tx = 0;
  e.tz = 0;
  step(w, { p: neutral() });
  expect(w.projectiles).toHaveLength(3);
  expect(new Set(w.projectiles.map((q) => q.dx)).size).toBe(3);
  w.projectiles = [];
  e.z = -2;
  e.wind = 0.01;
  const hp = p.hp;
  step(w, { p: neutral() });
  expect(p.hp).toBeLessThan(hp);
  e.wind = 0.01;
  p.evade = 0.3;
  const after = p.hp;
  step(w, { p: neutral() });
  expect(p.hp).toBe(after);
});
it("hornet aims a descending needle and high projectiles cannot hit a ground player", () => {
  const { w, p } = field();
  spawn(w, "hornet", 0, -15);
  const e = w.enemies[0];
  e.wind = 0.01;
  e.tx = 0;
  e.tz = 0;
  step(w, { p: neutral() });
  expect(w.projectiles).toHaveLength(1);
  expect(w.projectiles[0].dy).toBeLessThan(0);
  w.projectiles[0].x = 0;
  w.projectiles[0].z = 0;
  w.projectiles[0].y = 10;
  const hp = p.hp;
  step(w, { p: neutral() });
  expect(p.hp).toBe(hp);
});
it("legacy leaper perches outside walls then releases without crossing buildings", () => {
  for (const kind of ["spider"] as const) {
    const { w, p } = field();
    const b = mapFor(w).blocks[0];
    spawn(w, kind, 0, -10);
    const e = w.enemies[0];
    e.x = b.x - b.w / 2 - 1.7;
    e.z = b.z;
    e.y = 0;
    expect(specialMotion(w, e, p, 0.05)).toBe(true);
    expect(e.perch).toBeGreaterThan(0);
    expect(
      blocked(e.x, e.z, ENEMIES[e.kind].radius, e.y, mapFor(w).blocks),
    ).toBe(false);
    const position = [e.x, e.z];
    specialMotion(w, e, p, 0.05);
    expect([e.x, e.z]).toEqual(position);
    for (let n = 0; n < 50; n++) specialMotion(w, e, p, 0.05);
    expect(e.wallCooldown).toBeGreaterThan(0);
  }
});
it("spider jumps and lands in clear space", () => {
  const { w, p } = field();
  spawn(w, "spider", 0, -12);
  const e = w.enemies[0];
  e.cool = 0;
  specialMotion(w, e, p, 0.05);
  specialMotion(w, e, p, 0.2);
  expect(e.y).toBeGreaterThan(1);
  for (let n = 0; n < 20; n++) specialMotion(w, e, p, 0.05);
  expect(e.y).toBe(0);
  expect(e.z).toBeGreaterThan(-12);
});
it("worm form has seven authoritative hittable body segments independent of stage", () => {
  for (const stage of [1, 5, 10]) {
    const { w, p } = field(stage);
    spawn(w, "boss", 0, -35, stage === 1 ? "crown" : "worm");
    const e = w.enemies[0];
    expect(e.segments?.length ?? 0).toBe(stage === 1 ? 0 : 7);
    if (!e.segments) continue;
    p.x = 0;
    p.z = 0;
    e.segments[0] = { x: 0, y: 0, z: -4 };
    e.x = 12;
    const hp = e.hp;
    fire(w, p, { ...neutral(), fire: true, yaw: 0, pitch: 0 });
    expect(e.hp).toBeLessThan(hp);
    expect(JSON.parse(JSON.stringify(w)).enemies[0].segments).toHaveLength(7);
  }
});

it("every stage places dormant guards outside buildings within its wave quota", () => {
  for (let stage = 1; stage <= 20; stage++) {
    const w = createWorld("guards", 11, stage);
    addPlayer(w, "p");
    start(w);
    expect(w.enemies.length).toBeGreaterThanOrEqual(3);
    expect(w.spawned).toBe(w.enemies.filter((e) => e.kind !== "boss").length);
    for (const e of w.enemies) {
      if (e.kind !== "boss") expect(e.active).toBe(false);
      expect(
        blocked(e.x, e.z, ENEMIES[e.kind].radius, e.y, mapFor(w).blocks),
      ).toBe(false);
    }
  }
});
it("guards remain still at distance, then wake on visible approach or damage", () => {
  const { w, p } = field();
  spawn(w, "crawler", 0, -30);
  const e = w.enemies[0];
  e.active = false;
  for (let n = 0; n < 40; n++) step(w, { p: neutral() });
  expect([e.x, e.z, e.active]).toEqual([0, -30, false]);
  p.z = -15;
  step(w, { p: neutral() });
  expect(e.active).toBe(true);
  e.active = false;
  e.x = 0;
  e.z = -30;
  p.z = 0;
  fire(w, p, neutral());
  expect(e.hp).toBeLessThan(e.maxHp);
  expect(e.active).toBe(true);
});
it("steering varies across enemies and time, stays forward, and survives snapshot replay", () => {
  const { w, p } = field();
  spawn(w, "crawler", 0, -30);
  spawn(w, "crawler", 0, -30);
  const a = w.enemies[0],
    b = w.enemies[1];
  const first = pursuitDirection(w, a, p);
  expect(first.x).not.toBe(pursuitDirection(w, b, p).x);
  expect(first.z).toBeGreaterThan(0.6);
  expect(Math.hypot(first.x, first.z)).toBeCloseTo(1);
  w.time += 2;
  const clone = JSON.parse(JSON.stringify(w));
  const next = pursuitDirection(w, a, p);
  expect(next.x).not.toBe(first.x);
  expect(pursuitDirection(clone, clone.enemies[0], clone.players[0])).toEqual(
    next,
  );
  a.z = -2;
  expect(pursuitDirection(w, a, p)).toEqual({ x: 0, z: 1 });
});
it("dormant guards prevent wave completion until defeated", () => {
  const w = createWorld("guard-wave", 11);
  addPlayer(w, "p");
  start(w);
  w.spawned = 45;
  w.nextSpawn = 1e9;
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(1);
  expect(w.waveClearAt).toBeNull();
  for (const e of w.enemies) e.hp = 0;
  for (let n = 0; n < 100; n++) step(w, {});
  expect(w.wave).toBe(2);
  expect(w.enemies.some((e) => e.active === false)).toBe(true);
});

it("spider never walks between jumps and favors flanking more than other enemies", () => {
  const { w, p } = field();
  spawn(w, "spider", 0, -8);
  const e = w.enemies[0];
  e.jumpWait = 0.5;
  for (let i = 0; i < 5; i++) step(w, { p: neutral() });
  expect([e.x, e.y, e.z]).toEqual([0, 0, -8]);
  let spider = 0,
    ant = 0;
  for (let i = 0; i < 100; i++) {
    w.time = i * 2;
    e.z = -20;
    e.steerUntil = 0;
    pursuitDirection(w, e, p);
    spider += Math.abs(e.steerAngle!);
    const a = { ...e, kind: "ant" as const, steerUntil: 0 };
    pursuitDirection(w, a, p);
    ant += Math.abs(a.steerAngle!);
  }
  expect(spider).toBeGreaterThan(ant * 2);
});
it("wall perching rejects corners and keeps each of four faces supported", () => {
  const { w, p } = field();
  const b = mapFor(w).blocks[0];
  spawn(w, "spider", 0, -10);
  const e = w.enemies[0];
  for (const [dx, dz] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    Object.assign(e, {
      x: b.x + dx * (b.w / 2 + 1.7),
      z: b.z + dz * (b.d / 2 + 1.7),
      perch: 0,
      wallCooldown: 0,
      jump: 0,
    });
    specialMotion(w, e, p, 0.05);
    expect(e.perch).toBeGreaterThan(0);
    expect(blocked(e.x, e.z, 1.5, e.y, mapFor(w).blocks)).toBe(false);
  }
  Object.assign(e, {
    x: b.x - b.w / 2 - 1.7,
    z: b.z + b.d / 2 + 0.2,
    perch: 0,
    wallCooldown: 0,
    jump: 0,
  });
  specialMotion(w, e, p, 0.05);
  expect(e.perch).toBe(0);
});
it("hornet proximity does not force descent, heights vary and high close shots use needles", () => {
  const { w, p } = field();
  spawn(w, "hornet", 0, -2);
  const e = w.enemies[0];
  e.flightHeight = 8;
  e.flightUntil = 100;
  e.y = 8;
  for (let i = 0; i < 15; i++) step(w, { p: neutral() });
  expect(e.y).toBe(8);
  e.wind = 0.01;
  e.tx = p.x;
  e.tz = p.z;
  step(w, { p: neutral() });
  expect(w.projectiles.some((q) => q.dy < 0)).toBe(true);
  const heights = [];
  for (let i = 0; i < 100; i++) {
    w.time = i * 4;
    e.flightUntil = 0;
    e.wind = 0;
    e.cool = 100;
    e.x = 0;
    e.z = -5;
    step(w, { p: neutral() });
    heights.push(e.flightHeight!);
  }
  expect(heights.filter((h) => h >= 4.5).length).toBeGreaterThan(70);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(4.5);
  expect(Math.max(...heights)).toBeGreaterThan(10);
});
