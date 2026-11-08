import type { FrontResultRewards } from "./front-result-rewards";
import { gearReadOnlyRows, type GearRowState } from "./gear-weapon-list";

/**
 * 生存終了画面の「獲得報酬」。既存終了section内へ挿入する表示だけを担当する。
 * 計算・保存・再試行は持たない（再試行ボタンと失敗理由は主担当の既存表示）。
 * 武器は出撃準備と同じ1丁1行・同じ性能列で、右端のロック位置に保存状態を出す。
 */
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const WEAPON_STATES: Record<
  FrontResultRewards["weapons"][number]["state"],
  GearRowState
> = {
  stored: { key: "stored", label: "保存済", title: "所持武器に保存済み" },
  pending: {
    key: "pending",
    label: "保留",
    title: "所持上限を超えたため保留（保存済み・出撃準備で整理）",
  },
  unsaved: {
    key: "unsaved",
    label: "未保存",
    title: "保存を確認できていません",
  },
};

export function frontResultRewardsMarkup(rewards: FrontResultRewards): string {
  const chips: string[] = [];
  if (rewards.coins !== null) {
    // campaign が空の間は保存確定と表示しない（獲得予定額のまま）。
    const state = rewards.campaign
      ? ["stored", "保存済"]
      : rewards.error
        ? ["unsaved", "未保存"]
        : ["planned", "獲得予定"];
    chips.push(
      `<li class="fr-chip" data-state="${state[0]}"><span>攻略コイン</span><b>+${rewards.coins}</b>${rewards.treasureCoins > 0 ? `<small>宝箱${rewards.treasureCoins}を含む</small>` : ""}<em>${state[1]}</em></li>`,
    );
  }
  if (rewards.progress)
    chips.push(
      `<li class="fr-chip" data-state="stored"><span>${esc(rewards.progress)}</span></li>`,
    );
  else if (rewards.error)
    chips.push(
      '<li class="fr-chip" data-state="unsaved"><span>功績</span><em>未保存</em></li>',
    );
  const count = (s: keyof typeof WEAPON_STATES) =>
    rewards.weapons.filter((w) => w.state === s).length;
  if (rewards.eligible) {
    const parts = (["stored", "pending", "unsaved"] as const)
      .map((s) => [WEAPON_STATES[s].label, count(s)] as const)
      .filter(([, n]) => n > 0)
      .map(([label, n]) => `${label}${n}`);
    chips.push(
      `<li class="fr-chip"><span>武器</span><b>${rewards.weapons.length}丁</b>${parts.length ? `<small>${parts.join("・")}</small>` : ""}</li>`,
    );
  }

  let body: string;
  if (!rewards.eligible)
    body = '<p class="fr-note">今回の結果は武器・攻略コインの対象外です。</p>';
  else if (!rewards.weapons.length)
    body =
      '<p class="fr-note">今回の武器はありません。武器は60秒以上かつ1撃破から獲得できます。</p>';
  else {
    const notes = [
      count("pending")
        ? "保留＝所持上限を超えた分。保存済みで、出撃準備の整理待ちです。"
        : "",
      count("unsaved") ? "未保存＝保存を確認できていない武器です。" : "",
    ].filter(Boolean);
    body = `${gearReadOnlyRows(
      rewards.weapons.map(({ weapon, state }) => ({
        weapon,
        state: WEAPON_STATES[state],
      })),
      "今回の武器",
      "ロック",
      { locks: rewards.save?.locks ?? [] },
    )}${notes.map((n) => `<p class="fr-note">${n}</p>`).join("")}`;
  }

  return `<section class="fr-rewards" aria-labelledby="fr-rewards-title"><div class="fr-rewards-head"><h2 id="fr-rewards-title">獲得報酬</h2><ul class="fr-rewards-sum">${chips.join("")}</ul></div>${body}</section>`;
}
