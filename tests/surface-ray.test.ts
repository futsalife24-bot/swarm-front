import { describe, expect, it } from "vitest";
import { surfaceRay } from "../src/shared/surface-ray";
import type { Block } from "../src/shared/map-blocks";
import {
  groundHeight,
  registerTerrain,
  terrainProps,
} from "../src/shared/terrain";
import { registerRock, rockHeight } from "../src/shared/rock";
import {
  CAVE_BLOCKS,
  CAVE_NODES,
  CAVE_RADIUS,
  caveCeiling,
  caveClearance,
} from "../src/shared/cave";

describe("surface rays for crawling supports", () => {
  it("finds the real cave arch, with inward normals even when exiting solid stone", () => {
    const { x, z } = CAVE_NODES[0];
    const roof = caveCeiling(x, z);
    const below = surfaceRay(
      { x, y: 1, z },
      { x: 0, y: 1, z: 0 },
      20,
      CAVE_BLOCKS,
    )!;
    expect(below.point.y).toBeCloseTo(roof, 4);
    expect(below.normal.y).toBeCloseTo(-1);
    const above = surfaceRay(
      { x, y: roof + 1, z },
      { x: 0, y: -1, z: 0 },
      2,
      CAVE_BLOCKS,
    )!;
    expect(above.point.y).toBeCloseTo(roof, 4);
    expect(above.normal.y).toBeCloseTo(-1);
    const slope = surfaceRay(
      { x: x + CAVE_RADIUS * 0.7, y: 1, z },
      { x: 0, y: 1, z: 0 },
      20,
      CAVE_BLOCKS,
    )!;
    expect(slope.point.y).toBeCloseTo(caveCeiling(slope.point.x, z), 4);
    expect(slope.normal.x).toBeLessThan(0);
    expect(slope.normal.y).toBeLessThan(0);
  });
  it("finds cave walls and floor while keeping connected tunnel interiors open", () => {
    const { x, z } = CAVE_NODES[0];
    const wall = surfaceRay(
      { x, y: 1, z },
      { x: 1, y: 0, z: 0 },
      15,
      CAVE_BLOCKS,
    )!;
    expect(caveClearance(wall.point.x, wall.point.z)).toBeCloseTo(0, 4);
    expect(wall.normal.x).toBeCloseTo(-1);
    const exit = surfaceRay(
      { x: x + CAVE_RADIUS + 0.2, y: 1, z },
      { x: -1, y: 0, z: 0 },
      1,
      CAVE_BLOCKS,
    )!;
    expect(exit.distance).toBeCloseTo(0.2, 4);
    expect(exit.normal.x).toBeCloseTo(-1);
    const floor = surfaceRay(
      { x, y: -0.2, z },
      { x: 0, y: 1, z: 0 },
      1,
      CAVE_BLOCKS,
    )!;
    expect(floor.point.y).toBeCloseTo(0, 4);
    expect(floor.normal.y).toBeCloseTo(1);
    expect(
      surfaceRay({ x, y: 1, z }, { x: 0, y: 0, z: -1 }, 10, CAVE_BLOCKS),
    ).toBeUndefined();
  });
  it("normalizes directions and finds the floor without terrain registration", () => {
    const hit = surfaceRay({ x: 0, y: 2, z: 0 }, { x: 0, y: -7, z: 0 }, 3, []);
    expect(hit?.distance).toBeCloseTo(2);
    expect(hit?.normal).toEqual({ x: 0, y: 1, z: 0 });
    expect(
      surfaceRay({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 0 }, 3, []),
    ).toBeUndefined();
    expect(
      surfaceRay({ x: 0, y: 2, z: 0 }, { x: 0, y: -1, z: 0 }, 1, []),
    ).toBeUndefined();
  });
  it("hits every face, including a thin plate underside and an inside exit", () => {
    const blocks: Block[] = [
      { x: 0, z: 0, w: 4, d: 4, terrainBase: 2, h: 2.03 },
    ];
    const below = surfaceRay(
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      5,
      blocks,
    );
    expect(below?.point.y).toBe(2);
    expect(below?.normal).toEqual({ x: 0, y: -1, z: 0 });
    const inside = surfaceRay(
      { x: 0, y: 2.01, z: 0 },
      { x: 0, y: 1, z: 0 },
      1,
      blocks,
    );
    expect(inside?.distance).toBeCloseTo(0.02);
    expect(inside?.normal.y).toBe(1);
    const wall = surfaceRay(
      { x: 3, y: 2.01, z: 0 },
      { x: -1, y: 0, z: 0 },
      4,
      blocks,
    );
    expect(wall?.normal).toEqual({ x: 1, y: 0, z: 0 });
    expect(wall?.distance).toBe(1);
    expect(
      surfaceRay({ x: 3, y: 1, z: 0 }, { x: -1, y: 0, z: 0 }, 6, blocks),
    ).toBeUndefined();
  });
  it("chooses the nearest surface regardless of block order", () => {
    const blocks: Block[] = [
      { x: 8, z: 0, w: 2, d: 2, h: 5 },
      { x: 3, z: 0, w: 2, d: 2, h: 5 },
    ];
    const hit = surfaceRay(
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      20,
      blocks,
    );
    expect(hit?.distance).toBe(2);
    expect(hit?.surface).toBe("block:1");
  });
  it("keeps genuine door openings between authored collision pieces open", () => {
    const blocks: Block[] = [
      { x: -2, z: 0, w: 2, d: 1, h: 4 },
      { x: 2, z: 0, w: 2, d: 1, h: 4 },
      { x: 0, z: 0, w: 2, d: 1, terrainBase: 3, h: 4 },
    ];
    expect(
      surfaceRay({ x: 0, y: 1, z: -2 }, { x: 0, y: 0, z: 1 }, 4, blocks),
    ).toBeUndefined();
    expect(
      surfaceRay({ x: 0, y: 3.5, z: -2 }, { x: 0, y: 0, z: 1 }, 4, blocks)
        ?.distance,
    ).toBe(1.5);
  });
  it("uses prop base plus height rather than treating height as world Y", () => {
    const blocks: Block[] = [];
    registerTerrain(blocks, 0);
    terrainProps(blocks).push({
      x: 0,
      z: 0,
      w: 2,
      d: 2,
      base: 3,
      h: 0.1,
      style: "slab",
    });
    const top = surfaceRay(
      { x: 0, y: 5, z: 0 },
      { x: 0, y: -1, z: 0 },
      10,
      blocks,
    );
    expect(top?.point.y).toBeCloseTo(3.1);
    expect(top?.surface).toBe("prop:0");
    expect(
      surfaceRay({ x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, 2, blocks)?.point
        .y,
    ).toBe(3);
  });
  it("matches triangulated slopes and returns their actual normal", () => {
    const blocks: Block[] = [];
    registerTerrain(blocks, 3);
    for (const [x, z] of [
      [-10.2, -20.3],
      [22.8, 30.7],
    ]) {
      const y = groundHeight(x, z, blocks);
      const hit = surfaceRay(
        { x, y: y + 2, z },
        { x: 0, y: -1, z: 0 },
        3,
        blocks,
      );
      expect(hit?.point.y).toBeCloseTo(y, 8);
      expect(hit!.normal.y).toBeGreaterThan(0);
      expect(
        Math.hypot(hit!.normal.x, hit!.normal.y, hit!.normal.z),
      ).toBeCloseTo(1);
      const aheadX = x + 0.01;
      expect(y - (hit!.normal.x / hit!.normal.y) * 0.01).toBeCloseTo(
        groundHeight(aheadX, z, blocks),
        7,
      );
    }
    // An oblique ray crosses multiple cells before reaching the hillside.
    const hit = surfaceRay(
      { x: -20, y: 25, z: -20 },
      { x: 1, y: -1, z: 0.2 },
      50,
      blocks,
    )!;
    expect(hit.point.y).toBeCloseTo(
      groundHeight(hit.point.x, hit.point.z, blocks),
      7,
    );
  });
  it("uses authored rock triangles instead of an invisible bounding-box roof", () => {
    const b: Block = { x: 0, z: 0, w: 8, d: 8, h: 6 };
    registerRock(b, () => 0);
    const blocks = [b];
    const hit = surfaceRay(
      { x: 3, y: 10, z: 0 },
      { x: 0, y: -1, z: 0 },
      20,
      blocks,
    )!;
    expect(hit.point.y).toBeCloseTo(rockHeight(b, 3, 0), 7);
    expect(hit.point.y).toBeLessThan(6);
    expect(hit.normal.x).toBeGreaterThan(0);
    expect(hit.normal.y).toBeGreaterThan(0);
    const exit = surfaceRay(
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      10,
      blocks,
    )!;
    expect(exit.normal.y).toBeGreaterThan(0);
    expect(exit.point.y).toBeCloseTo(6);
  });
});
