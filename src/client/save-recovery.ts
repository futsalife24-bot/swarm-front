import { missionKey, victoryCoins } from "../shared/progression";
import {
  bank,
  loadProgress,
  persistProgress,
  validateProgress,
  weaponReceiptSnapshot,
  SaveConflictError,
  type ProgressSave,
} from "./progression-save";

/** Replays only an unsaved result delta against the latest save, never stale settings. */
export function recoverUnsavedResult(
  base: ProgressSave,
  pending: ProgressSave,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): ProgressSave {
  validateProgress(base);
  validateProgress(pending);
  const r = pending.result;
  if (base.mode !== "normal" || pending.mode !== "normal" || !r)
    throw new Error("回復できる通常プレイの戦果がありません。");
  const latest = loadProgress("normal", storage);
  if (!latest)
    throw new SaveConflictError(
      "最新の保存が見つかりません。未保存戦果を保持しています。",
    );
  const next = structuredClone(latest);
  const previousIds = new Set(
    base.result?.run === r.run ? base.result.weapons.map((w) => w.id) : [],
  );
  const added = r.weapons.filter((w) => !previousIds.has(w.id));
  // Full deterministic delta identity avoids hash collisions and survives later dismantling.
  const recoveryId = `recovery:${JSON.stringify([r.run, added.map((w) => w.id).sort(), r.choice, r.collectionDone])}`;
  if (next.receipts.includes(recoveryId)) return next;
  const freshRun = !next.receipts.includes(r.run);
  const key = missionKey(r.stage, r.difficulty);
  const old = next.missions[key] ?? [false, false, false];
  const first = freshRun && r.win && !old[0];
  const items = freshRun
    ? r.weapons.filter((w) => first || !w.id.startsWith(`${r.run}-first-`))
    : added;
  // Existing receipts mean its original rewards may already have been dismantled.
  if (r.win && (freshRun || base.receipts.includes(r.run))) {
    const history = weaponReceiptSnapshot(next);
    const received = new Set(history.ids);
    const unclaimed = items.filter(
      (w) =>
        !received.has(w.id) &&
        !next.receipts.includes(
          `recovery-weapon:${JSON.stringify([r.run, w.id])}`,
        ),
    );
    if (!freshRun && unclaimed.length && !history.runs.includes(r.run))
      throw new Error(
        "この戦果の古い受領履歴が残っていないため、自動復元を停止しました。未保存データの控えを書き出して保管してください。",
      );
    bank(
      next,
      unclaimed.map((w) => ({
        ...structuredClone(w),
        acquired: next.serial++,
      })),
    );
    for (const w of unclaimed)
      next.receipts.push(`recovery-weapon:${JSON.stringify([r.run, w.id])}`);
  }
  const coins = r.win ? victoryCoins(r.stage, r.difficulty) : r.coins;
  const firstCoins = first && r.stage === 21 ? 500 : 0;
  if (r.win && r.stage === 3 && pending.branch && !base.branch)
    next.branch = true;
  if (freshRun) {
    next.receipts.push(r.run);
    const history = weaponReceiptSnapshot(next);
    next.weaponReceipts = {
      ids: history.ids,
      runs: [...new Set([...history.runs, r.run])],
    };
    next.coins += coins + firstCoins;
    if (r.win) {
      next.missions[key] = old.map((v, i) => v || r.missions[i]);
      if (first && r.stage !== 21) {
        next.points = Math.min(120, next.points + 3);
        if (r.stage <= 4 && r.difficulty === "normal") next.materials++;
      }
    }
  }
  // Keep rewards already recorded by a concurrent collection for this run.
  const sameResult = next.result?.run === r.run ? next.result : undefined;
  if (sameResult) {
    const weapons = new Map(
      sameResult.weapons.map((w) => [w.id, structuredClone(w)]),
    );
    let additionalCollected = 0;
    if (base.receipts.includes(r.run))
      for (const w of items)
        if (!weapons.has(w.id)) {
          weapons.set(w.id, structuredClone(w));
          additionalCollected++;
        }
    next.result = {
      ...sameResult,
      weapons: [...weapons.values()],
      collected: sameResult.collected + additionalCollected,
      choice: "normal",
      collectionDone: true,
      bonus: [],
    };
  } else if (freshRun && (!next.result || next.result.choice !== "pending")) {
    // Display the recomputed first-clear reward, exactly matching the credited amount.
    next.result = {
      ...structuredClone(r),
      weapons: structuredClone(items),
      first,
      coins,
      firstCoins,
      choice: "normal",
      collectionDone: true,
      bonus: [],
    };
  }
  next.receipts.push(recoveryId);
  persistProgress(next, storage);
  return next;
}
