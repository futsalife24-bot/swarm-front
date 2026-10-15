import { it, expect } from "vitest";
import {
  createPleat,
  stepPleat,
  pleatHip,
} from "../src/shared/pleat-locomotion";
import { surfaceRay } from "../src/shared/surface-ray";
import {
  vec,
  dot,
  length,
  sub,
  transport,
  add,
  mul,
} from "../src/shared/surface-math";
import type { Block } from "../src/shared/map-blocks";
import type { PleatSurface } from "../src/shared/pleat-locomotion";
const environment = (blocks: Block[]) => ({
  ray: (o: ReturnType<typeof vec>, d: ReturnType<typeof vec>, max: number) =>
    surfaceRay(o, d, max, blocks),
});
it("keeps supported feet within leg reach at production sizes and burst speeds", () => {
  for (const scale of [1.2, 1.5, 3]) {
    const world = environment([]),
      s = createPleat(vec(), vec(0, 0, -1), scale, world);
    let reach = 0;
    for (let i = 0; i < 600; i++) {
      stepPleat(
        s,
        vec(Math.sin(i / 120) * 0.4, 0, -1),
        i < 180 ? 5.25 : i < 210 ? 11.55 : i < 400 ? 3.5 : 0,
        1 / 60,
        world,
      );
      s.feet.forEach((f, j) => {
        if (f.planted && f.reachable)
          reach = Math.max(
            reach,
            length(sub(f.point, pleatHip(s, j))) /
              ((j < 2 ? 1.912 : 1.842) * scale),
          );
      });
    }
    expect(reach, `scale=${scale}`).toBeLessThan(1.08);
    expect(s.feet.every((f) => f.planted)).toBe(true);
  }
});
it("walks flat with planted contacts, bounded reach and no neighbouring swings", () => {
  const world = environment([]),
    s = createPleat(vec(), vec(0, 0, -1), 1, world);
  for (let frame = 0; frame < 600; frame++) {
    const before = s.feet.map((f) => ({
      planted: f.planted,
      target: { ...f.target },
      support: { ...f.support },
    }));
    stepPleat(s, vec(0, 0, -1), 2, 1 / 60, world);
    s.feet.forEach((f, i) => {
      if (!f.planted) {
        expect(s.feet[i ^ 1].planted).toBe(true);
        expect(s.feet[i ^ 2].planted).toBe(true);
        if (!before[i].planted) {
          expect(f.target).toEqual(before[i].target);
          expect(f.support).toEqual(before[i].support);
        }
      }
    });
    expect(s.feet.filter((f) => !f.planted).length).toBeLessThanOrEqual(2);
    expect(s.feet.every((f) => Number.isFinite(f.point.y))).toBe(true);
    expect(s.body.y).toBeGreaterThan(0.3);
    expect(s.body.y).toBeLessThan(1.5);
  }
  expect(s.anchor.z).toBeLessThan(-18);
});
it("front feet land on a wall before the anchor changes, then climbs over a roof edge", () => {
  const world = environment([{ x: 0, z: -5, w: 20, d: 2, h: 5 }]),
    s = createPleat(vec(), vec(0, 0, -1), 1, world);
  let frontFirst = false,
    wall = false,
    roof = false;
  for (let frame = 0; frame < 1500; frame++) {
    const old = s.switches;
    stepPleat(s, s.forward, 1.5, 1 / 60, world);
    if (s.switches > old && !wall)
      frontFirst = s.feet
        .slice(0, 2)
        .every((f) => f.planted && dot(f.normal, s.normal) > 0.8);
    if (s.normal.z > 0.9) wall = true;
    if (wall && s.normal.y > 0.9 && s.anchor.y > 4.9) roof = true;
    if (roof) break;
  }
  expect({
    frontFirst,
    wall,
    roof,
    anchor: s.anchor,
    normal: s.normal,
    settling: s.settling,
    feet: s.feet.map((f) => ({
      p: f.point,
      n: f.normal,
      land: f.planted,
      reach: f.reachable,
    })),
  }).toMatchObject({ frontFirst: true, wall: true, roof: true });
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
  expect(
    length(transport(vec(1, 0, 0), vec(0, 1, 0), vec(0, -1, 0))),
  ).toBeCloseTo(1);
});
it("carries planted contacts in a translating support's local coordinates", () => {
  const box = { x: 0, z: 0, w: 8, d: 8, h: 1, terrainBase: 0.5 };
  const world: PleatSurface = {
    ...environment([box]),
    local: (_id, p) => vec(p.x - box.x, p.y, p.z),
    world: (_id, p) => vec(p.x + box.x, p.y, p.z),
  };
  const s = createPleat(vec(0, 1, 0), vec(0, 0, -1), 1, world);
  const before = s.feet.map((f) => ({ ...f.point }));
  box.x = 0.08;
  stepPleat(s, vec(0, 0, -1), 0, 1 / 60, world);
  s.feet.forEach((f, i) => {
    expect(f.planted).toBe(true);
    expect(f.point.x - before[i].x).toBeCloseTo(0.08);
    expect(f.point.y).toBeCloseTo(1);
  });
});
it("forces an overdue transfer without making NaNs", () => {
  const world = environment([]),
    s = createPleat(vec(), vec(0, 0, -1), 1, world);
  s.transfer = {
    point: vec(0, 1, -1),
    normal: vec(0, 0, 1),
    forward: vec(0, 1, 0),
    surface: "missing-wall",
    age: 1.39,
    convex: false,
    prepared: true,
  };
  stepPleat(s, s.forward, 1, 0.02, world);
  expect(s.switches).toBe(1);
  expect(s.normal).toEqual(vec(0, 0, 1));
  expect(Object.values(s.body).every(Number.isFinite)).toBe(true);
});
it("folds feet when all three foothold rays miss", () => {
  const world: PleatSurface = { ray: () => undefined },
    s = createPleat(vec(), vec(0, 0, -1), 1, world);
  for (let i = 0; i < 90; i++) stepPleat(s, s.forward, 1, 1 / 60, world);
  expect(s.feet.every((f) => !f.reachable)).toBe(true);
  expect(
    s.feet.every((f, i) => length(sub(f.point, pleatHip(s, i))) < 0.6),
  ).toBe(true);
});
it("continues from floor to wall to ceiling and round a thin slab's outside edge", () => {
  const world = environment([
    { x: 0, z: -5, w: 16, d: 2, h: 8 },
    { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
  ]);
  const s = createPleat(vec(0, 0, 1), vec(0, 0, -1), 1, world);
  let ceiling = false,
    outside = false,
    roof = false,
    maxReach = 0,
    maxBodyStep = 0,
    jumpInfo = "",
    reachInfo = "";
  for (let i = 0; i < 3000; i++) {
    const previous = { ...s.body };
    stepPleat(s, s.forward, 1, 1 / 60, world);
    // Actual rear mantle extends to z=1.478, well beyond the former .45 sphere.
    const rear = add(s.body, add(mul(s.up, 0.302), mul(s.poseForward, -1.478)));
    const inWall =
      Math.abs(rear.x) < 8 &&
      rear.z < -4.001 &&
      rear.z > -5.999 &&
      rear.y > 0.001 &&
      rear.y < 7.999;
    const inSlab =
      Math.abs(rear.x) < 8 &&
      Math.abs(rear.z) < 3.999 &&
      rear.y > 4.001 &&
      rear.y < 4.299;
    expect(inWall || inSlab, JSON.stringify({ i, rear, body: s.body })).toBe(
      false,
    );
    if (length(sub(s.body, previous)) > maxBodyStep) {
      maxBodyStep = length(sub(s.body, previous));
      jumpInfo = JSON.stringify({
        i,
        previous,
        body: s.body,
        anchor: s.anchor,
        n: s.normal,
        up: s.up,
        feet: s.feet.map((f) => f.point),
      });
    }
    s.feet.forEach((f, j) => {
      if (f.planted) {
        const r =
          length(sub(f.point, pleatHip(s, j))) / (j < 2 ? 1.912 : 1.842);
        if (r > maxReach) {
          maxReach = r;
          reachInfo = JSON.stringify({
            i,
            j,
            body: s.body,
            hip: pleatHip(s, j),
            point: f.point,
            normal: s.normal,
            transfer: s.transfer,
            settling: s.settling,
          });
        }
      }
    });
    if (s.normal.y < -0.9) ceiling = true;
    if (ceiling && s.normal.z > 0.9 && s.anchor.z > 3.9) outside = true;
    if (outside && s.normal.y > 0.9 && s.anchor.y > 4.2) {
      roof = true;
      break;
    }
  }
  expect(
    {
      ceiling,
      outside,
      roof,
      anchor: s.anchor,
      normal: s.normal,
      settling: s.settling,
      transfer: s.transfer,
      maxReach,
      maxBodyStep,
    },
    JSON.stringify(s),
  ).toMatchObject({ ceiling: true, outside: true, roof: true });
  expect(maxBodyStep, jumpInfo).toBeLessThan(0.3);
  expect(maxReach, reachInfo).toBeLessThan(1.05);
});
