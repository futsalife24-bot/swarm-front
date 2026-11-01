import { enemySize } from "./enemy-size";

/** Negotiated pose v1: up and poseForward only, after wire rounding. */
export function isPleatPoseTuple(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 6 &&
    value.every(
      (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1.01,
    ) &&
    Math.hypot(...value.slice(0, 3)) > 0.1 &&
    Math.hypot(...value.slice(3)) > 0.1
  );
}

/** Restore only presentation data; never feed this projection to authority/save. */
export function restorePleatPose(enemy: Record<string, any>, compact: boolean) {
  if (!Array.isArray(enemy.pleat)) return enemy;
  if (
    !compact ||
    enemy.kind !== "crawler" ||
    !isPleatPoseTuple(enemy.pleat) ||
    ![enemy.x, enemy.y, enemy.z].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    (enemy.size !== undefined &&
      (typeof enemy.size !== "number" ||
        !Number.isFinite(enemy.size) ||
        enemy.size <= 0))
  )
    throw new Error("invalid PLEAT pose");
  const [ux, uy, uz, fx, fy, fz] = enemy.pleat;
  const scale = enemySize(enemy);
  return {
    ...enemy,
    pleat: {
      body: { x: enemy.x, y: enemy.y + 0.8 * scale, z: enemy.z },
      up: { x: ux, y: uy, z: uz },
      poseForward: { x: fx, y: fy, z: fz },
      forward: { x: fx, y: fy, z: fz },
      scale,
    },
  };
}
