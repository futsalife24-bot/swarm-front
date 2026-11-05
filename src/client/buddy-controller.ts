import {
  freshBuddyProgress,
  chooseStarterBuddy,
  equipBuddy,
  drawBuddy,
  breakthroughBuddy,
  type BuddyId,
  type BuddyDrawReceipt,
  type BuddyProgress,
} from "../shared/buddy-progression";
import { persistProgress, type ProgressSave } from "./progression-save";

export type BuddyAction =
  | { kind: "starter"; buddyId: BuddyId }
  | { kind: "equip"; buddyId: BuddyId | null }
  | { kind: "draw"; requestId: string }
  | { kind: "breakthrough"; buddyId: BuddyId };

// 未保存の結果はUIへ返さず、同じ保存先・要求IDの再試行に保持する。
const preparedDraws = new WeakMap<
  object,
  Map<
    string,
    {
      base: string;
      progress: BuddyProgress;
      receipt: BuddyDrawReceipt;
    }
  >
>();

/**
 * Claude UI用の保存境界。成功で返ったsaveだけを画面の状態へ反映する。
 * エラー時は入力saveを保持し、抽選再試行には同じrequestIdを使う。
 * 初期の全所持時保証カウントは0。将来追加時への保証持越しは約束しない。
 */
export function applyBuddyAction(
  save: ProgressSave,
  action: BuddyAction,
  options: {
    inBattle: boolean;
    storage?: Pick<Storage, "getItem" | "setItem">;
    rng?: () => number;
  },
): { save: ProgressSave; receipt?: BuddyDrawReceipt; replayed?: boolean } {
  if (options.inBattle !== false)
    throw Error("バディの変更は基地で行ってください");
  const storage = options.storage ?? localStorage;
  const current = save.buddies ?? freshBuddyProgress();
  let buddies = current;
  let receipt: BuddyDrawReceipt | undefined;
  switch (action.kind) {
    case "starter":
      buddies = chooseStarterBuddy(current, action.buddyId);
      break;
    case "equip":
      buddies = equipBuddy(current, action.buddyId);
      break;
    case "breakthrough":
      buddies = breakthroughBuddy(current, action.buddyId);
      break;
    case "draw": {
      const completed = current.draws.find(
        (r) => r.requestId === action.requestId,
      );
      if (completed) return { save, receipt: completed, replayed: true };
      let pending = preparedDraws.get(storage);
      if (!pending) preparedDraws.set(storage, (pending = new Map()));
      let prepared = pending.get(action.requestId);
      if (prepared && prepared.base !== JSON.stringify(current))
        throw Error(
          "バディ保存が変わりました。未保存の抽選を先に確認してください",
        );
      if (!prepared) {
        if (pending.size >= 32)
          throw Error("未保存の抽選を先に再試行してください");
        const result = drawBuddy(
          current,
          action.requestId,
          options.rng ?? Math.random,
          { allOwnedPity: "reset" },
        );
        prepared = {
          base: JSON.stringify(current),
          progress: result.progress,
          receipt: result.receipt,
        };
        pending.set(action.requestId, prepared);
      }
      buddies = structuredClone(prepared.progress);
      receipt = prepared.receipt;
      break;
    }
    default:
      throw Error("バディ操作が不正です");
  }
  const next = { ...structuredClone(save), buddies };
  persistProgress(next, storage);
  if (action.kind === "draw")
    preparedDraws.get(storage)?.delete(action.requestId);
  return { save: next, receipt, replayed: false };
}
