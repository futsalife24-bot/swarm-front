import "./front-base.css";
import {
  FRONT_BASE_IDS,
  FRONT_FAMILY_CARDS,
  FRONT_FUSIONS,
  FRONT_FUSION_IDS,
  FRONT_UPGRADE_CATALOG as catalog,
  isFrontFusion,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import {
  readFrontCampaign,
  readFrontLoadout,
  saveFrontLoadout,
  validateFrontLoadout,
  FRONT_CAMPAIGN_UNLOCKS,
} from "./front-campaign";
import { readFrontDecks, saveFrontDeck } from "./front-decks";
import { readFrontProgress, type FrontStorage } from "./front-progress";
import { frontUpgradeEffect, frontUpgradeIconMarkup } from "./front-upgrade-ui";
import { menuMotion, menuTrace } from "./menu-effects";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const families = {
  explosion: "爆発",
  piercing: "貫通",
  interception: "迎撃",
  generic: "補強",
};
/** 保存・出撃反映は明示ボタンだけ。詳細閲覧、素材追加、呼び出しは編集中の値に限定。 */
export function openFrontBase(
  root: HTMLElement,
  storage: FrontStorage,
  back: () => void,
) {
  const campaign = readFrontCampaign(storage),
    progress = readFrontProgress(storage).progress;
  let draft = readFrontLoadout(storage),
    decks = readFrontDecks(storage),
    slot = 0;
  let selected: FrontUpgradeId = "blast-core",
    tab: "upgrades" | "fusions" = "upgrades",
    loadoutDirty = false,
    nameDirty = false;
  const icon = (id: FrontUpgradeId) =>
    frontUpgradeIconMarkup(id, import.meta.env.BASE_URL);
  const locked = (id: FrontUpgradeId) => !campaign.unlocked.includes(id);
  const unlock = (id: FrontUpgradeId) =>
    `攻略${FRONT_CAMPAIGN_UNLOCKS.find((r) => r.ids.includes(id))?.stage ?? ""}クリアで解放`;
  root.innerHTML = `<section class="panel menu-screen pt-screen front-base" aria-label="基地・デッキ編成">
    <header class="menu-header base-header"><h1>基地</h1><span class="base-service">${progress.wins}勝 · ${progress.credits}功績</span><nav><button id="front-save-pool" class="primary">出撃にセット</button><button id="base-back">戻る</button></nav></header>
    <div class="base-deck-bar"><label class="sr-only" for="base-slot">保存デッキ</label><select id="base-slot"></select><label class="sr-only" for="base-name">デッキ名</label><input id="base-name" maxlength="24" placeholder="デッキ名（24文字まで）"><button id="base-store">デッキ保存</button><button id="base-load">呼び出す</button><span id="base-count"></span></div>
    <div class="base-workbench"><section class="base-catalog" aria-label="強化候補">
      <div class="base-initial" aria-label="開幕の3択">${Object.entries(
        FRONT_FAMILY_CARDS,
      )
        .map(
          ([family, ids], i) =>
            `<label><span>${families[family as keyof typeof families]} · 開幕</span><span class="base-initial-choice"><span data-initial-icon="${i}">${icon(draft.initialCards[i])}</span><select data-initial="${family}" aria-label="開幕の${families[family as keyof typeof families]}候補">${ids
              .filter((id) => campaign.initialUnlocked.includes(id))
              .map(
                (id) =>
                  `<option value="${id}" ${draft.initialCards[i] === id ? "selected" : ""}>${catalog[id].name}</option>`,
              )
              .join("")}</select></span></label>`,
        )
        .join("")}</div>
      <div class="base-catalog-heading"><div role="tablist" aria-label="強化と融合"><button id="base-upgrades" role="tab" aria-selected="true" aria-controls="base-grid">強化 ${FRONT_BASE_IDS.length}</button><button id="base-fusions" role="tab" aria-selected="false" aria-controls="base-grid" tabindex="-1">融合 ${FRONT_FUSION_IDS.length}</button></div><span id="base-fusion-count"></span></div>
      <div id="base-grid" role="tabpanel" aria-labelledby="base-upgrades" tabindex="0"></div>
    </section><aside id="base-detail" class="base-detail" aria-label="強化・融合の説明"></aside></div>
    <p id="front-pool-status" role="status">${esc(draft.error || decks.error || "候補は6種以上。デッキはこの端末に保存。出撃には「出撃にセット」。")}</p>
  </section>`;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const name = $<HTMLInputElement>("base-name"),
    slots = $<HTMLSelectElement>("base-slot");
  function message(text: string, saved = false) {
    $("front-pool-status").textContent = text;
    if (saved) menuTrace($("front-pool-status"), true);
  }
  function slotOptions() {
    slots.innerHTML = decks.slots
      .map(
        (d, i) =>
          `<option value="${i}" ${slot === i ? "selected" : ""}>${i + 1} · ${esc(d?.name ?? "未保存")}</option>`,
      )
      .join("");
    $("base-load").toggleAttribute("disabled", !decks.slots[slot]);
  }
  function changed() {
    loadoutDirty = true;
    message(
      "編集中 · 出撃に使うには「出撃にセット」。デッキ保存で別の構成も残せます。",
    );
    render();
  }
  function detail(focus = false) {
    const d = catalog[selected],
      fusion = isFrontFusion(selected);
    const recipes = isFrontFusion(selected)
      ? [selected]
      : FRONT_FUSION_IDS.filter((f) => FRONT_FUSIONS[f].includes(selected));
    $("base-detail").innerHTML =
      `<div class="base-detail-title ${fusion ? "is-fusion" : ""}">${icon(selected)}<div><small>${fusion ? "融合完成形" : `${families[d.family]} · 最大${d.maxLevel}段階`}</small><h2 id="base-detail-name" tabindex="-1">${d.name}</h2></div></div>
      <p class="base-effect">${esc(fusion ? d.description : frontUpgradeEffect(selected, 1))}</p>${fusion ? "" : `<details class="base-ranks"><summary>最大段階の効果</summary><p>${esc(frontUpgradeEffect(selected, d.maxLevel))}</p></details>`}
      ${!fusion && locked(selected) ? `<p class="base-locked-note">${unlock(selected)}</p>` : ""}
      <section class="base-recipes"><h3>${fusion ? "融合レシピ" : "この強化から狙える融合"}</h3>${
        recipes.length
          ? recipes
              .map((f) => {
                const recipe = FRONT_FUSIONS[f],
                  ready = recipe.every((id) => draft.pool.includes(id));
                return `<div class="base-recipe" data-ready="${ready}">${!fusion ? `<button data-detail="${f}" class="base-fusion-result">${icon(f)}<strong>${catalog[f].name}</strong><span aria-hidden="true">?</span></button>` : ""}<div class="base-recipe-materials">${recipe.map((id) => `<button data-detail="${id}" aria-label="${catalog[id].name}の効果を見る">${icon(id)}<span>${catalog[id].name}<small>${locked(id) ? unlock(id) : draft.pool.includes(id) ? "✓ 候補に選択中" : "候補に未選択"}</small></span></button>`).join('<b aria-hidden="true">＋</b>')}</div><p>${ready ? "素材2種を候補に選択済み" : "素材を候補へ加えて、融合を狙おう"}</p><button data-add-recipe="${f}" ${recipe.some(locked) || ready ? "disabled" : ""}>${recipe.some(locked) ? "未解放の素材あり" : ready ? "素材を選択済み" : "素材2種を候補に加える"}</button></div>`;
              })
              .join("")
          : '<p class="base-no-recipe">この強化を素材にする融合はありません。</p>'
      }<p class="base-fusion-rule">作戦中に素材2種をそれぞれ最大段階へ育てると、融合が抽選候補に登場。2枠が1枠になり、完成形はさらに3段階まで育成できます。</p></section>${fusion ? `<details class="base-ranks"><summary>融合後の詳しい効果</summary><p>1段階：${esc(frontUpgradeEffect(selected, 1))}</p><p>最大段階：${esc(frontUpgradeEffect(selected, 3))}</p></details>` : ""}`;
    $("base-detail")
      .querySelectorAll<HTMLButtonElement>("[data-detail]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            selected = b.dataset.detail as FrontUpgradeId;
            detail(true);
          }),
      );
    $("base-detail")
      .querySelectorAll<HTMLButtonElement>("[data-add-recipe]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const id = b.dataset.addRecipe as (typeof FRONT_FUSION_IDS)[number];
            draft.pool = [...new Set([...draft.pool, ...FRONT_FUSIONS[id]])];
            changed();
            $("base-detail-name").focus({ preventScroll: true });
          }),
      );
    $("base-detail").scrollTop = 0;
    if (focus) $("base-detail-name").focus({ preventScroll: true });
  }
  function render() {
    $("base-count").textContent = `候補 ${draft.pool.length}種`;
    const readyCount = FRONT_FUSION_IDS.filter((f) =>
      FRONT_FUSIONS[f].every((id) => draft.pool.includes(id)),
    ).length;
    $("base-fusion-count").textContent =
      `狙える融合 ${readyCount}/${FRONT_FUSION_IDS.length}`;
    const grid = $("base-grid"),
      scroll = grid.scrollTop;
    grid.innerHTML = (tab === "upgrades" ? FRONT_BASE_IDS : FRONT_FUSION_IDS)
      .map((id) => {
        const d = catalog[id],
          fusion = isFrontFusion(id),
          active = draft.pool.includes(id);
        const unavailable = fusion
          ? FRONT_FUSIONS[id].some(locked)
          : locked(id);
        const isInitial = draft.initialCards.includes(id);
        const note = fusion
          ? `${FRONT_FUSIONS[id].filter((m) => draft.pool.includes(m)).length}/2 素材選択`
          : unavailable
            ? unlock(id)
            : isInitial
              ? "開幕候補"
              : families[d.family];
        return `<div class="base-tile" data-family="${fusion ? "fusion" : d.family}" data-selected="${active}" data-locked="${unavailable}"><button class="base-tile-pick" data-pool="${id}" ${fusion ? `aria-label="${d.name}の融合レシピを見る"` : `aria-pressed="${active}" aria-label="${d.name}を候補${active ? "から外す" : "に加える"}" ${unavailable || isInitial ? 'aria-disabled="true"' : ""}`}>${icon(id)}<span><strong>${d.name}</strong><small>${note}</small></span>${fusion ? '<em aria-hidden="true">◇</em>' : `<em aria-hidden="true">${unavailable ? "鍵" : active ? "✓" : "＋"}</em>`}</button><button class="base-help" data-help="${id}" aria-label="${d.name}の効果・融合を見る">?</button></div>`;
      })
      .join("");
    grid.scrollTop = scroll;
    grid.querySelectorAll<HTMLButtonElement>("[data-pool]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.pool as FrontUpgradeId;
          selected = id;
          if (isFrontFusion(id)) {
            detail();
            return;
          }
          if (locked(id) || draft.initialCards.includes(id)) {
            message(
              locked(id)
                ? unlock(id)
                : "開幕候補は抽選候補にも必要です。上の開幕候補から変更できます。",
            );
            detail();
            return;
          }
          draft.pool = draft.pool.includes(id)
            ? draft.pool.filter((v) => v !== id)
            : [...draft.pool, id];
          changed();
          const replacement = grid.querySelector<HTMLButtonElement>(
            `[data-pool="${id}"]`,
          )!;
          replacement.focus({ preventScroll: true });
          menuMotion(replacement, [{ opacity: 0.65 }, { opacity: 1 }], 160);
        }),
    );
    grid.querySelectorAll<HTMLButtonElement>("[data-help]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.help as FrontUpgradeId;
          detail(true);
        }),
    );
    detail();
  }
  // 上書き・編集破棄の確認はゲーム内のキーボード対応ダイアログで行う。
  function confirmAction(text: string, label: string, action: () => void) {
    const dialog = document.createElement("dialog");
    dialog.className = "base-confirm";
    dialog.setAttribute("aria-labelledby", "base-confirm-title");
    dialog.innerHTML = `<h2 id="base-confirm-title">${esc(text)}</h2><div><button data-cancel autofocus>キャンセル</button><button data-confirm>${label}</button></div>`;
    root.append(dialog);
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")!.onclick = () =>
      dialog.close();
    dialog.querySelector<HTMLButtonElement>("[data-confirm]")!.onclick = () => {
      dialog.close();
      action();
    };
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
  }
  function attempt(action: () => void) {
    try {
      action();
    } catch (e) {
      message(`保存・反映できませんでした：${(e as Error).message}`);
    }
  }
  $("front-save-pool").onclick = () =>
    attempt(() => {
      saveFrontLoadout(storage, draft);
      loadoutDirty = false;
      message(
        nameDirty
          ? "出撃にセットしました。デッキ名の変更は未保存です。"
          : "出撃にセットしました。次のソロ・協力出撃から反映します。",
        true,
      );
    });
  $("base-store").onclick = () =>
    attempt(() => {
      validateFrontLoadout(storage, draft);
      if (!name.value.trim()) throw new Error("デッキ名を入力してください。");
      const save = () =>
        attempt(() => {
          saveFrontDeck(storage, slot, {
            name: name.value,
            loadout: {
              pool: [...draft.pool],
              initialCards: [...draft.initialCards],
            },
          });
          decks = readFrontDecks(storage);
          loadoutDirty = false;
          nameDirty = false;
          slotOptions();
          message(
            `「${decks.slots[slot]!.name}」を保存しました。出撃へは「出撃にセット」で反映します。`,
            true,
          );
        });
      if (decks.slots[slot])
        confirmAction(
          `「${decks.slots[slot]!.name}」を上書きしますか？`,
          "上書き保存",
          save,
        );
      else save();
    });
  $("base-load").onclick = () => {
    const load = () =>
      attempt(() => {
        const stored = decks.slots[slot];
        if (!stored) return;
        validateFrontLoadout(storage, stored.loadout);
        draft = { ...structuredClone(stored.loadout), error: "" };
        name.value = stored.name;
        loadoutDirty = false;
        nameDirty = false;
        root
          .querySelectorAll<HTMLSelectElement>("[data-initial]")
          .forEach((el, i) => {
            el.value = draft.initialCards[i];
            root.querySelector(`[data-initial-icon="${i}"]`)!.innerHTML = icon(
              draft.initialCards[i],
            );
          });
        render();
        message(
          `「${stored.name}」を呼び出しました。出撃に使うには「出撃にセット」。`,
        );
      });
    if (loadoutDirty || nameDirty)
      confirmAction("編集中の変更を破棄して呼び出しますか？", "呼び出す", load);
    else load();
  };
  slots.onchange = () => {
    slot = Number(slots.value);
    slotOptions();
  };
  name.oninput = () => {
    nameDirty = true;
  };
  root.querySelectorAll<HTMLSelectElement>("[data-initial]").forEach(
    (el, i) =>
      (el.onchange = () => {
        draft.initialCards[i] = el.value as FrontUpgradeId;
        draft.pool = [...new Set([...draft.pool, ...draft.initialCards])];
        root.querySelector(`[data-initial-icon="${i}"]`)!.innerHTML = icon(
          draft.initialCards[i],
        );
        selected = draft.initialCards[i];
        changed();
      }),
  );
  for (const mode of ["upgrades", "fusions"] as const) {
    $("base-" + mode).onclick = () => {
      tab = mode;
      for (const other of ["upgrades", "fusions"]) {
        $("base-" + other).setAttribute(
          "aria-selected",
          String(mode === other),
        );
        $("base-" + other).tabIndex = mode === other ? 0 : -1;
      }
      $("base-grid").setAttribute("aria-labelledby", "base-" + mode);
      $("base-grid").scrollTop = 0;
      if (mode === "fusions") selected = FRONT_FUSION_IDS[0];
      render();
    };
    $("base-" + mode).onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next =
          e.key === "Home"
            ? "upgrades"
            : e.key === "End"
              ? "fusions"
              : mode === "upgrades"
                ? "fusions"
                : "upgrades";
        $("base-" + next).click();
        $("base-" + next).focus();
      }
    };
  }
  $("base-back").onclick = () =>
    loadoutDirty || nameDirty
      ? confirmAction("保存していない編集を破棄して戻りますか？", "戻る", back)
      : back();
  slotOptions();
  name.value = decks.slots[slot]?.name ?? "";
  render();
}
