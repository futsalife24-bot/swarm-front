import { validWeapon, type Weapon } from "../shared/defs";
import { validNewWeapon, type StoredWeapon } from "../shared/progression";
import { fresh, type Save } from "./save";
import {
  allWeapons,
  coopPreferences,
  initializeProgress,
  loadProgress,
  persistProgress,
  soldier,
  validateProgress,
  type ProgressSave,
} from "./progression-save";

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
// Baselines survive structuredClone of the projected Save; no stale full-save overwrite.
const baselines = new Map<number, string>();
function project(s: ProgressSave): Save {
  return {
    ...fresh(),
    ...s.coopPreferences,
    sharedArmory: true,
    sharedRevision: s.revision ?? 0,
    inventory: structuredClone(s.inventory),
    pendingWeapons: structuredClone(s.pending),
    equipped: [...soldier(s).equipped],
    favorites: [...s.locks],
    protectedWeapons: [...new Set(s.soldiers.flatMap((p) => p.equipped))],
    powder: s.powder,
    receipts: [...s.receipts],
  };
}
const fingerprint = (s: Save) =>
  JSON.stringify({ ...s, sharedRevision: undefined });

export function loadSharedCoopSave(
  storage: StorageAccess = localStorage,
): Save {
  const s =
    loadProgress("normal", storage) ?? initializeProgress("normal", storage);
  const projected = project(s);
  baselines.set(projected.sharedRevision!, fingerprint(projected));
  return projected;
}

export function persistSharedCoopSave(
  next: Save,
  storage: StorageAccess = localStorage,
): void {
  const s = loadProgress("normal", storage);
  if (!s || !next.sharedArmory || next.sharedRevision === undefined)
    throw new Error("共通武器保存が見つかりません。再読み込みしてください。");
  const current = project(s);
  if (
    next.sharedRevision !== current.sharedRevision &&
    baselines.get(next.sharedRevision) !== fingerprint(current)
  )
    throw new Error(
      "別の画面で武器庫が更新されました。再読み込みしてから操作してください。",
    );
  const known = new Map(allWeapons(s).map((w) => [w.id, w]));
  const store = (w: Weapon): StoredWeapon => {
    if ("format" in w) {
      if (!validNewWeapon(w) || w.testData)
        throw new Error("通常武器の形式が不正です。");
      return structuredClone(w);
    }
    if (!validWeapon(w) || ("testData" in w && w.testData !== false))
      throw new Error("通常武器の形式が不正です。");
    return {
      ...structuredClone(w),
      acquired: known.get(w.id)?.acquired ?? s.serial++,
      testData: false,
    };
  };
  const updated = structuredClone(s);
  updated.inventory = next.inventory.map(store);
  updated.pending = (next.pendingWeapons ?? []).map(store);
  updated.serial = Math.max(
    s.serial,
    ...[...updated.inventory, ...updated.pending].map((w) => w.acquired + 1),
  );
  soldier(updated).equipped = [...next.equipped];
  updated.locks = [...(next.favorites ?? [])];
  updated.powder = next.powder ?? 0;
  updated.receipts = [...next.receipts];
  updated.coopPreferences = coopPreferences(next);
  validateProgress(updated);
  persistProgress(updated, storage);
  next.sharedRevision = updated.revision;
  const committed = project(updated);
  next.protectedWeapons = committed.protectedWeapons;
  baselines.set(next.sharedRevision!, fingerprint(committed));
}
