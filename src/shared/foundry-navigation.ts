import { terrainProps, groundHeight } from "./terrain";
import { ARENA_X, ARENA_Z } from "./arena";
import { CAVE_EDGES, CAVE_NODES, caveLine, caveWaypoint } from "./cave";
import { blocked } from "./game";
import type { ArenaMap } from "./stages";

export type FoundryPoint = { x: number; z: number };
// The head's existing radius is 4m. This clearance also keeps the connectors
// between 3.2m-spaced body units away from the inside of a building corner.
export const FOUNDRY_NAV_RADIUS = 4.2;
const MARGIN = 0.15;
type Graph = {
  points: FoundryPoint[];
  links: { to: number; cost: number }[][];
};
const graphs = new WeakMap<ArenaMap, Graph>();
export const foundryDistance = (a: FoundryPoint, b: FoundryPoint) =>
  Math.hypot(a.x - b.x, a.z - b.z);

export function foundryGroundClear(map: ArenaMap, p: FoundryPoint) {
  return !blocked(p.x, p.z, FOUNDRY_NAV_RADIUS, groundHeight(p.x,p.z,map.blocks), map.blocks);
}

export function foundryGroundLine(
  map: ArenaMap,
  a: FoundryPoint,
  b: FoundryPoint,
) {
  if (!foundryGroundClear(map, a) || !foundryGroundClear(map, b)) return false;
  if (map.biome === "cave") return caveLine(a, b, FOUNDRY_NAV_RADIUS);
  for (const block of [...map.blocks,...terrainProps(map.blocks)]) {
    if (block.h <= 0) continue;
    let lo = 0,
      hi = 1;
    for (const [start, delta, min, max] of [
      [
        a.x,
        b.x - a.x,
        block.x - block.w / 2 - FOUNDRY_NAV_RADIUS,
        block.x + block.w / 2 + FOUNDRY_NAV_RADIUS,
      ],
      [
        a.z,
        b.z - a.z,
        block.z - block.d / 2 - FOUNDRY_NAV_RADIUS,
        block.z + block.d / 2 + FOUNDRY_NAV_RADIUS,
      ],
    ]) {
      if (Math.abs(delta) < 1e-10) {
        if (start <= min || start >= max) {
          hi = -1;
          break;
        }
      } else {
        const first = (min - start) / delta,
          last = (max - start) / delta;
        lo = Math.max(lo, Math.min(first, last));
        hi = Math.min(hi, Math.max(first, last));
      }
    }
    if (lo < hi && hi > 0 && lo < 1) return false;
  }
  return true;
}

function graphFor(map: ArenaMap): Graph {
  const cached = graphs.get(map);
  if (cached) return cached;
  const points: FoundryPoint[] = [];
  const r = FOUNDRY_NAV_RADIUS + MARGIN;
  for (const block of [...map.blocks,...terrainProps(map.blocks)])
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = {
          x: block.x + sx * (block.w / 2 + r),
          z: block.z + sz * (block.d / 2 + r),
        };
        if (foundryGroundClear(map, p)) points.push(p);
      }
  for (const x of [-ARENA_X + r, 0, ARENA_X - r])
    for (const z of [-ARENA_Z + r, 0, ARENA_Z - r]) {
      const p = { x, z };
      if (foundryGroundClear(map, p)) points.push(p);
    }
  const links: Graph["links"] = points.map(() => []);
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      if (foundryGroundLine(map, points[a], points[b])) {
        const cost = foundryDistance(points[a], points[b]);
        links[a].push({ to: b, cost });
        links[b].push({ to: a, cost });
      }
  const graph = { points, links };
  graphs.set(map, graph);
  return graph;
}

