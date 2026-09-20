import { it, expect } from "vitest";
import {
  StructureMotionController,
  type StructureInput,
} from "../src/client/structure-motion";
import {
  STRUCTURE_TIMING,
  type StructureKind,
} from "../src/shared/structure-timing";
const sample = (changes: Partial<StructureInput> = {}): StructureInput => ({
  id: 7,
  slot: 0,
  moving: false,
  distance: 0,
  wind: 0,
  cool: 0,
  ...changes,
});
for (const kind of Object.keys(STRUCTURE_TIMING).filter(
  (k) => k !== "calyx",
) as StructureKind[])
  it(`${kind} tracks authoritative impact, skipped snapshots, pause and removal`, () => {
    const c = new StructureMotionController(kind),
      spec = STRUCTURE_TIMING[kind],
      b = { setPose() {} };
    const input = sample({ wind: spec.wind });
    const before = JSON.stringify(input);
    c.update(b, [input], 0.016);
    expect(c.states.get(7)?.time).toBe(0);
    expect(JSON.stringify(input)).toBe(before);
    c.update(b, [sample({ wind: spec.wind / 2 })], 0.016);
    expect(c.states.get(7)?.time).toBeCloseTo(spec.impact / 2);
    c.update(b, [sample({ cool: spec.cooldown })], 0.016);
    expect(c.states.get(7)?.time).toBe(spec.impact);
    c.update(b, [sample({ cool: spec.cooldown })], 0);
    expect(c.states.get(7)?.time).toBe(spec.impact);
    c.update(b, [], 0);
    expect(c.states.size).toBe(0);
    c.update(b, [sample({ cool: 0.1 })], 0.016);
    c.update(b, [sample({ cool: spec.cooldown - 0.1 })], 0.016);
    expect(c.states.get(7)?.time).toBe(spec.impact);
  });
it("cancels aborted wind-up and never interprets spawn cooldown as a hit", () => {
  const c = new StructureMotionController("boss"),
    b = { setPose() {} };
  c.update(b, [sample({ cool: 3 })], 0.016);
  expect(c.states.get(7)?.clip).toBe("Idle");
  c.update(b, [sample({ wind: 2, cool: 0 })], 0.016);
  c.update(b, [sample()], 0.016);
  expect(c.states.get(7)?.clip).toBe("Idle");
});
it("LEAPER has its own model while VOLLEY and both attack timings are preserved", async () => {
  const { STRUCTURE_ASSETS } = await import("../src/client/structure-motion");
  for (const kind of ["ant", "spider"] as const) {
    expect(STRUCTURE_ASSETS[kind]).toBe(kind === "ant" ? "hound" : "leaper");
    const c = new StructureMotionController(kind),
      b = { setPose() {} };
    const wind = kind === "ant" ? 0.8 : 0.45,
      cool = kind === "ant" ? 2.7 : 1.2;
    c.update(b, [sample({ wind })], 0.016);
    expect(c.states.get(7)?.time).toBe(0);
    c.update(b, [sample({ wind: wind / 2 })], 0.016);
    expect(c.states.get(7)?.time).toBeCloseTo(0.225);
    c.update(b, [sample({ cool })], 0.016);
    expect(c.states.get(7)?.time).toBe(0.45);
  }
});
it("PLEAT keeps distance-driven gait independently of its asset name", () => {
  const c = new StructureMotionController("crawler"),
    poses: unknown[][] = [];
  c.update(
    {
      setPose(...args: unknown[]) {
        poses.push(args);
      },
    },
    [sample({ moving: true, distance: 0.36 })],
    0.016,
  );
  expect(c.states.get(7)?.clip).toBe("Locomotion");
  expect(c.states.get(7)?.time).toBeCloseTo(0.4);
});
