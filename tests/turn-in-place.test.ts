import { describe, expect, it } from "vitest";
import {
  TurnInPlace,
  TURN_PLANT_LIMIT,
  TURN_SETTLE_DELAY,
  easeYaw,
} from "../src/client/turn-in-place";

const run = (
  t: TurnInPlace,
  yawAt: (time: number) => number,
  seconds: number,
  dt = 1 / 60,
) => {
  const out: ReturnType<TurnInPlace["stand"]>[] = [];
  for (let time = 0; time < seconds; time += dt)
    out.push(t.stand(yawAt(time), dt));
  return out;
};

describe("turn in place (presentation only)", () => {
  it("keeps the feet planted for a small aim change and twists the hips instead", () => {
    const t = new TurnInPlace();
    t.reset(0);
    const r = run(t, () => 0.4, 0.3);
    expect(r.every((s) => !s.stepping)).toBe(true);
    expect(t.feetYaw).toBe(0);
    expect(r.at(-1)!.twist).toBeCloseTo(0.4, 6);
  });

  it("steps once the twist passes the plant limit and finishes square", () => {
    const t = new TurnInPlace();
    t.reset(0);
    const r = run(t, () => TURN_PLANT_LIMIT + 0.2, 0.6);
    expect(r[0].stepping).toBe(true);
    expect(r.some((s) => s.travel > 0)).toBe(true);
    expect(r.at(-1)!.stepping).toBe(false);
    expect(Math.abs(r.at(-1)!.twist)).toBeLessThan(0.05);
  });

  it("re-squares a held moderate twist after the settle delay", () => {
    const t = new TurnInPlace();
    t.reset(0);
    const r = run(t, () => 0.45, TURN_SETTLE_DELAY + 0.5);
    const first = r.findIndex((s) => s.stepping);
    expect(first).toBeGreaterThan(Math.floor((TURN_SETTLE_DELAY - 0.05) * 60));
    expect(Math.abs(r.at(-1)!.twist)).toBeLessThan(0.05);
  });

  it("never twists the hips past the limit plus one frame of a fast aim sweep", () => {
    const t = new TurnInPlace();
    t.reset(0);
    // A 4 rad/s sweep, typical for a mouse turn.
    const r = run(t, (time) => 4 * time, 1.2);
    for (const s of r)
      expect(Math.abs(s.twist)).toBeLessThan(TURN_PLANT_LIMIT + 0.35);
  });

  it("follows the shortest way across ±π", () => {
    const t = new TurnInPlace();
    t.reset(Math.PI - 0.1);
    const s = t.stand(-Math.PI + 0.1, 1 / 60);
    expect(s.twist).toBeCloseTo(0.2, 6);
  });

  it("tracking while moving hands over without a jump", () => {
    const t = new TurnInPlace();
    t.track(0.3);
    const s = t.stand(0.5, 1 / 60);
    expect(s.twist).toBeCloseTo(0.2, 6);
    expect(s.stepping).toBe(false);
  });

  it("eases remote yaw snapshots and snaps near-reversals", () => {
    let y = 0;
    for (let i = 0; i < 3; i++) y = easeYaw(y, 0.5, 1 / 60);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(0.5);
    for (let i = 0; i < 60; i++) y = easeYaw(y, 0.5, 1 / 60);
    expect(y).toBeCloseTo(0.5, 3);
    expect(easeYaw(0, 3.0, 1 / 60)).toBe(3.0);
    expect(easeYaw(Math.PI - 0.05, -Math.PI + 0.05, 1 / 60)).toBeGreaterThan(
      Math.PI - 0.05,
    );
  });
});
