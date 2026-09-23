import {
  KINDS,
  FAMILIES,
  EFFECT_POOLS,
  familyOf,
  type Family,
} from "../shared/defs";
import { makeWeapon, CAPACITY, type Variances } from "../shared/progression";
import { freshProgress, validateProgress } from "./progression-save";

/** Disposable in-memory menu data; never reads or writes player progression. */
export function menuSamples() {
  const save = freshProgress("normal");
  const values = [-10, 0, 5, 10, 15, 20] as const;
  // Fill each family to exactly its cap, so the sample save is the fullest
  // armoury the game will actually accept rather than one it would reject.
  // The starters freshProgress already issued count towards that cap.
  const held = new Map<Family, number>(FAMILIES.map((f) => [f, 0]));
  for (const w of save.inventory)
    held.set(familyOf(w.kind), (held.get(familyOf(w.kind)) ?? 0) + 1);
  const per = CAPACITY.perKind / (KINDS.length / FAMILIES.length);
  for (const kind of KINDS) {
    for (let i = 0; i < per; i++) {
      if ((held.get(familyOf(kind)) ?? 0) >= CAPACITY.perKind) break;
      const rarity = i % 5;
      const variance = Object.fromEntries(
        ["power", "reload", "range", "rate"].map((key, column) => [
          key,
          values[(i + column + Math.floor(i / 5)) % values.length],
        ]),
      ) as Variances;
      const weapon = makeWeapon(
        `menu-sample-${kind}-${i}`,
        kind,
        rarity,
        variance,
        false,
        save.serial++,
        // The second entry of each pool is that family's own special effect.
        rarity === 0 ? "none" : EFFECT_POOLS[kind][1],
      );
      save.inventory.push(weapon);
      held.set(familyOf(kind), (held.get(familyOf(kind)) ?? 0) + 1);
      if (i % 4 === 0) save.locks.push(weapon.id);
    }
  }
  save.soldiers[0].name = `サンプル${save.inventory.length}丁 · 再読み込みでリセット`;
  return validateProgress(save);
}
