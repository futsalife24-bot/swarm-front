import type { Block } from "../shared/defs";
import { wallDistance } from "../shared/game";
import {
  FOUNDRY_LASER_RANGE,
  foundryLaserDirection,
  type FoundryPoint3,
} from "../shared/foundry-defs";

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
