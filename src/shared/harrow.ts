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
  HARROW_DASH_TIMING,
  HARROW_SNIPE_TIMING,
  HARROW_BOMB_TIMING,
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
  dashWind: HARROW_DASH_TIMING.wind,
  dashTravel: HARROW_DASH_TIMING.travel,
  dashDuration: HARROW_DASH_TIMING.duration,
  dashDistance: 12,
  dashRadius: 4,
  dashDamage: 60,
  snipeWind: HARROW_SNIPE_TIMING.wind,
  snipeInterval: HARROW_SNIPE_TIMING.interval,
  snipeDuration: HARROW_SNIPE_TIMING.duration,
  snipeFlight: 0.8,
  snipeDamage: 18,
  snipeRadius: 0.7,
  bombWind: HARROW_BOMB_TIMING.wind,
  bombTravel: HARROW_BOMB_TIMING.travel,
  bombDuration: HARROW_BOMB_TIMING.duration,
  bombFlight: 0.8,
  bombDamage: 32,
  bombRadius: 2.5,
  bombSide: 5,
  bombSpacing: 6,
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
  diveClawRadius: 1.45,
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
  trajectory?: "arc" | "straight";
  /** Last flight time checked for collisions, including across delayed ticks/checkpoints. */
  lastChecked?: number;
}
/** Cubic trajectory: vertical launch, turn above the battlefield, vertical descent. */
export function harrowMissilePosition(m: HarrowMissile, time: number): Point {
  const t = Math.max(0, Math.min(1, (time - m.launch) / (m.impact - m.launch)));
  if (m.trajectory === "straight")
    return {
      x: m.origin.x + (m.target.x - m.origin.x) * t,
      y: m.origin.y + (m.target.y - m.origin.y) * t,
      z: m.origin.z + (m.target.z - m.origin.z) * t,
    };
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
    | "Spin"
    | "Threat"
    | "Dash"
    | "Snipe"
    | "BombPass"
    | "Takeoff"
    | "Glide"
    | "Dive"
    | "Land"
    | "StaggerFall";
  started: number;
  fired: boolean;
  yaw: number;
  from?: Point;
  to?: Point;
  hitIds?: string[];
  flapSeed?: number;
  travelProgress?: number;
}
const DIVE_FOOT_SIDE = 7.1;
const DIVE_CLAW_START = -2;
const DIVE_CLAW_STEP = 1.6;
const DIVE_CENTER_SEGMENT = 2;
/** Aligns the right foot's middle claw with the locked player position. */
export function harrowDiveRootForTarget(target: Point, yaw: number): Point {
  const forward = DIVE_CLAW_START + DIVE_CENTER_SEGMENT * DIVE_CLAW_STEP;
  return {
    x: target.x - Math.sin(yaw) * forward - Math.cos(yaw) * DIVE_FOOT_SIDE,
    y: target.y,
    z: target.z - Math.cos(yaw) * forward + Math.sin(yaw) * DIVE_FOOT_SIDE,
  };
}
/** Two feet, three tapering claw strokes each. Every returned circle is both marked and dangerous. */
export function harrowDiveClawCircles(to: Point, yaw: number) {
  const circles: Array<{ x: number; y: number; z: number; radius: number }> =
    [];
  for (const side of [-1, 1])
    for (let claw = -1; claw <= 1; claw++)
      for (let segment = 0; segment < 5; segment++) {
        const forward = DIVE_CLAW_START + segment * DIVE_CLAW_STEP;
        const lateral = side * DIVE_FOOT_SIDE + claw * (3.2 + segment * 0.38);
        circles.push({
          x: to.x + Math.sin(yaw) * forward + Math.cos(yaw) * lateral,
          y: to.y,
          z: to.z + Math.cos(yaw) * forward - Math.sin(yaw) * lateral,
          radius: HARROW.diveClawRadius - segment * 0.15,
        });
      }
  return circles;
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
/** v13 tips at 3.50s: renderer-corrected side X, loader Z, unscaled height. */
export function harrowMissileOrigins(
  e: Pick<Enemy, "x" | "y" | "z" | "harrowAirborne">,
  yaw: number,
): Point[] {
  const tips = e.harrowAirborne
    ? [
        [-5.19393361, 11.061604433, 1.937587254],
        [-5.6084078, 11.21421933, 1.453502691],
        [-5.050310874, 11.035312755, 1.411316097],
        [-6.055282893, 11.399765835, 1.687090148],
        [-5.652128703, 11.238741776, 1.95979127],
        [5.314106658, 11.419965969, 1.814120868],
        [4.87872031, 11.249095379, 2.259683486],
        [4.779941376, 11.227670087, 1.726287041],
        [5.74164752, 11.626260903, 2.08036168],
        [5.325061693, 11.446629479, 2.319215849],
      ]
    : [
        [-4.329957724, 12.035592695, 1.212735148],
        [-4.727860911, 12.21018741, 0.722217115],
        [-4.222710033, 11.911598796, 0.691771003],
        [-5.113040758, 12.515908495, 0.938686815],
        [-4.738984109, 12.308425635, 1.221282872],
        [4.361116116, 12.440172291, 0.965108571],
        [3.951080733, 12.243143, 1.423730925],
        [3.886054208, 12.124192835, 0.898040479],
        [4.720255109, 12.771711909, 1.204552831],
        [4.340783366, 12.540739029, 1.460512204],
      ];
  // The asymmetric replacement has independently measured tips on both sides.
  return tips.map(([x, y, z]) => harrowPoint(e, yaw, -z, x, y));
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
/** v13 verification: ten Snipe wing-claw tips in production model coordinates. */
const HARROW_SNIPE_TIPS = [
  [-4.915367343, 7.02764525, -3.421645303],
  [-5.464425555, 7.071378294, -3.066623057],
  [-4.909671922, 7.039191767, -2.87564662],
  [-5.873866071, 7.043033822, -3.413383976],
  [-5.385080505, 7.026867742, -3.567187126],
  [5.415537031, 7.500429726, -3.113906378],
  [4.878852259, 7.409683436, -3.461783696],
  [4.882514435, 7.411612099, -2.918910796],
  [5.831793508, 7.514325441, -3.46429236],
  [5.344896683, 7.452652062, -3.612583791],
] as const;
/** v13 verification: five launchers per wing during BombPass. */
const HARROW_BOMB_TIPS = [
  [-5.763617925, 10.141767, -2.448725023],
  [-6.210773122, 9.834339264, -2.816092187],
  [-5.627812876, 9.7607406, -2.815680154],
  [-6.683116942, 10.067166025, -2.709456964],
  [-6.249169248, 10.213446881, -2.478980556],
  [5.901003704, 10.298684423, -2.887246587],
  [5.442326525, 10.560660037, -2.515402356],
  [5.339431666, 10.177603411, -2.886088718],
  [6.361288063, 10.571757604, -2.788239684],
  [5.918649469, 10.677128424, -2.551954663],
] as const;
/** Grounded wing-claw muzzle positions, preserving verified launcher order. */
export function harrowSnipeOrigins(e: Enemy, yaw: number): Point[] {
  return HARROW_SNIPE_TIPS.map(([x, y, z]) => harrowPoint(e, yaw, -z, x, y));
}
export function harrowBombOrigins(
  e: Pick<Enemy, "x" | "y" | "z">,
  yaw: number,
): Point[] {
  return HARROW_BOMB_TIPS.map(([x, y, z]) => harrowPoint(e, yaw, -z, x, y));
}
export function queueHarrowSnipes(w: World, e: Enemy, target: Player) {
  const missiles = (w.harrowMissiles ??= []);
  if (missiles.length + 10 > HARROW.maxMissiles) return;
  const origins = harrowSnipeOrigins(e, e.harrow!.yaw);
  const aimed: Point = { x: target.x, y: (target.y ?? 0) + 0.9, z: target.z };
  for (let i = 0; i < 10; i++) {
    const launch = w.time + HARROW.snipeWind + i * HARROW.snipeInterval;
    missiles.push({
      id: ++w.serial,
      owner: e.id,
      origin: origins[i],
      target: { ...aimed },
      launch,
      impact: launch + HARROW.snipeFlight,
      damage: HARROW.snipeDamage,
      radius: HARROW.snipeRadius,
      trajectory: "straight",
    });
  }
}
/** Commit both target rows before the flyover, including their release times. */
export function queueHarrowBombs(w: World, e: Enemy, target: Player) {
  const missiles = (w.harrowMissiles ??= []);
  if (missiles.length + 10 > HARROW.maxMissiles) return;
  const a = e.harrow!;
  const from = a.from ?? { x: e.x, y: e.y, z: e.z };
  const to = a.to!;
  const blocks = mapFor(w).blocks;
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const forwardX = Math.sin(a.yaw),
    forwardZ = Math.cos(a.yaw);
  const sideX = Math.cos(a.yaw),
    sideZ = -Math.sin(a.yaw);
  const targetDistance =
    (target.x - from.x) * forwardX + (target.z - from.z) * forwardZ;
  for (let row = 0; row < 5; row++) {
    const along = Math.max(
      0,
      Math.min(length, targetDistance + (row - 2) * HARROW.bombSpacing),
    );
    const progress = length > 0 ? along / length : 0;
    const body = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y,
      z: from.z + (to.z - from.z) * progress,
    };
    const origins = harrowBombOrigins(body, a.yaw);
    for (const side of [-1, 1]) {
      const x = from.x + forwardX * along + sideX * side * HARROW.bombSide;
      const z = from.z + forwardZ * along + sideZ * side * HARROW.bombSide;
      const ground = supportHeight(x, z, blocks, groundHeight(x, z, blocks));
      const origin = origins[side < 0 ? row : row + 5];
      const intended = { x, y: ground, z };
      const delta = {
        x: intended.x - origin.x,
        y: intended.y - origin.y,
        z: intended.z - origin.z,
      };
      const distance = Math.hypot(delta.x, delta.y, delta.z);
      const firstSurface =
        distance > 1e-8
          ? wallDistance(
              origin.x,
              origin.y,
              origin.z,
              delta.x / distance,
              delta.y / distance,
              delta.z / distance,
              distance,
              blocks,
            )
          : distance;
      const hitFraction =
        firstSurface < distance - 1e-5
          ? Math.max(0, firstSurface - 0.02) / distance
          : 1;
      const launch = w.time + HARROW.bombWind + progress * HARROW.bombTravel;
      missiles.push({
        id: ++w.serial,
        owner: e.id,
        origin,
        target:
          hitFraction === 1
            ? intended
            : {
                x: origin.x + delta.x * hitFraction,
                y: origin.y + delta.y * hitFraction,
                z: origin.z + delta.z * hitFraction,
              },
        launch,
        impact: launch + HARROW.bombFlight,
        damage: HARROW.bombDamage,
        radius: HARROW.bombRadius,
        trajectory: "straight",
      });
    }
  }
}
export function stepHarrowMissiles(w: World, living: Player[], _dt: number) {
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
    const through = Math.min(w.time, m.impact);
    // Sweep subsegments so a high-speed descending missile cannot pass through a roof.
    for (
      let at = Math.max(m.launch, Math.min(m.lastChecked ?? m.launch, through));
      at < through - 1e-8;
    ) {
      const next = Math.min(at + 1 / 60, through),
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
      if (m.trajectory === "straight" && length > 1e-8) {
        let first = wall;
        for (const p of living) {
          if (p.hp <= 0 || !p.connected) continue;
          const px = p.x - a.x,
            py = (p.y ?? 0) + 0.9 - a.y,
            pz = p.z - a.z;
          const along = Math.max(
            0,
            Math.min(length, (px * dx + py * dy + pz * dz) / length),
          );
          const separation = Math.hypot(
            px - (dx / length) * along,
            py - (dy / length) * along,
            pz - (dz / length) * along,
          );
          if (separation <= m.radius && along <= first) first = along;
        }
        if (first < length - 1e-5) {
          hit = {
            x: a.x + (dx / length) * first,
            y: a.y + (dy / length) * first,
            z: a.z + (dz / length) * first,
          };
          break;
        }
      }
      if (wall < length - 1e-5) {
        const f = Math.max(0, wall - 0.02) / length;
        hit = { x: a.x + dx * f, y: a.y + dy * f, z: a.z + dz * f };
        break;
      }
      at = next;
    }
    if (!hit && w.time + 1e-8 < m.impact) {
      m.lastChecked = through;
      return true;
    }
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
    from?: Point,
  ) => {
    for (const p of living) {
      if (p.hp <= 0 || !p.connected || hitIds?.includes(p.id)) continue;
      const center = { x: p.x, y: (p.y ?? 0) + 0.9, z: p.z };
      let nearest = point;
      if (from) {
        const sx = point.x - from.x,
          sy = point.y - from.y,
          sz = point.z - from.z,
          squared = sx * sx + sy * sy + sz * sz;
        const t =
          squared > 1e-8
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((center.x - from.x) * sx +
                    (center.y - from.y) * sy +
                    (center.z - from.z) * sz) /
                    squared,
                ),
              )
            : 1;
        nearest = {
          x: from.x + sx * t,
          y: from.y + sy * t,
          z: from.z + sz * t,
        };
      }
      const dx = center.x - nearest.x,
        dy = center.y - nearest.y,
        dz = center.z - nearest.z,
        length = Math.hypot(dx, dy, dz);
      if (
        length <= radius &&
        (length < 1e-6 ||
          wallDistance(
            nearest.x,
            nearest.y,
            nearest.z,
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
      flapSeed: kind === "Takeoff" ? random(w) : undefined,
    };
  };
  if (e.harrow) {
    const a = e.harrow,
      age = Math.max(0, w.time - a.started);
    if (a.kind === "Dash") {
      e.heading = a.yaw;
      e.wind = Math.max(0, HARROW.dashWind - age);
      if (age >= HARROW.dashWind) a.fired = true;
      if (age >= HARROW.dashWind) {
        const start = a.travelProgress ?? 0;
        const end = Math.max(
          0,
          Math.min(1, (age - HARROW.dashWind) / HARROW.dashTravel),
        );
        const distance = Math.max(0, end - start) * HARROW.dashDistance;
        a.travelProgress = end;
        const from = { x: e.x, y: e.y + 0.9, z: e.z };
        move(
          e,
          Math.sin(a.yaw) * distance,
          Math.cos(a.yaw) * distance,
          3.4 * HARROW.scale,
          blocks,
        );
        if (distance > 0)
          hitPlayers(
            { x: e.x, y: e.y + 0.9, z: e.z },
            HARROW.dashRadius,
            HARROW.dashDamage,
            (a.hitIds ??= []),
            from,
          );
      }
      if (age >= HARROW.dashDuration) {
        e.harrow = undefined;
        e.cool = HARROW.cooldown;
        e.wind = 0;
      }
      return;
    }
    if (a.kind === "BombPass") {
      e.heading = a.yaw;
      e.wind = Math.max(0, HARROW.bombWind - age);
      if (age >= HARROW.bombWind) a.fired = true;
      if (age >= HARROW.bombWind) {
        const progress = Math.max(
          0,
          Math.min(1, (age - HARROW.bombWind) / HARROW.bombTravel),
        );
        e.x = a.from!.x + (a.to!.x - a.from!.x) * progress;
        e.z = a.from!.z + (a.to!.z - a.from!.z) * progress;
        e.y = a.from!.y;
      }
      if (age >= HARROW.bombDuration) {
        e.harrow = undefined;
        e.cool = HARROW.cooldown;
        e.wind = 0;
      }
      return;
    }
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
        travelFraction =
          a.kind === "Takeoff"
            ? Math.max(0, (fraction - 0.24) / 0.76)
            : fraction,
        t = travelFraction * travelFraction * (3 - 2 * travelFraction);
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
          const hitIds: string[] = [];
          for (const [index, circle] of harrowDiveClawCircles(
            to,
            a.yaw,
          ).entries()) {
            if (index % 5 === 4)
              event(w, { type: "burst", ...circle, radius: circle.radius });
            hitPlayers(
              { ...circle, y: circle.y + 0.9 },
              circle.radius,
              HARROW.diveDamage,
              hitIds,
            );
          }
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
    const wind =
      a.kind === "Spin"
        ? HARROW.spinWind
        : a.kind === "Snipe"
          ? HARROW.snipeWind
          : HARROW.threatWind;
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
      age >=
      (a.kind === "Spin"
        ? HARROW.spinDuration
        : a.kind === "Snipe"
          ? HARROW.snipeDuration
          : HARROW.threatDuration)
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
      const root = harrowDiveRootForTarget(
        { x: target.x, y: target.y ?? 0, z: target.z },
        yaw,
      );
      root.y = supportHeight(root.x, root.z, blocks, target.y ?? 0);
      e.heading = yaw;
      transition("Glide", root);
      return;
    }
    if (e.harrowAirborne && distance > 30 && random(w) < 0.55) {
      const beyond = 16;
      e.heading = yaw;
      transition("BombPass", {
        x: target.x + Math.sin(yaw) * beyond,
        y: e.y,
        z: target.z + Math.cos(yaw) * beyond,
      });
      queueHarrowBombs(w, e, target);
      e.wind = HARROW.bombWind;
      return;
    }
    if (
      !e.harrowAirborne &&
      distance > HARROW.dashRadius &&
      distance <= HARROW.dashDistance + HARROW.dashRadius &&
      random(w) < 0.35
    ) {
      e.heading = yaw;
      transition("Dash", {
        x: e.x + Math.sin(yaw) * HARROW.dashDistance,
        y: e.y,
        z: e.z + Math.cos(yaw) * HARROW.dashDistance,
      });
      e.wind = HARROW.dashWind;
      return;
    }
    if (
      !e.harrowAirborne &&
      distance > HARROW.spinTriggerRadius &&
      random(w) < 0.5
    ) {
      e.heading = yaw;
      transition("Snipe");
      queueHarrowSnipes(w, e, target);
      e.wind = HARROW.snipeWind;
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
