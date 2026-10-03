import type { FrontRunView } from "../shared/front-run";
import {
  FRONT_UPGRADE_CATALOG,
  FRONT_UPGRADE_IDS,
  FRONT_EVOLUTIONS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";

type UpgradeView = Pick<FrontRunView, "levels" | "evolved" | "picks">;
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
const icon = (id: FrontUpgradeId, base: string) =>
  `<img src="${esc(base)}rebuild/upgrades/${id}.png" alt="" width="32" height="32">`;

export function frontUpgradeStrip(view: UpgradeView, base: string) {
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
  const ids = acquired(view);
  return `<section class="front-upgrade-details" aria-label="強化状況"><h2>強化状況 <small>${view.picks}/7</small></h2>${
    ids.length
      ? `<ul>${ids
          .map((id) => {
            const d = FRONT_UPGRADE_CATALOG[id],
              level = view.levels[id];
            const description =
              id === "armor"
                ? `最大体力 +${level * 5}%。取得時に増加分を回復。`
                : id === "reload"
                  ? `装填時間を基準値から${level * 5}%短縮。`
                  : id === "magazine"
                    ? `基準弾倉の10%を切り上げた量（最低1発）を${level}回分追加。`
                    : d.description;
            return `<li data-upgrade="${id}">${icon(id, base)}<div><h3>${esc(d.name)}${d.maxLevel > 1 ? `<small>${level}/${d.maxLevel}段階</small>` : ""}</h3><p>${esc(description)}</p></div></li>`;
          })
          .join("")}</ul>`
      : '<p class="front-upgrade-empty">まだ強化を取得していません。</p>'
  }${view.evolved.length ? `<div class="front-upgrade-evolutions">${view.evolved.map((f) => `<p><strong>進化 · ${esc(FRONT_EVOLUTIONS[f].name)}</strong>${esc(FRONT_EVOLUTIONS[f].description)}</p>`).join("")}</div>` : ""}</section>`;
}
