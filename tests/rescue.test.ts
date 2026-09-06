import { describe, it, expect } from "vitest";
import { createWorld, addPlayer, start, type World } from "../src/shared/game";
import { rescue } from "../src/client/hud";
// The rescuer used to get no feedback at all, so every failing condition looked identical.
function pair() {
  const w = createWorld("test", 7),
    self = addPlayer(w, "self"),
    mate = addPlayer(w, "mate");
  start(w);
  w.nextSpawn = 1e9;
  self.x = 0;
  self.z = 0;
  mate.x = 0;
  mate.z = 0;
  return { w, self, mate };
}
function down(w: World, id: string, x: number, z: number) {
  const p = w.players.find((p) => p.id === id)!;
  p.hp = 0;
  p.down = 25;
  p.x = x;
  p.z = z;
  return p;
}
describe("rescue feedback", () => {
  it("reports no target while the squad is standing", () => {
    const { w } = pair();
    expect(rescue(w, "self").state).toBe("none");
  });
  it("reports the remaining distance when the downed mate is out of range", () => {
    const { w } = pair();
    down(w, "mate", 0, 9);
    const r = rescue(w, "self");
    expect(r.state).toBe("far");
    expect(r.state === "far" && r.distance).toBeCloseTo(9);
  });
  it("reports progress once in range with a clear line", () => {
    const { w } = pair();
    const mate = down(w, "mate", 0, 2);
    mate.revive = 1.25;
    const r = rescue(w, "self");
    expect(r.state).toBe("ready");
    expect(r.state === "ready" && r.progress).toBeCloseTo(0.5);
  });
  it("distinguishes a blocked line of sight from being out of range", () => {
    const { w, self } = pair();
    self.x = 12.5;
    self.z = 0.5;
    down(w, "mate", 14, -1.5);
    expect(rescue(w, "self").state).toBe("blocked");
  });
  it("offers nothing while the player is down themselves", () => {
    const { w } = pair();
    down(w, "self", 0, 0);
    down(w, "mate", 0, 2);
    expect(rescue(w, "self").state).toBe("none");
  });
  it("prefers a reachable mate over a merely closer one", () => {
    const { w, self } = pair();
    self.x = 12.5;
    self.z = 0.5;
    down(w, "mate", 14, -1.5);
    const far = addPlayer(w, "far");
    far.hp = 0;
    far.down = 25;
    far.x = 11;
    far.z = 2.5;
    expect(rescue(w, "self").state).toBe("ready");
  });
});
