/** 攻略の確定記録から解放を導出。読取時は移行・書換えを行わない。 */
import {
  FRONT_BASE_IDS,
  FRONT_INITIAL_CARDS,
  FRONT_V2_UPGRADE_IDS,
  FRONT_FAMILY_CARDS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import {
  loadProgress,
  legacyProgressKey,
  validateProgress,
  initializeProgress,
  persistProgress,
  type ProgressSave,
} from "./progression-save";
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
      initialUnlocked: progress.progress.unlocks,
      error: "",
    };
  } catch {
    return {
      save: null,
      unlocked: [...FRONT_V2_UPGRADE_IDS],
      initialUnlocked: [...FRONT_INITIAL_CARDS],
      error: "攻略の保存を読み込めません。既存データは保持しています。",
    };
  }
}
export interface FrontLoadout {
  pool: FrontUpgradeId[];
  initialCards: FrontUpgradeId[];
}
export function readFrontLoadout(
  storage: FrontStorage,
): FrontLoadout & { error: string } {
  const campaign = readFrontCampaign(storage);
  const fallback = {
    pool: campaign.unlocked,
    initialCards: [...FRONT_INITIAL_CARDS],
  };
  try {
    const raw = storage.getItem(FRONT_LOADOUT_KEY);
    if (raw === null) return { ...fallback, error: campaign.error };
    const value = JSON.parse(raw) as FrontLoadout;
    if (
      !Array.isArray(value.pool) ||
      !value.pool.every((id) => FRONT_BASE_IDS.includes(id)) ||
      new Set(value.pool).size !== value.pool.length ||
      !Array.isArray(value.initialCards) ||
      value.initialCards.length !== 3 ||
      !Object.values(FRONT_FAMILY_CARDS).every(
        (ids) =>
          value.initialCards.filter((id) => ids.includes(id)).length === 1,
      )
    )
      throw new Error();
    const initialCards = value.initialCards.map((id, i) =>
      campaign.initialUnlocked.includes(id) ? id : FRONT_INITIAL_CARDS[i],
    );
    const pool = [
      ...new Set([
        ...value.pool.filter((id) => campaign.unlocked.includes(id)),
        ...initialCards,
      ]),
    ];
    if (pool.length < 6) throw new Error();
    return { pool, initialCards, error: campaign.error };
  } catch {
    return {
      ...fallback,
      error:
        "候補設定を読み込めません。保存内容を上書きせず標準候補を使います。",
    };
  }
}
export function saveFrontLoadout(storage: FrontStorage, value: FrontLoadout) {
  const current = readFrontLoadout(storage);
  if (current.error) throw new Error(current.error);
  const campaign = readFrontCampaign(storage);
  if (
    value.pool.length < 6 ||
    value.pool.length > FRONT_BASE_IDS.length ||
    new Set(value.pool).size !== value.pool.length ||
    !value.pool.every((id) => campaign.unlocked.includes(id)) ||
    value.initialCards.length !== 3 ||
    !Object.values(FRONT_FAMILY_CARDS).every(
      (ids) => value.initialCards.filter((id) => ids.includes(id)).length === 1,
    ) ||
    !value.initialCards.every(
      (id) => value.pool.includes(id) && campaign.initialUnlocked.includes(id),
    )
  )
    throw new Error("候補は6種類以上、初期候補は各系統1つを選んでください。");
  storage.setItem(FRONT_LOADOUT_KEY, JSON.stringify(value));
}
/** 共有保存と同じ排他権・改訂番号・受取記録を使い、コインと受取済みを一括保存。 */
export function awardFrontCampaign(
  storage: FrontStorage,
  runId: string,
  seconds: number,
) {
  if (!runId || runId.length > 128 || !Number.isFinite(seconds) || seconds < 0)
    throw new Error("生存結果が不正です");
  const current = readFrontCampaign(storage);
  if (current.error) throw new Error(current.error);
  const save: ProgressSave =
    loadProgress("normal", storage) ?? initializeProgress("normal", storage);
  const receipt = `front-survival:${runId}`;
  if (save.receipts.includes(receipt)) return 0;
  const coins = Math.min(300, Math.floor(seconds / 60) * 10);
  const next = structuredClone(save);
  next.coins += coins;
  next.receipts.push(receipt);
  persistProgress(next, storage);
  return coins;
}
export const FRONT_PENDING_REWARDS_KEY = "swarm-front-survival-pending-v1";
type PendingReward = { runId: string; seconds: number };
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
        r.seconds >= 0,
    )
  )
    throw new Error("未保存の戦果を読めません。元データを保持しています。");
  return list;
}
export function recoverFrontCampaignRewards(storage: FrontStorage) {
  const pending = readPendingRewards(storage);
  let total = 0;
  for (const result of [...pending]) {
    total += awardFrontCampaign(storage, result.runId, result.seconds);
    pending.shift();
    storage.setItem(FRONT_PENDING_REWARDS_KEY, JSON.stringify(pending));
  }
  return total;
}
export function queueFrontCampaignReward(
  storage: FrontStorage,
  runId: string,
  seconds: number,
) {
  if (!runId || runId.length > 128 || !Number.isFinite(seconds) || seconds < 0)
    throw new Error("生存結果が不正です");
  const pending = readPendingRewards(storage);
  if (!pending.some((r) => r.runId === runId)) {
    if (pending.length >= 64)
      throw new Error("未保存の戦果がいっぱいです。保存を再試行してください。");
    pending.push({ runId, seconds });
    storage.setItem(FRONT_PENDING_REWARDS_KEY, JSON.stringify(pending));
  }
  return recoverFrontCampaignRewards(storage);
}
