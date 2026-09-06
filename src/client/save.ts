import { LIMITS, STARTERS, validWeapon, type Weapon } from "../shared/defs";
export const SAVE_KEY = "swarm-front-save-v1";
export interface Save {
  version: 1;
  inventory: Weapon[];
  equipped: string[];
  volume: number;
  sensitivity: number;
  quality: number;
  receipts: string[];
}
export const fresh = (): Save => ({
  version: 1,
  inventory: structuredClone(STARTERS),
  equipped: STARTERS.slice(0, 2).map((w) => w.id),
  volume: 0.35,
  sensitivity: 1,
  quality: 1,
  receipts: [],
});
export function parseSave(raw: string | null): Save {
  if (raw === null) return fresh();
  const v = JSON.parse(raw) as Save;
  if (
    v.version !== 1 ||
    !Array.isArray(v.inventory) ||
    v.inventory.length > LIMITS.inventory ||
    !v.inventory.every(validWeapon) ||
    new Set(v.inventory.map((w) => w.id)).size !== v.inventory.length ||
    !Array.isArray(v.equipped) ||
    v.equipped.length !== 2 ||
    new Set(v.equipped).size !== 2 ||
    !v.equipped.every((id) => v.inventory.some((w) => w.id === id)) ||
    !Array.isArray(v.receipts) ||
    !v.receipts.every((x) => typeof x === "string") ||
    !Number.isFinite(v.volume) ||
    v.volume < 0 ||
    v.volume > 1 ||
    !Number.isFinite(v.sensitivity) ||
    v.sensitivity < 0.3 ||
    v.sensitivity > 2.5 ||
    ![0.65, 1].includes(v.quality)
  )
    throw new Error(
      "保存データを読めません。上書きを停止しました。データを書き出して保管してください。",
    );
  return v;
}
export function rewards(save: Save, run: string, items: Weapon[]) {
  if (save.receipts.includes(run)) return { save, overflow: [] as Weapon[] };
  const next = structuredClone(save);
  const ids = new Set(next.inventory.map((w) => w.id));
  const overflow: Weapon[] = [];
  for (const item of items) {
    if (!validWeapon(item)) throw new Error("報酬が不正です");
    if (ids.has(item.id)) continue;
    if (next.inventory.length >= LIMITS.inventory) overflow.push(item);
    else {
      next.inventory.push(item);
      ids.add(item.id);
    }
  }
  if (!overflow.length) next.receipts.push(run);
  return { save: next, overflow };
}
export function persist(
  save: Save,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    throw new Error(
      "端末への保存に失敗しました。容量やブラウザ設定を確認して「保存を再試行」してください。",
    );
  }
}
