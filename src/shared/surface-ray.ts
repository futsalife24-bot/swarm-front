import type { Block } from "./map-blocks";
import { groundHeight, terrainProps } from "./terrain";
import { isRock, rockTriangles } from "./rock";
import { CAVE_BLOCKS, CAVE_RADIUS, caveClearance } from "./cave";

export type SurfaceVector = { x: number; y: number; z: number };
export type SurfaceHit = {
  point: SurfaceVector;
  normal: SurfaceVector;
  distance: number;
  surface: string;
};
type Point = readonly [number, number, number];
const EPS = 1e-9;

/** Finite world-space ray against the same geometry used by shared collision.
 * Normals always face out of solids, including rays starting inside them.
 * Surface IDs identify a support object, not a triangle or individual face.
 */
export function surfaceRay(
  origin: SurfaceVector,
  direction: SurfaceVector,
  max: number,
  blocks: Block[],
): SurfaceHit | undefined {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (
    !Number.isFinite(max) ||
    max < 0 ||
    !Number.isFinite(length) ||
    length < EPS ||
    ![origin.x, origin.y, origin.z].every(Number.isFinite)
  )
    return undefined;
  const o = [origin.x, origin.y, origin.z];
  const d = [direction.x / length, direction.y / length, direction.z / length];
  if (blocks === CAVE_BLOCKS) return caveSurfaceRay(o, d, max);
  let best: SurfaceHit | undefined;
  const hit = (t: number, normal: SurfaceVector, surface: string) => {
    if (t < -EPS || t > max + EPS || (best && t >= best.distance - EPS)) return;
    t = Math.max(0, Math.min(max, t));
    best = {
      point: { x: o[0] + d[0] * t, y: o[1] + d[1] * t, z: o[2] + d[2] * t },
      normal,
      distance: t,
      surface,
    };
  };
  const triangle = (
    a: Point,
    b: Point,
    c: Point,
    surface: string,
    sign = 1,
  ) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [
      d[1] * v[2] - d[2] * v[1],
      d[2] * v[0] - d[0] * v[2],
      d[0] * v[1] - d[1] * v[0],
    ];
    const det = u[0] * p[0] + u[1] * p[1] + u[2] * p[2];
    if (Math.abs(det) < EPS) return;
    const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const first = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (first < -EPS || first > 1 + EPS) return;
    const q = [
      s[1] * u[2] - s[2] * u[1],
      s[2] * u[0] - s[0] * u[2],
      s[0] * u[1] - s[1] * u[0],
    ];
    const second = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (second < -EPS || first + second > 1 + EPS) return;
    const n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const scale = sign / Math.hypot(...n);
    hit(
      (v[0] * q[0] + v[1] * q[1] + v[2] * q[2]) / det,
      { x: n[0] * scale, y: n[1] * scale, z: n[2] * scale },
      surface,
    );
  };
  const box = (
    b: Block,
    bottom: number,
    top: number,
    surface: string,
    rock: boolean,
  ) => {
    const low = [b.x - b.w / 2, bottom, b.z - b.d / 2];
    const high = [b.x + b.w / 2, top, b.z + b.d / 2];
    let enter = -Infinity,
      exit = Infinity,
      enterAxis = 0,
      exitAxis = 0,
      enterSign = 0,
      exitSign = 0;
    for (let i = 0; i < 3; i++) {
      // Rock top heights follow the ground at each vertex: use XZ broad phase only.
      if (rock && i === 1) continue;
      if (Math.abs(d[i]) < EPS) {
        if (o[i] < low[i] - EPS || o[i] > high[i] + EPS) return;
        continue;
      }
      const a = (low[i] - o[i]) / d[i],
        z = (high[i] - o[i]) / d[i];
      const near = Math.min(a, z),
        far = Math.max(a, z);
      if (near > enter) {
        enter = near;
        enterAxis = i;
        enterSign = d[i] > 0 ? -1 : 1;
      }
      if (far < exit) {
        exit = far;
        exitAxis = i;
        exitSign = d[i] > 0 ? 1 : -1;
      }
      if (enter > exit + EPS) return;
    }
    if (exit < -EPS || enter > (best?.distance ?? max) + EPS) return;
    if (rock) {
      // registerRock's authored winding points inward for both rings and top.
      for (const [a, c, e] of rockTriangles(b)) triangle(a, c, e, surface, -1);
      return;
    }
    const inside = enter < -EPS;
    const n = [0, 0, 0];
    n[inside ? exitAxis : enterAxis] = inside ? exitSign : enterSign;
    hit(inside ? exit : enter, { x: n[0], y: n[1], z: n[2] }, surface);
  };
  blocks.forEach((b, i) =>
    box(b, b.terrainBase ?? 0, b.h, `block:${i}`, isRock(b)),
  );
  terrainProps(blocks).forEach((b, i) =>
    box(b, b.base, b.base + b.h, `prop:${i}`, isRock(b)),
  );

  // Traverse only the metre cells crossed by this short ray, not an entire map
  // or its bounding rectangle. The diagonal matches groundHeight exactly.
  let x = Math.floor(o[0]),
    z = Math.floor(o[2]);
  const sx = Math.sign(d[0]),
    sz = Math.sign(d[2]);
  let tx = sx ? (x + (sx > 0 ? 1 : 0) - o[0]) / d[0] : Infinity;
  let tz = sz ? (z + (sz > 0 ? 1 : 0) - o[2]) / d[2] : Infinity;
  const dx = sx ? Math.abs(1 / d[0]) : Infinity,
    dz = sz ? Math.abs(1 / d[2]) : Infinity;
  let t = 0;
  while (t <= (best?.distance ?? max) + EPS) {
    const a: Point = [x, groundHeight(x, z, blocks), z];
    const b: Point = [x + 1, groundHeight(x + 1, z, blocks), z];
    const c: Point = [x, groundHeight(x, z + 1, blocks), z + 1];
    const e: Point = [x + 1, groundHeight(x + 1, z + 1, blocks), z + 1];
    triangle(a, c, b, "ground");
    triangle(e, b, c, "ground");
    t = Math.min(tx, tz);
    if (!Number.isFinite(t)) break;
    if (tx <= t + EPS) {
      x += sx;
      tx += dx;
    }
    if (tz <= t + EPS) {
      z += sz;
      tz += dz;
    }
  }
  return best;
}

