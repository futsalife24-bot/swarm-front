import { describe, it, expect } from "vitest";
import {
  createPleat,
  stepPleat,
  pleatContactFeet,
  type PleatState,
} from "../src/shared/pleat-locomotion";
import { pleatGaitSpeed } from "../src/shared/pleat-gait";
import { surfaceRay } from "../src/shared/surface-ray";
import {
  vec,
  dot,
  length,
  sub,
  transport,
  add,
  mul,
  cross,
  unit,
} from "../src/shared/surface-math";
import type { Block } from "../src/shared/map-blocks";
import type { PleatSurface } from "../src/shared/pleat-locomotion";
import legacySpeed from "../docs/evidence/pleat-lightweight-20261101/legacy-speed.json";

const environment = (blocks: Block[]): PleatSurface => ({
  ray: (o, d, max) => surfaceRay(o, d, max, blocks),
});
/** Centres of the three body volumes the former controller collided with. */
function bodyPoints(s: PleatState) {
  const right = unit(cross(s.poseForward, s.up));
  return [
    [0, -0.78],
    [0.244, -0.434],
    [0.302, 0.687],
    [0.302, 1.478], // rear mantle tip
  ]
    .map(([y, z]) =>
      add(
        s.body,
        add(mul(s.up, y * s.scale), mul(s.poseForward, -z * s.scale)),
      ),
    )
    .concat([add(s.body, mul(right, 0))]);
}
function inside(p: { x: number; y: number; z: number }, blocks: Block[]) {
  if (p.y < -0.001) return "ground";
  for (const b of blocks)
    if (
      Math.abs(p.x - b.x) < b.w / 2 - 0.001 &&
      Math.abs(p.z - b.z) < b.d / 2 - 0.001 &&
      p.y > (b.terrainBase ?? 0) + 0.001 &&
      p.y < b.h - 0.001
    )
      return `block ${JSON.stringify(b)}`;
  return "";
}
/** Runs a course, asserting no NaN, no body inside a solid and no teleport. */
function run(
  s: PleatState,
  blocks: Block[],
  seconds: number,
  speed: number,
  until: (s: PleatState) => boolean,
  input: (s: PleatState) => ReturnType<typeof vec> = (s) => s.forward,
) {
  const world = environment(blocks);
  let maxStep = 0,
    stuck = 0,
    longestStuck = 0;
  for (let i = 0; i < seconds * 20; i++) {
    const before = { ...s.body };
    stepPleat(s, input(s), speed, 0.05, world);
    expect(Object.values(s.body).every(Number.isFinite)).toBe(true);
    for (const p of bodyPoints(s))
      expect(inside(p, blocks), JSON.stringify({ i, p, s })).toBe("");
    const moved = length(sub(s.body, before));
    maxStep = Math.max(maxStep, moved);
    stuck = moved < 1e-3 ? stuck + 1 : 0;
    longestStuck = Math.max(longestStuck, stuck);
    if (until(s)) return { done: true, maxStep, longestStuck, ticks: i };
  }
  return { done: false, maxStep, longestStuck, ticks: seconds * 20 };
}
const SIZES = [1.2, 1.5, 2.25, 3];

