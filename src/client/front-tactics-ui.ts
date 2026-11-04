import {
  FRONT_SURVIVAL_UNLOCKS,
  emptySurvivalTraining,
  frontSurvivalProgress,
  type FrontSurvivalTraining,
} from "../shared/front-progression";
import { FRONT_UPGRADE_CATALOG } from "../shared/front-upgrades";
import {
  highestClearedStage,
  allocateSurvivalTraining,
} from "./front-campaign";
import { soldier, type ProgressSave, type Receipt } from "./progression-save";
import "./front-tactics.css";

export function survivalBreakthroughRewardMarkup(
  save: ProgressSave,
  receipt: Receipt,
) {
  if (
    !receipt.win ||
    !receipt.first ||
    receipt.difficulty !== "normal" ||
    receipt.stage < 1 ||
    receipt.stage > 7
  )
    return "";
  const stage = receipt.stage;
  const legacy = save.survivalCardVersion !== 1;
  const before = frontSurvivalProgress(stage - 1, legacy);
  const after = frontSurvivalProgress(stage, legacy);
  const rewards = after.unlocked
    .filter((id) => !before.unlocked.includes(id))
    .map((id) => FRONT_UPGRADE_CATALOG[id].name);
  if (after.points > before.points) rewards.push("生存適性 +1pt");
  if (after.rerolls > before.rerolls) rewards.push("再抽選・除外 各+1");
  return rewards.length
    ? `<p class="survival-unlock-reward"><strong>生存の突破特典</strong><br>${rewards.join(" · ")}</p>`
    : "";
}

/** 既存の兵士育成から開く。配分の保存は通常の保存・再試行経路へ渡す。 */
export function openSurvivalTraining(
  save: ProgressSave,
  dialog: (title: string, html: string) => HTMLDialogElement,
  commit: (next: ProgressSave, after: () => void) => boolean,
  after: () => void,
) {
  const stage = highestClearedStage(save);
  const draft = {
    ...(soldier(save).survivalTraining ?? emptySurvivalTraining()),
  };
  const progress = frontSurvivalProgress(
    stage,
    save.survivalCardVersion !== 1,
    draft,
  );
  const d = dialog(
    "生存適性",
    `<section class="survival-tactics"><p>進撃1・4・7突破で各1pt。配分は兵士別・振り直し無料。次の出撃から反映。</p><output id="tactics-budget" aria-live="polite"></output><div class="tactics-branches">${(["rerolls", "exclusions"] as const).map((key) => `<section><h3>${key === "rerolls" ? "再抽選" : "除外"}</h3><p>${key === "rerolls" ? "3択を引き直す回数。毎作戦全回復。" : "抽選から外す枚数。生存カードで指定。"}</p><label>追加枠 <select data-tactics="${key}" aria-label="${key === "rerolls" ? "再抽選" : "除外"}の追加枠">${[0, 1, 2].map((n) => `<option value="${n}" ${draft[key] === n ? "selected" : ""}>+${n}（${n}pt）</option>`).join("")}</select></label><strong data-tactics-total="${key}"></strong></section>`).join("")}</div><p id="tactics-message" role="status"></p><details><summary>進撃の突破報酬を見る</summary><table><thead><tr><th>進撃</th><th>新カード</th><th>抽選・育成</th></tr></thead><tbody>${FRONT_SURVIVAL_UNLOCKS.map((row) => `<tr><th>${row.stage}${stage >= row.stage ? " ✓" : ""}</th><td>${row.ids.map((id) => FRONT_UPGRADE_CATALOG[id].name).join("・")}</td><td>${[1, 4, 7].includes(row.stage) ? "適性 +1pt" : [2, 5].includes(row.stage) ? "再抽選・除外 各+1" : "—"}</td></tr>`).join("")}</tbody></table></details></section>`,
  );
  const footer = document.createElement("footer");
  footer.className = "tactics-actions";
  footer.innerHTML =
    '<button class="primary" id="tactics-save">生存適性を保存</button>';
  d.append(footer);
  const button = d.querySelector<HTMLButtonElement>("#tactics-save")!;
  const update = () => {
    d.querySelector("#tactics-budget")!.textContent =
      `配分 ${draft.rerolls + draft.exclusions}/${progress.points}pt · 進撃${stage}まで突破`;
    let error = "";
    try {
      allocateSurvivalTraining(save, draft);
    } catch (e) {
      error = (e as Error).message;
    }
    d.querySelector("#tactics-message")!.textContent =
      error || "使わないポイントは残せます。配分はいつでも変更できます。";
    button.disabled = !!error;
    const base = frontSurvivalProgress(stage);
    for (const key of ["rerolls", "exclusions"] as const)
      d.querySelector(`[data-tactics-total="${key}"]`)!.textContent =
        `合計 ${base[key] + draft[key]}${key === "rerolls" ? "回 / 作戦" : "枚まで"}`;
  };
  d.querySelectorAll<HTMLSelectElement>("[data-tactics]").forEach((select) => {
    select.onchange = () => {
      draft[select.dataset.tactics as keyof FrontSurvivalTraining] = Number(
        select.value,
      );
      update();
    };
  });
  button.onclick = () => {
    try {
      commit(allocateSurvivalTraining(save, draft), () => {
        d.close();
        after();
      });
    } catch (e) {
      d.querySelector("#tactics-message")!.textContent = (e as Error).message;
    }
  };
  update();
}
