import { CAMPAIGN_COUNT } from "./campaign";
import {
  FRONT_SURVIVAL_BASE_IDS,
  FRONT_V2_UPGRADE_IDS,
  type FrontUpgradeId,
} from "./front-upgrades";

/** 新規データは8種。連射と迎撃の2融合を初日から狙える。 */
export const FRONT_SURVIVAL_STARTERS: readonly FrontUpgradeId[] = [
  "blast-core",
  "armor-piercer",
  "afterimage-mine",
  "interceptor",
  "reload",
  "magazine",
  "armor",
  "magnet",
];
export const FRONT_SURVIVAL_UNLOCKS: readonly {
  stage: number;
  ids: readonly FrontUpgradeId[];
}[] = [
  { stage: 1, ids: ["fuse", "blast-radius", "fire-rounds"] },
  { stage: 2, ids: ["ricochet", "opening-shot", "frost-rounds"] },
  { stage: 3, ids: ["boost-coil", "emergency-armor", "chain-lightning"] },
  { stage: 4, ids: ["recovery-pack", "life-drain"] },
  { stage: 5, ids: ["power-cell", "reserve-rounds"] },
  { stage: 6, ids: ["compressed-charge", "burst-cell"] },
  { stage: 7, ids: ["line-shot", "tactical-reload"] },
];
export interface FrontSurvivalTraining {
  rerolls: number;
  exclusions: number;
}
export interface FrontSurvivalPlan {
  version: 1;
  clearedStage: number;
  legacyCards: boolean;
  training: FrontSurvivalTraining;
  excluded: FrontUpgradeId[];
}
export const emptySurvivalTraining = (): FrontSurvivalTraining => ({
  rerolls: 0,
  exclusions: 0,
});
const integer = (v: unknown, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export function validSurvivalTraining(v: unknown): v is FrontSurvivalTraining {
  if (!v || typeof v !== "object") return false;
  const t = v as FrontSurvivalTraining;
  return (
    integer(t.rerolls, 2) &&
    integer(t.exclusions, 2) &&
    t.rerolls + t.exclusions <= 3
  );
}
export function validSurvivalExclusions(v: unknown): v is FrontUpgradeId[] {
  return (
    Array.isArray(v) &&
    v.length <= 4 &&
    new Set(v).size === v.length &&
    v.every((id) => FRONT_SURVIVAL_BASE_IDS.includes(id))
  );
}
/** 進撃で共通枠、兵士ごとの3pt配分で戦い方を選ぶ。費用なしで振り直せる。 */
export function frontSurvivalProgress(
  clearedStage: number,
  legacyCards = false,
  training = emptySurvivalTraining(),
) {
  if (
    !integer(clearedStage, CAMPAIGN_COUNT) ||
    !validSurvivalTraining(training)
  )
    throw new RangeError("生存の育成設定が不正です");
  const points = [1, 4, 7].filter((n) => clearedStage >= n).length;
  if (training.rerolls + training.exclusions > points)
    throw new RangeError("生存適性の配分ポイントが不足しています");
  const unlocked = new Set<FrontUpgradeId>(
    legacyCards ? FRONT_V2_UPGRADE_IDS : FRONT_SURVIVAL_STARTERS,
  );
  for (const row of FRONT_SURVIVAL_UNLOCKS)
    if (clearedStage >= row.stage) row.ids.forEach((id) => unlocked.add(id));
  if (legacyCards) {
    const oldRewards: FrontUpgradeId[] = [
      "boost-coil",
      "life-drain",
      "recovery-pack",
      "power-cell",
      "burst-cell",
      "reserve-rounds",
    ];
    oldRewards.slice(0, clearedStage).forEach((id) => unlocked.add(id));
  }
  const common = [2, 5].filter((n) => clearedStage >= n).length;
  return {
    unlocked: FRONT_SURVIVAL_BASE_IDS.filter((id) => unlocked.has(id)),
    points,
    rerolls: 1 + common + training.rerolls,
    exclusions: common + training.exclusions,
    next:
      FRONT_SURVIVAL_UNLOCKS.find((row) => row.stage > clearedStage) ?? null,
  };
}
/** 通信でも保存でも、候補と回数を同じ規則から導出する。 */
export function validFrontSurvivalPlan(
  value: unknown,
): value is FrontSurvivalPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as FrontSurvivalPlan;
  if (
    p.version !== 1 ||
    typeof p.legacyCards !== "boolean" ||
    !integer(p.clearedStage, CAMPAIGN_COUNT) ||
    !validSurvivalTraining(p.training) ||
    !validSurvivalExclusions(p.excluded)
  )
    return false;
  try {
    const progress = frontSurvivalProgress(
      p.clearedStage,
      p.legacyCards,
      p.training,
    );
    return (
      p.excluded.length <= progress.exclusions &&
      progress.unlocked.length - p.excluded.length >= 6 &&
      p.excluded.every((id) => progress.unlocked.includes(id))
    );
  } catch {
    return false;
  }
}
export function frontSurvivalPlanLoadout(plan: FrontSurvivalPlan) {
  if (!validFrontSurvivalPlan(plan))
    throw new RangeError("生存の抽選設定が不正です");
  const progress = frontSurvivalProgress(
    plan.clearedStage,
    plan.legacyCards,
    plan.training,
  );
  return {
    ...progress,
    pool: progress.unlocked.filter((id) => !plan.excluded.includes(id)),
  };
}
