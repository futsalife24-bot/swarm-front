import { clusterMember } from "./structure-ai";
import type { Enemy, World } from "./game";
import { blocked, eye } from "./game";
import { CAVE_BLOCKS, CAVE_NODES, caveWaypoint, caveCeiling } from "./cave";
import { ENEMIES } from "./defs";
import { mapFor } from "./stages";

export interface WormNode {
  x: number;
  y: number;
  z: number;
  partHp?: number;
  route?: number;
  heading?: number;
  acidAt?: number;
  pulseAim?: { x: number; z: number };
}
export const wormNodes = (e: Enemy): WormNode[] => [e, ...(e.segments ?? [])];
export function initWorm(e: Enemy) {
  if (!e.segments) return;
  for (const node of wormNodes(e)) node.partHp ??= e.maxHp / 8;
}
export const wormSpeed = (e: Enemy) =>
  ENEMIES.boss.speed * 3 * (e.fractured ? 2 : 1);

// Broken nodes stay in their original slots: every gap defines a new moving chain.
// This preserves one boss reward/wave entry, even after seven separate cuts.
export function moveWorm(w: World, e: Enemy, dt: number) {
  initWorm(e);
  const nodes = wormNodes(e),
    blocks = mapFor(w).blocks;
  const cave = blocks === CAVE_BLOCKS;
  const route = cave
    ? CAVE_NODES.slice(1, 9)
    : Array.from({ length: 8 }, (_, i) => ({
        x: Math.sin((i * Math.PI) / 4) * 39,
        z: Math.cos((i * Math.PI) / 4) * 39,
      }));
  let leader: WormNode | undefined;
  for (const [i, node] of nodes.entries()) {
    if ((node.partHp ?? 0) <= 0) {
      leader = undefined;
      continue;
    }
    const radius = i === 0 ? 4 : 2.2;
    if (!leader) {
      const direction = (e.id + i) % 2 ? 1 : -1;
      if (node.route === undefined) {
        const nearest = route.reduce(
          (best, p, j) =>
            Math.hypot(p.x - node.x, p.z - node.z) <
            Math.hypot(route[best].x - node.x, route[best].z - node.z)
              ? j
              : best,
          0,
        );
        node.route = (nearest + direction + route.length) % route.length;
      }
      if (
        Math.hypot(route[node.route].x - node.x, route[node.route].z - node.z) <
        3
      )
        node.route = (node.route + direction + route.length) % route.length;
      const goal = route[node.route];
      const target = cave ? caveWaypoint(node, goal, radius) : goal;
      const desired = Math.atan2(target.x - node.x, target.z - node.z);
      node.heading ??= desired;
      const turn = Math.atan2(
        Math.sin(desired - node.heading),
        Math.cos(desired - node.heading),
      );
      node.heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, turn));
      // Cave navigation follows the corridor centre; outdoor flight makes wide turns.
      if (cave) node.heading = desired;
      const x = node.x + Math.sin(node.heading) * wormSpeed(e) * dt;
      const z = node.z + Math.cos(node.heading) * wormSpeed(e) * dt;
      let height = 3 + 3 * Math.sin(w.time * 0.24 + e.id + i);
      if (cave)
        height = Math.min(
          height,
          caveCeiling(x, z) - radius - (i === 0 ? 3 : 2) - 0.2,
        );
      else {
        // Ascend before entering a roof, including the head's full hit volume.
        for (const b of blocks)
          if (
            Math.abs(x - b.x) < b.w / 2 + radius + 7 &&
            Math.abs(z - b.z) < b.d / 2 + radius + 7
          )
            height = Math.max(height, b.h + 1);
      }
      node.y += Math.max(
        -5 * dt,
        Math.min(5 * dt, Math.max(0, height) - node.y),
      );
      if (!blocked(x, z, radius, node.y, blocks)) {
        node.x = x;
        node.z = z;
      }
    } else {
      const distance = Math.hypot(
        leader.x - node.x,
        leader.y - node.y,
        leader.z - node.z,
      );
      if (distance > 3.2) {
        const target = cave
          ? { ...caveWaypoint(node, leader, radius), y: leader.y }
          : leader;
        const length = Math.max(
          0.001,
          Math.hypot(target.x - node.x, target.y - node.y, target.z - node.z),
        );
        const amount = Math.min(
          distance - 3.2,
          wormSpeed(e) * 1.5 * dt,
          length,
        );
        const x = node.x + ((target.x - node.x) / length) * amount;
        const z = node.z + ((target.z - node.z) / length) * amount;
        let y = node.y + ((target.y - node.y) / length) * amount;
        if (cave)
          y = Math.max(0, Math.min(y, caveCeiling(x, z) - radius - 2 - 0.2));
        if (!cave)
          for (const b of blocks)
            if (
              Math.abs(x - b.x) < b.w / 2 + radius &&
              Math.abs(z - b.z) < b.d / 2 + radius
            )
              y = Math.max(y, b.h + 0.1);
        if (!blocked(x, z, radius, y, blocks)) {
          node.x = x;
          node.y = y;
          node.z = z;
        }
      }
      node.heading = Math.atan2(leader.x - node.x, leader.z - node.z);
    }
    leader = node;
    node.acidAt ??= w.time + 0.8 + i * 0.23;
    if (w.time >= node.acidAt - 0.8 && !node.pulseAim)
      node.pulseAim = clusterMember(w.players);
    if (w.time < node.acidAt) continue;
    const target = node.pulseAim;
    node.pulseAim = undefined;
    node.acidAt = w.time + 3.2;
    if (!target || w.projectiles.length >= 100) continue;
    const height = i === 0 ? eye(e) : node.y + 2;
    const flight = Math.max(
      0.35,
      Math.hypot(target.x - node.x, target.z - node.z) / 19,
    );
    w.projectiles.push({
      id: ++w.serial,
      x: node.x,
      y: height,
      z: node.z,
      dx: (target.x - node.x) / flight,
      dz: (target.z - node.z) / flight,
      dy: (1.2 - height) / flight + 3 * flight,
      gravity: 6,
      life: flight + 1,
      owner: "enemy",
      damage: 10,
      rocket: false,
    });
  }
}
