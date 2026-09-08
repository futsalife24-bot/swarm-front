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
    v.sensitivity < 0.1 ||
    v.sensitivity > 6 ||
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
