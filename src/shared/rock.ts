import type { Block } from "./map-blocks";

type Point = [number, number, number];
type Triangle = [Point, Point, Point];
const surfaces = new WeakMap<Block, Triangle[]>();

/** Same rings and diagonals as assets/blender/scripts/build_maps_v1.py:rock.
 * Cache world-space vertices after terrain registration, exactly as liftMap does. */
export function registerRock(
  b: Block,
  ground: (x: number, z: number) => number,
) {
  const ring = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
  ];
  const vertices: Point[] = [];
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 8; i++) {
      const f = j / 5;
      const scale =
        j === 0
          ? 1
          : (1 - f * 0.65) * (1 + 0.1 * Math.sin(i * 4 + j * 2 + b.x));
      const x = b.x + ((ring[i][0] * b.w) / 2) * scale;
      const z = b.z + ((ring[i][1] * b.d) / 2) * scale;
      vertices.push([x, (b.h - (b.terrainBase ?? 0)) * f + ground(x, z), z]);
    }
  const triangles: Triangle[] = [];
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 8; i++) {
      const a = vertices[j * 8 + i],
        c = vertices[(j + 1) * 8 + ((i + 1) % 8)];
      triangles.push(
        [a, vertices[j * 8 + ((i + 1) % 8)], c],
        [a, c, vertices[(j + 1) * 8 + i]],
      );
    }
  // The irregular top ring can be concave. A fan from its first vertex spills
  // outside the polygon, creating invisible ledges and blocking clear shots.
  const top = vertices.slice(40);
  while (top.length > 3) {
    const ear = top.findIndex((b, i) => {
      const a = top[(i + top.length - 1) % top.length];
      const c = top[(i + 1) % top.length];
      const cross =
        (b[0] - a[0]) * (c[2] - b[2]) - (b[2] - a[2]) * (c[0] - b[0]);
      return (
        cross > 1e-10 &&
        !top.some(
          (p) =>
            p !== a &&
            p !== b &&
            p !== c &&
            heightOnTriangle(p[0], p[2], [a, b, c]) !== undefined,
        )
      );
    });
    if (ear < 0) throw new Error("Invalid authored rock top polygon");
    triangles.push([
      top[(ear + top.length - 1) % top.length],
      top[ear],
      top[(ear + 1) % top.length],
    ]);
    top.splice(ear, 1);
  }
  triangles.push(top as Triangle);
  surfaces.set(b, triangles);
}

export const isRock = (b: Block) => surfaces.has(b);
export const rockTriangles = (b: Block) => surfaces.get(b) ?? [];

function heightOnTriangle(x: number, z: number, [a, b, c]: Triangle) {
  const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(det) < 1e-10) return undefined;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
  return u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8
    ? u * a[1] + v * b[1] + (1 - u - v) * c[1]
    : undefined;
}

export function rockHeight(b: Block, x: number, z: number) {
  if (Math.abs(x - b.x) > b.w / 2 || Math.abs(z - b.z) > b.d / 2)
    return -Infinity;
  let height = -Infinity;
  for (const triangle of rockTriangles(b))
    height = Math.max(height, heightOnTriangle(x, z, triangle) ?? -Infinity);
  return height;
}

export function rockRay(
  b: Block,
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
) {
  // Broad phase keeps rays far from a rock out of the triangle loop.
  let lo = 0,
    hi = max;
  for (const [origin, direction, min, end] of [
    [x, dx, b.x - b.w / 2, b.x + b.w / 2],
    [z, dz, b.z - b.d / 2, b.z + b.d / 2],
  ]) {
    if (Math.abs(direction) < 1e-10) {
      if (origin < min || origin > end) return max;
    } else {
      const a = (min - origin) / direction,
        c = (end - origin) / direction;
      lo = Math.max(lo, Math.min(a, c));
      hi = Math.min(hi, Math.max(a, c));
      if (lo > hi) return max;
    }
  }
  if (y < rockHeight(b, x, z) && y >= (b.terrainBase ?? 0)) return 0;
  let best = max;
  for (const triangle of rockTriangles(b)) {
    const [a, c, d] = triangle;
    const ux = c[0] - a[0],
      uy = c[1] - a[1],
      uz = c[2] - a[2];
    const vx = d[0] - a[0],
      vy = d[1] - a[1],
      vz = d[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const denom = nx * dx + ny * dy + nz * dz;
    if (Math.abs(denom) < 1e-10) continue;
    const t = (nx * (a[0] - x) + ny * (a[1] - y) + nz * (a[2] - z)) / denom;
    if (
      t >= 0 &&
      t < best &&
      heightOnTriangle(x + dx * t, z + dz * t, triangle) !== undefined
    )
      best = t;
  }
  return best;
}
