import type { FrontUpgradeId, FrontFamily } from "../shared/front-upgrades";

export type SurvivalCardFamily = FrontFamily | "generic";
export interface SurvivalCardView {
  id: FrontUpgradeId;
  name: string;
  kind: "normal" | "fusion";
  type: "ability" | "weapon" | "fusion";
  family: SurvivalCardFamily;
  iconMarkup: string;
  description: string;
  level: { current: number; max: number; next?: number };
  acquisition?: "new" | "level-up" | "fusion-new" | "fusion-up";
  materials?: { name: string; iconMarkup: string }[];
  deck?: "in" | "out";
  excluded?: boolean;
  locked?: string;
  undiscovered?: boolean;
  fusionProgress?: string;
  inspecting?: boolean;
}

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const familyName: Record<SurvivalCardFamily, string> = {
  explosion: "爆発",
  piercing: "貫通",
  interception: "迎撃",
  generic: "補強",
};
const familyGlyph: Record<SurvivalCardFamily, string> = {
  explosion:
    '<path d="M12 2l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z" fill="currentColor"/>',
  piercing:
    '<path d="M3 12h17m-6-6 6 6-6 6M8 5v14" fill="none" stroke="currentColor" stroke-width="2"/>',
  interception:
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6" stroke="currentColor" stroke-width="2"/>',
  generic:
    '<path d="M12 2 20 7v10l-8 5-8-5V7zM12 7v10M7 12h10" fill="none" stroke="currentColor" stroke-width="2"/>',
};
const glyph = (family: SurvivalCardFamily) =>
  `<svg class="sc-family-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${familyGlyph[family]}</svg>`;
const kindName = (view: SurvivalCardView) =>
  view.kind === "fusion"
    ? "◆ 融合"
    : view.type === "ability"
      ? "能力強化"
      : "武器強化";
const levelText = ({ current, max, next }: SurvivalCardView["level"]) =>
  next !== undefined
    ? current
      ? `${current} → ${next}段階`
      : `未取得 → ${next}段階`
    : current >= max
      ? `最大 ${max}段階`
      : `${current}/${max}段階`;
const pips = ({ current, max, next }: SurvivalCardView["level"]) =>
  max <= 1
    ? ""
    : `<span class="sc-pips" aria-hidden="true">${Array.from({ length: max }, (_, index) => `<i data-pip="${index < current ? "on" : next !== undefined && index < next ? "gain" : "off"}"></i>`).join("")}</span>`;
const attrs = (view: SurvivalCardView, size: "L" | "M" | "S" | "row") =>
  `data-size="${size}" data-kind="${view.kind}" data-type="${view.type}" data-family="${view.family}"${view.deck ? ` data-deck="${view.deck}"` : ""}${view.locked ? ' data-locked="true"' : ""}${view.undiscovered ? ' data-undiscovered="true"' : ""}${view.inspecting ? ' data-inspecting="true"' : ""}${view.level.current >= view.level.max ? ' data-max="true"' : ""}${view.acquisition ? ` data-acquisition="${view.acquisition}"` : ""}`;
const shell = (inner: string) =>
  `<span class="sc-ring" aria-hidden="true"></span><span class="sc-frame" aria-hidden="true"></span><span class="sc-face">${inner}</span>`;
const art = (view: SurvivalCardView) =>
  `<span class="sc-art">${view.undiscovered ? '<span class="sc-unknown" aria-hidden="true">？</span>' : view.iconMarkup}</span>`;
const tag = (view: SurvivalCardView) =>
  `<span class="sc-kind-tag"${view.kind === "fusion" ? ' title="上位レア・融合"' : ""}>${kindName(view)}</span>`;
const acquisition = {
  new: ["＋", "新規獲得"],
  "level-up": ["↑", "段階アップ"],
  "fusion-new": ["◆", "融合進化"],
  "fusion-up": ["◆", "融合強化"],
} as const;

