/** Approved FOUNDRY ZERO combat and model-space contract. */
export const FOUNDRY_SPEED = 4.2;
export const FOUNDRY_FRACTURED_SPEED = 6.3;
export const FOUNDRY_UNIT_PITCH = 3.2;
export const FOUNDRY_LASER_WARNING = 0.8;
export const FOUNDRY_LASER_INTERVAL = 4.8;
export const FOUNDRY_LASER_DAMAGE = 10;
export const FOUNDRY_LASER_SPEED = 60;
export const FOUNDRY_LASER_RANGE = 100;
export const FOUNDRY_TARGET_HEIGHT = 1.2;
export const FOUNDRY_HEAD_MUZZLE = { x: 0, y: 1.65, z: -1.66 } as const;
export const FOUNDRY_BODY_MUZZLE = { x: 0, y: 2.68, z: -0.62 } as const;

export type FoundryPoint3 = { x: number; y: number; z: number };

// Both GLB optics pivot at their muzzle. Aiming the visible barrel therefore
// cannot move the authoritative origin. Model forward is local -Z.
export function foundryLaserOrigin(
  node: FoundryPoint3 & { heading?: number },
  part: number,
  size = 1,
): FoundryPoint3 {
  const local = part === 0 ? FOUNDRY_HEAD_MUZZLE : FOUNDRY_BODY_MUZZLE;
  const yaw = (node.heading ?? 0) + Math.PI;
  return {
    x: node.x + size * (local.x * Math.cos(yaw) + local.z * Math.sin(yaw)),
    y: node.y + local.y * size,
    z: node.z + size * (-local.x * Math.sin(yaw) + local.z * Math.cos(yaw)),
  };
}

export function foundryLaserDirection(
  origin: FoundryPoint3,
  target: { x: number; y?: number; z: number },
): FoundryPoint3 {
  const x = target.x - origin.x;
  const y = (target.y ?? FOUNDRY_TARGET_HEIGHT) - origin.y;
  const z = target.z - origin.z;
  const length = Math.hypot(x, y, z);
  return length > 1e-8
    ? { x: x / length, y: y / length, z: z / length }
    : { x: 0, y: 0, z: 1 };
}
