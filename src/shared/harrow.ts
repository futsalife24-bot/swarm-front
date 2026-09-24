import {
  event,
  hurtPlayer,
  move,
  visible,
  wallDistance,
  random,
  type Enemy,
  type Player,
  type World,
} from "./game";
import { pursuitDirection } from "./enemy-motion";
import { mapFor } from "./stages";
import { groundHeight, supportHeight } from "./terrain";
import { ARENA_X, ARENA_Z } from "./arena";
import { RAY_MAX_FLIGHT_HEIGHT } from "./defs";
import {
  HARROW_SCALE,
  HARROW_MOVE_SPEED,
  HARROW_WALK_AUTHORED_SPEED,
  HARROW_SPIN_TIMING,
  harrowSpinRotation,
} from "./harrow-motion";

export const HARROW = {
  scale: HARROW_SCALE,
  speed: HARROW_MOVE_SPEED,
  walkAuthoredSpeed: HARROW_WALK_AUTHORED_SPEED,
  threatWind: 3.5,
  threatDuration: 7,
  shotRange: 100,
  cooldown: 1.8,
  missileFlight: 1.8,
  markerLead: 3.5,
  missileDamage: 36,
  missileRadius: 2.5,
  maxMissiles: 40,
  spinWind: HARROW_SPIN_TIMING.wind,
  spinDuration: HARROW_SPIN_TIMING.duration,
  spinTurn: HARROW_SPIN_TIMING.turn,
  // Grounded wings sweep outward; the visible pressure reaches the 28m boundary.
  spinRadius: 28,
  // More reach must not change when HARROW lands or chooses its close attack.
  spinTriggerRadius: 21.2,
  spinDamage: 84,
  takeoffDuration: 3.5,
  flightHeight: RAY_MAX_FLIGHT_HEIGHT * 3,
  groundDuration: 12,
  airDuration: 14,
  glideDuration: 2.1,
  diveDuration: 0.9,
  landDuration: 1.75,
  diveChance: 0.45,
  diveRange: 60,
  diveRadius: 12,
  diveDamage: 92,
  staggerFraction: 0.12,
  staggerFallDuration: 2.625,
} as const;
type Point = { x: number; y: number; z: number };
export interface HarrowMissile {
  id: number;
  owner: number;
  origin: Point;
  target: Point;
  launch: number;
  impact: number;
  damage: number;
  radius: number;
}
/** Cubic trajectory: vertical launch, turn above the battlefield, vertical descent. */
export function harrowMissilePosition(m: HarrowMissile, time: number): Point {
  const t = Math.max(0, Math.min(1, (time - m.launch) / (m.impact - m.launch)));
  const u = 1 - t,
    top = Math.max(m.origin.y, m.target.y) + 28;
  return {
    x:
      (u * u * u + 3 * u * u * t) * m.origin.x +
      (3 * u * t * t + t * t * t) * m.target.x,
    y:
      u * u * u * m.origin.y +
      3 * u * u * t * top +
      3 * u * t * t * top +
      t * t * t * m.target.y,
    z:
      (u * u * u + 3 * u * u * t) * m.origin.z +
      (3 * u * t * t + t * t * t) * m.target.z,
  };
}
export interface HarrowAttack {
  kind:
    "Spin" | "Threat" | "Takeoff" | "Glide" | "Dive" | "Land" | "StaggerFall";
  started: number;
  fired: boolean;
  yaw: number;
  from?: Point;
  to?: Point;
  hitIds?: string[];
}
/** Forward distance and side offset in the same -Z production frame as the GLB. */
export function harrowPoint(
  e: Pick<Enemy, "x" | "y" | "z">,
  yaw: number,
  forward: number,
  side: number,
  height: number,
) {
  forward *= HARROW.scale;
  side *= HARROW.scale;
  height *= HARROW.scale;
  return {
    x: e.x + Math.sin(yaw) * forward + Math.cos(yaw) * side,
    y: e.y + height,
    z: e.z + Math.cos(yaw) * forward - Math.sin(yaw) * side,
  };
}
/** v8 red warhead tips at Threat/AirThreat 3.50s, measured from the exported skin. */
export function harrowMissileOrigins(
  e: Pick<Enemy, "x" | "y" | "z" | "harrowAirborne">,
  yaw: number,
): Point[] {
  const left = e.harrowAirborne
    ? [
        [-6.35393, 7.861266, 0.264011],
        [-6.743596, 7.705794, -0.212991],
        [-6.856803, 8.099505, 0.597161],
        [-7.246469, 7.944033, 0.120159],
        [-6.8002, 7.902649, 0.192085],
      ]
    : [
        [-5.619758, 6.446827, -2.32226],
        [-6.107112, 6.085182, -2.509989],
        [-6.006242, 6.967652, -2.32226],
        [-6.493595, 6.606007, -2.509989],
        [-6.056677, 6.526417, -2.416125],
      ];
  return [1, -1].flatMap((sign) =>
    left.map(([x, y, z]) => harrowPoint(e, yaw, -z, x * sign, y)),
  );
}
export function queueHarrowMissiles(w: World, e: Enemy, living: Player[]) {
  const missiles = (w.harrowMissiles ??= []);
  if (missiles.length + 10 > HARROW.maxMissiles) return;
  const targets = living
    .filter((p) => p.hp > 0 && p.connected)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!targets.length) return;
  const blocks = mapFor(w).blocks;
  for (let i = 0; i < 10; i++) {
    const p = targets[i % targets.length];
    const angle = random(w) * Math.PI * 2,
      radius = i < targets.length ? 0 : 4 + Math.sqrt(random(w)) * 8;
    const x = Math.max(
      -ARENA_X + 3,
      Math.min(ARENA_X - 3, p.x + Math.sin(angle) * radius),
    );
    const z = Math.max(
      -ARENA_Z + 3,
      Math.min(ARENA_Z - 3, p.z + Math.cos(angle) * radius),
    );
    const target = {
      x,
      z,
      y: supportHeight(
        x,
        z,
        blocks,
        Math.max(p.y ?? 0, groundHeight(x, z, blocks)),
      ),
    };
    const origin = harrowMissileOrigins(e, e.harrow!.yaw)[i];
    const launch = w.time + HARROW.markerLead;
    missiles.push({
      id: ++w.serial,
      owner: e.id,
      origin,
      target,
      launch,
      impact: launch + HARROW.missileFlight,
      damage: HARROW.missileDamage,
      radius: HARROW.missileRadius,
    });
  }
}
export function stepHarrowMissiles(w: World, living: Player[], dt: number) {
  if (w.phase !== "battle" || w.waveClearAt !== null) {
    w.harrowMissiles = [];
    return;
  }
  const blocks = mapFor(w).blocks;
  w.harrowMissiles = (w.harrowMissiles ?? []).filter((m) => {
    if (
      w.time < m.launch &&
      !w.enemies.some((e) => e.id === m.owner && e.hp > 0)
    )
      return false;
    if (w.time < m.launch) return true;
    let hit: Point | undefined;
    // Sweep subsegments so a high-speed descending missile cannot pass through a roof.
    for (
      let at = Math.max(m.launch, w.time - dt);
      at < Math.min(w.time, m.impact) - 1e-8;
    ) {
      const next = Math.min(at + 1 / 60, w.time, m.impact),
        a = harrowMissilePosition(m, at),
        b = harrowMissilePosition(m, next);
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z,
        length = Math.hypot(dx, dy, dz);
      const wall =
        length > 1e-8
          ? wallDistance(
              a.x,
              a.y,
              a.z,
              dx / length,
              dy / length,
              dz / length,
              length,
              blocks,
            )
          : length;
      if (wall < length - 1e-5) {
        const f = Math.max(0, wall - 0.02) / length;
        hit = { x: a.x + dx * f, y: a.y + dy * f, z: a.z + dz * f };
        break;
      }
      at = next;
    }
    if (!hit && w.time + 1e-8 < m.impact) return true;
    hit ??= m.target;
    event(w, { type: "burst", ...hit, radius: m.radius });
    for (const p of living) {
      if (p.hp <= 0 || !p.connected) continue;
      const dx = p.x - hit.x,
        dy = (p.y ?? 0) + 0.9 - hit.y,
        dz = p.z - hit.z,
        length = Math.hypot(dx, dy, dz);
      if (
        length <= m.radius &&
        (length < 1e-6 ||
          wallDistance(
            hit.x,
            hit.y + 0.02,
            hit.z,
            dx / length,
            dy / length,
            dz / length,
            length,
            blocks,
          ) >=
            length - 0.03)
      )
        hurtPlayer(w, p, m.damage);
    }
    return false;
  });
}
export function stepHarrow(
  w: World,
  e: Enemy,
  target: Player,
  living: Player[],
  dt: number,
) {
  const blocks = mapFor(w).blocks;
  const hitPlayers = (
    point: Point,
    radius: number,
    damage: number,
    hitIds?: string[],
  ) => {
    for (const p of living) {
      if (p.hp <= 0 || !p.connected || hitIds?.includes(p.id)) continue;
      const dx = p.x - point.x,
        dy = (p.y ?? 0) + 0.9 - point.y,
        dz = p.z - point.z,
        length = Math.hypot(dx, dy, dz);
      if (
        length <= radius &&
        (length < 1e-6 ||
          wallDistance(
            point.x,
            point.y,
            point.z,
            dx / length,
            dy / length,
            dz / length,
            length,
            blocks,
          ) >=
            length - 0.01)
      ) {
        hurtPlayer(w, p, damage, true);
        hitIds?.push(p.id);
      }
    }
  };
  const transition = (kind: HarrowAttack["kind"], to?: Point) => {
    if (kind === "Takeoff") {
      e.harrowAirborne = true;
      e.harrowAirDamage = 0;
    }
    e.harrow = {
      kind,
      started: w.time,
      fired: false,
      yaw: e.heading ?? 0,
      from: { x: e.x, y: e.y, z: e.z },
      to,
    };
  };
  if (e.harrow) {
    const a = e.harrow,
      age = Math.max(0, w.time - a.started);
    if (
      a.kind === "Takeoff" ||
      a.kind === "Land" ||
      a.kind === "Glide" ||
      a.kind === "Dive" ||
      a.kind === "StaggerFall"
    ) {
      const duration =
        a.kind === "StaggerFall"
          ? HARROW.staggerFallDuration
          : a.kind === "Takeoff"
            ? HARROW.takeoffDuration
            : a.kind === "Land"
              ? HARROW.landDuration
              : a.kind === "Glide"
                ? HARROW.glideDuration
                : HARROW.diveDuration;
      const fraction = Math.min(1, age / duration),
        t = fraction * fraction * (3 - 2 * fraction);
      const from = a.from!,
        to = a.to!;
      if (a.kind === "Glide") {
        // Stop short and above the marked dive point before the steep final descent.
        e.x = from.x + (to.x - from.x) * t * 0.65;
        e.z = from.z + (to.z - from.z) * t * 0.65;
        e.y =
          from.y + (Math.max(from.y, to.y + HARROW.flightHeight) - from.y) * t;
      } else {
        e.x = from.x + (to.x - from.x) * t;
        e.y = from.y + (to.y - from.y) * t;
        e.z = from.z + (to.z - from.z) * t;
      }
      e.heading = a.yaw;
      e.wind = 0;
      if (fraction >= 1) {
        if (a.kind === "Glide") {
          transition("Dive", to);
          return;
        }
        if (a.kind === "StaggerFall") {
          e.harrowAirborne = false;
          transition("Land", to);
          return;
        }
        if (a.kind === "Dive") {
          event(w, { type: "burst", ...to, radius: HARROW.diveRadius });
          hitPlayers(
            { ...to, y: to.y + 0.9 },
            HARROW.diveRadius,
            HARROW.diveDamage,
          );
          transition("Land", to);
          return;
        }
        e.harrowAirborne = a.kind === "Takeoff";
        e.harrowAirDamage = 0;
        e.harrowSwitchAt =
          w.time +
          (e.harrowAirborne ? HARROW.airDuration : HARROW.groundDuration);
        e.harrow = undefined;
        e.cool = a.kind === "Land" ? 1 : 0.5;
      }
      return;
    }
    const wind = a.kind === "Spin" ? HARROW.spinWind : HARROW.threatWind;
    e.heading = a.yaw;
    e.wind = Math.max(0, wind - age);
    if (a.kind === "Spin") {
      e.heading = a.yaw + harrowSpinRotation(age);
      if (age >= HARROW.spinWind && age < HARROW.spinWind + HARROW.spinTurn)
        hitPlayers(
          { x: e.x, y: e.y + 0.9, z: e.z },
          HARROW.spinRadius,
          HARROW.spinDamage,
          (a.hitIds ??= []),
        );
    }
    if (!a.fired && age + 1e-8 >= wind) {
      a.fired = true;
    }
    if (
      age >= (a.kind === "Spin" ? HARROW.spinDuration : HARROW.threatDuration)
    ) {
      e.harrow = undefined;
      e.wind = 0;
      e.cool = HARROW.cooldown;
    }
    return;
  }
  e.cool = Math.max(0, e.cool - dt);
  const dx = target.x - e.x,
    dz = target.z - e.z,
    distance = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  e.harrowSwitchAt ??= w.time + HARROW.groundDuration;
  if (
    e.harrowAirborne &&
    ((distance <= HARROW.spinTriggerRadius &&
      w.time >= e.harrowSwitchAt - HARROW.airDuration + 2) ||
      w.time >= e.harrowSwitchAt)
  ) {
    transition("Land", {
      x: e.x,
      z: e.z,
      y: supportHeight(e.x, e.z, blocks, e.y),
    });
    return;
  }
  if (!e.harrowAirborne && w.time >= e.harrowSwitchAt) {
    transition("Takeoff", { x: e.x, z: e.z, y: e.y + HARROW.flightHeight });
    return;
  }
  // A nearby target must wait for landing, including the two-second airborne grace.
  // Do not choose the ground-only Spin (or a ranged attack) while hovering above it.
  if (e.harrowAirborne && distance <= HARROW.spinTriggerRadius) return;
  // Bounded turn rate keeps the large wings from snapping across the arena.
  const old = e.heading ?? yaw;
  const turn = Math.atan2(Math.sin(yaw - old), Math.cos(yaw - old));
  e.heading = old + Math.max(-dt * 0.65, Math.min(dt * 0.65, turn));
  if (
    e.cool <= 0 &&
    Math.abs(turn) < 0.15 &&
    distance <= HARROW.shotRange &&
    visible(e, target, blocks)
  ) {
    e.tx = target.x;
    e.tz = target.z;
    e.ty = target.y ?? 0;
    if (
      e.harrowAirborne &&
      distance >= 14 &&
      distance <= HARROW.diveRange &&
      random(w) < HARROW.diveChance
    ) {
      transition("Glide", {
        x: target.x,
        z: target.z,
        y: supportHeight(target.x, target.z, blocks, target.y ?? 0),
      });
      return;
    }
    e.harrow = {
      kind: distance <= HARROW.spinTriggerRadius ? "Spin" : "Threat",
      started: w.time,
      fired: false,
      yaw: e.heading,
    };
    e.wind = e.harrow.kind === "Spin" ? HARROW.spinWind : HARROW.threatWind;
    if (e.harrow.kind === "Threat") queueHarrowMissiles(w, e, living);
    return;
  }
  if (distance > 3.4) {
    const direction = pursuitDirection(w, e, target);
    move(
      e,
      direction.x * HARROW.speed * dt,
      direction.z * HARROW.speed * dt,
      3.4 * HARROW.scale,
      blocks,
    );
    // Ground pursuit keeps move()'s rock/roof support, including platform edges.
    if (e.harrowAirborne)
      e.y = groundHeight(e.x, e.z, blocks) + HARROW.flightHeight;
  }
}
export function staggerHarrow(w: World, e: Enemy, damage: number) {
  if (
    e.kind !== "harrow" ||
    !e.harrowAirborne ||
    e.hp <= 0 ||
    e.harrow?.kind === "StaggerFall" ||
    e.harrow?.kind === "Land"
  )
    return;
  e.harrowAirDamage = (e.harrowAirDamage ?? 0) + Math.max(0, damage);
  if (e.harrowAirDamage < e.maxHp * HARROW.staggerFraction) return;
  e.harrowAirDamage = 0;
  e.wind = 0;
  e.harrow = {
    kind: "StaggerFall",
    started: w.time,
    fired: false,
    yaw: e.heading ?? 0,
    from: { x: e.x, y: e.y, z: e.z },
    to: { x: e.x, y: supportHeight(e.x, e.z, mapFor(w).blocks, e.y), z: e.z },
  };
  w.harrowMissiles = (w.harrowMissiles ?? []).filter(
    (m) => m.owner !== e.id || m.launch <= w.time,
  );
}
