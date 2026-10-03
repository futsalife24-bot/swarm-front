/** 旧版・改装版共通の読み込み表示。準備処理と開始条件は呼び出し側で管理する。 */
export function battleLoadingMarkup(manualEntry = false) {
  return `<section class="pt-loading" aria-label="戦場の読み込み"><h1>戦場を準備中</h1><progress id="pt-progress" aria-label="準備の進捗" max="100" value="0"></progress><b id="pt-load-percent">0%</b>${manualEntry ? '<p>自動回復と回復ドロップを活用しましょう。</p><button id="pt-enter" hidden>タップで戦場へ</button><div id="pt-load-error"></div>' : ""}</section>`;
}
