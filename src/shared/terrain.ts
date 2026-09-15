import type { Block } from "./defs";
import { ARENA_X, ARENA_Z } from "./arena";

export const WALK_STEP = 0.36;
export const TERRAIN_CELL = 1;
export interface TerrainProp extends Block {
  base: number;
  style: "slab" | "crate" | "rock";
}
interface Terrain {
  heights: Float32Array;
  props: TerrainProp[];
}
const terrains = new WeakMap<Block[], Terrain>();
const NX = ARENA_X * 2 + 1,
  NZ = ARENA_Z * 2 + 1;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};

/** Fixed, metre-space ridgelines. Buildings retain their original foundations. */
export function registerTerrain(blocks: Block[], index: number) {
  const ridges = [
    [
      [-5, -42, 22, 35, 2.8],
      [9, 54, 19, 24, 1.8],
      [-79, 5, 17, 54, 3.6],
    ],
    [
      [0, -35, 23, 40, 2.4],
      [5, 54, 23, 27, 1.6],
      [-80, 15, 15, 60, 2.8],
    ],
    [
      [0, -40, 23, 35, 3.2],
      [0, 48, 22, 32, 2.4],
      [81, -5, 13, 60, 3.8],
    ],
    [
      [-20, -28, 36, 60, 8.5],
      [31, 36, 36, 51, 6.8],
      [-71, 24, 27, 58, 10],
    ],
    [
      [-7, -36, 31, 56, 10.5],
      [8, 46, 28, 46, 7.5],
      [-81, -15, 20, 77, 14],
    ],
    [
      [-43, 0, 35, 48, 1.7],
      [31, -40, 39, 31, 1.9],
      [0, 30, 20, 27, 1.25],
    ],
  ][index];
  const heights = new Float32Array(NX * NZ);
  for (let iz = 0; iz < NZ; iz++)
    for (let ix = 0; ix < NX; ix++) {
      const x = ix - ARENA_X,
        z = iz - ARENA_Z;
      let h = 0;
      // Intact paved districts have no authored root damage or collapsed roads.
      for (const [cx, cz, rx, rz, peak] of index < 3 ? [] : ridges) {
        // Elliptical, long crests with two traversable shoulders, not noise bumps.
        const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
        h = Math.max(h, peak * smooth(1 - d));
      }
      let foundation = 1;
      for (const b of blocks) {
        const d = Math.hypot(
          Math.max(0, Math.abs(x - b.x) - b.w / 2),
          Math.max(0, Math.abs(z - b.z) - b.d / 2),
        );
        foundation = Math.min(foundation, smooth((d - 2) / 10));
      }
      h *=
        foundation *
        smooth((ARENA_X - Math.abs(x)) / 8) *
        smooth((ARENA_Z - Math.abs(z)) / 8);
      // Keep the entry, coop spawn and a broad centre lane accessible.
      h *= 0.55 + 0.45 * smooth(Math.abs(x) / 8);
      heights[iz * NX + ix] = h;
    }
  const terrain: Terrain = { heights, props: [] };
  terrains.set(blocks, terrain);
  // No generic prop placement. Relief comes from the ground itself; any future
  // props must belong to an authored location and its environment.
}

/** Triangulated metre grid, O(1), shared by client and Worker; visual vertices sample it. */
export function groundHeight(x: number, z: number, blocks: Block[]): number {
  const t = terrains.get(blocks);
  if (!t || Math.abs(x) >= ARENA_X || Math.abs(z) >= ARENA_Z) return 0;
  const gx = x + ARENA_X,
    gz = z + ARENA_Z,
    ix = Math.floor(gx),
    iz = Math.floor(gz),
    fx = gx - ix,
    fz = gz - iz;
  const a = t.heights[iz * NX + ix],
    b = t.heights[iz * NX + ix + 1],
    c = t.heights[(iz + 1) * NX + ix],
    d = t.heights[(iz + 1) * NX + ix + 1];
  return fx + fz <= 1
    ? a + (b - a) * fx + (c - a) * fz
    : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
export function terrainProps(blocks: Block[]) {
  return terrains.get(blocks)?.props ?? [];
}
export function supportHeight(
  x: number,
  z: number,
  blocks: Block[],
  feet = Infinity,
  r = 0,
) {
  let h = groundHeight(x, z, blocks);
  for (const b of terrainProps(blocks))
    if (
      Math.abs(x - b.x) < b.w / 2 + r &&
      Math.abs(z - b.z) < b.d / 2 + r &&
      b.base + b.h <= feet + WALK_STEP + 1e-6
    )
      h = Math.max(h, b.base + b.h);
  for (const b of blocks)
    if (
      Math.abs(x - b.x) < b.w / 2 + r &&
      Math.abs(z - b.z) < b.d / 2 + r &&
      b.h <= feet + WALK_STEP + 1e-6
    )
      h = Math.max(h, b.h);
  return h;
}
export function terrainBlocked(
  x: number,
  z: number,
  r: number,
  y: number,
  blocks: Block[],
) {
  return terrainProps(blocks).some(
    (b) =>
      y < b.base + b.h - 1e-6 &&
      Math.abs(x - b.x) < b.w / 2 + r &&
      Math.abs(z - b.z) < b.d / 2 + r,
  );
}
export function terrainRay(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
  blocks: Block[],
) {
  if (!terrains.has(blocks)) return max;
  const under = (s: number) =>
    y + dy * s < groundHeight(x + dx * s, z + dz * s, blocks) - 0.015;
  for (let s = 0; s <= max + 0.4; s += 0.4) {
    const end = Math.min(s, max);
    if (under(end)) {
      let lo = Math.max(0, end - 0.4),
        hi = end;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        if (under(mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    if (end === max) break;
  }
  return max;
}
export function markerAbove(enemy: { y: number }, player?: { y?: number }) {
  return enemy.y > (player?.y ?? 0) + 0.05;
}

/** Swept descending feet contact for the next jump task. Upward motion cannot
 * land on a roof; a downward sweep stops on the highest crossed top surface. */
export function landingHeight(
  x: number,
  z: number,
  fromY: number,
  toY: number,
  blocks: Block[],
  r = 0.55,
): number | undefined {
  if (toY > fromY) return undefined;
  const surfaces = [groundHeight(x, z, blocks)];
  for (const b of [...blocks, ...terrainProps(blocks)])
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)
      surfaces.push(b.h + ("base" in b ? Number(b.base) : 0));
  return surfaces
    .filter((y) => y <= fromY + 1e-6 && y >= toY - 1e-6)
    .sort((a, b) => b - a)[0];
}
