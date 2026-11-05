import { campaignNumber, SOLO_STAGE_IDS, validSoloStage } from "./campaign";

export const BUDDY_IDS = ["tatara", "yosuga", "tobari", "oriha"] as const;
export type BuddyId = (typeof BUDDY_IDS)[number];
/** 初期調整値。攻撃成長は最大19.5%。支援量・時間には適用しない。 */
export const BUDDY_LEVEL_CAPS = [10, 20, 30, 40] as const;
export const BUDDY_BREAKTHROUGH_COSTS = [3, 6, 10] as const;
export const BUDDY_RECRUIT_RULES = {
  ticketCost: 1,
  /** 4連続被りの後、次の1回は未所持保証。 */
  pityDuplicateLimit: 4,
  duplicateFragments: 1,
  firstClearTickets: 2,
  repeatUnitsPerTicket: 3,
} as const;
const MAX_LEDGER = 10000;
const MAX_CURRENCY = 1000000;
export interface BuddyGrowth {
  xp: number;
  breakthrough: number;
}
export interface BuddyDrawReceipt {
  requestId: string;
  buddyId: BuddyId;
  duplicate: boolean;
  guaranteed: boolean;
}
export interface BuddyProgress {
  version: 1;
  owned: Partial<Record<BuddyId, BuddyGrowth>>;
  selected: BuddyId | null;
  starterChosen: boolean;
  tickets: number;
  fragments: number;
  repeatUnits: number;
  pity: number;
  clearedStages: number[];
  runs: string[];
  draws: BuddyDrawReceipt[];
}
const integer = (v: unknown, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
export const isBuddyId = (v: unknown): v is BuddyId =>
  typeof v === "string" && BUDDY_IDS.includes(v as BuddyId);
const key = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9:_-]{1,120}$/.test(v);
export const buddyXpForLevel = (level: number) => {
  if (!integer(level, 40) || level === 0) throw Error("バディレベルが不正です");
  return 20 * (level - 1) ** 2;
};
export const buddyLevel = (growth: BuddyGrowth) => {
  if (
    !integer(growth.breakthrough, 3) ||
    !integer(growth.xp, buddyXpForLevel(40))
  )
    throw Error("バディ育成情報が不正です");
  return Math.min(
    BUDDY_LEVEL_CAPS[growth.breakthrough],
    1 + Math.floor(Math.sqrt(growth.xp / 20)),
  );
};
export const buddyGrowthFactor = (level: number) => {
  buddyXpForLevel(level);
  return 1 + (level - 1) * 0.005;
};
export const freshBuddyProgress = (): BuddyProgress => ({
  version: 1,
  owned: {},
  selected: null,
  starterChosen: false,
  tickets: 0,
  fragments: 0,
  repeatUnits: 0,
  pity: 0,
  clearedStages: [],
  runs: [],
  draws: [],
});
/** 旧保存の未指定は呼出側でfreshへ。壊れた値を黙って新規化しない。 */
export function validBuddyProgress(value: unknown): value is BuddyProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as BuddyProgress;
  if (
    p.version !== 1 ||
    !p.owned ||
    typeof p.owned !== "object" ||
    Array.isArray(p.owned) ||
    Object.keys(p.owned).some((id) => !isBuddyId(id)) ||
    typeof p.starterChosen !== "boolean" ||
    !integer(p.tickets, MAX_CURRENCY) ||
    !integer(p.fragments, MAX_CURRENCY) ||
    !integer(p.repeatUnits, BUDDY_RECRUIT_RULES.repeatUnitsPerTicket - 1) ||
    !integer(p.pity, BUDDY_RECRUIT_RULES.pityDuplicateLimit) ||
    !Array.isArray(p.clearedStages) ||
    p.clearedStages.length > SOLO_STAGE_IDS.length ||
    !p.clearedStages.every(validSoloStage) ||
    new Set(p.clearedStages).size !== p.clearedStages.length ||
    !Array.isArray(p.runs) ||
    p.runs.length > MAX_LEDGER ||
    !p.runs.every(key) ||
    new Set(p.runs).size !== p.runs.length ||
    !Array.isArray(p.draws) ||
    p.draws.length > MAX_LEDGER ||
    !p.draws.every(
      (r) =>
        r &&
        key(r.requestId) &&
        isBuddyId(r.buddyId) &&
        typeof r.duplicate === "boolean" &&
        typeof r.guaranteed === "boolean",
    ) ||
    new Set(p.draws.map((r) => r.requestId)).size !== p.draws.length
  )
    return false;
  if (p.selected !== null && (!isBuddyId(p.selected) || !p.owned[p.selected]))
    return false;
  const owned = Object.values(p.owned);
  if (
    p.starterChosen !== owned.length > 0 ||
    (!p.starterChosen && p.draws.length > 0)
  )
    return false;
  return owned.every(
    (g) =>
      g &&
      integer(g.breakthrough, 3) &&
      integer(g.xp, buddyXpForLevel(BUDDY_LEVEL_CAPS[g.breakthrough])),
  );
}
function assertProgress(p: BuddyProgress) {
  if (!validBuddyProgress(p)) throw Error("バディ保存が不正です");
}
function copy(p: BuddyProgress): BuddyProgress {
  assertProgress(p);
  return structuredClone(p);
}
function addCurrency(value: number, amount: number) {
  const next = value + amount;
  if (!integer(next, MAX_CURRENCY)) throw Error("バディ通貨の保存上限です");
  return next;
}
export function chooseStarterBuddy(progress: BuddyProgress, id: BuddyId) {
  const p = copy(progress);
  if (!isBuddyId(id) || p.starterChosen)
    throw Error("初回バディは選択済みか不正です");
  p.owned[id] = { xp: 0, breakthrough: 0 };
  p.selected = id;
  p.starterChosen = true;
  return p;
}
/** 出撃中変更の禁止は呼出側の作戦状態で検査する。 */
export function equipBuddy(progress: BuddyProgress, id: BuddyId | null) {
  const p = copy(progress);
  if (id !== null && (!isBuddyId(id) || !p.owned[id]))
    throw Error("未所持のバディです");
  p.selected = id;
  return p;
}
/** 全所持中の保証カウントは未決のため、製品の呼出元で明示選択が必要。 */
export function drawBuddy(
  progress: BuddyProgress,
  requestId: string,
  rng: () => number,
  policy: { allOwnedPity: "reset" | "freeze" },
): { progress: BuddyProgress; receipt: BuddyDrawReceipt; replayed: boolean } {
  assertProgress(progress);
  if (!key(requestId) || !["reset", "freeze"].includes(policy?.allOwnedPity))
    throw Error("バディ抽選要求が不正です");
  const previous = progress.draws.find((r) => r.requestId === requestId);
  if (previous) return { progress, receipt: previous, replayed: true };
  if (
    !progress.starterChosen ||
    progress.tickets < BUDDY_RECRUIT_RULES.ticketCost
  )
    throw Error("初回選択またはチケットが必要です");
  if (progress.draws.length === MAX_LEDGER)
    throw Error("抽選記録の保存上限です");
  const missing = BUDDY_IDS.filter((id) => !progress.owned[id]);
  const guaranteed =
    missing.length > 0 &&
    progress.pity >= BUDDY_RECRUIT_RULES.pityDuplicateLimit;
  const pool = guaranteed ? missing : BUDDY_IDS;
  const random = rng();
  if (!Number.isFinite(random) || random < 0 || random >= 1)
    throw Error("抽選乱数が不正です");
  const buddyId = pool[Math.floor(random * pool.length)];
  const duplicate = !!progress.owned[buddyId];
  const p = copy(progress);
  p.tickets -= BUDDY_RECRUIT_RULES.ticketCost;
  if (duplicate)
    p.fragments = addCurrency(
      p.fragments,
      BUDDY_RECRUIT_RULES.duplicateFragments,
    );
  else p.owned[buddyId] = { xp: 0, breakthrough: 0 };
  p.pity =
    missing.length === 0
      ? policy.allOwnedPity === "reset"
        ? 0
        : p.pity
      : duplicate
        ? Math.min(BUDDY_RECRUIT_RULES.pityDuplicateLimit, p.pity + 1)
        : 0;
  const receipt = { requestId, buddyId, duplicate, guaranteed };
  p.draws.push(receipt);
  return { progress: p, receipt, replayed: false };
}
export interface BuddyRunReward {
  /** 権威側の戦果ID。HTTP/WS再送でも同じIDにする。 */
  run: string;
  stage: number;
  win: boolean;
  /** 作戦開始時に固定した同行者。終了時の画面選択を使わない。 */
  buddyId: BuddyId | null;
  /** 反復クリアの重み。通常1で3クリア1枚。難度別調整は呼出側の設定。 */
  repeatUnits: number;
}
/** 進撃専用の戦果処理からのみ呼ぶ。勝敗・stage・runはUI申告を信用しない。 */
export function settleBuddyRun(
  progress: BuddyProgress,
  reward: BuddyRunReward,
) {
  assertProgress(progress);
  if (
    !key(reward.run) ||
    !validSoloStage(reward.stage) ||
    typeof reward.win !== "boolean" ||
    !integer(reward.repeatUnits, BUDDY_RECRUIT_RULES.repeatUnitsPerTicket) ||
    (reward.buddyId !== null &&
      (!isBuddyId(reward.buddyId) || !progress.owned[reward.buddyId]))
  )
    throw Error("バディ戦果が不正です");
  if (progress.runs.includes(reward.run)) return progress;
  if (progress.runs.length === MAX_LEDGER)
    throw Error("バディ戦果の保存上限です");
  const p = copy(progress);
  p.runs.push(reward.run);
  if (reward.buddyId) {
    const growth = p.owned[reward.buddyId]!;
    // 即リタイアの繰返しによる育成を避け、初期調整は勝利時のみ付与。
    const xp = reward.win ? 100 + 10 * campaignNumber(reward.stage) : 0;
    growth.xp = Math.min(
      buddyXpForLevel(BUDDY_LEVEL_CAPS[growth.breakthrough]),
      growth.xp + xp,
    );
  }
  if (!reward.win) return p;
  if (!p.clearedStages.includes(reward.stage)) {
    p.clearedStages.push(reward.stage);
    p.tickets = addCurrency(p.tickets, BUDDY_RECRUIT_RULES.firstClearTickets);
    p.fragments = addCurrency(p.fragments, 1);
  } else {
    const units = p.repeatUnits + reward.repeatUnits;
    p.repeatUnits = units % BUDDY_RECRUIT_RULES.repeatUnitsPerTicket;
    p.tickets = addCurrency(
      p.tickets,
      Math.floor(units / BUDDY_RECRUIT_RULES.repeatUnitsPerTicket),
    );
    p.fragments = addCurrency(
      p.fragments,
      Math.floor(units / BUDDY_RECRUIT_RULES.repeatUnitsPerTicket),
    );
  }
  return p;
}
export function breakthroughBuddy(progress: BuddyProgress, id: BuddyId) {
  const p = copy(progress);
  const growth = isBuddyId(id) ? p.owned[id] : undefined;
  if (!growth || growth.breakthrough >= 3)
    throw Error("限界突破できないバディです");
  const cost = BUDDY_BREAKTHROUGH_COSTS[growth.breakthrough];
  if (
    buddyLevel(growth) !== BUDDY_LEVEL_CAPS[growth.breakthrough] ||
    p.fragments < cost
  )
    throw Error("レベル上限または突破素材が不足しています");
  p.fragments -= cost;
  growth.breakthrough++;
  return p;
}
