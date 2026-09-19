import { enemySpeedFactor } from "./enemy-size";
import { CAVE_BLOCKS, caveWaypoint } from "./cave";
import type { Enemy, Player, World } from "./game";
import { blocked, roofHeight } from "./game";
import { ENEMIES } from "./defs";
import { mapFor } from "./stages";

// Per-enemy random sequence keeps loot randomness independent from steering.
export function pursuitDirection(w: World, e: Enemy, t: Player) {
  if (mapFor(w).blocks === CAVE_BLOCKS) {
    let nav = e.navigation;
    if (
      !nav ||
      w.time >= nav.until ||
      Math.hypot(e.x - nav.point.x, e.z - nav.point.z) < 1
    ) {
      nav = {
        until: w.time + 0.5,
        point: caveWaypoint(e, t, ENEMIES[e.kind].radius),
      };
      e.navigation = nav;
    }
    const dx = nav.point.x - e.x,
      dz = nav.point.z - e.z,
      d = Math.max(0.001, Math.hypot(dx, dz));
    return { x: dx / d, z: dz / d };
  }
  if (w.time >= (e.steerUntil ?? 0)) {
    const value = (salt: number) => {
      let n =
        Math.imul(e.id + salt, 374761393) ^
        Math.imul(Math.floor(w.time * 20), 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const turn = value(17) * 2 - 1;
    e.steerAngle =
      e.kind === "spider"
        ? Math.sign(turn || 1) * (0.65 + Math.abs(turn) * 0.8)
        : turn * (e.kind === "boss" ? 0.35 : 0.85);
    e.steerUntil = w.time + 0.65 + value(53) * 0.95;
  }
  const dx = t.x - e.x,
    dz = t.z - e.z;
  const distance = Math.hypot(dx, dz);
  // Keep a side for the whole approach rather than rerolling a flank each second.
  // ID/time are authoritative, so this adds no random draws or network state.
  const side = e.id % 2 === 0 ? 1 : -1;
  const phase = w.time * 1.6 + e.id * 2.399963;
  const style = e.id % 3;
  const approach =
    e.kind === "hornet"
      ? (e.steerAngle ?? 0)
      : e.kind === "spider"
        ? side * (1.05 + Math.sin(phase * 0.6) * 0.2)
        : e.kind === "boss"
          ? side * (0.4 + Math.sin(phase * 0.35) * 0.12)
          : style === 0
            ? side * (0.95 + Math.sin(phase * 0.45) * 0.15)
            : style === 1
              ? Math.sin(phase) * 0.85
              : (e.steerAngle ?? 0) * 0.35;
  const angle =
    approach *
    Math.min(
      1,
      Math.max(
        0,
        (distance - (e.kind === "spider" ? 1 : 3)) /
          (e.kind === "spider" ? 4 : e.kind === "hornet" ? 9 : 6),
      ),
    );
  const length = Math.max(0.001, distance);
  return {
    x: (dx * Math.cos(angle) - dz * Math.sin(angle)) / length,
    z: (dx * Math.sin(angle) + dz * Math.cos(angle)) / length,
  };
}

// All timers and body positions belong to the authoritative world snapshot.
export function specialMotion(w: World, e: Enemy, t: Player, dt: number) {
  const blocks = mapFor(w).blocks;
  const def = ENEMIES[e.kind];
  if (e.kind !== "spider") return false;
  e.jumpWait = Math.max(0, (e.jumpWait ?? 0) - dt);
  e.wallCooldown = Math.max(0, (e.wallCooldown ?? 0) - dt);
  if ((e.perch ?? 0) > 0) {
    e.perch = Math.max(0, e.perch! - dt);
    if (e.perch === 0) {
      e.wallCooldown = 7;
      if (e.kind === "spider") {
        e.jump = 0.001;
        e.jumpFrom = e.y;
      }
    }
    return true;
  }
  if (e.kind === "spider" && (e.jump ?? 0) > 0) {
    e.jump! += dt;
    const f = Math.min(1, e.jump! / 0.9);
    const floor = roofHeight(e.x, e.z, def.radius, blocks);
    e.y = Math.max(
      floor,
      (1 - f) * (e.jumpFrom ?? 0) + Math.sin(f * Math.PI) * 3.5,
    );
    const direction = pursuitDirection(w, e, t);
    const x = e.x + direction.x * 10 * enemySpeedFactor(e) * dt,
      z = e.z + direction.z * 10 * enemySpeedFactor(e) * dt;
    if (!blocked(x, z, def.radius, e.y, blocks)) {
      e.x = x;
      e.z = z;
    }
    if (f === 1) {
      e.jump = 0;
      e.jumpWait = 0.65;
      const landing = roofHeight(e.x, e.z, def.radius, blocks);
      e.y = landing;
    }
    return true;
  }
  // Stop just outside a wall; do not place a collider inside the building.
  for (const b of blocks) {
    const x = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, e.x));
    const z = Math.max(b.z - b.d / 2, Math.min(b.z + b.d / 2, e.z));
    const d = Math.hypot(x - e.x, z - e.z);
    if (
      ((Math.abs(e.x - b.x) > b.w / 2 && Math.abs(e.z - b.z) < b.d / 2 - 2.5) ||
        (Math.abs(e.z - b.z) > b.d / 2 &&
          Math.abs(e.x - b.x) < b.w / 2 - 2.5)) &&
      b.h > 5 &&
      d < def.radius + 0.8 &&
      d >= def.radius &&
      (e.jump ?? 0) === 0 &&
      e.wallCooldown === 0
    ) {
      e.y = Math.min(b.h - 2.5, 4);
      e.x = x + ((e.x - x) / d) * (def.radius + 0.01);
      e.z = z + ((e.z - z) / d) * (def.radius + 0.01);
      e.wallYaw = Math.atan2(x - e.x, -(z - e.z));
      e.perch = 1.2;
      return true;
    }
  }
  if (
    e.kind === "spider" &&
    (e.jumpWait ?? 0) === 0 &&
    Math.hypot(t.x - e.x, t.z - e.z) > 1.8
  ) {
    e.jump = 0.001;
    e.jumpFrom = e.y;
    return true;
  }
  if (e.kind === "spider") {
    const floor = roofHeight(e.x, e.z, def.radius, blocks);
    e.y = Math.max(floor, e.y - 9 * enemySpeedFactor(e) * dt);
    return true;
  }
  return false;
}
