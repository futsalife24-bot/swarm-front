import { mapFor } from "../src/shared/stages";
import { describe, it, expect } from "vitest";
import { ENEMIES, MOVE_SPEED } from "../src/shared/defs";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  step,
  neutral,
  fire,
  eye,
  blocked,
  falloff,
  roofHeight,
} from "../src/shared/game";
// Trial flier. These cover the parts that altitude actually changed; balance and
// wave composition are deliberately not asserted.
function field() {
  const w = createWorld("hornet", 11),
    p = addPlayer(w, "p");
  p.x = 0;
  p.z = 0;
  start(w);
  w.nextSpawn = 1e9;
  w.enemies.length = 0;
  return { w, p };
}
const run = (w: ReturnType<typeof field>["w"], seconds: number) => {
  for (let n = 0; n < seconds / 0.05; n++) step(w, { p: neutral() });
};
describe("airborne enemy", () => {
  it("keeps existing enemies on the ground and unchanged", () => {
    const { w } = field();
    spawn(w, "crawler", 0, -10);
    expect(w.enemies[0].y).toBe(0);
    expect(eye(w.enemies[0])).toBe(1.4);
    run(w, 1);
    expect(w.enemies[0].y).toBe(0);
  });
  it("spawns at cruising height", () => {
    const { w } = field();
    spawn(w, "hornet", 0, -30);
    expect(w.enemies[0].y).toBe(ENEMIES.hornet.cruise);
    expect(eye(w.enemies[0])).toBeCloseTo(7.5);
  });
  it("climbs over a building instead of passing through it", () => {
    const { w, p } = field();
    // Straight line from spawn to the player runs through a building.
    p.x = 34;
    p.z = 45;
    spawn(w, "hornet", 34, -45);
    const roof = roofHeight(34, 8, ENEMIES.hornet.radius, mapFor(w).blocks);
    expect(roof).toBeGreaterThan(ENEMIES.hornet.cruise);
    let insideAtCruise = 0,
      cleared = false;
    for (let n = 0; n < 22 / 0.05; n++) {
      step(w, { p: neutral() });
      const e = w.enemies[0];
      // Never occupy a building's footprint below its roof.
      if (blocked(e.x, e.z, ENEMIES.hornet.radius, e.y, mapFor(w).blocks))
        insideAtCruise++;
      if (e.z > 8) cleared = true;
    }
    expect(insideAtCruise).toBe(0);
    expect(cleared).toBe(true);
  });
  it("keeps altitude when the target is close and can change height later", () => {
    const { w, p } = field();
    spawn(w, "hornet", 0, -9);
    run(w, 4);
    expect(w.enemies[0].y).toBeGreaterThan(4.5);
    // Retreat does not force the hornet to ground level either.
    p.x = 40;
    p.z = 40;
    run(w, 6);
    expect(w.enemies[0].y).toBeGreaterThan(5);
  });
  it("cannot be hit by a level shot, but can be hit by an aimed one", () => {
    for (const [pitch, expected] of [
      [0, false],
      [Math.atan2(7.5 - 1.5, 10), true],
    ] as const) {
      const { w, p } = field();
      spawn(w, "hornet", 0, -10);
      const target = w.enemies[0];
      const before = target.hp;
      for (let n = 0; n < 5; n++) {
        p.cool = 0;
        fire(w, p, { ...neutral(), yaw: 0, pitch, fire: true });
      }
      expect(target.hp < before).toBe(expected);
    }
  });
});
describe("kiting costs", () => {
  it("charges the rifle for distance but leaves close range alone", () => {
    expect(falloff("rifle", 10)).toBe(1);
    expect(falloff("rifle", 22)).toBe(1);
    expect(falloff("rifle", 65)).toBeLessThan(0.6);
    expect(falloff("rifle", 200)).toBe(0.45);
    // The rocket is the answer to distance, so it keeps its damage.
    expect(falloff("rocket", 65)).toBe(1);
    // Shotgun behaviour is unchanged.
    expect(falloff("shotgun", 0)).toBe(1);
    expect(falloff("shotgun", 35)).toBe(0.3);
  });
  it("outruns a walking player", () => {
    expect(ENEMIES.hornet.speed).toBeGreaterThan(MOVE_SPEED.walk);
    for (const kind of ["crawler", "spitter", "boss"] as const)
      expect(ENEMIES[kind].speed).toBeLessThan(MOVE_SPEED.walk);
  });
  it("closes on a player who keeps backing away", () => {
    const { w, p } = field();
    spawn(w, "hornet", 0, -30);
    const away = { ...neutral(), mz: -1 };
    for (let n = 0; n < 400; n++) {
      step(w, { p: away });
      if (p.z < 40) p.z += 0;
    }
    expect(Math.hypot(w.enemies[0].x - p.x, w.enemies[0].z - p.z)).toBeLessThan(
      8,
    );
  });
});
