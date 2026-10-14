/** 攻略の確定記録から解放を導出。読取時は移行・書換えを行わない。 */
import {
  FRONT_V2_UPGRADE_IDS,
  isValidFrontUpgradePool,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import {
  loadProgress,
  legacyProgressKey,
  validateProgress,
  initializeProgress,
  persistProgress,
  type ProgressSave,
  bank,
  allWeapons,
  weaponReceiptSnapshot,
} from "./progression-save";
import { campaignNumber, CAMPAIGN_COUNT } from "../shared/campaign";
import { validNewWeapon, type NewWeapon } from "../shared/progression";
import { weaponLevel } from "../shared/weapon-growth";
import { frontSurvivalRewardCount } from "../shared/front-survival";
import { readFrontProgress, type FrontStorage } from "./front-progress";

export const FRONT_CAMPAIGN_UNLOCKS: readonly {
  stage: number;
  ids: readonly FrontUpgradeId[];
}[] = [
  { stage: 1, ids: ["boost-coil"] },
  { stage: 3, ids: ["recovery-pack"] },
  { stage: 5, ids: ["burst-cell"] },
  { stage: 2, ids: ["life-drain"] },
  { stage: 4, ids: ["power-cell"] },
  { stage: 6, ids: ["reserve-rounds"] },
];
export const FRONT_LOADOUT_KEY = "swarm-front-upgrade-loadout-v1";
export function highestClearedStage(save: ProgressSave | null) {
  return Math.max(
    0,
    save?.survival?.highestClearedStage ?? 0,
    ...Object.entries(save?.missions ?? {})
      .filter(([, flags]) => flags[0])
      .map(([key]) => campaignNumber(Number(key.split(":")[0]))),
  );
}
export interface SurvivalSpoils {
  weapons: NewWeapon[];
  kills: number;
  clearedStage: number;
}
function validSpoils(value: SurvivalSpoils) {
  return (
    !!value &&
    Number.isSafeInteger(value.kills) &&
    value.kills >= 0 &&
    Number.isInteger(value.clearedStage) &&
    value.clearedStage >= 0 &&
    value.clearedStage <= CAMPAIGN_COUNT &&
    Array.isArray(value.weapons) &&
    value.weapons.length <= 30 &&
    new Set(value.weapons.map((w) => w.id)).size === value.weapons.length &&
    value.weapons.every(
      (w) =>
        validNewWeapon(w) &&
        !w.testData &&
        weaponLevel(w) === Math.min(60, 1 + value.clearedStage),
    )
  );
}
function validSpoilsForRun(
  run: string,
  seconds: number,
  spoils: SurvivalSpoils,
) {
  return (
    validSpoils(spoils) &&
    seconds <= 3601 &&
    spoils.weapons.length <= frontSurvivalRewardCount(seconds, spoils.kills) &&
    spoils.weapons.every((w) =>
      w.id.startsWith(`${run.slice(0, 48)}-survival-`),
    )
  );
}
export function readFrontCampaign(storage: FrontStorage) {
  try {
    let save = loadProgress("normal", {
      getItem: (key) => storage.getItem(key),
    });
    if (!save) {
      const old = storage.getItem(legacyProgressKey);
      if (old !== null) {
        save = validateProgress(JSON.parse(old));
        if (save.mode !== "normal") throw new Error("保存モード不一致");
      }
    }
    const progress = readFrontProgress(storage);
    if (progress.error) throw new Error(progress.error);
    const unlocked = [...FRONT_V2_UPGRADE_IDS]; // 従来の候補は没収しない。
    for (const rule of FRONT_CAMPAIGN_UNLOCKS)
      if (
        Object.entries(save?.missions ?? {}).some(
          ([key, flags]) => key.startsWith(`${rule.stage}:`) && flags[0],
        )
      )
        unlocked.push(...rule.ids);
    return {
      save,
      unlocked,
      error: "",
    };
  } catch {
    return {
      save: null,
      unlocked: [...FRONT_V2_UPGRADE_IDS],
      error: "攻略の保存を読み込めません。既存データは保持しています。",
    };
  }
}
export interface FrontLoadout {
  pool: FrontUpgradeId[];
}
export function readFrontLoadout(
  storage: FrontStorage,
): FrontLoadout & { error: string } {
  const campaign = readFrontCampaign(storage);
  const fallback = {
    pool: campaign.unlocked,
  };
  try {
    const raw = storage.getItem(FRONT_LOADOUT_KEY);
    if (raw === null) return { ...fallback, error: campaign.error };
    const value = JSON.parse(raw) as FrontLoadout;
    // 旧保存のinitialCardsは読取時に無視。チェック内容を増やさず、元データも書き換えない。
    if (!isValidFrontUpgradePool(value?.pool)) throw new Error();
    const pool = value.pool.filter((id) => campaign.unlocked.includes(id));
    if (pool.length < 6) throw new Error();
    return { pool, error: campaign.error };
  } catch {
    return {
      ...fallback,
      error:
        "候補設定を読み込めません。保存内容を上書きせず標準候補を使います。",
    };
  }
}
export function validateFrontLoadout(
  storage: FrontStorage,
  value: FrontLoadout,
) {
  const current = readFrontLoadout(storage);
  if (current.error) throw new Error(current.error);
  const campaign = readFrontCampaign(storage);
  if (
    !isValidFrontUpgradePool(value?.pool) ||
    !value.pool.every((id) => campaign.unlocked.includes(id))
  )
    throw new Error("解放済みの強化候補を6種類以上選んでください。");
}
export function saveFrontLoadout(storage: FrontStorage, value: FrontLoadout) {
  validateFrontLoadout(storage, value);
  storage.setItem(FRONT_LOADOUT_KEY, JSON.stringify({ pool: [...value.pool] }));
}
/** 共有保存と同じ排他権・改訂番号・受取記録を使い、コインと受取済みを一括保存。 */
export function awardFrontCampaign(
  storage: FrontStorage,
  runId: string,
  seconds: number,
  spoils?: SurvivalSpoils,
) {
  if (!runId || runId.length > 128 || !Number.isFinite(seconds) || seconds < 0)
    throw new Error("生存結果が不正です");
  if (spoils && !validSpoilsForRun(runId, seconds, spoils))
    throw Error("生存武器の結果が不正です。");
  const current = readFrontCampaign(storage);
  if (current.error) throw new Error(current.error);
  const save: ProgressSave =
    loadProgress("normal", storage) ?? initializeProgress("normal", storage);
  const receipt = `front-survival:${runId}`;
  if (
    save.receipts.includes(receipt) &&
    (!spoils || save.receipts.includes(`${receipt}:weapons`))
  )
    return 0;
  const coins = frontCampaignCoins(seconds);
  const next = structuredClone(save);
  const addedCoins = save.receipts.includes(receipt) ? 0 : coins;
  if (!save.receipts.includes(receipt)) {
    next.coins += coins;
    next.receipts.push(receipt);
  }
  if (spoils && !next.receipts.includes(`${receipt}:weapons`)) {
    const known = new Set([
      ...(next.weaponReceipts?.ids ?? []),
      ...allWeapons(next).map((w) => w.id),
    ]);
    const weapons = spoils.weapons
      .filter((w) => !known.has(w.id))
      .map((w) => ({ ...structuredClone(w), acquired: next.serial++ }));
    bank(next, weapons);
    const old = next.survival ?? {
      bestSeconds: 0,
      bestKills: 0,
      runs: 0,
      weapons: 0,
      highestClearedStage: 0,
    };
    next.survival = {
      bestSeconds: Math.max(old.bestSeconds, seconds),
      bestKills: Math.max(old.bestKills, spoils.kills),
      runs: old.runs + 1,
      weapons: old.weapons + weapons.length,
      highestClearedStage: Math.max(
        old.highestClearedStage,
        spoils.clearedStage,
      ),
    };
    next.receipts.push(`${receipt}:weapons`);
    next.weaponReceipts = weaponReceiptSnapshot(next);
  }
  persistProgress(next, storage);
  return addedCoins;
}
export function frontCampaignCoins(seconds: number) {
  return Math.min(300, Math.floor(seconds / 60) * 10);
}
export const FRONT_PENDING_REWARDS_KEY = "swarm-front-survival-pending-v1";
type PendingReward = {
  runId: string;
  seconds: number;
  spoils?: SurvivalSpoils;
};
function readPendingRewards(storage: FrontStorage): PendingReward[] {
  const raw = storage.getItem(FRONT_PENDING_REWARDS_KEY);
  if (raw === null) return [];
  const list = JSON.parse(raw);
  if (
    !Array.isArray(list) ||
    list.length > 64 ||
    new Set(list.map((r) => r?.runId)).size !== list.length ||
    !list.every(
      (r) =>
        r &&
        typeof r.runId === "string" &&
        r.runId.length > 0 &&
        r.runId.length <= 128 &&
        Number.isFinite(r.seconds) &&
        r.seconds >= 0 &&
        (r.spoils === undefined ||
          validSpoilsForRun(r.runId, r.seconds, r.spoils)),
    )
  )
    throw new Error("未保存の戦果を読めません。元データを保持しています。");
  return list;
}
export function recoverFrontCampaignRewards(storage: FrontStorage) {
  const pending = readPendingRewards(storage);
  let total = 0;
  for (const result of [...pending]) {
    total += awardFrontCampaign(
      storage,
      result.runId,
      result.seconds,
      result.spoils,
    );
    pending.shift();
    storage.setItem(FRONT_PENDING_REWARDS_KEY, JSON.stringify(pending));
  }
  return total;
}
export function queueFrontCampaignReward(
  storage: FrontStorage,
  runId: string,
  seconds: number,
  spoils?: SurvivalSpoils,
) {
  if (!runId || runId.length > 128 || !Number.isFinite(seconds) || seconds < 0)
    throw new Error("生存結果が不正です");
  if (spoils && !validSpoilsForRun(runId, seconds, spoils))
    throw Error("生存武器の結果が不正です。");
  const pending = readPendingRewards(storage);
  if (!pending.some((r) => r.runId === runId)) {
    if (pending.length >= 64)
      throw new Error("未保存の戦果がいっぱいです。保存を再試行してください。");
    pending.push({
      runId,
      seconds,
      ...(spoils ? { spoils: structuredClone(spoils) } : {}),
    });
    storage.setItem(FRONT_PENDING_REWARDS_KEY, JSON.stringify(pending));
  }
  return recoverFrontCampaignRewards(storage);
}