describe("PLEAT body locomotion", () => {
  it("walks flat at the legacy ground speed without leaving the surface", () => {
    for (const scale of SIZES) {
      const s = createPleat(vec(), vec(0, 0, -1), scale, environment([]));
      for (let i = 0; i < 200; i++)
        stepPleat(s, vec(0, 0, -1), 5.25, 0.05, environment([]));
      expect(s.body.y).toBeCloseTo(0.8 * scale, 2);
      expect(s.normal).toEqual(vec(0, 1, 0));
      expect(s.anchor.z).toBeLessThan(-10);
    }
  });
  it("keeps the measured legacy speed and restart time for every production size", () => {
    const { scales, speeds, ratio, startSeconds } = legacySpeed;
    scales.forEach((scale, a) =>
      speeds.forEach((speed, b) => {
        if (speed < 3.5) return;
        const world = environment([]),
          dir = vec(0, 0, -1);
        const s = createPleat(vec(), dir, scale, world);
        for (let i = 0; i < 60; i++) stepPleat(s, dir, speed, 0.05, world);
        const z0 = s.body.z;
        for (let i = 0; i < 600; i++) stepPleat(s, dir, speed, 0.05, world);
        const measured = (z0 - s.body.z) / 30 / speed;
        expect(measured, `scale ${scale} speed ${speed}`).toBeCloseTo(
          ratio[a][b],
          1,
        );
        expect(Math.abs(measured / ratio[a][b] - 1)).toBeLessThan(0.03);
        const r = createPleat(vec(), dir, scale, world);
        let t = 0;
        while (-r.body.z < 0.5 && t < 5) {
          stepPleat(r, dir, speed, 0.05, world);
          t += 0.05;
        }
        expect(
          Math.abs(t - startSeconds[a][b]),
          `start scale ${scale} speed ${speed}: ${t}`,
        ).toBeLessThanOrEqual(0.1 + 1e-9);
      }),
    );
    // Production commands: size ≤ 1 → 5.25 (lunge 11.55), size > 1 → 3.5 (lunge 7.7).
    expect(pleatGaitSpeed(1.5, 5.25)).toBeLessThan(5.25);
    expect(pleatGaitSpeed(1.5, 11.55)).toBeLessThan(11.55);
  });
  it("climbs floor → wall → roof without stalling or entering the wall, at every size", () => {
    for (const scale of SIZES) {
      const blocks = [{ x: 0, z: -8, w: 20, d: 2, h: 5 + scale }];
      const s = createPleat(vec(), vec(0, 0, -1), scale, environment(blocks));
      let wall = false;
      const result = run(s, blocks, 40, 3.5, (s) => {
        if (s.normal.z > 0.9) wall = true;
        return wall && s.normal.y > 0.9 && s.anchor.y > 4.9 + scale;
      });
      expect(result.done, `scale ${scale} ${JSON.stringify(s)}`).toBe(true);
      expect(result.maxStep).toBeLessThan(0.5 * scale);
      expect(result.longestStuck).toBeLessThan(20);
    }
  });
  it("crosses the thin survival yard wall: up, over its top, down and away", () => {
    const blocks = [{ x: 0, z: 48, w: 94, d: 2, h: 4 }];
    for (const scale of [1.2, 1.275, 1.5, 1.8, 2.25, 3]) {
      const s = createPleat(
        vec(0, 0, 54),
        vec(0, 0, -1),
        scale,
        environment(blocks),
      );
      const seen = new Set<string>();
      const result = run(
        s,
        blocks,
        60,
        3.5,
        (s) => {
          seen.add(
            s.normal.y > 0.9
              ? s.anchor.y > 3.9
                ? "top"
                : s.anchor.z > 48
                  ? "outside"
                  : "inside"
              : s.normal.z > 0.9
                ? "outerWall"
                : s.normal.z < -0.9
                  ? "innerWall"
                  : "other",
          );
          return s.anchor.z < 44 && s.normal.y > 0.9 && s.anchor.y < 0.1;
        },
        () => vec(0, 0, -1),
      );
      expect(result.done, `scale ${scale} ${JSON.stringify(s)}`).toBe(true);
      expect([...seen]).toEqual(
        expect.arrayContaining(["outside", "outerWall", "inside"]),
      );
      expect(result.longestStuck).toBeLessThan(20);
    }
  });
  it("goes floor → wall → ceiling and round a thin slab's outside edge onto its roof", () => {
    for (const scale of [1, 1.5]) {
      const blocks = [
        { x: 0, z: -5, w: 16, d: 2, h: 8 },
        { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
      ];
      const s = createPleat(
        vec(0, 0, 1),
        vec(0, 0, -1),
        scale,
        environment(blocks),
      );
      let ceiling = false,
        outside = false;
      const result = run(s, blocks, 120, 1.5, (s) => {
        if (s.normal.y < -0.9) ceiling = true;
        if (ceiling && s.normal.z > 0.9 && s.anchor.z > 3.9) outside = true;
        return outside && s.normal.y > 0.9 && s.anchor.y > 4.2;
      });
      expect(
        { ceiling, outside, done: result.done },
        `scale ${scale} ${JSON.stringify(s)}`,
      ).toEqual({ ceiling: true, outside: true, done: true });
      expect(result.maxStep).toBeLessThan(0.5 * scale);
    }
  });
  it("walks off a roof edge, down the wall and back onto the floor", () => {
    for (const scale of SIZES) {
      const blocks = [{ x: 0, z: 0, w: 12, d: 12, h: 4 }];
      const s = createPleat(
        vec(0, 4, 0),
        vec(0, 0, -1),
        scale,
        environment(blocks),
      );
      expect(s.anchor.y).toBeCloseTo(4);
      const seen = new Set<string>();
      const result = run(s, blocks, 40, 3.5, (s) => {
        if (s.normal.z < -0.9) seen.add("wall");
        return seen.has("wall") && s.normal.y > 0.9 && s.anchor.y < 0.05;
      });
      expect(result.done, `scale ${scale} ${JSON.stringify(s)}`).toBe(true);
      expect(result.longestStuck).toBeLessThan(20);
    }
  });
  it("steps onto a low kerb and over a knee-high step without transfer or fall", () => {
    for (const scale of SIZES)
      for (const h of [0.2, 0.35 * scale]) {
        const blocks = [{ x: 0, z: -10, w: 12, d: 8, h }];
        const s = createPleat(vec(), vec(0, 0, -1), scale, environment(blocks));
        const result = run(
          s,
          blocks,
          30,
          3.5,
          (s) => s.anchor.z < -7 && Math.abs(s.anchor.y - h) < 0.02,
          () => vec(0, 0, -1),
        );
        expect(result.done, `scale ${scale} h ${h} ${JSON.stringify(s)}`).toBe(
          true,
        );
      }
  });
  it("parallel transport preserves direction around the ceiling and antiparallel normals", () => {
    let f = vec(0, 0, -1),
      n = vec(0, 1, 0);
    for (const next of [
      vec(0, 0, 1),
      vec(0, -1, 0),
      vec(0, 0, -1),
      vec(0, 1, 0),
    ]) {
      f = transport(f, n, next);
      n = next;
      expect(Math.abs(dot(f, n))).toBeLessThan(1e-7);
    }
    expect(length(sub(f, vec(0, 0, -1)))).toBeLessThan(1e-7);
  });
  it("finishes an overdue transfer and survives a world without surfaces", () => {
    const empty: PleatSurface = { ray: () => undefined };
    const s = createPleat(vec(), vec(0, 0, -1), 1, empty);
    for (let i = 0; i < 90; i++) stepPleat(s, s.forward, 1, 1 / 20, empty);
    expect(Object.values(s.body).every(Number.isFinite)).toBe(true);
    s.transfer = {
      point: vec(0, 1, -1),
      normal: vec(0, 0, 1),
      forward: vec(0, 1, 0),
      surface: "missing-wall",
      age: 0,
      convex: false,
    };
    for (let i = 0; i < 40; i++) stepPleat(s, s.forward, 1, 0.05, empty);
    expect(s.switches).toBe(1);
    expect(s.normal).toEqual(vec(0, 0, 1));
    expect(Object.values(s.body).every(Number.isFinite)).toBe(true);
  });
  it("resumes a pre-lightweight save: keeps its body, drops legs, completes a transfer", () => {
    const world = environment([{ x: 0, z: -3, w: 10, d: 2, h: 5 }]);
    const legacy = {
      anchor: vec(0, 0, -1.5),
      normal: vec(0, 1, 0),
      forward: vec(0, 0, -1),
      poseForward: vec(0, 0, -1),
      body: vec(0, 1.2, -1.4),
      up: vec(0, 1, 0),
      velocity: vec(),
      travel: vec(),
      feet: [1, 2, 3, 4].map(() => ({ point: vec(), normal: vec(0, 1, 0) })),
      scale: 1.5,
      phase: 0.4,
      speed: 0,
      transfer: {
        point: vec(0, 0.9, -2),
        normal: vec(0, 0, 1),
        forward: vec(0, 1, 0),
        surface: "block:0",
        age: 0.3,
        convex: false,
        prepared: true,
      },
      settling: false,
      switches: 2,
    } as unknown as PleatState;
    for (let i = 0; i < 40; i++)
      stepPleat(legacy, legacy.forward, 3.5, 0.05, world);
    expect("feet" in legacy).toBe(false);
    expect("travel" in legacy).toBe(false);
    expect(legacy.switches).toBeGreaterThanOrEqual(3);
    expect(Object.values(legacy.body).every(Number.isFinite)).toBe(true);
  });
  it("derives four compatibility contacts from the body alone", () => {
    const s = createPleat(vec(), vec(0, 0, -1), 1.5, environment([]));
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      s.phase = phase;
      const feet = pleatContactFeet(s);
      expect(feet).toHaveLength(4);
      expect(feet.filter((f) => f.planted).length).toBeGreaterThanOrEqual(2);
      for (const f of feet) {
        expect(f.point.y).toBeGreaterThanOrEqual(-1e-9);
        expect(f.point.y).toBeLessThan(0.3);
      }
    }
  });
});
