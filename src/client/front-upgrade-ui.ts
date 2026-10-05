import type { FrontRunView } from "../shared/front-run";
import * as legacyUi from "./front-legacy-upgrade-ui";
import {
  FRONT_UPGRADE_CATALOG as legacyCatalog,
  type FrontUpgradeId as LegacyId,
} from "../shared/front-legacy-upgrades";
import {
  FRONT_UPGRADE_CATALOG,
  FRONT_UPGRADE_IDS,
  FRONT_EVOLUTIONS,
  FRONT_EVOLUTION_RECIPES,
  FRONT_MAX_PICKS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";

type UpgradeView = Pick<FrontRunView, "levels" | "evolved" | "picks"> &
  Partial<Pick<FrontRunView, "maxPicks" | "growthVersion">>;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const acquired = (view: UpgradeView) =>
  FRONT_UPGRADE_IDS.filter((id) => view.levels[id] > 0);
export const frontUpgradeIcon = (id: FrontUpgradeId, base: string) =>
  `${base}rebuild/upgrades/${id}.png`;
export function frontUpgradeEffect(id: FrontUpgradeId, level: number): string {
  const n = Math.max(1, level);
  switch (id) {
    case "blast-core":
      return `射撃撃破で爆発。爆発威力 ${Math.round(42 * (1 + 0.3 * (n - 1)))}。`;
    case "fuse":
      return `命中で印、次の命中で起爆。威力 ${Math.round(34 * (1 + 0.3 * (n - 1)))}。`;
    case "compressed-charge":
      return `同じ敵に${n >= 3 ? 2 : 3}回命中で爆発。威力 ${Math.round(42 * (1 + 0.3 * (n - 1)))}。`;
    case "armor-piercer":
      return `貫通対象 +${n}体。`;
    case "ricochet":
      return `3回命中で跳弾。威力 ${Math.round(32 * (1 + 0.4 * (n - 1)))}。`;
    case "line-shot":
      return `貫通 +${n}体。3体命中で${n}発返却。`;
    case "afterimage-mine":
      return `回避後に地雷。最大${n + 2}個・威力 ${Math.round(65 * (1 + 0.3 * (n - 1)))}。`;
    case "tactical-reload":
      return `回避後、次の装填時間 −${35 + 10 * (n - 1)}%。`;
    case "interceptor":
      return `命中で充填、装填時に迎撃。威力 ${Math.round(35 * (1 + 0.4 * (n - 1)))}。`;
    case "armor":
      return `最大体力 +${n * 5}%。生存中の取得時は増加分を回復。`;
    case "reload":
      return `装填時間を基準値から${n * 5}%短縮。`;
    case "magazine":
      return `基準弾倉の10%切上げ（最低1発）を${n}回分追加。`;
    case "magnet":
      return `経験値の回収半径 ${5 + 3 * n}m。`;
    case "blast-radius":
      return `爆発・地雷の半径 +${20 * n}%。`;
    case "opening-shot":
      return `装填完了後、その武器の初弾威力 +${25 * n}%。`;
    case "emergency-armor":
      return `回避終了後2秒、被ダメージ −${10 * n}%。`;
  }
}
const icon = (id: FrontUpgradeId, base: string) =>
  `<img src="${esc(frontUpgradeIcon(id, base))}" alt="" width="32" height="32">`;

export function frontUpgradeStrip(view: UpgradeView, base: string) {
  if (view.growthVersion === 1) return legacyUi.frontUpgradeStrip(view, base);
  const ids = acquired(view);
  if (!ids.length) return "";
  return `<div class="front-upgrade-strip" role="list" aria-label="取得済み強化">${ids
    .map((id) => {
      const d = FRONT_UPGRADE_CATALOG[id],
        level = view.levels[id];
      return `<span class="front-upgrade-mini" role="listitem" aria-label="${esc(d.name)}${d.maxLevel > 1 ? ` ${level}段階` : ""}" title="${esc(d.name)}">${icon(id, base)}${d.maxLevel > 1 ? `<em>${level}</em>` : ""}</span>`;
    })
    .join("")}</div>`;
}

export function frontUpgradeDetails(view: UpgradeView, base: string) {
  if (view.growthVersion === 1) return legacyUi.frontUpgradeDetails(view, base);
  const ids = acquired(view);
  return `<section class="front-upgrade-details" aria-label="強化状況"><h2>強化状況 <small>${view.picks}/${view.maxPicks ?? FRONT_MAX_PICKS}</small></h2>${
    ids.length
      ? `<ul>${ids
          .map((id) => {
            const d = FRONT_UPGRADE_CATALOG[id],
              level = view.levels[id];
            const description = frontUpgradeEffect(id, level);
            return `<li data-upgrade="${id}">${icon(id, base)}<div><h3>${esc(d.name)}${d.maxLevel > 1 ? `<small>${level}/${view.growthVersion === 1 && d.family !== "generic" ? 1 : d.maxLevel}段階</small>` : ""}</h3><p>${esc(description)}</p></div></li>`;
          })
          .join("")}</ul>`
      : '<p class="front-upgrade-empty">まだ強化を取得していません。</p>'
  }${view.evolved.length ? `<div class="front-upgrade-evolutions">${view.evolved.map((f) => `<p><strong>進化 · ${esc(FRONT_EVOLUTIONS[f].name)}</strong>${esc(FRONT_EVOLUTIONS[f].description)}</p>`).join("")}</div>` : ""}<div class="front-evolution-progress"><h3>進化条件</h3>${
    view.growthVersion === 1
      ? "<p>更新前の作戦：同系統3種で進化。</p>"
      : Object.entries(FRONT_EVOLUTION_RECIPES)
          .map(
            ([family, recipe]) =>
              `<p>${FRONT_EVOLUTIONS[family as keyof typeof FRONT_EVOLUTIONS].name}：${FRONT_UPGRADE_CATALOG[recipe.main].name} ${view.levels[recipe.main]}/${FRONT_UPGRADE_CATALOG[recipe.main].maxLevel} ＋ ${FRONT_UPGRADE_CATALOG[recipe.support].name} ${view.levels[recipe.support] > 0 ? "取得済み" : "未取得"}${view.evolved.includes(family as keyof typeof FRONT_EVOLUTIONS) ? " · 進化済み" : " → PRISM／大型を撃破"}</p>`,
          )
          .join("")
  }</div></section>`;
}

export function frontUpgradeCardCopy(view: UpgradeView, id: FrontUpgradeId) {
  if (view.growthVersion === 1) {
    const d = legacyCatalog[id as LegacyId];
    return {
      name: d.name,
      family: d.family,
      aria: d.description,
      description: legacyUi.legacyUpgradeCopy[id as LegacyId],
      prefix: "",
    };
  }
  const d = FRONT_UPGRADE_CATALOG[id];
  const description = frontUpgradeEffect(id, view.levels[id] + 1);
  return {
    name: d.name,
    family: d.family,
    aria: description,
    description,
    prefix: `${view.levels[id] ? `${view.levels[id]} → ${view.levels[id] + 1}段階` : "新規"} · `,
  };
}
