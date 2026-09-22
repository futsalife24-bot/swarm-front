/** Save id 21 has always meant 3-A. Never reuse it for normal ST21. */
export const BRANCH_3 = 21;
export const BRANCH_15 = 27;
export const CAMPAIGN_COUNT = 25;
export const normalSaveId = (number: number) =>
  number <= 20 ? number : number + 1;
export const campaignNumber = (id: number) =>
  id === BRANCH_3 ? 3 : id === BRANCH_15 ? 15 : id > 21 ? id - 1 : id;
export const isBranch = (id: number) => id === BRANCH_3 || id === BRANCH_15;
export const SOLO_STAGE_IDS = Array.from({ length: CAMPAIGN_COUNT }, (_, i) =>
  normalSaveId(i + 1),
).flatMap((id) =>
  id === 3 ? [id, BRANCH_3] : id === 15 ? [id, BRANCH_15] : [id],
);
export const validSoloStage = (id: number) =>
  Number.isInteger(id) && SOLO_STAGE_IDS.includes(id);
export function soloUnlocked(
  save: { mode: string; branch: boolean; missions: Record<string, boolean[]> },
  id: number,
) {
  if (!validSoloStage(id)) return false;
  if (save.mode === "test") return true;
  if (id === BRANCH_3) return save.branch;
  if (id === BRANCH_15) return !!save.missions["15:normal"]?.[0];
  return (
    id === 1 ||
    !!save.missions[`${normalSaveId(campaignNumber(id) - 1)}:normal`]?.[0]
  );
}
