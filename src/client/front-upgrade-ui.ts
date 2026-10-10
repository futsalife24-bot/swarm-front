import type { FrontRunView } from "../shared/front-run";
import * as legacyUi from "./front-legacy-upgrade-ui";
import {
  FRONT_UPGRADE_CATALOG as legacyCatalog,
  type FrontUpgradeId as LegacyId,
} from "../shared/front-legacy-upgrades";
import {
  FRONT_UPGRADE_CATALOG,
  FRONT_FUSIONS,
  FRONT_FUSION_IDS,
  isFrontFusion,
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
function fusionAbility(id: FrontUpgradeId, n: number): string {
  switch (id) {
    case "fusion-aegis":
      return `回避後の防御を${2 + 0.5 * n}秒に延長。回避も速く回せる。`;
    case "fusion-collector":
      return `広範囲の経験値回収で体力${3 + n}回復。${3 - 0.5 * n}秒に1回。`;
    case "fusion-reactor":
      return `2回命中で強化爆発。中心の敵へさらに${20 * n}ダメージ。`;
    case "fusion-collapse":
      return "印の爆発が、近くの印へ連鎖する。";
    case "fusion-skewer":
      return "跳弾で倒すと、次の一発の威力と貫通がアップ。";
    case "fusion-counter":
      return "地雷が爆発すると、次の命中に追撃弾。";
    case "fusion-bastion":
      return `敵を倒すたび体力${3 + n}回復。最大体力も${(4 + n) * 5}%アップ。`;
    case "fusion-magazine":
      return `装填を${(4 + n) * 5}%短縮。弾倉容量も大幅アップ。`;
    case "fusion-overdrive":
      return `射撃の威力${(3 + n) * 10}%アップ。倒すたび${3 + n}発補充。`;
    default:
      return "";
  }
}
export function frontUpgradeEffect(id: FrontUpgradeId, level: number): string {
  const n = Math.max(1, level);
  if (isFrontFusion(id))
    return `${fusionAbility(id, n)} ${FRONT_FUSIONS[id].map((material) => `${FRONT_UPGRADE_CATALOG[material].name}：${id === "fusion-collector" && material === "recovery-pack" ? `回収時${3 + n}HP回復（${3 - 0.5 * n}秒に1回）。` : id === "fusion-aegis" && material === "emergency-armor" ? `${2 + 0.5 * n}秒、被ダメージ −${(3 + n) * 10}%。` : frontUpgradeEffect(material, FRONT_UPGRADE_CATALOG[material].maxLevel + n)}`).join(" ")}`;
  switch (id) {
    case "boost-coil":
      return `回避の待ち時間 −${Math.min(48, n * 8)}%。`;
    case "recovery-pack":
      return `経験値を拾うと${n}HP回復。3秒に1回。`;
    case "burst-cell":
      return `爆発・地雷の威力 +${Math.min(48, n * 8)}%。`;
    case "life-drain":
      return `撃破時に${n}HP回復。`;
    case "power-cell":
      return `手動射撃の威力 +${n * 10}%。`;
    case "reserve-rounds":
      return `手動射撃で撃破時、弾倉に${n}発返却。`;
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
const atlasIds: readonly FrontUpgradeId[] = [
  "life-drain",
  "power-cell",
  "reserve-rounds",
  ...FRONT_FUSION_IDS.slice(0, 6),
];
const icon = (id: FrontUpgradeId, base: string, card = false) => {
  const index = atlasIds.indexOf(id);
  return index < 0
    ? `<img class="${card ? "rebuild-card-icon" : ""}" src="${esc(frontUpgradeIcon(id, base))}" alt="" width="${card ? 96 : 32}" height="${card ? 96 : 32}">`
    : `<span aria-hidden="true" class="front-atlas-icon ${card ? "rebuild-card-icon" : ""}" style="background-image:url('${esc(base)}rebuild/upgrades/fusion-atlas.png');background-position:${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%"></span>`;
};
/** 基地でも戦闘と同じ画像・アトラス切り出しを使う。 */
export const frontUpgradeIconMarkup = icon;

export function frontUpgradeStrip(view: UpgradeView, base: string) {
  if (view.growthVersion === 1) return legacyUi.frontUpgradeStrip(view, base);
  const ids = acquired(view);
  if (!ids.length) return "";
  return `<div class="front-upgrade-strip" role="list" aria-label="取得済み強化">${ids
    .map((id) => {
      const d = FRONT_UPGRADE_CATALOG[id],
        level = view.levels[id];
      return `<span class="front-upgrade-mini${isFrontFusion(id) ? " front-fused" : ""}" role="listitem" aria-label="${esc(d.name)}${d.maxLevel > 1 ? ` ${level}段階` : ""}" title="${esc(d.name)}">${icon(id, base)}${d.maxLevel > 1 ? `<em>${level}</em>` : ""}</span>`;
    })
    .join("")}</div>`;
}

export function frontUpgradeDetails(
  view: UpgradeView,
  base: string,
  discovered: readonly FrontUpgradeId[] = [],
) {
  if (view.growthVersion === 1) return legacyUi.frontUpgradeDetails(view, base);
  const ids = acquired(view);
  return `<section class="front-upgrade-details" aria-label="強化状況"><h2>強化状況 <small>${view.growthVersion === 3 ? `${acquired(view).length}/6枠 · 取得${view.picks}回` : `${view.picks}/${view.maxPicks ?? FRONT_MAX_PICKS}`}</small></h2>${
    ids.length
      ? `<ul>${ids
          .map((id) => {
            const d = FRONT_UPGRADE_CATALOG[id],
              level = view.levels[id];
            const description = frontUpgradeEffect(id, level);
            return `<li data-upgrade="${id}"${isFrontFusion(id) ? ' class="front-fused"' : ""}>${icon(id, base)}<div><h3>${esc(d.name)}${d.maxLevel > 1 ? `<small>${level}/${view.growthVersion === 1 && d.family !== "generic" ? 1 : d.maxLevel}段階</small>` : ""}</h3><p>${esc(description)}</p></div></li>`;
          })
          .join("")}</ul>`
      : '<p class="front-upgrade-empty">まだ強化を取得していません。</p>'
  }${view.growthVersion !== 3 && view.evolved.length ? `<div class="front-upgrade-evolutions">${view.evolved.map((f) => `<p><strong>進化 · ${esc(FRONT_EVOLUTIONS[f].name)}</strong>${esc(FRONT_EVOLUTIONS[f].description)}</p>`).join("")}</div>` : ""}<div class="front-evolution-progress${view.growthVersion === 3 ? " front-fusion-list" : ""}"><div class="front-fusion-heading"><h3>${view.growthVersion === 3 ? "融合条件" : "進化条件"}</h3>${view.growthVersion === 3 ? '<span class="front-fusion-rule">融合元の能力をレベルMAXで融合可能。1枠空く</span>' : ""}</div>${
    view.growthVersion === 3
      ? FRONT_FUSION_IDS.map(
          (f) =>
            `<p>${FRONT_UPGRADE_CATALOG[f].name}＝${view.levels[f] || discovered.includes(f) ? FRONT_FUSIONS[f].map((id) => FRONT_UPGRADE_CATALOG[id].name).join(" × ") : "？？ × ？？"}</p>`,
        ).join("")
      : view.growthVersion === 1
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
      intent: "legacy",
      status: "",
      rank: "",
    };
  }
  const d = FRONT_UPGRADE_CATALOG[id];
  const description = isFrontFusion(id)
    ? fusionAbility(id, (view.levels[id] || 0) + 1)
    : frontUpgradeEffect(id, (view.levels[id] || 0) + 1);
  return {
    name: d.name,
    family: d.family,
    aria:
      description +
      (isFrontFusion(id)
        ? ` 素材：${FRONT_FUSIONS[id].map((m) => FRONT_UPGRADE_CATALOG[m].name).join(" × ")}`
        : ""),
    description,
    prefix: `${view.levels[id] ? `${view.levels[id]} → ${view.levels[id] + 1}段階` : "新規"} · `,
    intent: isFrontFusion(id) ? "fusion" : view.levels[id] ? "level-up" : "new",
    status: isFrontFusion(id)
      ? view.levels[id]
        ? "融合強化"
        : "融合進化"
      : view.levels[id]
        ? "段階アップ"
        : "新規獲得",
    rank: view.levels[id]
      ? `${view.levels[id]} → ${view.levels[id] + 1}段階`
      : isFrontFusion(id)
        ? "2枠 → 1枠 · 1段階"
        : "未取得 → 1段階",
  };
}

export function frontUpgradeCardMarkup(
  view: UpgradeView,
  id: FrontUpgradeId,
  base: string,
) {
  const d = frontUpgradeCardCopy(view, id);
  const family = {
    explosion: "爆発",
    piercing: "貫通",
    interception: "迎撃",
    generic: "補強",
  }[d.family];
  const modern = d.intent !== "legacy";
  const sources = isFrontFusion(id)
    ? `<span class="front-fusion-sources">${FRONT_FUSIONS[id].map((material) => `<span>${icon(material, base)}<span>${esc(FRONT_UPGRADE_CATALOG[material].name)}</span></span>`).join("<b>×</b>")}</span>`
    : "";
  return `<button class="rebuild-card${isFrontFusion(id) ? " front-fused" : ""}" data-card="${id}"${modern ? ` data-acquisition="${d.intent}"` : ""} aria-label="${modern ? `${d.status}・${d.rank}：` : ""}${esc(d.name)}：${esc(d.aria)}">${modern ? `<span class="front-acquisition"><span aria-hidden="true">${d.intent === "new" ? "＋" : "↑"}</span>${d.status}</span>` : ""}${icon(id, base, true)}<span class="rebuild-card-kind">${modern ? `<b class="front-card-rank">${d.rank}</b>${isFrontFusion(id) ? "" : " · "}` : ""}${isFrontFusion(id) ? "" : family}</span><strong>${esc(d.name)}</strong><span class="rebuild-card-description">${esc(d.description)}</span>${sources}</button>`;
}
