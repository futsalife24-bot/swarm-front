import { describe, it, expect } from "vitest";
import {
  HoundMotionController,
  type HoundMotionBatch,
  type HoundVisualInput,
} from "../src/client/hound-motion";

function harness() {
  const poses: unknown[][] = [];
  const batch = {
    setPose(...v: unknown[]) {
      poses.push(v);
    },
  } as unknown as HoundMotionBatch;
  return { controller: new HoundMotionController(), batch, poses };
}
const enemy = (changes: Partial<HoundVisualInput> = {}): HoundVisualInput => ({
  id: 11,
  moving: false,
  wind: 0,
  cool: 0,
  distance: 0,
  ...changes,
});
describe("HOUND visual motion contract", () => {
  it("aligns charge and impact with authoritative wind/cool, without changing the input", () => {
    const { controller: c, batch: b } = harness();
    for (const wind of [0.45, 0.32, 0.02]) {
      const input = enemy({ wind });
      const before = JSON.stringify(input);
      c.update(b, [input], 1 / 60);
      expect(c.states.get(11)?.time).toBeCloseTo(0.45 - wind, 6);
      expect(c.states.get(11)?.clip).toBe("Lunge");
      expect(JSON.stringify(input)).toBe(before);
    }
    c.update(b, [enemy({ cool: 1.2 })], 1 / 60);
    expect(c.states.get(11)?.time).toBe(0.45);
    for (let i = 0; i < 50; i++)
      c.update(b, [enemy({ cool: Math.max(0, 1.2 - i / 60) })], 1 / 60);
    expect(c.states.get(11)?.clip).toBe("Idle");
  });
  it("cancels an interrupted charge, keeps IDs stable after reordering, and clears removed enemies", () => {
    const { controller: c, batch: b } = harness();
    c.update(b, [enemy({ wind: 0.3 }), enemy({ id: 12 })], 0.016);
    c.update(b, [enemy({ id: 12 }), enemy({ wind: 0, cool: 0 })], 0.016);
    expect(c.states.get(11)?.clip).toBe("Idle");
    expect(c.states.size).toBe(2);
    c.update(b, [enemy({ id: 12 })], 0.016);
    expect(c.states.has(11)).toBe(false);
    c.update(b, [], 0.016);
    expect(c.states.size).toBe(0);
  });
  it("advances locomotion by traveled distance and freezes a paused sample", () => {
    const { controller: c, batch: b } = harness();
    c.update(b, [enemy({ moving: true, distance: 0.36 })], 0.016);
    expect(c.states.get(11)?.time).toBeCloseTo(0.4);
    c.update(b, [enemy({ moving: true, distance: 0 })], 0);
    expect(c.states.get(11)?.time).toBeCloseTo(0.4);
  });
  it("recovers impact timing when a snapshot skips the last wind sample", () => {
    const { controller: c, batch: b } = harness();
    c.update(b, [enemy({ cool: 0.2 })], 0.016);
    c.update(b, [enemy({ cool: 1.2 })], 0.016);
    expect(c.states.get(11)?.clip).toBe("Lunge");
    expect(c.states.get(11)?.time).toBe(0.45);
  });
});
