import type { Enemy, Player } from "./game";
import { blocked } from "./game";
import type { Block } from "./map-blocks";
import { surfaceRay } from "./surface-ray";
import { enemySize } from "./enemy-size";
import { ENEMIES } from "./defs";
import { CAVE_BLOCKS } from "./cave";
import { groundHeight } from "./terrain";
export const PLEAT_STRIKE = {
  travel: 4,
  radius: 2.5,
  halfWidth: 2.5 * Math.sin(Math.PI / 3),
} as const;
/** Same swept forward sector for the authoritative strike and its warning. */
export function pleatStrike(e: Enemy, blocks: Block[]) {
  const dx = e.tx - e.x,
    dz = e.tz - e.z,
    n = Math.hypot(dx, dz);
  const x = n > 1e-6 ? dx / n : 0,
    z = n > 1e-6 ? dz / n : -1;
  let travel = 0;
  const s = e.pleat;
  // Only replicated pose and shared geometry determine the warning footprint.
  // Private transfer/settling state already gates attack initiation in game.ts.
  if (s && s.up.y > 0.95) {
    travel = PLEAT_STRIKE.travel;
    const radius = ENEMIES.crawler.radius * enemySize(e);
    for (let d = 0; d <= travel; d += 0.25) {
      const px = e.x + x * d,
        pz = e.z + z * d;
      if (blocked(px, pz, radius, e.y + 0.05, blocks)) {
        travel = 0;
        break;
      }
      for (const side of [-1, 0, 1]) {
        const floor = surfaceRay(
          {
            x: px - z * radius * side,
            y: e.y + 0.1,
            z: pz + x * radius * side,
          },
          { x: 0, y: -1, z: 0 },
          0.2,
          blocks,
        );
        if (!floor || floor.normal.y < 0.99) {
          travel = 0;
          break;
        }
      }
      if (!travel) break;
    }
  }
  return { x: e.x, y: e.y, z: e.z, dx: x, dz: z, travel };
}
export function insidePleatStrike(
  a: ReturnType<typeof pleatStrike>,
  p: Pick<Player, "x" | "y" | "z">,
) {
  if (Math.abs((p.y ?? 0) - a.y) >= 2.5) return false;
  const px = p.x - a.x,
    pz = p.z - a.z,
    forward = px * a.dx + pz * a.dz,
    side = Math.abs(px * a.dz - pz * a.dx);
  if (forward < 0 || side > forward * Math.sqrt(3)) return false;
  const nearest = Math.max(0, forward - a.travel);
  return (
    side <= PLEAT_STRIKE.halfWidth &&
    nearest * nearest + side * side < PLEAT_STRIKE.radius ** 2
  );
}
/** Advances on the already warned floor only; never steps over a new obstruction. */
export function advancePleatStrike(e: Enemy, blocks: Block[], dt: number) {
  const s = e.pleat!,
    a = s.strike!;
  a.from = { x: e.x, y: e.y, z: e.z };
  a.travelled = 0;
  const wanted = Math.min(a.remaining, (PLEAT_STRIKE.travel / 0.3) * dt);
  for (let moved = 0; moved < wanted - 1e-8;) {
    const increment = Math.min(0.2, wanted - moved),
      nx = e.x + a.dx * increment,
      nz = e.z + a.dz * increment;
    const floor = surfaceRay(
      { x: nx, y: e.y + 0.1, z: nz },
      { x: 0, y: -1, z: 0 },
      0.2,
      blocks,
    );
    if (
      blocked(
        nx,
        nz,
        ENEMIES.crawler.radius * enemySize(e),
        e.y + 0.05,
        blocks,
      ) ||
      !floor ||
      floor.normal.y < 0.99
    ) {
      a.remaining = 0;
      break;
    }
    e.x = nx;
    e.z = nz;
    s.body.x += a.dx * increment;
    s.body.z += a.dz * increment;
    s.anchor.x += a.dx * increment;
    s.anchor.z += a.dz * increment;
    if (blocks === CAVE_BLOCKS) {
      // The cave floor slopes beneath a strike. Keep the replicated body and
      // support anchor on that floor as the warned path advances.
      const rise = floor.point.y - e.y;
      e.y = floor.point.y;
      s.body.y += rise;
      s.anchor.y = groundHeight(s.anchor.x, s.anchor.z, blocks);
    }
    moved += increment;
    a.travelled += increment;
    a.remaining = Math.max(0, a.remaining - increment);
  }
  s.forward = { x: a.dx, y: 0, z: a.dz };
  s.poseForward = { ...s.forward };
  s.speed = 0;
  if (a.remaining < 1e-6) a.remaining = 0;
  s.velocity = {
    x: dt > 0 ? (a.dx * a.travelled) / dt : 0,
    y: 0,
    z: dt > 0 ? (a.dz * a.travelled) / dt : 0,
  };
}