/** Closest deterministic legal point, including targets beside narrow cover. */
export function foundrySafePoint(
  map: ArenaMap,
  point: FoundryPoint,
): FoundryPoint {
  if (foundryGroundClear(map, point)) return { x: point.x, z: point.z };
  const candidates: FoundryPoint[] = [];
  if (map.biome === "cave") {
    for (const [ai, bi] of CAVE_EDGES) {
      const a = CAVE_NODES[ai],
        b = CAVE_NODES[bi];
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz),
        ),
      );
      candidates.push({ x: a.x + dx * t, z: a.z + dz * t });
    }
  } else {
    const r = FOUNDRY_NAV_RADIUS + MARGIN;
    const x = Math.max(-ARENA_X + r, Math.min(ARENA_X - r, point.x));
    const z = Math.max(-ARENA_Z + r, Math.min(ARENA_Z - r, point.z));
    candidates.push({ x, z }, ...graphFor(map).points);
    for (const block of [...map.blocks,...terrainProps(map.blocks)])
      for (const side of [-1, 1]) {
        candidates.push({ x: block.x + side * (block.w / 2 + r), z });
        candidates.push({ x, z: block.z + side * (block.d / 2 + r) });
      }
  }
  let result: FoundryPoint | undefined,
    distance = Infinity;
  for (const p of candidates)
    if (foundryGroundClear(map, p)) {
      const d = foundryDistance(point, p);
      if (d < distance) {
        result = p;
        distance = d;
      }
    }
  if (!result) throw new Error("FOUNDRY ZERO map has no safe ground spawn");
  return { x: result.x, z: result.z };
}

/** One navigation family: outdoor visibility graph; existing cave graph helper. */
export function foundryPath(
  map: ArenaMap,
  start: FoundryPoint,
  target: FoundryPoint,
): FoundryPoint[] {
  const goal = foundrySafePoint(map, target);
  if (foundryDistance(start, goal) < 1e-6) return [];
  if (foundryGroundLine(map, start, goal)) return [goal];
  if (map.biome === "cave") {
    const path: FoundryPoint[] = [];
    let cursor = start;
    for (let count = 0; count < 32; count++) {
      const next = caveWaypoint(cursor, goal, FOUNDRY_NAV_RADIUS);
      if (
        foundryDistance(cursor, next) < 0.01 ||
        !foundryGroundLine(map, cursor, next)
      )
        return [];
      path.push({ x: next.x, z: next.z });
      cursor = next;
      if (foundryDistance(cursor, goal) < 0.01) return path;
    }
    return [];
  }
  const graph = graphFor(map),
    n = graph.points.length;
  const distances = graph.points.map((p) =>
    foundryGroundLine(map, start, p) ? foundryDistance(start, p) : Infinity,
  );
  const previous = Array<number>(n).fill(-1),
    visited = Array<boolean>(n).fill(false);
  let best = Infinity,
    last = -1;
  for (let step = 0; step < n; step++) {
    let current = -1;
    for (let i = 0; i < n; i++)
      if (!visited[i] && (current < 0 || distances[i] < distances[current]))
        current = i;
    if (
      current < 0 ||
      !Number.isFinite(distances[current]) ||
      distances[current] >= best
    )
      break;
    visited[current] = true;
    const point = graph.points[current];
    if (foundryGroundLine(map, point, goal)) {
      const cost = distances[current] + foundryDistance(point, goal);
      if (cost < best) {
        best = cost;
        last = current;
      }
    }
    for (const edge of graph.links[current])
      if (distances[current] + edge.cost < distances[edge.to]) {
        distances[edge.to] = distances[current] + edge.cost;
        previous[edge.to] = current;
      }
  }
  if (last < 0) return [];
  const result: FoundryPoint[] = [goal];
  for (let at = last; at >= 0; at = previous[at])
    result.push({ ...graph.points[at] });
  return result.reverse();
}

export function foundryPatrol(map: ArenaMap): FoundryPoint[] {
  if (map.biome === "cave")
    return CAVE_NODES.slice(1, 9).map((p) => ({ ...p }));
  return Array.from({ length: 8 }, (_, i) =>
    foundrySafePoint(map, {
      x: Math.sin((i * Math.PI) / 4) * (ARENA_X - FOUNDRY_NAV_RADIUS - 2),
      z: Math.cos((i * Math.PI) / 4) * (ARENA_Z - FOUNDRY_NAV_RADIUS - 2),
    }),
  );
}
