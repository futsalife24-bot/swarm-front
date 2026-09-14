import { enemySize, enemySpeedFactor } from "./enemy-size";
import { supportHeight } from "./terrain";
import type { Enemy, Player, World } from "./game";
import { mapFor } from "./stages";
import {
  FOUNDRY_FRACTURED_SPEED,
  FOUNDRY_LASER_DAMAGE,
  FOUNDRY_LASER_INTERVAL,
  FOUNDRY_LASER_RANGE,
  FOUNDRY_LASER_SPEED,
  FOUNDRY_LASER_WARNING,
  FOUNDRY_SPEED,
  FOUNDRY_TARGET_HEIGHT,
  FOUNDRY_UNIT_PITCH,
  foundryLaserDirection,
  foundryLaserOrigin,
} from "./foundry-defs";
import {
  foundryDistance,
  foundryGroundLine,
  foundryPath,
  foundryPatrol,
  foundrySafePoint,
  type FoundryPoint,
} from "./foundry-navigation";

export interface WormNode {
  x: number;
  y: number;
  z: number;
  partHp?: number;
  route?: number;
  heading?: number;
  acidAt?: number;
  pulseAim?: { x: number; y?: number; z: number };
  // Only chain leaders own history. Followers reference the owner's fixed slot
  // and arc-distance, so a cut can transfer history without duplicating it.
  trail?: FoundryPoint[];
  trailOwner?: number;
  trailOffset?: number;
  groundPath?: FoundryPoint[];
  groundGoal?: FoundryPoint;
  groundRepathAt?: number;
  groundChasing?: boolean;
}
export const WORM_BODY_COUNT = 7;
export const WORM_UNIT_COUNT = 1 + WORM_BODY_COUNT;
export const wormNodes = (e: Enemy): WormNode[] => [e, ...(e.segments ?? [])];
export function wormChains(e: Enemy): number[][] {
  if (!e.segments || e.hp <= 0) return [];
  const chains: number[][] = [];
  let chain: number[] | undefined;
  for (const [part, node] of wormNodes(e).entries()) {
    if ((node.partHp ?? e.maxHp / WORM_UNIT_COUNT) <= 0) {
      chain = undefined;
      continue;
    }
    if (!chain) chains.push((chain = []));
    chain.push(part);
  }
  return chains;
}
// Capture before destroying the head. Already detached bodies never contribute.
export function attachedWormBodyParts(e: Enemy): number[] {
  const headChain = wormChains(e)[0];
  return headChain?.[0] === 0 ? headChain.slice(1) : [];
}
export function initWorm(e: Enemy) {
  if (!e.segments) return;
  for (const node of wormNodes(e)) node.partHp ??= e.maxHp / WORM_UNIT_COUNT;
}
export const wormSpeed = (e: Enemy) =>
  (e.fractured ? FOUNDRY_FRACTURED_SPEED : FOUNDRY_SPEED) * enemySpeedFactor(e);

function trailSample(trail: FoundryPoint[], behind: number) {
  for (let i = trail.length - 1; i > 0; i--) {
    const a = trail[i - 1],
      b = trail[i],
      length = foundryDistance(a, b);
    if (behind <= length && length > 1e-8) {
      const f = 1 - behind / length;
      return {
        point: { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f },
        heading: Math.atan2(b.x - a.x, b.z - a.z),
        index: i,
      };
    }
    behind -= length;
  }
  return { point: { ...trail[0] }, heading: 0, index: 0 };
}
function historyBefore(trail: FoundryPoint[], behind: number) {
  const sample = trailSample(trail, behind);
  return [...trail.slice(0, sample.index), sample.point];
}
function trimHistory(trail: FoundryPoint[], length: number) {
  const sample = trailSample(trail, length);
  return sample.index ? [sample.point, ...trail.slice(sample.index)] : trail;
}

/** Safe initial placement along one real navigable path, including cave bends. */
export function placeWormOnGround(w: World, e: Enemy) {
  if (!e.segments) return;
  const map = mapFor(w),
    nodes = wormNodes(e);
  const head = foundrySafePoint(map, e),
    patrol = foundryPatrol(map);
  const farthest = patrol
    .map((point, index) => ({
      point,
      index,
      distance: foundryDistance(head, point),
    }))
    .sort((a, b) => b.distance - a.distance || a.index - b.index);
  let behind: FoundryPoint[] = [];
  for (const { point } of farthest) {
    const path = foundryPath(map, head, point);
    const candidate = [head, ...path];
    let length = 0;
    for (let i = 1; i < candidate.length; i++)
      length += foundryDistance(candidate[i - 1], candidate[i]);
    if (length >= (WORM_BODY_COUNT + 1) * FOUNDRY_UNIT_PITCH * enemySize(e)) {
      behind = candidate;
      break;
    }
  }
  if (!behind.length)
    throw new Error("FOUNDRY ZERO cannot place its full body safely");
  const trail = trimHistory(
    behind.reverse(),
    WORM_UNIT_COUNT * FOUNDRY_UNIT_PITCH * enemySize(e),
  );
  for (const [index, node] of nodes.entries()) {
    const offset = index * FOUNDRY_UNIT_PITCH * enemySize(e),
      sample = trailSample(trail, offset);
    node.x = sample.point.x;
    node.z = sample.point.z;
    node.y = supportHeight(node.x,node.z,mapFor(w).blocks);
    node.heading = sample.heading;
    node.trail = index === 0 ? trail : undefined;
    node.trailOwner = 0;
    node.trailOffset = offset;
    node.route = undefined;
    node.groundPath = undefined;
    node.groundGoal = undefined;
    node.groundRepathAt = undefined;
  }
}

