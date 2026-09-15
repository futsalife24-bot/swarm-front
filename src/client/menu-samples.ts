import { type Kind } from "../shared/defs";
import { makeWeapon, type Variances } from "../shared/progression";
import { freshProgress, validateProgress } from "./progression-save";

/** Disposable in-memory menu data; never reads or writes player progression. */
export function menuSamples() {
  const save = freshProgress("normal");
  const values = [-10, 0, 5, 10, 15, 20] as const;
  for (const kind of ["rifle", "shotgun", "rocket"] as Kind[]) {
    for (let i = 0; i < 15; i++) {
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
        rarity === 0
          ? "none"
          : ({ rifle: "pierce", shotgun: "repel", rocket: "chain" }[kind] as
              "pierce" | "repel" | "chain"),
      );
      save.inventory.push(weapon);
      if (i % 4 === 0) save.locks.push(weapon.id);
    }
  }
  save.soldiers[0].name = "サンプル48丁 · 再読み込みでリセット";
  return validateProgress(save);
}
