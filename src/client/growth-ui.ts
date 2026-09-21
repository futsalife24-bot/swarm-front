import {
  COSTS,
  SKILLS,
  SKILL_NAMES,
  SWAP_TIMES,
  type Skill,
} from "../shared/progression";
import { resourceFrame } from "./resource-frame";
import "./growth-accessory.css";

const descriptions: Record<Skill, string> = {
  hp: "最大HPを増やし、攻撃に耐えやすくします。1レベルごとに基礎HPの10%を加算します。",
  aim: "照準付近の敵を捉えるAIM補助の角度を広げます。1レベルごとに基準角度の4%を加算します。",
  move: "通常の移動速度を高めます。1レベルごとに基礎速度の3%を加算します。",
  swap: "武器を切り替えてから使えるまでの待ち時間を短縮します。状況に合わせた持ち替えが素早くなります。",
};
const value = (skill: Skill, level: number) =>
  ({
    hp: `${Math.round(160 * (1 + level * 0.1))} HP`,
    aim: `補助角度 +${level * 4}%`,
    move: `移動速度 +${level * 3}%`,
    swap: `${SWAP_TIMES[level]} 秒`,
  })[skill];

export function growthConfirmation(
  before: Record<Skill, number>,
  after: Record<Skill, number>,
) {
  const changed = SKILLS.filter((k) => before[k] !== after[k]);
  const total = (levels: Record<Skill, number>) =>
    SKILLS.reduce((n, k) => n + COSTS[levels[k]], 0);
  const refund = changed.some((k) => after[k] < before[k]);
  return `<div class="growth-confirmation"><ul class="growth-changes">${changed.map((k) => `<li data-growth-change="${k}" class="${after[k] < before[k] ? "is-reduced" : ""}"><div><strong>${SKILL_NAMES[k]}</strong><small>Lv${before[k]} → Lv${after[k]}</small></div><p><span>${value(k, before[k])}</span><span aria-hidden="true"> → </span><strong>${value(k, after[k])}</strong></p></li>`).join("")}</ul><p class="growth-point-change">使用ポイント：${total(before)} → <strong>${total(after)}pt</strong></p>${refund ? `<p class="growth-refund-cost">振り直し費用 ${resourceFrame("coins", 500, "cost")}</p>` : ""}</div>`;
}
const axes: Record<Skill, [number, number]> = {
  hp: [0, -1],
  aim: [1, 0],
  move: [0, 1],
  swap: [-1, 0],
};
const points = (levels: Record<Skill, number>) =>
  SKILLS.map((k) => {
    const r = (levels[k] / (COSTS.length - 1)) * 84;
    return `${150 + axes[k][0] * r},${110 + axes[k][1] * r}`;
  }).join(" ");

export function growthMarkup(
  levels: Record<Skill, number>,
  unlocked: Skill[],
  materials: number,
) {
  return `<div class="growth-radar" aria-label="育成レーダー"><svg viewBox="0 0 300 220" aria-hidden="true">
    ${[0.2, 0.4, 0.6, 0.8, 1].map((n) => `<polygon class="radar-grid" points="150,${110 - 84 * n} ${150 + 84 * n},110 150,${110 + 84 * n} ${150 - 84 * n},110"/>`).join("")}
    <path class="radar-axis" d="M150 26V194M66 110H234"/>
    <polygon class="radar-saved" points="${points(levels)}"/><polygon class="radar-draft" points="${points(levels)}"/>
    <circle cx="150" cy="110" r="3" class="radar-origin"/>
    </svg>${SKILLS.map((k) => `<button class="radar-node radar-${k}" data-growth-focus="${k}" aria-controls="growth-panel-${k}" aria-expanded="false"><span>${SKILL_NAMES[k]}</span><strong data-radar-level="${k}">${unlocked.includes(k) ? `Lv${levels[k]}` : "未解放"}</strong></button>`).join("")}
    <small class="radar-legend">実線：編集中　点線：確定済み</small></div>
    <div class="growth-inspector"><section class="growth-overview"><span class="growth-kicker">SOLDIER / GROWTH</span><h2>能力を選んで育成</h2><p>レーダーの各項目をタップすると、効果を確認してポイントを配分できます。</p><div class="growth-summary">${SKILLS.map((k) => `<button data-growth-focus="${k}" aria-controls="growth-panel-${k}" aria-expanded="false">${SKILL_NAMES[k]}<strong data-growth-summary="${k}">${value(k, levels[k])}</strong></button>`).join("")}</div></section>
    ${SKILLS.map((k) => `<section id="growth-panel-${k}" class="growth-detail" data-growth-panel="${k}" hidden><button class="growth-back" type="button">← 全体を見る</button><h2 tabindex="-1">${SKILL_NAMES[k]}</h2><p>${descriptions[k]}</p><div class="growth-value"><span>確定済み<strong>${value(k, levels[k])}</strong></span><span>編集中<strong data-growth-value="${k}">${value(k, levels[k])}</strong></span></div>${unlocked.includes(k) ? `<label>配分レベル<select data-level="${k}" aria-label="${SKILL_NAMES[k]}の配分レベル">${COSTS.map((cost, i) => `<option value="${i}" ${levels[k] === i ? "selected" : ""}>Lv${i} (${cost}pt)</option>`).join("")}</select></label><div class="growth-steps">${COSTS.map((cost, i) => `<button type="button" data-growth-skill="${k}" data-growth-level="${i}" aria-pressed="${levels[k] === i}">Lv${i}<small>${cost}pt</small></button>`).join("")}</div><small>必要ptは累計です。変更は「配分を確定」で保存します。</small>` : `<p>この能力はまだ解放されていません。</p><button data-unlock="${k}" ${materials ? "" : "disabled"}>能力を解放 ${resourceFrame("materials", 1, "cost")}</button>`}</section>`).join("")}</div>`;
}

