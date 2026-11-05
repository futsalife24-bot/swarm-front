import { stats, WEAPONS } from "../shared/defs";
import { effectHelp } from "./weapon-help";
import {
  varianceClass,
  varianceMark,
  type StoredWeapon,
  weaponGrade,
  weaponTier,
  weaponStatVariance,
} from "../shared/progression";
import { weaponLevel } from "../shared/weapon-growth";
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

/** 支給品も既存の行・性能列・装備印を使う。所持品やロックには接続しない。 */
export function gearSupplyRows(
  equipped: readonly ("rifle" | "shotgun" | "smg")[],
) {
  return `<div class="pt-weapon-list gear-weapon-list front-weapon-table" aria-label="支給武器"><div class="pt-weapon-row pt-weapon-head"><div class="pt-identity"><span class="gear-rarity">支給</span><span>武器</span></div><div class="pt-stat-scroll"><div class="pt-stat-inner">${columns.map((c) => `<span>${c}</span>`).join("")}</div></div><span class="gear-lock-head">装備</span></div>${(
    ["rifle", "shotgun", "smg"] as const
  )
    .map((kind) => {
      const d = WEAPONS[kind],
        slot = equipped.indexOf(kind);
      const values = [
        "なし",
        `${d.damage}${d.pellets > 1 ? "×" + d.pellets : ""}`,
        String(d.mag),
        `${d.reload.toFixed(2)}秒`,
        `${d.range}m`,
        (1 / d.interval).toFixed(1),
      ];
      return `<div data-front-weapon-row="${kind}" class="pt-weapon-row front-weapon-row ${slot >= 0 ? "is-equipped" : ""}"><div class="pt-identity"><button data-weapon="${kind}" aria-label="${d.name}を装備"><small class="gear-rarity">支給</small><b>${d.name}</b>${slot >= 0 ? `<span class="gear-equipped" aria-label="装備${slot + 1}">E${slot + 1}</span>` : ""}</button></div><div class="pt-stat-scroll"><div class="pt-stat-inner">${values.map((v) => `<span>${v}</span>`).join("")}</div></div><button class="gear-pinned-label" data-weapon="${kind}" aria-label="${d.name}を装備" aria-pressed="${slot >= 0}">${slot >= 0 ? `${slot + 1}枠目` : "装備"}</button></div>`;
    })
    .join("")}</div>`;
}

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
  const renderRow = (w: StoredWeapon) => {
    const selected =
      selectedSlot !== undefined && w.id === equipped[selectedSlot];
    const d = stats(w),
      slot = equipped.indexOf(w.id),
      pending = save.pending.some((item) => item.id === w.id);
    return `<div class="pt-weapon-row ${slot >= 0 ? "is-equipped" : ""} ${selected ? "is-selected-slot" : ""}" data-row="${esc(w.id)}" style="--weapon-tier:${tiers[weaponTier(w)]}"><div class="pt-identity">${organizing ? `<input type="checkbox" data-check="${esc(w.id)}" aria-label="${esc(d.name)}を解体対象に選択" ${checked.has(w.id) ? "checked" : ""} ${weaponProtected(save, w.id) ? "disabled" : ""}>` : ""}<button data-detail="${esc(w.id)}" aria-label="${esc(d.name)} ${weaponGrade(w)}${pending ? " 超過・整理待ち" : ""}${slot >= 0 ? " 装備" + (slot + 1) : ""} 詳細"><small class="gear-rarity pt-grade-${weaponTier(w)}">${weaponGrade(w)}</small><b>${esc(WEAPONS[w.kind].name)}</b>${slot >= 0 ? `<span class="gear-equipped" title="装備${slot + 1}">E${slot + 1}</span>` : pending ? '<span class="gear-equipped" title="超過・整理待ち" aria-label="超過・整理待ち">!</span>' : ""}</button></div>${statCells(w)}<button data-lock="${esc(w.id)}" aria-label="${esc(d.name)}のロック" aria-pressed="${save.locks.includes(w.id)}">${lockMarkup(save.locks.includes(w.id))}</button></div>`;
  };
  return `<div class="pt-weapon-list gear-weapon-list ${organizing ? "is-organizing" : ""}" aria-label="所持武器">${listHead("ロック")}${items.map((w) => renderRow(w)).join("")}</div>`;
}

/** 効果と全性能のセル。所持一覧と結果一覧で同じ列・同じ書式を使う。 */
function statCells(w: StoredWeapon) {
  const d = stats(w);
  const values = [
    `${d.damage.toFixed(0)}${d.pellets > 1 ? "×" + d.pellets : ""}`,
    String(d.mag),
    d.reload.toFixed(2) + "s",
    Number(d.range.toFixed(1)) + "m",
    (1 / d.interval).toFixed(1),
  ];
  return `<div class="pt-stat-scroll"><div class="pt-stat-inner"><span class="gear-effect">${effectHelp(w.effect, w.kind, true)}</span>${values.map((value, i) => `<span class="pt-var-${varianceClass(weaponStatVariance(w, keys[i]))}">${value}<sup>${varianceMark(weaponStatVariance(w, keys[i]))}</sup></span>`).join("")}</div></div>`;
}
const listHead = (end: string) =>
  `<div class="pt-weapon-row pt-weapon-head"><div class="pt-identity"><span class="gear-rarity">レア</span><span>武器</span></div><div class="pt-stat-scroll"><div class="pt-stat-inner">${columns.map((c) => `<span>${c}</span>`).join("")}</div></div><span class="gear-lock-head">${end}</span></div>`;

/** 右端の固定列（所持一覧のロック位置）に出す、読み取り専用の状態。 */
export interface GearRowState {
  key: string;
  label: string;
  title: string;
}
/**
 * 結果画面など、操作を持たない1丁1行。所持一覧と同じ行・列・性能書式を使い、
 * 恒久Lvを名前の後ろへ、右端のロック位置へ状態を出す。装備・解体・ロック・詳細の
 * ボタンは作らない（押せて無反応の要素を作らない）。特殊効果だけは既存の説明を開く。
 */
export function gearReadOnlyRows(
  items: readonly { weapon: StoredWeapon; state: GearRowState }[],
  label: string,
  stateHead = "状態",
) {
  return `<div class="pt-weapon-list gear-weapon-list is-read-only" aria-label="${esc(label)}">${listHead(stateHead)}${items
    .map(({ weapon: w, state }) => {
      const name = WEAPONS[w.kind].name;
      return `<div class="pt-weapon-row" data-row="${esc(w.id)}" data-state="${esc(state.key)}" style="--weapon-tier:${tiers[weaponTier(w)]}"><div class="pt-identity"><span class="gear-row-name"><small class="gear-rarity pt-grade-${weaponTier(w)}">${weaponGrade(w)}</small><b>${esc(name)}</b><span class="gear-level">Lv${weaponLevel(w)}</span></span></div>${statCells(w)}<span class="gear-row-state" data-state="${esc(state.key)}" title="${esc(state.title)}">${esc(state.label)}</span></div>`;
    })
    .join("")}</div>`;
}
