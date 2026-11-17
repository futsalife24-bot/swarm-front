import { WEAPONS, EFFECT_POOLS, familyOf, type Kind } from "../shared/defs";
import { CAPACITY, type StoredWeapon } from "../shared/progression";
import {
  weaponLevel,
  weaponModLimit,
  WEAPON_MOD_NAMES,
  type WeaponMod,
} from "../shared/weapon-growth";
import { validateProgress, type ProgressSave } from "./progression-save";

export const conversionCost = (w: StoredWeapon) => 8 + weaponLevel(w) * 2;
export const modificationCost = (w: StoredWeapon, key: WeaponMod) =>
  1 + Math.floor(weaponLevel(w) / 3) + ((w.mods?.[key] ?? 0) + 1) * 2;
/** Lv1→2 is 4 shards; each later level costs two more, up to Lv24→25 at 50. */
export const ARMORY_LEVEL_LIMIT = 25;
export const levelUpCost = (w: StoredWeapon) => 2 + weaponLevel(w) * 2;
export function levelUpWeapon(s: ProgressSave, id: string) {
  const n = structuredClone(s);
  const w = n.inventory.find((item) => item.id === id);
  if (!w) throw Error("強化対象の所持武器が見つかりません。");
  if (weaponLevel(w) >= ARMORY_LEVEL_LIMIT)
    throw Error("この武器は強化上限のLv25です。");
  const cost = levelUpCost(w);
  if (n.powder < cost) throw Error("武装片が不足しています。");
  n.powder -= cost;
  w.level = weaponLevel(w) + 1;
  validateProgress(n);
  return n;
}
export function convertWeapon(s: ProgressSave, id: string, target: Kind) {
  const n = structuredClone(s);
  const w = n.inventory.find((item) => item.id === id);
  if (!w || !Object.hasOwn(WEAPONS, target) || w.kind === target)
    throw Error("変換先と所持武器を確認してください。");
  if (n.locks.includes(id))
    throw Error("ロックを解除してから変換してください。");
  const cost = conversionCost(w);
  if (n.powder < cost) throw Error("武装片が不足しています。");
  w.kind = target;
  // Stage counts, quality, rolls and identity survive. Unsupported speed stages
  // remain dormant so cycling kinds never refunds or creates growth.
  if (!EFFECT_POOLS[target].includes(w.effect)) w.effect = "none";
  if (
    n.inventory.filter((item) => familyOf(item.kind) === familyOf(target))
      .length > CAPACITY.perKind
  )
    throw Error("変換先の系統が所持上限です。武器を整理してください。");
  n.powder -= cost;
  validateProgress(n);
  return n;
}
export function modifyWeapon(s: ProgressSave, id: string, key: WeaponMod) {
  const n = structuredClone(s);
  const w = n.inventory.find((item) => item.id === id);
  if (!w || !Object.hasOwn(WEAPON_MOD_NAMES, key))
    throw Error("改造対象を確認してください。");
  if (n.locks.includes(id))
    throw Error("ロックを解除してから改造してください。");
  if (key === "speed" && !("speed" in WEAPONS[w.kind]))
    throw Error("この武器は弾速改造の対象外です。");
  const stage = w.mods?.[key] ?? 0;
  if (stage >= weaponModLimit(w, key))
    throw Error("この武器種の性能は改造上限です。");
  const cost = modificationCost(w, key);
  if (n.powder < cost) throw Error("武装片が不足しています。");
  n.powder -= cost;
  w.mods = { ...w.mods, [key]: stage + 1 };
  validateProgress(n);
  return n;
}