export function bindGrowthUI(
  root: HTMLElement,
  saved: Record<Skill, number>,
  budget: number,
  coins: number,
) {
  const workspace = root.querySelector<HTMLElement>(".pt-growth")!;
  let lastTrigger: HTMLButtonElement | null = null;
  root
    .querySelectorAll<HTMLButtonElement>("[data-growth-focus]")
    .forEach((button) => {
      button.onclick = () => {
        lastTrigger = button;
        const skill = button.dataset.growthFocus!;
        workspace.classList.add("is-focused");
        root.querySelector<HTMLElement>(".growth-overview")!.hidden = true;
        root
          .querySelectorAll<HTMLElement>("[data-growth-panel]")
          .forEach(
            (panel) => (panel.hidden = panel.dataset.growthPanel !== skill),
          );
        root
          .querySelectorAll<HTMLElement>("[data-growth-focus]")
          .forEach((node) =>
            node.setAttribute(
              "aria-expanded",
              String(node.dataset.growthFocus === skill),
            ),
          );
        root
          .querySelector<HTMLElement>(`#growth-panel-${skill} h2`)!
          .focus({ preventScroll: true });
      };
    });
  root.querySelectorAll<HTMLButtonElement>(".growth-back").forEach(
    (button) =>
      (button.onclick = () => {
        workspace.classList.remove("is-focused");
        root.querySelector<HTMLElement>(".growth-overview")!.hidden = false;
        root
          .querySelectorAll<HTMLElement>("[data-growth-panel]")
          .forEach((panel) => (panel.hidden = true));
        root
          .querySelectorAll<HTMLElement>("[data-growth-focus]")
          .forEach((node) => node.setAttribute("aria-expanded", "false"));
        lastTrigger?.focus({ preventScroll: true });
      }),
  );
  const update = () => {
    const draft = { ...saved };
    root
      .querySelectorAll<HTMLSelectElement>("[data-level]")
      .forEach(
        (select) =>
          (draft[select.dataset.level as Skill] = Number(select.value)),
      );
    root.querySelector(".radar-draft")!.setAttribute("points", points(draft));
    let total = 0;
    for (const k of SKILLS) {
      total += COSTS[draft[k]];
      if (root.querySelector(`[data-level="${k}"]`))
        root.querySelector(`[data-radar-level="${k}"]`)!.textContent =
          `Lv${draft[k]}`;
      root.querySelector(`[data-growth-value="${k}"]`)!.textContent = value(
        k,
        draft[k],
      );
      root.querySelector(`[data-growth-summary="${k}"]`)!.textContent = value(
        k,
        draft[k],
      );
    }
    root
      .querySelectorAll<HTMLButtonElement>("[data-growth-level]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(
            draft[button.dataset.growthSkill as Skill] ===
              Number(button.dataset.growthLevel),
          ),
        ),
      );
    const apply = root.querySelector<HTMLButtonElement>("#pt-allocate")!;
    const refund = SKILLS.some((k) => draft[k] < saved[k]);
    apply.disabled =
      !SKILLS.some((k) => draft[k] !== saved[k]) ||
      total > budget ||
      (refund && coins < 500);
    apply.textContent =
      total > budget
        ? `ポイント不足（${total - budget}pt）`
        : refund && coins < 500
          ? "振り直しに500コイン必要"
          : refund
            ? "配分を確定（500コイン）"
            : "配分を確定";
  };
  root.querySelectorAll<HTMLButtonElement>("[data-growth-level]").forEach(
    (button) =>
      (button.onclick = () => {
        const select = root.querySelector<HTMLSelectElement>(
          `[data-level="${button.dataset.growthSkill}"]`,
        )!;
        select.value = button.dataset.growthLevel!;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }),
  );
  root
    .querySelectorAll("[data-level]")
    .forEach((select) => select.addEventListener("change", update));
  update();
}
