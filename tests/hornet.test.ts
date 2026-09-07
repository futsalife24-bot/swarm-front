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
  it("crosses ground that a walker cannot enter", () => {
    const { w, p } = field();
    // Straight line from spawn to the player runs through a building.
    p.x = 17;
    p.z = 30;
    spawn(w, "hornet", 17, -30);
    expect(blocked(17, 4, ENEMIES.hornet.radius)).toBe(true);
    const start = w.enemies[0].z;
    run(w, 12);
    expect(w.enemies[0].z).toBeGreaterThan(start + 20);
  });
  it("drops to strike and climbs back out of reach", () => {
    const { w, p } = field();
    spawn(w, "hornet", 0, -9);
    run(w, 4);
    expect(w.enemies[0].y).toBeLessThan(2);
    // Move the target away; the hornet should return to cruising height.
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
