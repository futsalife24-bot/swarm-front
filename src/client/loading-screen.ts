/** 旧版・改装版共通の読み込み表示。準備処理と開始条件は呼び出し側で管理する。 */
export function battleLoadingMarkup(manualEntry = false) {
  return `<section class="pt-loading" aria-label="戦場の読み込み"><h1>戦場を準備中</h1><progress id="pt-progress" aria-label="準備の進捗" max="100" value="0"></progress><b id="pt-load-percent">0%</b><div id="pt-load-stage" role="status">素材を読み込んでいます · 経過 0秒</div><small>初回は準備に数十秒かかる場合があります。端末や通信環境によって変わります。</small>${manualEntry ? '<p>自動回復と回復ドロップを活用しましょう。</p><button id="pt-enter" hidden>タップで戦場へ</button><div id="pt-load-error"></div>' : ""}</section>`;
}

/** 呼び出し側の既存進捗更新と併用する。完了またはエラー後は呼ばない。 */
export function updateBattleLoadingStatus(status: {
  stage: string;
  elapsedSeconds: number;
}) {
  const line = document.getElementById("pt-load-stage");
  if (line)
    line.textContent = `${status.stage} · 経過 ${status.elapsedSeconds}秒`;
}
