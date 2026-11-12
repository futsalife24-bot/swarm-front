import { getMenuReducedMotion } from "./menu-effects";
import { loadSupplyReveal, type Reveal } from "./supply-presentation";
import {
  SUPPLY_EFFECT_NAMES,
  selectedSupplyPreview,
  randomSupplyPreview,
} from "./supply-preview-data";
import "./supply-menu.css";
import { openSupplyResult, shareSupplyResults } from "./supply-result-actions";

/** 認証済み開発者の表示確認専用。補給サービス・受領・保存を呼ばない。 */
export function mountSupplyPreview(host: HTMLElement, getVolume: () => number) {
  let closed = false,
    busy = false,
    reveal: Reveal | null = null;
  host.innerHTML = `<section class="supply-preview">
    <p>1連・10連の演出確認です。補給券の消費・報酬の取得・進行の保存はありません。</p>
    <div class="supply-preview-controls"><label>回数<select data-supply-preview-count aria-label="確認する回数"><option value="10">10連</option><option value="1">1連</option></select></label><label>演出を選ぶ<select id="supply-preview-effect" data-supply-preview-select aria-label="確認する確定演出">${SUPPLY_EFFECT_NAMES.map((name, i) => `<option value="${i + 1}">${i + 1}. ${name}</option>`).join("")}</select></label>
    <button type="button" data-supply-preview-play>選択した演出で再生</button>
    <button type="button" data-supply-preview-random>ランダムで再生</button></div>
    <p data-supply-preview-note role="status" aria-live="polite">選択時は演出に必要な結果を用意します。ランダム時は選んだ回数の通常の確率・保証・演出選択です。</p>
    <small>タップ・長押し・スキップ・2倍速・動き減を確認できます。結果一覧の「次へ」で繰り返し再生できます。</small>
    <p data-supply-preview-effect="" class="supply-preview-result"></p>
  </section>`;
  const note = host.querySelector<HTMLElement>("[data-supply-preview-note]")!;
  const result = host.querySelector<HTMLElement>(
    "[data-supply-preview-effect]",
  )!;
  const buttons = host.querySelectorAll<HTMLButtonElement>("button");
  const unlock = () => {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
  };
  const play = async (effect?: number) => {
    if (busy || closed) return;
    busy = true;
    buttons.forEach((b) => (b.disabled = true));
    note.textContent = "演出を読み込んでいます…";
    try {
      const count = Number(
        host.querySelector<HTMLSelectElement>("[data-supply-preview-count]")!
          .value,
      ) as 1 | 10;
      const results =
        effect === undefined
          ? randomSupplyPreview(Math.random, count)
          : selectedSupplyPreview(effect, count);
      const module = await loadSupplyReveal();
      if (closed) return;
      reveal?.destroy();
      reveal = module.createSupplyReveal(document.body, {
        label: "演出確認・取得なし",
        reduced: getMenuReducedMotion(),
        sound: getVolume() > 0,
        volume: getVolume(),
        assetBase: new URL(
          import.meta.env.BASE_URL + "supply-reveal/assets/",
          location.origin,
        ).href,
        finalActions: [
          { id: "share", label: "Xで共有" },
          { id: "close", label: "次へ", primary: true },
        ],
        onResult: openSupplyResult,
        onShare: (results: Parameters<typeof shareSupplyResults>[0]) =>
          shareSupplyResults(results, true),
        onClose: () => {
          if (closed) return;
          reveal?.destroy();
          reveal = null;
          if (!closed) {
            unlock();
            note.textContent = "確認が終わりました。次の演出を再生できます。";
          }
        },
      });
      await reveal.ready;
      if (closed) {
        reveal?.destroy();
        return;
      }
      await reveal.play(
        results,
        effect === undefined
          ? {}
          : { effects: effect, previewSingleEffects: count === 1 },
      );
      if (closed) return;
      const actual = reveal.state().effect;
      result.dataset.supplyPreviewEffect = String(actual);
      result.textContent = `前回の${effect === undefined ? "ランダム" : "選択"}再生：${actual ? `${actual}. ${SUPPLY_EFFECT_NAMES[actual - 1]}` : "通常演出"}（取得なし）`;
      note.textContent = "再生中です。";
    } catch (error) {
      reveal?.destroy();
      reveal = null;
      if (!closed) {
        unlock();
        note.textContent = (error as Error).message;
      }
    }
  };
  host.querySelector<HTMLButtonElement>("[data-supply-preview-play]")!.onclick =
    () => {
      void play(
        Number(
          host.querySelector<HTMLSelectElement>("[data-supply-preview-select]")!
            .value,
        ),
      );
    };
  host.querySelector<HTMLButtonElement>(
    "[data-supply-preview-random]",
  )!.onclick = () => void play();
  return {
    destroy() {
      closed = true;
      reveal?.destroy();
      reveal = null;
    },
  };
}