/** 3択。button[data-card]を既存の選択処理が操作する。 */
export function renderSurvivalCardL(
  view: SurvivalCardView,
  interactive = true,
): string {
  const action = acquisition[view.acquisition ?? "new"];
  const materials = view.materials
    ?.map((material) => material.name)
    .join(" × ");
  const label = `${action[1]}・${levelText(view.level)}：${view.name}（${kindName(view)}・${familyName[view.family]}）：${view.description}${materials ? ` 素材：${materials}` : ""}`;
  const root = interactive ? "button" : "div";
  return `<${root} ${interactive ? `type="button" data-card="${view.id}"` : 'role="img"'} class="sc-card" ${attrs(view, "L")} aria-label="${esc(label)}">${shell(`<span class="sc-top">${tag(view)}<span class="sc-acq"><b aria-hidden="true">${action[0]}</b>${action[1]}</span></span>${art(view)}<span class="sc-family">${glyph(view.family)}${familyName[view.family]}</span><strong class="sc-name">${esc(view.name)}</strong><span class="sc-level">${pips(view.level)}<span>${esc(levelText(view.level))}</span></span><span class="sc-desc">${esc(view.description)}</span>${view.materials?.length ? `<span class="sc-materials">${view.materials.map((material) => `<span>${material.iconMarkup}${esc(material.name)}</span>`).join('<b aria-hidden="true">×</b>')}</span>` : ""}`)}</${root}>`;
}

/** 基地。deckを省くと獲得済み全候補の閲覧、指定時は候補編集。 */
export function renderSurvivalCardM(view: SurvivalCardView): string {
  const sub = view.undiscovered
    ? "？？ × ？？"
    : view.locked ||
      view.fusionProgress ||
      (view.excluded !== undefined
        ? `${view.excluded ? "除外中" : "抽選対象"} · 最大${view.level.max}段階`
        : `${familyName[view.family]} · 最大${view.level.max}段階`);
  const check =
    view.excluded !== undefined
      ? `<button type="button" class="sc-check sc-exclude" role="checkbox" aria-checked="${view.excluded}" data-pool="${view.id}" aria-label="${esc(view.name)}を抽選から除外"${view.locked ? ' aria-disabled="true"' : ""}><span class="sc-checkbox" aria-hidden="true">${view.locked ? "鍵" : view.excluded ? "−" : ""}</span></button>`
      : view.deck
        ? `<button type="button" class="sc-check" role="checkbox" aria-checked="${view.deck === "in"}" data-pool="${view.id}" aria-label="${esc(view.name)}を候補に含める"${view.locked ? ' aria-disabled="true"' : ""}><span class="sc-checkbox" aria-hidden="true">${view.locked ? "鍵" : view.deck === "in" ? "✓" : ""}</span></button>`
        : "";
  return `<div class="sc-card" ${attrs(view, "M")} ${view.excluded ? 'data-excluded="true"' : ""}>${shell(`<button type="button" class="sc-pick" data-inspect="${view.id}" aria-label="${esc(view.name)}の詳細を見る"${view.inspecting ? ' aria-current="true"' : ""}>${art(view)}<span class="sc-text">${tag(view)}<strong class="sc-name">${esc(view.name)}</strong><small>${esc(sub)}</small></span></button>${check}`)}</div>`;
}

/** 24px HUD。融合記号と段階数字を画像の上に残す。 */
export function renderSurvivalCardS(view: SurvivalCardView): string {
  const label = `${view.name}（${kindName(view)}） ${levelText(view.level)}`;
  return `<span class="sc-card" ${attrs(view, "S")} role="listitem" aria-label="${esc(label)}" title="${esc(label)}">${shell(`${art(view)}${view.kind === "fusion" ? '<b class="sc-fusion-mark" aria-hidden="true">◆</b>' : ""}${view.level.max > 1 ? `<em>${view.level.current >= view.level.max ? "M" : view.level.current}</em>` : ""}`)}</span>`;
}

/** 一時停止と3択中の取得一覧。 */
export function renderSurvivalCardRow(view: SurvivalCardView): string {
  return `<li class="sc-card" ${attrs(view, "row")} data-upgrade="${view.id}">${shell(`${art(view)}<span class="sc-text">${tag(view)}<strong class="sc-name">${esc(view.name)}</strong>${pips(view.level)}<small class="sc-lv">${esc(levelText(view.level))}</small><span class="sc-desc">${esc(view.description)}</span></span>`)}</li>`;
}
