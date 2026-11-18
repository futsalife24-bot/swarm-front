import type { Block } from "../shared/defs";
import type { WormNode } from "../shared/worm";
import { redWarningDuringWind } from "./attack-telegraph";
import { wallDistance } from "../shared/game";
import {
  FOUNDRY_LASER_RANGE,
  FOUNDRY_LASER_WARNING,
  foundryLaserDirection,
  foundryLaserOrigin,
  type FoundryPoint3,
} from "../shared/foundry-defs";

export const foundryWarningMaterial = {
  color: 0xff4054,
  transparent: true,
  opacity: 0.36,
  depthWrite: false,
};

export function foundryWarningPose(
  node: WormNode,
  part: number,
  size: number,
  time: number,
  blocks: Block[],
) {
  const remaining = (node.acidAt ?? time) - time;
  if (
    !node.pulseAim ||
    node.partHp === 0 ||
    !redWarningDuringWind(remaining, FOUNDRY_LASER_WARNING)
  )
    return;
  const origin = foundryLaserOrigin(node, part, size);
  const { to, length } = foundryLaserWarningLine(origin, node.pulseAim, blocks);
  if (length <= 0) return;
  const dx = to.x - origin.x,
    dy = to.y - origin.y,
    dz = to.z - origin.z;
  return {
    x: origin.x + dx / 2,
    y: origin.y + dy / 2,
    z: origin.z + dz / 2,
    // A player centre within 1 m of the ray is inside the danger corridor.
    width: 2,
    height: 0.06 + 0.04 * (1 - remaining / FOUNDRY_LASER_WARNING),
    length,
    pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
    yaw: Math.atan2(dx, dz),
  };
}

/** Preview the laser's full swept range, stopping where the authoritative shot stops. */
export function foundryLaserWarningLine(
  origin: FoundryPoint3,
  target: { x: number; y?: number; z: number },
  blocks: Block[],
) {
  const direction = foundryLaserDirection(origin, target);
  let length = wallDistance(
    origin.x,
    origin.y,
    origin.z,
    direction.x,
    direction.y,
    direction.z,
    FOUNDRY_LASER_RANGE,
    blocks,
  );
  if (direction.y < 0)
    length = Math.min(length, Math.max(0, -origin.y / direction.y));
  return {
    from: origin,
    to: {
      x: origin.x + direction.x * length,
      y: origin.y + direction.y * length,
      z: origin.z + direction.z * length,
    },
    length,
  };
}
