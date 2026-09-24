import * as T from "three";
import type { Block } from "../shared/defs";
import { groundHeight, terrainProps, WALK_STEP } from "../shared/terrain";
import { isRock, rockTriangles } from "../shared/rock";

type Point = { x: number; y: number; z: number };
type XY = [number, number];
type Surface = {
  ground?: boolean;
  polygon: XY[];
  a: number;
  b: number;
  c: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
type CachedRing = Point & {
  radius: number;
  blocks?: Block[];
  triangles: number;
  widthFactor: number;
};
const area = (p: XY[]) =>
  p.reduce(
    (sum, v, i) =>
      sum + v[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * v[1],
    0,
  );
function clip(polygon: XY[], a: number, b: number, c: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const from = polygon[i],
      to = polygon[(i + 1) % polygon.length];
    const d = a * from[0] + b * from[1] + c,
      e = a * to[0] + b * to[1] + c;
    if (d >= -1e-9) out.push(from);
    if ((d > 1e-9 && e < -1e-9) || (d < -1e-9 && e > 1e-9)) {
      const t = d / (d - e);
      out.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ]);
    }
  }
  return out;
}
function edges(polygon: XY[]) {
  return polygon.flatMap((v, i) => {
    const n = polygon[(i + 1) % polygon.length],
      length = Math.hypot(n[0] - v[0], n[1] - v[1]);
    return length < 1e-7
      ? []
      : [
          [
            (v[1] - n[1]) / length,
            (n[0] - v[0]) / length,
            (v[0] * n[1] - n[0] * v[1]) / length,
          ] as const,
        ];
  });
}
function intersect(subject: XY[], boundary: XY[]) {
  let p = subject;
  for (const [a, b, c] of edges(boundary)) {
    p = clip(p, a, b, c);
    if (p.length < 3) return [];
  }
  return p;
}
function subtract(subject: XY[], boundary: XY[]) {
  const outside: XY[][] = [];
  let inside = subject;
  for (const [a, b, c] of edges(boundary)) {
    const part = clip(inside, -a, -b, -c);
    if (part.length >= 3 && Math.abs(area(part)) > 1e-9) outside.push(part);
    inside = clip(inside, a, b, c);
    if (inside.length < 3) break;
  }
  return outside;
}
function surface(v: [number, number, number][]): Surface | undefined {
  const [p, q, r] = v;
  const det = (q[0] - p[0]) * (r[2] - p[2]) - (r[0] - p[0]) * (q[2] - p[2]);
  if (Math.abs(det) < 1e-9) return;
  const a =
    ((q[1] - p[1]) * (r[2] - p[2]) - (r[1] - p[1]) * (q[2] - p[2])) / det;
  const b =
    ((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / det;
  const polygon: XY[] = v.map((p) => [p[0], p[2]]);
  if (area(polygon) < 0) polygon.reverse();
  return {
    polygon,
    a,
    b,
    c: p[1] - a * p[0] - b * p[2],
    minX: Math.min(...v.map((p) => p[0])),
    maxX: Math.max(...v.map((p) => p[0])),
    minZ: Math.min(...v.map((p) => p[2])),
    maxZ: Math.max(...v.map((p) => p[2])),
  };
}
const rockCache = new WeakMap<Block[], Surface[]>();
function fixedSurfaces(blocks: Block[], feet: number) {
  let rocks = rockCache.get(blocks);
  if (!rocks) {
    rocks = blocks
      .flatMap((b) => rockTriangles(b).map((t) => surface(t)))
      .filter((s): s is Surface => !!s);
    rockCache.set(blocks, rocks);
  }
  const tops: Surface[] = [];
  for (const b of [...blocks, ...terrainProps(blocks)]) {
    if (isRock(b)) continue;
    const y = b.h + ("base" in b ? Number(b.base) : 0);
    if (y > feet + WALK_STEP + 1e-6) continue;
    const x = b.x - b.w / 2,
      z = b.z - b.d / 2;
    tops.push({
      polygon: [
        [x, z],
        [x + b.w, z],
        [x + b.w, z + b.d],
        [x, z + b.d],
      ],
      a: 0,
      b: 0,
      c: y,
      minX: x,
      maxX: x + b.w,
      minZ: z,
      maxZ: z + b.d,
    });
  }
  return [...rocks, ...tops];
}
/** Rings are clipped onto the actual 1m terrain triangles and authored rock
 * triangles. Their visible upper envelope never bridges a terrain ridge.
 * Fixed slots and compact indices bound GPU storage/draws; unchanged rings reuse it. */
export class TerrainProjectedMarkers extends T.Mesh<
  T.BufferGeometry,
  T.MeshBasicMaterial
> {
  static readonly maxTrianglesPerRing = 4096;
  private readonly verticesPerRing: number;
  private readonly cache: Array<CachedRing | undefined> = [];
  private indexDirty = true;
  constructor(
    material: T.MeshBasicMaterial,
    readonly capacity: number,
    readonly triangleBudget = TerrainProjectedMarkers.maxTrianglesPerRing,
  ) {
    const geometry = new T.BufferGeometry(),
      vertices = capacity * triangleBudget * 3;
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    geometry.setIndex(
      new T.BufferAttribute(new Uint32Array(vertices), 1).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    geometry.setDrawRange(0, 0);
    super(geometry, material);
    this.verticesPerRing = triangleBudget * 3;
    this.count = 0;
    this.frustumCulled = false;
  }
  ringInfo(index: number) {
    return this.cache[index];
  }
  setCount(value: number) {
    const count = Math.min(this.capacity, Math.max(0, value));
    if (count === this.count && !this.indexDirty) return;
    this.count = count;
    const indices = this.geometry.index!;
    let end = 0;
    for (let ring = 0; ring < count; ring++)
      for (let v = 0; v < (this.cache[ring]?.triangles ?? 0) * 3; v++)
        indices.setX(end++, ring * this.verticesPerRing + v);
    this.geometry.setDrawRange(0, end);
    indices.addUpdateRange(0, end);
    indices.needsUpdate = true;
    this.indexDirty = false;
  }
  setRing(index: number, point: Point, radius: number, blocks?: Block[]) {
    if (index >= this.capacity) return;
    const old = this.cache[index];
    if (
      old &&
      old.x === point.x &&
      old.y === point.y &&
      old.z === point.z &&
      old.radius === radius &&
      old.blocks === blocks
    )
      return;
    const positions = this.geometry.getAttribute(
      "position",
    ) as T.BufferAttribute;
    const fixed = blocks ? fixedSurfaces(blocks, point.y) : [];
    let triangles = 0,
      exhausted = false,
      widthFactor = 1;
    const emit = (polygon: XY[], s: Surface) => {
      for (let i = 1; i < polygon.length - 1; i++) {
        const vertices = [polygon[0], polygon[i + 1], polygon[i]];
        if (Math.abs(area(vertices)) < 1e-9) continue;
        if (triangles >= this.triangleBudget) {
          exhausted = true;
          return;
        }
        let offset = index * this.verticesPerRing + triangles++ * 3;
        for (const v of vertices) {
          const x = Math.fround(v[0]),
            z = Math.fround(v[1]);
          positions.setXYZ(offset++, x, s.a * x + s.b * z + s.c + 0.12, z);
        }
      }
    };
    const segments = Math.max(
      48,
      Math.ceil((2 * Math.PI * radius) / 0.8 / 8) * 8,
    );
    do {
      triangles = 0;
      exhausted = false;
      for (let segment = 0; segment < segments && !exhausted; segment++) {
        const angle = (segment / segments) * Math.PI * 2,
          next = (((segment + 1) % segments) / segments) * Math.PI * 2;
        const inner = radius * (1 - 0.055 * widthFactor),
          outer = radius * (1 + 0.055 * widthFactor);
        const polygon: XY[] = [
          [
            point.x + Math.cos(angle) * inner,
            point.z + Math.sin(angle) * inner,
          ],
          [
            point.x + Math.cos(angle) * outer,
            point.z + Math.sin(angle) * outer,
          ],
          [point.x + Math.cos(next) * outer, point.z + Math.sin(next) * outer],
          [point.x + Math.cos(next) * inner, point.z + Math.sin(next) * inner],
        ];
        const minX = Math.min(...polygon.map((p) => p[0])),
          maxX = Math.max(...polygon.map((p) => p[0])),
          minZ = Math.min(...polygon.map((p) => p[1])),
          maxZ = Math.max(...polygon.map((p) => p[1]));
        const candidates = fixed.filter(
          (s) =>
            s.minX <= maxX &&
            s.maxX >= minX &&
            s.minZ <= maxZ &&
            s.maxZ >= minZ,
        );
        if (blocks)
          for (let x = Math.floor(minX); x <= Math.floor(maxX); x++)
            for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
              const a: [number, number, number] = [
                  x,
                  groundHeight(x, z, blocks),
                  z,
                ],
                b: [number, number, number] = [
                  x + 1,
                  groundHeight(x + 1, z, blocks),
                  z,
                ],
                c: [number, number, number] = [
                  x,
                  groundHeight(x, z + 1, blocks),
                  z + 1,
                ],
                d: [number, number, number] = [
                  x + 1,
                  groundHeight(x + 1, z + 1, blocks),
                  z + 1,
                ];
              candidates.push(
                { ...surface([a, b, c])!, ground: true },
                { ...surface([b, d, c])!, ground: true },
              );
            }
        else
          candidates.push({
            polygon,
            a: 0,
            b: 0,
            c: point.y,
            minX,
            maxX,
            minZ,
            maxZ,
          });
        for (const s of candidates) {
          const overlap = intersect(polygon, s.polygon);
          if (overlap.length < 3 || Math.abs(area(overlap)) < 1e-9) continue;
          let pieces = [overlap];
          for (const other of candidates) {
            if (
              other === s ||
              (s.ground && other.ground) ||
              other.maxX < s.minX ||
              other.minX > s.maxX ||
              other.maxZ < s.minZ ||
              other.minZ > s.maxZ
            )
              continue;
            const higher = clip(
              other.polygon,
              other.a - s.a,
              other.b - s.b,
              other.c - s.c - 1e-7,
            );
            if (higher.length < 3) continue;
            pieces = pieces.flatMap((p) => {
              const cut = intersect(p, higher);
              return cut.length >= 3 && Math.abs(area(cut)) > 1e-9
                ? subtract(p, higher)
                : [p];
            });
            if (!pieces.length) break;
          }
          for (const p of pieces) emit(p, s);
          if (exhausted) break;
        }
      }
      // Under an unexpectedly complex map, retain a complete thinner outline,
      // still clipped to every physical face; never leave a partial/flat ring.
      if (exhausted) widthFactor *= 0.5;
    } while (exhausted && widthFactor >= 1 / 64);
    if (exhausted)
      throw new Error("Terrain marker exceeds fixed tessellation capacity");
    this.cache[index] = { ...point, radius, blocks, triangles, widthFactor };
    this.indexDirty = true;
    positions.addUpdateRange(index * this.verticesPerRing * 3, triangles * 9);
    positions.needsUpdate = true;
  }
  dispose() {
    this.geometry.dispose();
  }
}
