import { MOVE_SPEED } from "../src/shared/defs";
import { CAVE_BLOCKS, caveWaypoint } from "../src/shared/cave";
import { mapFor } from "../src/shared/stages";
import { foundryPath } from "../src/shared/foundry-navigation";
import {
  neutral,
  visible,
  eye,
  enemyBodies,
  move,
  type World,
  type Input,
} from "../src/shared/game";
// Test pilot only: sends ordinary movement and aim inputs; never modifies HP, timing or rewards.
const searchWaypoints = new WeakMap<
  World,
  { x: number; z: number; until: number }
>();
export function pilot(w: World, id: string): Input {
  const p = w.players.find((p) => p.id === id)!;
  const i = neutral();
  i.seq = Math.round(w.time * 20) + 1;
  const targets = w.enemies
    .flatMap((e) =>
      e.segments
        ? enemyBodies(e).map((b) => ({ ...e, x: b.x, z: b.z, y: b.y - 1.2, aimY: b.y }))
        : [{ ...e, aimY: eye(e) }],
    )
    .filter((e) => e.hp > 0);
  const enemies = targets
    .filter(
      (e) =>
        Math.hypot(e.x - p.x, e.z - p.z) < 60 &&
        visible(p, e, mapFor(w).blocks),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    );
  const e = enemies[0];
  if (!e) {
    if (mapFor(w).blocks === CAVE_BLOCKS) {
      const target = [...targets].sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
      if (target) {
        let next = searchWaypoints.get(w);
        if (
          !next ||
          w.time >= next.until ||
          Math.hypot(next.x - p.x, next.z - p.z) < 1
        ) {
          next = { ...caveWaypoint(p, target), until: w.time + 3 };
          searchWaypoints.set(w, next);
        }
        i.yaw = Math.atan2(next.x - p.x, -(next.z - p.z));
        // Follow a corridor corner using only legal inputs when the shortest
        // waypoint direction meets the wall at the player's current margin.
        const options = [
          0,
          -0.4,
          0.4,
          -0.8,
          0.8,
          -1.2,
          1.2,
          -1.8,
          1.8,
          Math.PI,
        ].map((turn) => {
          const yaw = i.yaw + turn,
            trial = { x: p.x, z: p.z, y: p.y };
          move(
            trial,
            Math.sin(yaw) * MOVE_SPEED.walk * 0.05,
            -Math.cos(yaw) * MOVE_SPEED.walk * 0.05,
            0.55,
            mapFor(w).blocks,
          );
          return {
            yaw,
            distance:
              Math.hypot(trial.x - next.x, trial.z - next.z) +
              (Math.hypot(trial.x - p.x, trial.z - p.z) < 0.1 ? 100 : 0),
          };
        });
        i.yaw = options.sort((a, b) => a.distance - b.distance)[0].yaw;
        i.mz = 1;
      }
      return i;
    }
    // Outdoor enemies can remain beyond the firing radius or behind cover.
    // Walk toward a live body along clear ground instead of indefinitely
    // oscillating down the central boulevard. The wider enemy navigation
    // clearance is conservative for the player; only ordinary inputs are sent.
    const target = [...targets].sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
    if (target) {
      let next = searchWaypoints.get(w);
      if (
        !next ||
        w.time >= next.until ||
        Math.hypot(next.x - p.x, next.z - p.z) < 0.5
      ) {
        const waypoint = foundryPath(mapFor(w), p, target)[0];
        next = waypoint ? { ...waypoint, until: w.time + 0.5 } : undefined;
        if (next) searchWaypoints.set(w, next);
        else searchWaypoints.delete(w);
      }
      if (next) {
        i.yaw = Math.atan2(next.x - p.x, -(next.z - p.z));
        i.mz = 1;
        return i;
      }
    }
    // While waiting for the next spawn, keep searching the clear boulevard.
    i.yaw = 0;
    i.mx = Math.max(-1, Math.min(1, -p.x));
    i.mz = p.z > 80 ? 1 : p.z < -80 ? -1 : Math.sin(w.time * 0.1) > 0 ? 1 : -1;
    return i;
  }
  searchWaypoints.delete(w);
  const d = Math.hypot(e.x - p.x, e.z - p.z);
  i.yaw = Math.atan2(e.x - p.x, -(e.z - p.z));
  i.pitch = Math.atan2(e.aimY - ((p.y ?? 0) + 1.5), d);
  i.fire = true;
  let vx = Math.cos(w.time * 0.7) * 4,
    vz = Math.sin(w.time * 0.7) * 2;
  let imminent = false;
  for (const q of w.projectiles.filter((q) => q.owner === "enemy")) {
    const speed2 = q.dx * q.dx + q.dz * q.dz;
    if (!speed2) continue;
    const when = ((p.x - q.x) * q.dx + (p.z - q.z) * q.dz) / speed2;
    if (
      when > 0 &&
      when < 0.6 &&
      Math.abs(q.y + q.dy * when - 0.5 * (q.gravity ?? 0) * when * when - ((p.y ?? 0) + 1.2)) <
        1.5 &&
      Math.hypot(q.x + q.dx * when - p.x, q.z + q.dz * when - p.z) < 2
    ) {
      const side = (p.x - q.x) * q.dz - (p.z - q.z) * q.dx >= 0 ? 1 : -1;
      vx += q.dz * side;
      vz -= q.dx * side;
      imminent ||= when < 0.25;
    }
  }
  for (const a of w.enemies) {
    const dist = Math.max(1, Math.hypot(a.x - p.x, a.z - p.z));
    if (dist < 14) {
      vx += ((p.x - a.x) / dist) * (14 - dist);
      vz += ((p.z - a.z) / dist) * (14 - dist);
    }
  }
  const threateningBosses = w.enemies.filter(
    (a) =>
      a.kind === "boss" &&
      a.hp > 0 &&
      a.wind > 0 &&
      Math.hypot(p.x - a.tx, p.z - a.tz) < 10,
  );
  for (const a of threateningBosses) {
    // React to every visible blast telegraph, including bosses behind the aim target.
    vx += p.x <= a.tx ? -18 : 18;
    vz += p.z <= a.tz ? -10 : 10;
  }
  // Keep the pilot in the clear central boulevard and away from the boundary.
  if (mapFor(w).blocks !== CAVE_BLOCKS)
    vx += p.x > 7 ? (7 - p.x) * 7 : p.x < -7 ? (-7 - p.x) * 7 : 0;
  vz += p.z > 92 ? (92 - p.z) * 7 : p.z < -92 ? (-92 - p.z) * 7 : 0;
  if (d > 25) {
    vx += (e.x - p.x) * 0.4;
    vz += (e.z - p.z) * 0.4;
  }
  const norm = Math.max(1, Math.hypot(vx, vz));
  vx /= norm;
  vz /= norm;
  // A valid evade into a cave wall still leaves the pilot inside the next
  // laser's path. Predict only legal movement on copies and steer around cover
  // when the intended combat direction cannot make progress.
  const speed =
    p.evade > 0 || (imminent && p.evadeCd <= 0.05)
      ? MOVE_SPEED.dodge
      : MOVE_SPEED.walk;
  const trialMove = (turn: number) => {
    const dx = vx * Math.cos(turn) - vz * Math.sin(turn),
      dz = vx * Math.sin(turn) + vz * Math.cos(turn),
      trial = { x: p.x, z: p.z, y: p.y };
    for (let n = 0; n < 5; n++)
      move(trial, dx * speed * 0.05, dz * speed * 0.05, 0.55, mapFor(w).blocks);
    const x = trial.x - p.x,
      z = trial.z - p.z,
      distance = Math.hypot(x, z);
    return {
      dx,
      dz,
      distance,
      score: x * vx + z * vz + distance * 0.2 - Math.abs(turn) * 0.025,
    };
  };
  const forward = trialMove(0);
  if (forward.distance < speed * 0.25 * 0.75) {
    const best = [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2, -1.6, 1.6, Math.PI]
      .map(trialMove)
      .sort((a, b) => b.score - a.score)[0];
    vx = best.dx;
    vz = best.dz;
  }
  i.mx = Math.max(-1, Math.min(1, vx * Math.cos(i.yaw) + vz * Math.sin(i.yaw)));
  i.mz = Math.max(-1, Math.min(1, vx * Math.sin(i.yaw) - vz * Math.cos(i.yaw)));
  // Dodge close to impact; dodging at 0.6 seconds expires before the projectile arrives.
  i.dodge =
    imminent ||
    threateningBosses.some((a) => a.wind < 0.25) ||
    w.enemies.some(
      (a) =>
        a.hp > 0 &&
        a.wind > 0 &&
        a.wind < 0.25 &&
        Math.hypot(a.x - p.x, a.z - p.z) < 3,
    );
  i.revive = true;
  return i;
}
