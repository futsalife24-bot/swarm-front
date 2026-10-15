import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  enemyBodies,
  fire,
  neutral,
  spawn,
  start,
  step,
  visible,
  wallDistance,
  type World,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";
import { prepareState } from "../src/shared/state-wire";

function field() {
  const w = createWorld("pleat-authority", 11, 1),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.hp = 1e6;
  return { w, p };
}
function wallField() {
  const { w, p } = field(),
    b = mapFor(w).blocks[0];
  p.x = b.x + b.w / 2 + 3;
  p.z = b.z;
  spawn(w, "crawler", b.x - b.w / 2 - 3, b.z);
  const e = w.enemies[0];
  Object.assign(e, { size: 1, active: true, id: 6 });
  return { w, p, e, b };
}
describe("PLEAT authoritative world integration", () => {
  it("climbs a real city wall continuously without roof-height repair teleporting it", () => {
    const { w, e, b } = wallField();
    let highest = e.y,
      wall = false,
      maxStep = 0;
    for (let i = 0; i < 300; i++) {
      const before = { x: e.x, y: e.y, z: e.z };
      step(w, { p: neutral() });
      maxStep = Math.max(
        maxStep,
        Math.hypot(e.x - before.x, e.y - before.y, e.z - before.z),
      );
      highest = Math.max(highest, e.y);
      wall ||= !!e.pleat && Math.abs(e.pleat.normal.y) < 0.2;
    }
    expect(
      wall,
      JSON.stringify({ x: e.x, y: e.y, z: e.z, normal: e.pleat?.normal }),
    ).toBe(true);
    expect(highest, JSON.stringify(e.pleat)).toBeGreaterThan(3);
    expect(maxStep, `building height=${b.h}`).toBeLessThan(1);
  });
  it("hits the elevated solved body rather than its old ground position", () => {
    const { w, p, e } = wallField();
    for (let i = 0; i < 300 && e.y < 3; i++) step(w, { p: neutral() });
    expect(e.y).toBeGreaterThan(3);
    // The next city tower begins eight metres outward. Four metres places the
    // shooter in the real alley; assert the actual muzzle ray stays unobstructed.
    p.x = e.pleat!.body.x + e.pleat!.normal.x * 4;
    p.z = e.pleat!.body.z + e.pleat!.normal.z * 4;
    p.y = 0;
    const body = enemyBodies(e)[0],
      dx = body.x - p.x,
      dz = body.z - p.z;
    expect(body.y).toBeCloseTo(e.pleat!.body.y, 6);
    const dy = body.y - 1.5,
      range = Math.hypot(dx, dy, dz);
    expect(
      wallDistance(
        p.x,
        1.5,
        p.z,
        dx / range,
        dy / range,
        dz / range,
        range,
        mapFor(w).blocks,
      ),
      JSON.stringify({
        p: { x: p.x, z: p.z },
        body,
        normal: e.pleat!.normal,
        weapon: p.weapons[p.slot],
        ammo: p.ammo,
      }),
    ).toBeGreaterThanOrEqual(range - 0.01);
    const hp = e.hp;
    p.cool = p.reload = p.swapCd = 0;
    fire(w, p, {
      ...neutral(),
      fire: true,
      yaw: Math.atan2(dx, -dz),
      pitch: Math.atan2(body.y - 1.5, Math.hypot(dx, dz)),
    });
    expect(e.hp).toBeLessThan(hp);
  });
  it("retains full controller state through persistence and resumes deterministically", () => {
    const { w } = wallField();
    for (let i = 0; i < 50; i++) step(w, { p: neutral() });
    const resumed = JSON.parse(JSON.stringify(w)) as World;
    for (let i = 0; i < 80; i++) {
      step(w, { p: neutral() });
      step(resumed, { p: neutral() });
    }
    expect(resumed.enemies[0].pleat).toEqual(w.enemies[0].pleat);
    expect(resumed.enemies[0].x).toBe(w.enemies[0].x);
  });
  it("does not apply an already wound-up melee strike across distant altitude", () => {
    const { w, p } = field();
    p.x = 0;
    p.z = 0;
    p.y = 0;
    p.safe = 0;
    spawn(w, "crawler", 0, -1);
    const e = w.enemies[0];
    Object.assign(e, {
      active: true,
      size: 1,
      y: 8,
      wind: 0.01,
      tx: 0,
      tz: 0,
      cool: 0,
    });
    const hp = p.hp;
    step(w, { p: neutral() });
    expect(p.hp).toBe(hp);
  });
  it("does not apply an already wound-up strike through an existing wall", () => {
    const { w, p, e, b } = wallField();
    // Both actors are outside adjacent faces; their attack segment crosses the
    // solid corner, even though they are less than melee range apart.
    p.x = b.x - b.w / 2 + 0.9;
    p.z = b.z - b.d / 2 - 0.85;
    p.y = 0;
    p.safe = 0;
    Object.assign(e, {
      x: b.x - b.w / 2 - 0.85,
      y: 0,
      z: b.z - b.d / 2 + 0.9,
      wind: 0.01,
      tx: p.x,
      tz: p.z,
      cool: 0,
    });
    const hp = p.hp;
    expect(visible(e, p, mapFor(w).blocks)).toBe(false);
    step(w, { p: neutral() });
    expect(p.hp).toBe(hp);
  });
  it.each([
    [80, -60, 0, 0, 6],
    [-62, -54, -62, -86, 7],
  ])("still pursues across city obstacles from %s,%s", (ex, ez, px, pz, id) => {
    const { w, p } = field();
    p.x = px;
    p.z = pz;
    spawn(w, "crawler", ex, ez);
    const e = w.enemies[0];
    Object.assign(e, { id, size: 1, active: true });
    for (let i = 0; i < 2400 && p.hp === 1e6; i++) step(w, { p: neutral() });
    expect(
      p.hp,
      JSON.stringify({ x: e.x, y: e.y, z: e.z, pleat: e.pleat }),
    ).toBeLessThan(1e6);
  });
  it("sends 40 solved four-foot poses below 64KiB and measures real-map 20Hz work", () => {
    const { w, p } = field();
    p.x = 0;
    p.z = 0;
    for (let i = 0; i < 40; i++) {
      spawn(w, "crawler", -10 + (i % 8) * 2.5, -12 - Math.floor(i / 8) * 3);
      Object.assign(w.enemies.at(-1)!, { active: true, size: 1 });
    }
    const timings: number[] = [];
    for (let i = 0; i < 100; i++) {
      const begin = performance.now();
      step(w, { p: neutral() });
      timings.push(performance.now() - begin);
    }
    const packet = prepareState(w, 0, {
      members: [],
      preparationGeneration: 0,
    }).packet(p.id);
    const bytes = new TextEncoder().encode(packet).length;
    expect(bytes).toBeLessThan(65536);
    const received = JSON.parse(packet).world;
    expect(received.enemies).toHaveLength(40);
    for (const e of received.enemies) {
      expect(e.pleat.feet).toHaveLength(4);
      expect(e.pleat.body).toBeDefined();
      expect(e.pleat.velocity).toBeUndefined();
      expect(e.pleat.anchor).toBeUndefined();
    }
    timings.sort((a, b) => a - b);
    console.info(
      JSON.stringify({
        pleatAuthority40: {
          packetBytes: bytes,
          medianMs: timings[50],
          p95Ms: timings[95],
          maxMs: timings[99],
        },
      }),
    );
  });
});
