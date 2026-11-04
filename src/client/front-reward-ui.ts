import { FRONT_RUN_CONFIG, type FrontRunView } from "../shared/front-run";
import { FRONT_UPGRADE_CATALOG, isFrontFusion } from "../shared/front-upgrades";
import { frontUpgradeCardView, frontUpgradeCardCopy } from "./front-upgrade-ui";
import { renderSurvivalCardL } from "./survival-card";

/** 再抽選・再接続では同じ演出を最初からやり直さない。 */
export function frontLevelUpActive(view: FrontRunView, now: number) {
  return (
    view.phase === "selection" &&
    view.offer?.kind === "additional" &&
    view.levelUpAt != null &&
    now < view.levelUpAt + FRONT_RUN_CONFIG.levelUpSeconds
  );
}

export const frontLevelUpMarkup = () =>
  '<section class="front-level-up" role="status" aria-label="レベルアップ。強化カードを表示します"><span class="front-level-line" aria-hidden="true"></span><small>レベルアップ</small><strong>LEVEL UP</strong><p>強化カードを選択</p></section>';

export function frontTreasureMarkup(
  view: FrontRunView,
  base: string,
  revealed: boolean,
) {
  const reward = view.treasure?.reward;
  let result = '<p class="front-treasure-wait">部隊の宝箱を開封中…</p>';
  if (revealed && reward?.kind === "upgrade") {
    result = renderSurvivalCardL(
      {
        ...frontUpgradeCardView(reward.cardId, base),
        description: frontUpgradeCardCopy(
          { ...view, levels: { ...view.levels, [reward.cardId]: reward.from } },
          reward.cardId,
        ).description,
        level: {
          current: reward.from,
          next: reward.to,
          max: FRONT_UPGRADE_CATALOG[reward.cardId].maxLevel,
        },
        acquisition: isFrontFusion(reward.cardId) ? "fusion-up" : "level-up",
      },
      false,
    );
  } else if (revealed && reward && reward.kind !== "upgrade") {
    result = `<div class="front-treasure-bonus"><b>${reward.kind === "heal" ? "＋" : "◈"}</b><strong>${reward.kind === "heal" ? `HP +${reward.amount}` : `コイン +${reward.amount}`}</strong><p>${reward.kind === "heal" ? "全カード最大 · 体力を回復" : "全カード最大 · 帰還時に受け取り"}</p></div>`;
  } else if (revealed)
    result = '<p class="front-treasure-wait">生存中の仲間が報酬を獲得</p>';
  return `<section class="front-treasure" data-revealed="${revealed}" role="status" aria-label="宝箱の報酬"><header><small>ボス撃破報酬</small><h1>${revealed ? "宝箱獲得" : "宝箱を開封"}</h1></header><div class="front-treasure-content">${result}</div></section>`;
}
