import { LIMITS, STARTERS, validWeapon, type Weapon } from "../shared/defs";
export const SAVE_KEY = "swarm-front-save-v1";
export interface Save {
  version: 1;
  inventory: Weapon[];
  equipped: string[];
  volume: number;
  sensitivity: number;
  fireSensitivity?: number;
  gyroEnabled?: boolean;
  gyroSensitivity?: number;
  quality: number;
  receipts: string[];
  pendingWeapons?: Weapon[];
  favorites?: string[];
  powder?: number;
  // Optional so saves written before this setting existed still load.
  mapRotates?: boolean;
  damageNumbers?: "self" | "all" | "off";
}
export const fresh = (): Save => ({
  version: 1,
  inventory: structuredClone(STARTERS),
  equipped: STARTERS.slice(0, 2).map((w) => w.id),
  volume: 0.35,
  sensitivity: 1,
  quality: 1,
  receipts: [],
  mapRotates: false,
  damageNumbers: "self",
});
export function parseSave(raw: string | null): Save {
  if (raw === null) return fresh();
  const v = JSON.parse(raw) as Save;
  if (
    v.version !== 1 ||
    (v.powder !== undefined &&
      (!Number.isSafeInteger(v.powder) || v.powder < 0)) ||
    !Array.isArray(v.inventory) ||
    v.inventory.length > LIMITS.inventory ||
    !v.inventory.every(validWeapon) ||
    (v.pendingWeapons !== undefined &&
      (!Array.isArray(v.pendingWeapons) ||
        !v.pendingWeapons.every(validWeapon) ||
        new Set([...v.inventory, ...v.pendingWeapons].map((w) => w.id)).size !==
          v.inventory.length + v.pendingWeapons.length)) ||
    (v.favorites !== undefined &&
      (!Array.isArray(v.favorites) ||
        !v.favorites.every((id) =>
          [...v.inventory, ...(v.pendingWeapons ?? [])].some(
            (w) => w.id === id,
          ),
        ))) ||
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
    v.sensitivity < 0.1 ||
    v.sensitivity > 6 ||
    (v.fireSensitivity !== undefined &&
      (!Number.isFinite(v.fireSensitivity) ||
        v.fireSensitivity < 0.1 ||
        v.fireSensitivity > 6)) ||
    (v.gyroSensitivity !== undefined &&
      (!Number.isFinite(v.gyroSensitivity) ||
        v.gyroSensitivity < 0.1 ||
        v.gyroSensitivity > 6)) ||
    !["boolean", "undefined"].includes(typeof v.gyroEnabled) ||
    ![0.65, 1].includes(v.quality) ||
    !["boolean", "undefined"].includes(typeof v.mapRotates) ||
    ![undefined, "self", "all", "off"].includes(v.damageNumbers)
  )
    throw new Error(
      "保存データを読めません。上書きを停止しました。データを書き出して保管してください。",
    );
  return v;
}
// Brings an armoury filled under the old single cap down to the per-family one.
// Equipped weapons are never dropped; among the rest the weakest go first.
export function trimToKindCap(save: Save) {
  const keep = new Set<string>();
  const removed: Weapon[] = [];
  for (const kind of new Set(save.inventory.map((w) => w.kind))) {
    const family = save.inventory.filter((w) => w.kind === kind);
    const ranked = [...family].sort(
      (a, b) =>
        Number(save.equipped.includes(b.id)) -
          Number(save.equipped.includes(a.id)) ||
        b.rarity - a.rarity ||
        b.power - a.power,
    );
    for (const [i, w] of ranked.entries())
      if (i < LIMITS.perKind || save.equipped.includes(w.id)) keep.add(w.id);
      else removed.push(w);
  }
  if (!removed.length) return { save, removed };
  return {
    save: {
      ...save,
      inventory: save.inventory.filter((w) => keep.has(w.id)),
    },
    removed,
  };
}
export function rewards(save: Save, run: string, items: Weapon[]) {
  if (save.receipts.includes(run)) return { save, overflow: [] as Weapon[] };
  const next = structuredClone(save);
  const ids = new Set(next.inventory.map((w) => w.id));
  const overflow: Weapon[] = [];
  const held = (kind: Weapon["kind"]) =>
    next.inventory.filter((w) => w.kind === kind).length;
  for (const item of items) {
    if (!validWeapon(item)) throw new Error("報酬が不正です");
    if (ids.has(item.id)) continue;
    // A family fills up long before the armoury does, and that is the point:
    // the choice it forces is between weapons you can actually compare.
    if (
      next.inventory.length >= LIMITS.inventory ||
      held(item.kind) >= LIMITS.perKind
    )
      overflow.push(item);
    else {
      next.inventory.push(item);
      ids.add(item.id);
    }
  }
  if (!overflow.length) next.receipts.push(run);
  return { save: next, overflow };
}
// Commit the entire victory, including overflow, before leaving the result.
export function bankRewards(save: Save, run: string, items: Weapon[]): Save {
  if (save.receipts.includes(run)) return save;
  const known = new Set(
    [...save.inventory, ...(save.pendingWeapons ?? [])].map((w) => w.id),
  );
  const r = rewards(
    save,
    run,
    items.filter((w) => !known.has(w.id)),
  );
  return {
    ...r.save,
    pendingWeapons: [...(save.pendingWeapons ?? []), ...r.overflow],
    receipts: [...new Set([...r.save.receipts, run])],
  };
}
export const POWDER_NAME = "武装片";
export const POWDER_YIELDS: readonly number[] = [1, 3, 10, 30];
export function dismantleWeapons(save: Save, ids: string[]): Save {
  const selected = new Set(ids);
  const weapons = [...save.inventory, ...(save.pendingWeapons ?? [])].filter(
    (w) => selected.has(w.id),
  );
  if (weapons.length !== selected.size)
    throw new Error("分解対象の武器が見つかりません。");
  if (
    weapons.some(
      (w) => save.equipped.includes(w.id) || save.favorites?.includes(w.id),
    )
  )
    throw new Error("装備中・お気に入りの武器は保護されています。");
  const powder =
    (save.powder ?? 0) +
    weapons.reduce((n, w) => n + POWDER_YIELDS[w.rarity], 0);
  if (!Number.isSafeInteger(powder))
    throw new Error(`${POWDER_NAME}の所持上限を超えます。`);
  const next = structuredClone(save);
  next.powder = powder;
  next.inventory = next.inventory.filter((w) => !selected.has(w.id));
  next.pendingWeapons = (next.pendingWeapons ?? []).filter(
    (w) => !selected.has(w.id),
  );
  const waiting: Weapon[] = [];
  for (const w of next.pendingWeapons) {
    if (
      next.inventory.length < LIMITS.inventory &&
      next.inventory.filter((a) => a.kind === w.kind).length < LIMITS.perKind
    )
      next.inventory.push(w);
    else waiting.push(w);
  }
  next.pendingWeapons = waiting;
  return next;
}
export function discardWeapon(save: Save, id: string): Save {
  return dismantleWeapons(save, [id]);
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
