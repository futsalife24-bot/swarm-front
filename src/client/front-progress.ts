/** 改装版専用の進行。旧版のセーブ・日次台帳を読まず、書かない。 */
import {
  FRONT_INITIAL_CARDS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import type { FrontMode } from "../shared/front-run";
export const FRONT_PROGRESS_KEY = "swarm-front-rebuild-v1";
export interface FrontProgress {
  version: 1;
  wins: number;
  runs: number;
  credits: number;
  unlocks: FrontUpgradeId[];
  receipts: {
    id: string;
    won: boolean;
    mode: FrontMode;
    day: string;
    at: number;
    reward: number;
  }[];
  dailyWins: string[];
  receiptFloor: number;
  dailyFloor: string;
}
export const FRONT_UNLOCK_ORDER: readonly FrontUpgradeId[] = [
  "fuse",
  "ricochet",
  "tactical-reload",
  "compressed-charge",
  "line-shot",
  "interceptor",
];
export function emptyFrontProgress(): FrontProgress {
  return {
    version: 1,
    wins: 0,
    runs: 0,
    credits: 0,
    unlocks: [...FRONT_INITIAL_CARDS],
    receipts: [],
    dailyWins: [],
    receiptFloor: 0,
    dailyFloor: "",
  };
}
const integer = (value: unknown, max = 1e9): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= max;
const day = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function validFrontProgress(value: unknown): value is FrontProgress {
  if (!value || typeof value !== "object") return false;
  const p = value as FrontProgress;
  return (
    p.version === 1 &&
    integer(p.receiptFloor, Number.MAX_SAFE_INTEGER) &&
    (p.dailyFloor === "" || day(p.dailyFloor)) &&
    integer(p.wins) &&
    integer(p.runs) &&
    p.wins <= p.runs &&
    integer(p.credits) &&
    Array.isArray(p.unlocks) &&
    p.unlocks.length <= 9 &&
    new Set(p.unlocks).size === p.unlocks.length &&
    p.unlocks.every((id) =>
      [...FRONT_INITIAL_CARDS, ...FRONT_UNLOCK_ORDER].includes(id),
    ) &&
    FRONT_INITIAL_CARDS.every((id) => p.unlocks.includes(id)) &&
    Array.isArray(p.receipts) &&
    p.receipts.length <= 512 &&
    p.receipts.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        r.id.length > 0 &&
        r.id.length <= 120 &&
        typeof r.won === "boolean" &&
        ["survival", "defense", "daily"].includes(r.mode) &&
        day(r.day) &&
        integer(r.at, Number.MAX_SAFE_INTEGER) &&
        integer(r.reward, 200),
    ) &&
    new Set(p.receipts.map((r) => r.id)).size === p.receipts.length &&
    Array.isArray(p.dailyWins) &&
    p.dailyWins.length <= 512 &&
    new Set(p.dailyWins).size === p.dailyWins.length &&
    p.dailyWins.every(day)
  );
}
export interface FrontStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function readFrontProgress(storage: FrontStorage): {
  progress: FrontProgress;
  error: string;
} {
  try {
    const raw = storage.getItem(FRONT_PROGRESS_KEY);
    if (raw === null) return { progress: emptyFrontProgress(), error: "" };
    const p = JSON.parse(raw);
    if (validFrontProgress(p)) return { progress: p, error: "" };
  } catch {
    return {
      progress: emptyFrontProgress(),
      error: "改装版の進行を読み込めません。既存データは上書きしません。",
    };
  }
  return {
    progress: emptyFrontProgress(),
    error: "改装版の進行が不正です。既存データは上書きしません。",
  };
}
/** 直近512作戦を保持。古い結果の再受取を境界値で防ぎ、継続プレイを止めない。 */
export function awardFrontProgress(
  storage: FrontStorage,
  receipt: {
    id: string;
    won: boolean;
    mode: FrontMode;
    day: string;
    at: number;
  },
): { progress: FrontProgress; reward: number; saved: boolean; error: string } {
  const current = readFrontProgress(storage),
    p = current.progress;
  if (current.error) return { ...current, reward: 0, saved: false };
  if (
    typeof receipt.id !== "string" ||
    !receipt.id ||
    receipt.id.length > 120 ||
    !day(receipt.day) ||
    !integer(receipt.at, Number.MAX_SAFE_INTEGER) ||
    typeof receipt.won !== "boolean" ||
    !["survival", "defense", "daily"].includes(receipt.mode)
  )
    return {
      progress: p,
      reward: 0,
      saved: false,
      error: "作戦結果が不正です",
    };
  if (p.receipts.some((r) => r.id === receipt.id))
    return { progress: p, reward: 0, saved: true, error: "" };
  if (receipt.at <= p.receiptFloor)
    return { progress: p, reward: 0, saved: true, error: "" };
  if (p.runs >= 1e9 || p.credits > 1e9 - 200)
    return {
      progress: p,
      reward: 0,
      saved: false,
      error: "進行の保存上限に達しました。既存データは保持しています。",
    };
  const reward = receipt.won
    ? receipt.mode === "daily"
      ? p.dailyWins.includes(receipt.day) || receipt.day <= p.dailyFloor
        ? 0
        : 200
      : 100
    : 20;
  const wins = p.wins + (receipt.won ? 1 : 0),
    next: FrontProgress = {
      version: 1,
      wins,
      runs: p.runs + 1,
      credits: p.credits + reward,
      unlocks: [
        ...FRONT_INITIAL_CARDS,
        ...FRONT_UNLOCK_ORDER.slice(0, Math.min(6, wins)),
      ],
      receipts: [...p.receipts, { ...receipt, reward }],
      dailyWins:
        receipt.won &&
        receipt.mode === "daily" &&
        !p.dailyWins.includes(receipt.day)
          ? [...p.dailyWins, receipt.day]
          : [...p.dailyWins],
      receiptFloor: p.receiptFloor,
      dailyFloor: p.dailyFloor,
    };
  if (next.receipts.length > 512) {
    next.receiptFloor = Math.max(
      next.receiptFloor,
      Math.min(...next.receipts.map((r) => r.at)),
    );
    next.receipts = next.receipts.filter((r) => r.at > next.receiptFloor);
  }
  if (next.dailyWins.length > 512) {
    next.dailyWins.sort();
    next.dailyFloor = next.dailyWins.shift()!;
  }
  try {
    storage.setItem(FRONT_PROGRESS_KEY, JSON.stringify(next));
    return { progress: next, reward, saved: true, error: "" };
  } catch {
    return {
      progress: p,
      reward: 0,
      saved: false,
      error: "進行を保存できません。旧版のセーブは変更していません。",
    };
  }
}
