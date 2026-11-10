import { CAMPAIGN_COUNT } from "./campaign";
import { rollWeapon, type NewWeapon } from "./progression";
import { random, type World } from "./game";

/** A cleared campaign stage, not the stage currently selected in the lobby. */
export function validFrontClearedStage(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= CAMPAIGN_COUNT
  );
}

export const frontSurvivalWeaponLevel = (clearedStage: number) =>
  Math.min(60, 1 + clearedStage);

/** Difficulty is captured at sortie; it cannot change as the campaign advances. */
export function frontSurvivalDifficulty(clearedStage: number) {
  if (!validFrontClearedStage(clearedStage))
    throw new RangeError("Invalid cleared campaign stage");
  return {
    clearedStage,
    weaponLevel: frontSurvivalWeaponLevel(clearedStage),
    hpScale: 1.25 + clearedStage * 0.07,
    damageScale: 1.3 + clearedStage * 0.045,
    spawnScale: 1.25 + clearedStage * 0.04,
  };
}

/** Survival-only pressure that keeps rising every two minutes of the run. */
export function frontSurvivalTimeScale(seconds: number) {
  const steps = Math.floor(Math.max(0, seconds) / 120);
  return { hp: 1 + steps * 0.35, damage: 1 + steps * 0.08 };
}

/** New one-weapon survival pressure depends only on battle time, not campaign clears. */
export function frontDedicatedSurvivalScale(seconds: number) {
  const minutes = Math.max(0, seconds) / 60;
  const early = Math.min(5, minutes);
  const late = Math.max(0, minutes - 5);
  return {
    hp: 1.05 + early * 0.11 + late * 0.06,
    damage: 0.85 + early * 0.05 + late * 0.02,
    spawn: 0.85 + early * 0.05 + late * 0.015,
  };
}

/** One weapon per minute, plus one per 30 kills after a minute and a kill. */
export function frontSurvivalRewardCount(seconds: number, kills: number) {
  if (!Number.isFinite(seconds) || !Number.isFinite(kills)) return 0;
  if (seconds < 60 || kills < 1) return 0;
  const minutes = Math.floor(seconds / 60);
  return Math.min(30, minutes + Math.floor(Math.max(0, kills) / 30));
}

/** Finalize exactly once after World.finish has cleared transient loot. */
export function finalizeFrontSurvivalRewards(
  world: World,
  clearedStage: number,
  eligibleIds: readonly string[],
  counts?: Readonly<Record<string, number>>,
) {
  if (!validFrontClearedStage(clearedStage))
    throw new RangeError("Invalid cleared campaign stage");
  if (world.phase === "battle" || world.phase === "lobby") return;
  const eligible = new Set(eligibleIds);
  for (const [playerIndex, player] of world.players.entries()) {
    if (!eligible.has(player.id) || world.rewards[player.id]) continue;
    const requested = counts
      ? (counts[player.id] ?? 0)
      : frontSurvivalRewardCount(world.time, player.kills);
    const count =
      Number.isInteger(requested) && requested >= 0 && requested <= 30
        ? requested
        : 0;
    const level = frontSurvivalWeaponLevel(clearedStage);
    world.rewards[player.id] = Array.from({ length: count }, (_, index) => ({
      ...rollWeapon(
        `${world.run.slice(0, 48)}-survival-${playerIndex}-${index}`,
        Math.max(1, clearedStage),
        "normal",
        false,
        index,
        () => random(world),
      ),
      level,
    })) as NewWeapon[];
  }
}
