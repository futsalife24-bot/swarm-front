import type { Weapon } from "./defs";

export const WEAPON_MAX_LEVEL = 60;
export const WEAPON_MOD_LIMIT = 10;
export const WEAPON_MOD_NAMES = {
  damage: "火力",
  speed: "弾速",
  mag: "装填数",
};
export type WeaponMod = keyof typeof WEAPON_MOD_NAMES;
export type WeaponMods = Partial<Record<WeaponMod, number>>;
export const weaponLevel = (w: Weapon) => w.level ?? 1;
export const weaponModLimit = (w: Weapon, key: WeaponMod) =>
  key === "mag"
    ? ((
        { rocket: 4, heavy: 3, grenade: 5, sticky: 5 } as Record<string, number>
      )[w.kind] ?? 10)
    : 10;
/** Absent fields are the identity transform; old saves require no rewrite. */
export function validWeaponGrowth(w: Weapon) {
  return (
    (w.level === undefined ||
      (Number.isInteger(w.level) &&
        w.level >= 1 &&
        w.level <= WEAPON_MAX_LEVEL)) &&
    (w.mods === undefined ||
      (!!w.mods &&
        typeof w.mods === "object" &&
        !Array.isArray(w.mods) &&
        Object.entries(w.mods).every(
          ([key, n]) =>
            Object.hasOwn(WEAPON_MOD_NAMES, key) &&
            Number.isInteger(n) &&
            n >= 0 &&
            n <= WEAPON_MOD_LIMIT,
        )))
  );
}
export function applyWeaponGrowth<
  T extends { damage: number; mag: number; speed?: number },
>(w: Weapon, base: T): T {
  const mods = w.mods ?? {};
  return {
    ...base,
    damage:
      base.damage *
      (1 + (weaponLevel(w) - 1) * 0.06) *
      (1 + (mods.damage ?? 0) * 0.05),
    mag:
      base.mag +
      Math.max(1, Math.round(base.mag * 0.1)) *
        Math.min(weaponModLimit(w, "mag"), mods.mag ?? 0),
    ...(base.speed === undefined
      ? {}
      : { speed: base.speed * (1 + (mods.speed ?? 0) * 0.05) }),
  };
}