/** The shared cave is a union of rounded tunnels/chambers, not block geometry.
 * This field has the exact caveClearance/caveCeiling zero set and a Lipschitz
 * bound of one. Its magnitude is a conservative distance from either side,
 * so tracing it cannot jump across a thin passage or the arched ceiling.
 */
function caveSurfaceRay(
  o: number[],
  d: number[],
  max: number,
): SurfaceHit | undefined {
  const field = (x: number, y: number, z: number) => {
    const clearance = caveClearance(x, z);
    const arch =
      CAVE_RADIUS -
      Math.hypot(
        Math.max(0, CAVE_RADIUS - clearance),
        Math.max(0, (y - 2) / 1.25),
      );
    return Math.min(clearance, y, arch);
  };
  const tolerance = 1e-5;
  let t = 0;
  for (let i = 0; i < 512; i++) {
    const x = o[0] + d[0] * t,
      y = o[1] + d[1] * t,
      z = o[2] + d[2] * t;
    const distance = field(x, y, z);
    if (Math.abs(distance) <= tolerance) {
      // Gradient points toward traversable air, including an exit from stone.
      const e = 1e-4;
      const nx = field(x + e, y, z) - field(x - e, y, z);
      const ny = field(x, y + e, z) - field(x, y - e, z);
      const nz = field(x, y, z + e) - field(x, y, z - e);
      const length = Math.hypot(nx, ny, nz);
      if (length < EPS) return undefined;
      return {
        point: { x, y, z },
        normal: { x: nx / length, y: ny / length, z: nz / length },
        distance: t,
        surface: "cave",
      };
    }
    if (t >= max) break;
    t = Math.min(max, t + Math.abs(distance) * 0.9);
  }
  return undefined;
}
