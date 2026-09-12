import type { Block } from "./defs";
import { MAP_SCALE } from "./arena";

// One connected nest: two loops share a cross tunnel, with winding side burrows.
export const CAVE_NODES = [
  [0, 40],
  [0, 22],
  [-21, 25],
  [-31, 3],
  [-23, -23],
  [0, -37],
  [23, -24],
  [31, 1],
  [22, 24],
  [0, 0],
  [-34, -37],
  [34, 37],
  [-15, -1],
  [16, 4],
].map(([x, z]) => ({ x: x * MAP_SCALE, z: z * MAP_SCALE }));
export const CAVE_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 1],
  [3, 12],
  [12, 9],
  [9, 13],
  [13, 7],
  [4, 10],
  [8, 11],
];
export const CAVE_RADIUS = 6.8;
export const CAVE_BLOCKS: Block[] = [];
type Point = { x: number; z: number };
export function caveClearance(x: number, z: number) {
  let best = -Infinity;
  for (const [ai, bi] of CAVE_EDGES) {
    const a = CAVE_NODES[ai],
      b = CAVE_NODES[bi];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
    );
    best = Math.max(
      best,
      CAVE_RADIUS - Math.hypot(x - a.x - dx * t, z - a.z - dz * t),
    );
  }
  // Round chambers at important junctions; other branches stay narrow.
  for (const i of [1, 5, 9])
    best = Math.max(
      best,
      9 - Math.hypot(x - CAVE_NODES[i].x, z - CAVE_NODES[i].z),
    );
  return best;
}
export function caveCeiling(x: number, z: number) {
  const c = caveClearance(x, z);
  if (c < 0) return 0;
  const d = Math.max(0, CAVE_RADIUS - c);
  return 2 + Math.sqrt(Math.max(0, CAVE_RADIUS * CAVE_RADIUS - d * d)) * 1.25;
}
export function caveBlocked(x: number, z: number, r = 0.55, y = 0) {
  return (
    caveClearance(x, z) < r || y < 0 || y + Math.max(0.1, r) > caveCeiling(x, z)
  );
}
export function caveRay(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
) {
  // Conservative signed-distance stepping; also intersects the arched ceiling.
  let t = 0;
  while (t < max) {
    const px = x + dx * t,
      py = y + dy * t,
      pz = z + dz * t;
    const clearance = caveClearance(px, pz),
      roof = caveCeiling(px, pz) - py;
    if (clearance < 0 || roof < 0 || py < 0) return Math.max(0, t - 0.06);
    t += Math.max(0.06, Math.min(2, clearance * 0.4, roof * 0.2, py + 0.05));
  }
  return max;
}
export function caveLine(a: Point, b: Point, r = 0.8) {
  const d = Math.hypot(b.x - a.x, b.z - a.z),
    n = Math.ceil(d / 0.8);
  for (let i = 0; i <= n; i++) {
    const f = n ? i / n : 0;
    if (caveClearance(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f) < r)
      return false;
  }
  return true;
}
const distances = CAVE_NODES.map((_, i) =>
  CAVE_NODES.map((__, j) => (i === j ? 0 : Infinity)),
);
const next = CAVE_NODES.map(() => CAVE_NODES.map(() => -1));
for (const [a, b] of CAVE_EDGES) {
  distances[a][b] = distances[b][a] = Math.hypot(
    CAVE_NODES[a].x - CAVE_NODES[b].x,
    CAVE_NODES[a].z - CAVE_NODES[b].z,
  );
  next[a][b] = b;
  next[b][a] = a;
}
for (let k = 0; k < CAVE_NODES.length; k++)
  for (let i = 0; i < CAVE_NODES.length; i++)
    for (let j = 0; j < CAVE_NODES.length; j++)
      if (distances[i][k] + distances[k][j] < distances[i][j]) {
        distances[i][j] = distances[i][k] + distances[k][j];
        next[i][j] = next[i][k];
      }
export function caveWaypoint(a: Point, b: Point, r = 1): Point {
  const startRadius = Math.max(
    0.1,
    Math.min(r, caveClearance(a.x, a.z) - 0.05),
  );
  const endRadius = Math.max(0.1, Math.min(r, caveClearance(b.x, b.z) - 0.05));
  if (caveLine(a, b, Math.min(startRadius, endRadius))) return b;
  const starts = CAVE_NODES.map((p, i) => ({
    p,
    i,
    d: Math.hypot(p.x - a.x, p.z - a.z),
  })).filter((n) => caveLine(a, n.p, startRadius));
  const ends = CAVE_NODES.map((p, i) => ({
    p,
    i,
    d: Math.hypot(p.x - b.x, p.z - b.z),
  })).filter((n) => caveLine(b, n.p, endRadius));
  let cost = Infinity,
    result = a;
  for (const s of starts)
    for (const e of ends) {
      const length = s.d + distances[s.i][e.i] + e.d;
      if (length < cost) {
        cost = length;
        result =
          s.d < 1.5 && next[s.i][e.i] >= 0 ? CAVE_NODES[next[s.i][e.i]] : s.p;
      }
    }
  return result;
}