function nearestPlayer(
  players: Player[],
  node: FoundryPoint,
  range = Infinity,
  originY?: number,
): Player | undefined {
  let target: Player | undefined,
    best = Infinity;
  for (const player of players) {
    if (player.hp <= 0 || !player.connected) continue;
    const distance = Math.hypot(
      player.x - node.x,
      player.z - node.z,
      originY === undefined ? 0 : (player.y ?? 0) + FOUNDRY_TARGET_HEIGHT - originY,
    );
    if (distance > range) continue;
    if (
      distance < best ||
      (distance === best && target && player.id < target.id)
    ) {
      target = player;
      best = distance;
    }
  }
  return target;
}

function appendHistory(w: World, node: WormNode, point: FoundryPoint) {
  const trail = node.trail!;
  const end = trail[trail.length - 1];
  if (foundryDistance(end, point) < 1e-8) return;
  // Keep turns, but merge very short nearly-collinear steps. The merged segment
  // must itself be clear, so sampling never shortcuts through a wall.
  if (trail.length > 1) {
    const a = trail[trail.length - 2],
      dx = point.x - a.x,
      dz = point.z - a.z;
    const length = Math.hypot(dx, dz);
    const deviation =
      Math.abs(dx * (end.z - a.z) - dz * (end.x - a.x)) /
      Math.max(length, 1e-8);
    if (
      length < 0.85 &&
      deviation < 0.012 &&
      foundryGroundLine(mapFor(w), a, point)
    ) {
      trail[trail.length - 1] = { ...point };
      return;
    }
  }
  trail.push({ ...point });
}

const angleDelta = (to: number, from: number) =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

function moveLeader(
  w: World,
  e: Enemy,
  node: WormNode,
  part: number,
  chainLength: number,
  dt: number,
) {
  const map = mapFor(w),
    patrol = foundryPatrol(map),
    direction = (e.id + part) % 2 ? 1 : -1;
  const player = e.fractured ? nearestPlayer(w.players, node) : undefined;
  if (node.route === undefined) {
    // The authored body already lies behind this heading. Starting toward the
    // nearest patrol index can reverse into that history and fold all eight
    // units onto one another before the first waypoint is reached.
    let best = Infinity;
    node.route = 0;
    for (const [index, point] of patrol.entries()) {
      const first = foundryPath(map, node, point)[0];
      if (!first) continue;
      const turn = Math.abs(
        angleDelta(
          Math.atan2(first.x - node.x, first.z - node.z),
          node.heading ?? 0,
        ),
      );
      if (turn < best) {
        best = turn;
        node.route = index;
      }
    }
  }
  let goal = player ? foundrySafePoint(map, player) : patrol[node.route];
  if (!player && foundryDistance(node, goal) < 0.35) {
    node.route = (node.route + direction + patrol.length) % patrol.length;
    goal = patrol[node.route];
    node.groundPath = undefined;
  }
  const changed =
    !node.groundGoal || foundryDistance(node.groundGoal, goal) > 0.8;
  const modeChanged = node.groundChasing !== Boolean(player);
  if (
    !node.groundPath?.length ||
    modeChanged ||
    (changed && w.time >= (node.groundRepathAt ?? 0))
  ) {
    node.groundPath = foundryPath(map, node, goal);
    node.groundGoal = { ...goal };
    node.groundRepathAt = w.time + 0.5;
    node.groundChasing = Boolean(player);
  }
  let remaining = wormSpeed(e) * Math.max(0, dt);
  for (
    let hops = 0;
    remaining > 1e-8 && node.groundPath.length && hops < 16;
    hops++
  ) {
    while (
      node.groundPath.length > 1 &&
      foundryDistance(node, node.groundPath[0]) < 1 &&
      foundryGroundLine(map, node, node.groundPath[1])
    )
      node.groundPath.shift();
    const target = node.groundPath[0],
      distance = foundryDistance(node, target);
    if (distance < 1e-6) {
      node.groundPath.shift();
      continue;
    }
    const amount = Math.min(distance, remaining),
      desired = Math.atan2(target.x - node.x, target.z - node.z);
    const wanted =
      desired +
      (distance > 1 ? 0.13 * Math.sin(w.time * 1.7 + e.id + part * 0.6) : 0);
    // A bounded turn changes the actual travelled path, so followers inherit
    // the same bend. Small chains and the final approach retain tighter turns.
    const radius =
      chainLength > 1
        ? Math.min(chainLength > 2 ? 2.8 : 1.6, Math.max(0.5, distance * 0.6))
        : 0.4;
    const turn = amount / radius,
      previous = node.heading ?? desired,
      delta = angleDelta(wanted, previous),
      angle = previous + Math.max(-turn, Math.min(turn, delta));
    let next =
      amount === distance && Math.abs(angleDelta(desired, previous)) <= turn
        ? { ...target }
        : {
            x: node.x + Math.sin(angle) * amount,
            z: node.z + Math.cos(angle) * amount,
          };
    if (!foundryGroundLine(map, node, next)) {
      const delta = angleDelta(desired, previous);
      const straight = previous + Math.max(-turn, Math.min(turn, delta));
      next = {
        x: node.x + Math.sin(straight) * amount,
        z: node.z + Math.cos(straight) * amount,
      };
      if (!foundryGroundLine(map, node, next)) {
        // Replan from the actual centre after a bend reaches tight cover. A
        // stale waypoint must not hold a chain against the cave boundary.
        node.heading = straight;
        node.groundPath = undefined;
        break;
      }
    }
    node.heading = Math.atan2(next.x - node.x, next.z - node.z);
    node.x = next.x;
    node.z = next.z;
    node.y = supportHeight(node.x,node.z,mapFor(w).blocks);
    appendHistory(w, node, next);
    remaining -= amount;
    if (foundryDistance(next, target) < 1e-6) node.groundPath.shift();
  }
}

