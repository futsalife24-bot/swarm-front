import { expect, it } from "vitest";
import { MAPS, STAGES } from "../src/shared/stages";
import { blocked, createWorld, spawn } from "../src/shared/game";
import { ENEMIES } from "../src/shared/defs";
import { ARENA_X, ARENA_Z } from "../src/shared/arena";
import {
  CAVE_BLOCKS,
  CAVE_NODES,
  CAVE_EDGES,
  CAVE_RADIUS,
  caveClearance,
  caveCeiling,
  caveWaypoint,
} from "../src/shared/cave";
import { move, wallDistance } from "../src/shared/game";

it("doubles outdoor extents and tunnel centreline lengths without widening the tunnels", () => {
  expect([ARENA_X * 2, ARENA_Z * 2]).toEqual([188, 208]);
  expect(blocked(93, 100, 0.55, 0, [])).toBe(false);
  expect(blocked(94, 100, 0.55, 0, [])).toBe(true);
  expect(CAVE_NODES[0]).toEqual({ x: 0, z: 80 });
  expect(CAVE_NODES[5]).toEqual({ x: 0, z: -74 });
  expect(CAVE_RADIUS).toBe(6.8);
  expect(caveCeiling(0, 72)).toBeCloseTo(10.5);
  expect(caveClearance(6.8, 72)).toBeCloseTo(0);
  expect(MAPS[0].blocks[0]).toMatchObject({ x: -62, z: -70, w: 16, d: 22 });
});

it("nest has two solid islands, two independent loops and an arched bullet-blocking ceiling", () => {
  expect(CAVE_EDGES.length - CAVE_NODES.length + 1).toBe(2);
  expect(caveClearance(0, -36)).toBeLessThan(0);
  expect(caveClearance(0, 24)).toBeLessThan(0);
  expect(caveCeiling(0, 72)).toBeGreaterThan(caveCeiling(5, 72));
  expect(wallDistance(0, 1.5, 72, 0, 0, -1, 70, CAVE_BLOCKS)).toBeLessThan(60);
  expect(wallDistance(0, 1.5, 72, 0, 1, 0, 30, CAVE_BLOCKS)).toBeCloseTo(
    caveCeiling(0, 72) - 1.5,
    0,
  );
  expect(blocked(0, 72, 1, 14, CAVE_BLOCKS)).toBe(true);
});

it("a boss-sized mover can route around both islands and return from the burrows", () => {
  for (const [from, to] of [
    [0, 5],
    [10, 11],
    [3, 7],
    [11, 10],
  ]) {
    const p = { ...CAVE_NODES[from] },
      target = CAVE_NODES[to];
    for (
      let n = 0;
      n < 3000 && Math.hypot(p.x - target.x, p.z - target.z) > 1;
      n++
    ) {
      const next = caveWaypoint(p, target, 4),
        d = Math.max(0.001, Math.hypot(next.x - p.x, next.z - p.z));
      move(
        p,
        ((next.x - p.x) / d) * 0.2,
        ((next.z - p.z) / d) * 0.2,
        4,
        CAVE_BLOCKS,
      );
      expect(blocked(p.x, p.z, 4, 0, CAVE_BLOCKS)).toBe(false);
    }
    expect(Math.hypot(p.x - target.x, p.z - target.z)).toBeLessThan(1);
  }
});

it.each(MAPS.slice(3))(
  "$name has connected walkable passages and safe enemy entries",
  (map) => {
    // Flood the playable floor at two-metre spacing, including side chambers.
    const open = new Set<string>();
    for (let x = -92; x <= 92; x += 2)
      for (let z = -102; z <= 102; z += 2)
        if (!blocked(x, z, 0.55, 0, map.blocks)) open.add(`${x},${z}`);
    const queue = [[0, 0]],
      seen = new Set(["0,0"]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        const key = `${x + dx},${z + dz}`;
        if (open.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push([x + dx, z + dz]);
        }
      }
    }
    expect(seen.size).toBe(open.size);
    const stage = STAGES.find((s) => MAPS[s.map] === map)!;
    for (let seed = 1; seed <= 30; seed++) {
      const w = createWorld("entries", seed, stage.id);
      for (const kind of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]) {
        spawn(w, kind);
        const e = w.enemies.at(-1)!;
        expect(blocked(e.x, e.z, ENEMIES[kind].radius, e.y, map.blocks)).toBe(
          false,
        );
      }
    }
  },
);
