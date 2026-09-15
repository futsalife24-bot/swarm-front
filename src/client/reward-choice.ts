import { weaponGrade } from "../shared/progression";
import { stats, RARITIES, effectLabel, type Weapon } from "../shared/defs";
import { rewards, type Save } from "./save";

export function weaponDetails(w: Weapon) {
  const d = stats(w);
  return `${weaponGrade(w)} · ${d.name}\n威力 ${Math.round(d.damage)}${d.pellets > 1 ? ` × ${d.pellets}` : ""} · 装弾 ${d.mag} · 装填 ${d.reload.toFixed(2)}秒\n射程 ${Math.round(d.range)}m · 連射 ${(1 / d.interval).toFixed(1)}発/秒 · ${effectLabel(w)}`;
}
export function canReplace(
  save: Save,
  items: Weapon[],
  pending: Weapon[],
  id: string,
) {
  const item = save.inventory.find((w) => w.id === id);
  return (
    !!item &&
    !save.equipped.includes(id) &&
    !items.some((w) => w.id === id) &&
    pending.some((w) => w.kind === item.kind)
  );
}
// Build one new save; callers persist it once so a storage failure cannot commit only the deletion.
export function replaceForRewards(
  save: Save,
  run: string,
  items: Weapon[],
  id: string,
) {
  const pending = rewards(save, run, items).overflow;
  if (!canReplace(save, items, pending, id))
    throw new Error("この武器は削除対象にできません。");
  return rewards(
    { ...save, inventory: save.inventory.filter((w) => w.id !== id) },
    run,
    items,
  ).save;
}