function fireLaser(w: World, node: WormNode, part: number, size: number) {
  node.acidAt ??= w.time + FOUNDRY_LASER_WARNING + part * 0.23;
  if (w.time >= node.acidAt - FOUNDRY_LASER_WARNING && !node.pulseAim) {
    const origin = foundryLaserOrigin(node, part, size);
    const player = nearestPlayer(
      w.players,
      origin,
      FOUNDRY_LASER_RANGE,
      origin.y,
    );
    if (player) {
      node.pulseAim = { x: player.x, y: (player.y ?? 0) + FOUNDRY_TARGET_HEIGHT, z: player.z };
      // A player entering range late still sees the complete warning. The
      // stored cooldown is an earliest-fire time, not permission to skip windup.
      node.acidAt = w.time + FOUNDRY_LASER_WARNING;
    }
  }
  if (w.time < node.acidAt) return;
  const target = node.pulseAim;
  node.pulseAim = undefined;
  node.acidAt = w.time + FOUNDRY_LASER_INTERVAL * Math.max(1, size);
  if (!target || w.projectiles.length >= 100) return;
  const origin = foundryLaserOrigin(node, part, size),
    direction = foundryLaserDirection(origin, target);
  w.projectiles.push({
    id: ++w.serial,
    ...origin,
    dx: direction.x * FOUNDRY_LASER_SPEED,
    dy: direction.y * FOUNDRY_LASER_SPEED,
    dz: direction.z * FOUNDRY_LASER_SPEED,
    gravity: 0,
    life: FOUNDRY_LASER_RANGE / FOUNDRY_LASER_SPEED,
    owner: "enemy",
    damage: FOUNDRY_LASER_DAMAGE * size,
    rocket: false,
    style: "laser",
  });
}

export function moveWorm(w: World, e: Enemy, dt: number) {
  initWorm(e);
  if (!e.segments || e.hp <= 0) return;
  const nodes = wormNodes(e),
    chains = wormChains(e);
  if (nodes.every((node) => node.trailOwner === undefined))
    placeWormOnGround(w, e);
  // Promote all new leaders before moving or releasing any old history.
  for (const parts of chains) {
    const part = parts[0],
      node = nodes[part];
    if (node.trailOwner !== part || !node.trail) {
      const owner = nodes[node.trailOwner ?? part];
      node.trail = owner.trail
        ? historyBefore(owner.trail, node.trailOffset ?? 0)
        : [{ x: node.x, z: node.z }];
      node.heading ??= trailSample(node.trail, 0).heading;
      node.trailOwner = part;
      node.trailOffset = 0;
      node.groundPath = undefined;
      node.groundGoal = undefined;
      node.groundRepathAt = undefined;
    }
  }
  const leaders = new Set(chains.map((parts) => parts[0]));
  for (const [part, node] of nodes.entries())
    if (!leaders.has(part)) {
      node.trail = undefined;
      node.groundPath = undefined;
      node.groundGoal = undefined;
    }
  for (const parts of chains) {
    const leader = nodes[parts[0]];
    moveLeader(w, e, leader, parts[0], parts.length, dt);
    leader.trail = trimHistory(
      leader.trail!,
      parts.length * FOUNDRY_UNIT_PITCH * enemySize(e),
    );
    for (const [offset, part] of parts.entries()) {
      const node = nodes[part];
      if (offset > 0) {
        const sample = trailSample(leader.trail, offset * FOUNDRY_UNIT_PITCH * enemySize(e));
        node.x = sample.point.x;
        node.z = sample.point.z;
        node.heading = sample.heading;
      }
      node.y = supportHeight(node.x,node.z,mapFor(w).blocks);
      node.trailOwner = parts[0];
      node.trailOffset = offset * FOUNDRY_UNIT_PITCH * enemySize(e);
      fireLaser(w, node, part, enemySize(e));
    }
  }
}
