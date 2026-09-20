import {
  event,
  hurtPlayer,
  move,
  visible,
  wallDistance,
  type Enemy,
  type Player,
  type Projectile,
  type World,
} from "./game";
import { mapFor } from "./stages";
import { groundHeight } from "./terrain";
import { pursuitDirection } from "./enemy-motion";
import type { Block } from "./map-blocks";

export const CALYX = {
  speed: 0.65,
  slamRange: 4,
  slamWind: 1,
  slamDuration: 2.2,
  shotWind: 1.6,
  shotDuration: 2.8,
  shotCooldown: 12,
  radius: 9,
  growth: 1,
  lifetime: 8,
  tick: 0.5,
  damage: 4,
  gravity: 12,
  maxClouds: 16,
} as const;
export interface PollenCloud {
  id: number;
  x: number;
  y: number;
  z: number;
  born: number;
  damage: number;
}
export interface CalyxAttack {
  kind: "Slam" | "PollenShot";
  started: number;
  fired: boolean;
  yaw: number;
}
export function pollenRadius(c: PollenCloud, time: number) {
  const age = time - c.born;
  return age < 0 || age >= CALYX.lifetime
    ? 0
    : CALYX.radius *
        Math.min(1, age / CALYX.growth, (CALYX.lifetime - age) / 0.5);
}
/** Same geometry predicate for authoritative harm and the visible cloud cells. */
export function pollenContains(
  c: PollenCloud,
  p: { x: number; y?: number; z: number },
  time: number,
  blocks: Block[],
) {
  const radius = pollenRadius(c, time),
    y = (p.y ?? 0) + 0.9;
  if (
    !radius ||
    Math.hypot(p.x - c.x, p.z - c.z) > radius ||
    Math.abs(y - c.y) > 2.5
  )
    return false;
  const dy = y - (c.y + 0.08),
    dx = p.x - c.x,
    dz = p.z - c.z,
    length = Math.hypot(dx, dy, dz);
  return (
    length < 1e-6 ||
    wallDistance(
      c.x,
      c.y + 0.08,
      c.z,
      dx / length,
      dy / length,
      dz / length,
      length,
      blocks,
    ) >=
      length - 0.005
  );
}
export function clearPollen(w: World) {
  w.pollen = [];
  w.projectiles = w.projectiles.filter((q) => q.style !== "pollen");
}
export function stepPollen(w: World, living: Player[], dt: number) {
  if (w.phase !== "battle" || w.waveClearAt !== null) {
    clearPollen(w);
    return;
  }
  const clouds = w.pollen ?? [];
  const targets = calyxTargets(w, living);
  // One common clock: differently-aged overlapping clouds never stack their ticks.
  for (
    let tick = Math.floor((w.time - dt + 1e-8) / CALYX.tick) + 1;
    tick <= Math.floor((w.time + 1e-8) / CALYX.tick);
    tick++
  ) {
    const at = tick * CALYX.tick;
    for (const p of targets) {
      if (p.hp <= 0 || !p.connected) continue;
      let damage = 0;
      for (const c of clouds)
        if (pollenContains(c, p, at, mapFor(w).blocks))
          damage = Math.max(damage, c.damage);
      if (damage) hurtPlayer(w, p, damage);
    }
  }
  w.pollen = clouds.filter((c) => w.time - c.born < CALYX.lifetime);
}
export function advancePollen(w: World, q: Projectile, dt: number) {
  // Substeps follow the parabola, including ceilings, rather than one long chord.
  let remaining = Math.min(dt, Math.max(0, q.life)),
    elapsed = 0;
  while (remaining > 1e-8 && q.life > 0) {
    const h = Math.min(remaining, 1 / 120),
      dx = q.dx * h,
      dz = q.dz * h,
      dy = q.dy * h - 0.5 * CALYX.gravity * h * h;
    const length = Math.hypot(dx, dy, dz),
      wall = wallDistance(
        q.x,
        q.y,
        q.z,
        dx / length,
        dy / length,
        dz / length,
        length,
        mapFor(w).blocks,
      );
    const hit = wall < length - 1e-8;
    const part = hit ? Math.max(0, (wall - 0.025) / length) : 1;
    q.x += dx * part;
    q.y += dy * part;
    q.z += dz * part;
    q.dy -= CALYX.gravity * h;
    elapsed += h * (hit ? wall / length : 1);
    remaining -= h;
    q.life -= h;
    const floor = groundHeight(q.x, q.z, mapFor(w).blocks);
    if (hit || q.y <= floor + 0.03 || q.life <= 1e-8) {
      q.y = Math.max(q.y, floor + 0.03);
      q.life = -1;
      const clouds = (w.pollen ??= []);
      if (clouds.length < CALYX.maxClouds)
        clouds.push({
          id: ++w.serial,
          x: q.x,
          y: q.y,
          z: q.z,
          born: w.time - dt + elapsed,
          damage: q.damage,
        });
    }
  }
}
/** Socket near the forward pollen sac; GLB local -Z is forward. */
export function calyxMuzzle(e: Pick<Enemy, "x" | "y" | "z">, yaw: number) {
  const forward = 0.16 * Math.cos(0.18) - 0.29 * Math.sin(0.18),
    height = 0.9 + 0.16 * Math.sin(0.18) + 0.29 * Math.cos(0.18);
  return {
    x: e.x + Math.sin(yaw) * forward,
    y: e.y + height,
    z: e.z + Math.cos(yaw) * forward,
  };
}
function calyxTargets(w: World, living: Player[]) {
  const armory = w.defense?.armory;
  return armory && !living.includes(armory) ? [...living, armory] : living;
}
export function stepCalyx(
  w: World,
  e: Enemy,
  target: Player,
  living: Player[],
  dt: number,
) {
  const blocks = mapFor(w).blocks,
    attack = e.calyx;
  if (attack) {
    const impact = attack.kind === "Slam" ? CALYX.slamWind : CALYX.shotWind;
    const duration =
      attack.kind === "Slam" ? CALYX.slamDuration : CALYX.shotDuration;
    const age = w.time - attack.started;
    e.wind = Math.max(0, impact - age);
    if (!attack.fired && age + 1e-8 >= impact) {
      attack.fired = true;
      if (attack.kind === "Slam") {
        event(w, {
          type: "calyxSlam",
          x: e.x,
          y: e.y + 0.06,
          z: e.z,
          tx: e.tx,
          tz: e.tz,
          radius: CALYX.slamRange,
        });
        for (const p of calyxTargets(w, living)) {
          const dx = p.x - e.x,
            dz = p.z - e.z,
            d = Math.hypot(dx, dz);
          if (
            p.hp > 0 &&
            p.connected &&
            d <= CALYX.slamRange &&
            Math.abs((p.y ?? 0) - e.y) < 2 &&
            (d < 1e-6 ||
              (dx * Math.sin(attack.yaw) + dz * Math.cos(attack.yaw)) / d >=
                0.5) &&
            visible(e, p, blocks)
          )
            hurtPlayer(w, p, 24);
        }
      } else {
        e.pollenReadyAt = w.time + CALYX.shotCooldown;
        const origin = calyxMuzzle(e, attack.yaw),
          distance = Math.hypot(e.tx - origin.x, e.tz - origin.z);
        const flight = Math.max(1.2, Math.min(1.8, distance / 16)),
          ty = e.ty ?? groundHeight(e.tx, e.tz, blocks);
        if (w.projectiles.length < 100)
          w.projectiles.push({
            id: ++w.serial,
            ...origin,
            dx: (e.tx - origin.x) / flight,
            dz: (e.tz - origin.z) / flight,
            dy: (ty + 0.04 - origin.y) / flight + 0.5 * CALYX.gravity * flight,
            life: flight + 0.2,
            owner: "enemy",
            damage: CALYX.damage,
            rocket: false,
            gravity: CALYX.gravity,
            style: "pollen",
          });
      }
    }
    if (age + 1e-8 >= duration) {
      e.calyx = undefined;
      e.wind = 0;
      e.cool = 0.5;
    }
    return;
  }
  e.cool = Math.max(0, e.cool - dt);
  const distance = Math.hypot(target.x - e.x, target.z - e.z),
    clear = visible(e, target, blocks);
  const shot =
    distance >= 8 && distance <= 28 && w.time >= (e.pollenReadyAt ?? 0);
  if (e.cool <= 0 && clear && (distance <= 3.5 || shot)) {
    const kind = distance <= 3.5 ? "Slam" : "PollenShot";
    e.tx = target.x;
    e.tz = target.z;
    e.ty = target.y ?? 0;
    e.calyx = {
      kind,
      started: w.time,
      fired: false,
      yaw: Math.atan2(e.tx - e.x, e.tz - e.z),
    };
    e.wind = kind === "Slam" ? CALYX.slamWind : CALYX.shotWind;
    return;
  }
  if (distance > 2.8) {
    const direction = pursuitDirection(w, e, target);
    move(
      e,
      direction.x * CALYX.speed * dt,
      direction.z * CALYX.speed * dt,
      0.9,
      blocks,
    );
  }
}
