import { eye, wallDistance, type Enemy } from "../shared/game";
import type { Block } from "../shared/defs";
import { groundHeight } from "../shared/terrain";

export type WarningPoint = { x: number; y: number; z: number };

/** The enemy round integrator, including the three VOLLEY directions and travel past its aim point. */
export function projectileWarningPaths(
  e: Enemy,
  blocks: Block[],
): WarningPoint[][] {
  if (e.kind !== "ant" && e.kind !== "spitter" && e.kind !== "hornet")
    return [];
  const distance = Math.hypot(e.tx - e.x, e.tz - e.z);
  const aim = Math.atan2(e.tx - e.x, e.tz - e.z);
  const sourceY = eye(e);
  const targetY = (e.ty ?? groundHeight(e.tx, e.tz, blocks)) + 1.2;
  const flight = Math.max(0.3, distance / 13);
  const paths: WarningPoint[][] = [];
  for (const spread of e.kind === "ant" ? [-0.16, 0, 0.16] : [0]) {
    const angle = aim + spread;
    const speed = e.kind === "hornet" ? 19 : 13;
    const length = Math.max(1e-8, Math.hypot(distance, targetY - sourceY));
    const gravity = e.kind === "ant" ? 12 : 0;
    const velocity = {
      x:
        e.kind === "hornet"
          ? ((e.tx - e.x) / length) * speed
          : Math.sin(angle) * speed,
      y:
        e.kind === "hornet"
          ? ((targetY - sourceY) / length) * speed
          : gravity
            ? (targetY - sourceY) / flight + 0.5 * gravity * flight
            : ((targetY - sourceY) / Math.max(1, distance)) * speed,
      z:
        e.kind === "hornet"
          ? ((e.tz - e.z) / length) * speed
          : Math.cos(angle) * speed,
    };
    let point = { x: e.x, y: sourceY, z: e.z };
    let life = 4;
    const path = [point];
    // Match the authority's 50 ms collision integration. Draw every second
    // point, plus the impact or lifetime endpoint, within 41 segments per lane.
    for (let step = 0; step < 81 && life > 0; step++) {
      const dt = 0.05;
      const dx = velocity.x * dt;
      const dy = velocity.y * dt - 0.5 * gravity * dt * dt;
      const dz = velocity.z * dt;
      const segment = Math.hypot(dx, dy, dz);
      const wall = wallDistance(
        point.x,
        point.y,
        point.z,
        dx / segment,
        dy / segment,
        dz / segment,
        segment,
        blocks,
      );
      const portion = Math.min(1, wall / segment);
      point = {
        x: point.x + dx * portion,
        y: point.y + dy * portion,
        z: point.z + dz * portion,
      };
      life -= dt;
      const floor = groundHeight(point.x, point.z, blocks);
      if (point.y <= floor) point.y = floor;
      const hit = wall < segment || point.y <= floor || life <= 0;
      if (hit || step % 2 === 1) path.push(point);
      if (hit) break;
      velocity.y -= gravity * dt;
    }
    paths.push(path);
  }
  return paths;
}
