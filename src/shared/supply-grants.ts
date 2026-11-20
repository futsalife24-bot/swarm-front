import { campaignNumber, SOLO_STAGE_IDS } from "./campaign";
export const SUPPLY_GRANTS = {
  firstClear: 3,
  star: 1,
  frontStage: 2,
  weeklyClear: 1,
  weeklyClearCap: 10,
  dailyFirstClear: 1,
  weekly: { "campaign-3": 2, "campaign-10": 5, "defense-3": 3 },
} as const;
export type SupplyProgress = {
  earned: number;
  missions: Record<string, unknown>;
};
/** Only the finite stage/difficulty roster is eligible; arbitrary uploaded keys cannot mint tickets. */
export function supplyMilestones(missions: Record<string, unknown>) {
  const grants: { id: string; tickets: number }[] = [];
  let highest = 0;
  for (const stage of SOLO_STAGE_IDS)
    for (const difficulty of ["normal", "medium"]) {
      const key = `${stage}:${difficulty}`,
        stars = missions[key];
      if (!Array.isArray(stars) || stars[0] !== true) continue;
      grants.push({ id: `first:${key}`, tickets: SUPPLY_GRANTS.firstClear });
      highest = Math.max(highest, campaignNumber(stage));
      for (const index of [1, 2])
        if (stars[index] === true)
          grants.push({
            id: `star:${key}:${index}`,
            tickets: SUPPLY_GRANTS.star,
          });
    }
  for (let stage = 1; stage <= highest; stage++)
    grants.push({ id: `front:${stage}`, tickets: SUPPLY_GRANTS.frontStage });
  return grants;
}
export const weeklySupplyTickets = (id: string) =>
  SUPPLY_GRANTS.weekly[id as keyof typeof SUPPLY_GRANTS.weekly] ?? 0;
