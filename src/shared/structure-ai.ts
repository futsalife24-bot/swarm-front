import type { Enemy, Player } from "./game";

type Point = { x: number; z: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
// Stable ID ordering is independent of join order and never consumes loot RNG.
export function selectStructureTarget(
  e: Enemy,
  players: Player[],
  visible: (p: Player) => boolean,
) {
  const living = players
    .filter((p) => p.hp > 0 && p.connected)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let pool = living;
  if (e.kind === "spitter") {
    const ranged = living.filter((p) => distance(e, p) >= 16 && visible(p));
    if (ranged.length) pool = ranged;
  }
  const score = (p: Player) =>
    e.kind === "hornet"
      ? living.reduce((sum, other) => sum + distance(p, other), 0) /
        Math.max(1, living.length - 1)
      : e.kind === "spitter" && pool !== living
        ? distance(e, p)
        : -distance(e, p);
  return pool.reduce<Player | undefined>(
    (best, p) => (!best || score(p) > score(best) ? p : best),
    undefined,
  );
}

// For <=4 players, disk intersections plus player centres find the maximum
// covered count, including groups whose optimal centre is between players.
export function clusterPoint(
  players: Player[],
  radius = 7,
  canHit: (p: Player) => boolean = () => true,
): Point | undefined {
  const living = players
    .filter((p) => p.hp > 0 && p.connected && canHit(p))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const points: Point[] = living.map((p) => ({ x: p.x, z: p.z }));
  const r = radius - 0.001;
  for (let i = 0; i < living.length; i++)
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i],
        b = living[j],
        d = distance(a, b);
      if (!d || d > 2 * r) continue;
      const h = Math.sqrt(Math.max(0, r * r - (d * d) / 4));
      for (const s of [-1, 1])
        points.push({
          x: (a.x + b.x) / 2 + ((s * (a.z - b.z)) / d) * h,
          z: (a.z + b.z) / 2 + ((s * (b.x - a.x)) / d) * h,
        });
    }
  const count = (p: Point) =>
    living.filter((a) => distance(a, p) < radius).length;
  return points.reduce<Point | undefined>(
    (best, p) => (!best || count(p) > count(best) ? p : best),
    undefined,
  );
}

// A single projectile must aim at a member of the cluster, not empty space.
export function clusterMember(players: Player[]): Point | undefined {
  const point = clusterPoint(players);
  if (!point) return;
  const member = players
    .filter((p) => p.hp > 0 && p.connected)
    .sort(
      (a, b) =>
        distance(a, point) - distance(b, point) || a.id.localeCompare(b.id),
    )[0];
  return { x: member.x, z: member.z };
}

export function foundryPhase(e: Enemy): 1 | 2 | 3 {
  return e.hp > (e.maxHp * 2) / 3 ? 1 : e.hp > e.maxHp / 3 ? 2 : 3;
}
