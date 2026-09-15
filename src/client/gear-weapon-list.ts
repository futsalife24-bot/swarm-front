import { effectLabel, stats, WEAPONS } from "../shared/defs";
import {
  GRADES,
  varianceClass,
  varianceMark,
  type NewWeapon,
  type StoredWeapon,
  weaponGrade,
  weaponTier,
  type Variances,
} from "../shared/progression";
import { weaponProtected, type ProgressSave } from "./progression-save";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const columns = ["特殊効果", "威力", "装弾", "装填", "射程", "連射"];
const keys = ["power", "mag", "reload", "range", "rate"] as const;
const tiers = ["#92aaa6", "#83d8b0", "#7cbdf4", "#d5a4f4", "#ffd472"];

export const lockMarkup = (locked: boolean, detail = false) =>
  `<img class="gear-lock-icon" src="${import.meta.env.BASE_URL}assets/ui/weapon-${locked ? "locked" : "unlocked"}.png" alt="" aria-hidden="true">${detail ? `<span>${locked ? "ロック解除" : "ロックする"}</span>` : ""}`;

// A single list scrolls; sticky identity/lock cells keep every row aligned.
export function gearWeaponRows(
  items: StoredWeapon[],
  save: ProgressSave,
  organizing: boolean,
  checked: Set<string>,
  selectedSlot?: number,
) {
  const equipped = save.soldiers.find(
    (p) => p.id === save.selectedSoldier,
  )!.equipped;
  const renderRow = (w: StoredWeapon, pinned = false) => {
    const d = stats(w),
      slot = equipped.indexOf(w.id),
      pending = save.pending.some((item) => item.id === w.id),
      label = effectLabel(w);
    const shortEffect = label
      .replace("貫通：最大3体", "貫通×3")
      .replace("高速装填：20%短縮", "装填−20%");
    const values = [
      `${d.damage.toFixed(0)}${d.pellets > 1 ? "×" + d.pellets : ""}`,
      String(d.mag),
      d.reload.toFixed(2) + "s",
      Number(d.range.toFixed(1)) + "m",
      (1 / d.interval).toFixed(1),
    ];
    return `<div class="pt-weapon-row ${slot >= 0 ? "is-equipped" : ""} ${pinned ? "gear-pinned-row" : ""}" ${pinned ? "data-pinned" : "data-row"}="${esc(w.id)}" style="--weapon-tier:${tiers[weaponTier(w)]}"><div class="pt-identity">${organizing && !pinned ? `<input type="checkbox" data-check="${esc(w.id)}" aria-label="${esc(d.name)}を解体対象に選択" ${checked.has(w.id) ? "checked" : ""} ${weaponProtected(save, w.id) ? "disabled" : ""}>` : ""}<button data-detail="${esc(w.id)}" aria-label="${esc(d.name)} ${weaponGrade(w)}${pending ? " 超過・整理待ち" : ""}${slot >= 0 ? " 装備" + (slot + 1) : ""} 詳細"><small class="gear-rarity pt-grade-${weaponTier(w)}">${weaponGrade(w)}</small><b>${esc(WEAPONS[w.kind].name)}</b>${slot >= 0 ? `<span class="gear-equipped" title="装備${slot + 1}">E${slot + 1}</span>` : pending ? '<span class="gear-equipped" title="超過・整理待ち" aria-label="超過・整理待ち">!</span>' : ""}</button></div><div class="pt-stat-scroll"><div class="pt-stat-inner"><span class="gear-effect" title="${esc(label)}">${esc(shortEffect)}</span>${values.map((value, i) => `<span class="pt-var-${keys[i] === "mag" ? "base" : varianceClass(w.format === 2 ? w.variance[keys[i] as keyof Variances] : 0)}">${value}<sup>${keys[i] === "mag" ? "" : varianceMark(w.format === 2 ? w.variance[keys[i] as keyof Variances] : 0)}</sup></span>`).join("")}</div></div>${pinned ? `<button class="gear-pinned-label" data-pinned-detail="${esc(w.id)}">装備${selectedSlot! + 1}</button>` : `<button data-lock="${esc(w.id)}" aria-label="${esc(d.name)}のロック" aria-pressed="${save.locks.includes(w.id)}">${lockMarkup(save.locks.includes(w.id))}</button>`}</div>`;
  };
  const pinned =
    selectedSlot === undefined
      ? undefined
      : save.inventory.find((w) => w.id === equipped[selectedSlot]);
  return `<div class="pt-weapon-list gear-weapon-list ${organizing ? "is-organizing" : ""}" aria-label="所持武器"><div class="pt-weapon-row pt-weapon-head"><div class="pt-identity"><span class="gear-rarity">レア</span><span>武器</span></div><div class="pt-stat-scroll"><div class="pt-stat-inner">${columns.map((c) => `<span>${c}</span>`).join("")}</div></div><span class="gear-lock-head">ロック</span></div>${pinned ? renderRow(pinned, true) : ""}${items.map((w) => renderRow(w)).join("")}</div>`;
}
