/** Authored repeating roster: independent of run seed, stage, shots and loot. */
const SIZES = [
  1, 0.85, 1.15, 0.95, 1.3, 0.8, 1.05, 1.5, 0.9, 1.1, 1, 1.2, 0.95, 1.4, 1,
  1.15, 0.9, 1.05, 0.85, 1.2, 1, 0.95, 1.75, 1.1, 0.8, 1.05, 1.3, 0.9, 1, 1.2,
  0.95, 2,
] as const;
export const enemySize = (enemy: { size?: number }) => enemy.size ?? 1;
export function spawnSize(kind: string, worm: boolean, ordinal: number) {
  return kind === "boss" && !worm ? 2 : SIZES[ordinal % SIZES.length];
}

export const enemySpeedFactor = (enemy: { size?: number }) =>
  enemySize(enemy) <= 1 ? 1.5 : 1;
