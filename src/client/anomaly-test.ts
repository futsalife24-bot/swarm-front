import "./anomaly-test.css";
import {
  ANOMALY_TEST_LIMIT,
  anomalyTestCurrentCount,
  createAnomalyTestWorld,
  requestAnomalyTestUpdate,
  type World,
} from "../shared/game";
import { ENEMY_REPORT_NAMES } from "../shared/enemy-identity";

const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

type DialogFactory = (title: string, body: string) => HTMLDialogElement;

export { createAnomalyTestWorld };

export function openAnomalyTestPreparation(
  container: HTMLElement,
  start: () => Promise<void>,
) {
  container.innerHTML = `<section class="panel menu-screen pt-screen anomaly-test-preparation"><header class="menu-header"><div><div class="eyebrow">DEVELOPER TEST</div><h1>ANOMALYテスト</h1></div></header><p class="pt-status" role="status">初期設定のまま出撃できます。</p><div class="anomaly-test-summary"><article><small>モード</small><b>観察</b></article><article><small>強さ</small><b>ST1 · 通常</b></article><article><small>装備</small><b>基準装備</b></article><article><small>地形</small><b>武器庫防衛拠点</b></article><article><small>ANOMALY</small><b>${esc(ENEMY_REPORT_NAMES.crawler)} 1体</b></article><article><small>行動</small><b>自由</b></article></div><p>本編AIで移動と攻撃を確認します。観察モードでは自機が倒れず、指定個体を倒すと補充されます。テスト結果・ドロップ・報酬・遭遇・任務進行は保存されません。</p><footer class="anomaly-test-actions"><button id="pt-anomaly-back">開発者ホームへ戻る</button><button id="pt-anomaly-start" class="primary">ANOMALYテスト出撃 ↗</button></footer></section>`;
  container.querySelector<HTMLButtonElement>("#pt-anomaly-back")!.onclick =
    () => {
      container.dispatchEvent(new CustomEvent("anomaly-test-home"));
    };
  container.querySelector<HTMLButtonElement>("#pt-anomaly-start")!.onclick =
    () => {
      void start();
    };
}

export function openAnomalyTestSettings(
  world: World,
  dialog: DialogFactory,
  onResume: () => void,
) {
  if (!world.anomalyTest) throw Error("ANOMALYテストではありません");
  const setting = world.anomalyTest.enemies.crawler;
  const current = anomalyTestCurrentCount(world, "crawler");
  const d = dialog(
    "ANOMALY設定",
    `<div class="anomaly-test-setting-grid"><article class="anomaly-test-summary"><small>現在数</small><b id="pt-anomaly-current">${current}体</b><small>設定数 · 行動</small><b>${esc(ENEMY_REPORT_NAMES.crawler)}</b></article><label>体数（0〜${ANOMALY_TEST_LIMIT}）<span class="anomaly-test-count-row"><button id="pt-anomaly-minus" aria-label="体数を減らす">−</button><input id="pt-anomaly-count" type="number" min="0" max="${ANOMALY_TEST_LIMIT}" step="1" value="${setting.count}"><button id="pt-anomaly-plus" aria-label="体数を増やす">＋</button></span></label><label>行動<select id="pt-anomaly-action"><option value="free" ${setting.action === "free" ? "selected" : ""}>自由</option><option value="wait" ${setting.action === "wait" ? "selected" : ""}>待機</option></select></label><p id="pt-anomaly-message" role="status">確定すると次のシミュレーション更新で差分を反映します。</p><footer class="anomaly-test-setting-actions"><button id="pt-anomaly-cancel">キャンセル</button><button id="pt-anomaly-apply" class="primary">確定</button></footer></div>`,
  );
  const count = d.querySelector<HTMLInputElement>("#pt-anomaly-count")!;
  d.querySelector<HTMLButtonElement>("#pt-anomaly-minus")!.onclick = () => {
    count.value = String(Math.max(0, Number(count.value) - 1));
  };
  d.querySelector<HTMLButtonElement>("#pt-anomaly-plus")!.onclick = () => {
    count.value = String(Math.min(ANOMALY_TEST_LIMIT, Number(count.value) + 1));
  };
  d.querySelector<HTMLButtonElement>("#pt-anomaly-cancel")!.onclick = () =>
    d.close();
  d.querySelector<HTMLButtonElement>("#pt-anomaly-apply")!.onclick = () => {
    try {
      requestAnomalyTestUpdate(
        world,
        "crawler",
        Number(count.value),
        d.querySelector<HTMLSelectElement>("#pt-anomaly-action")!.value as
          "free" | "wait",
      );
      d.close();
    } catch (error) {
      d.querySelector<HTMLElement>("#pt-anomaly-message")!.textContent = (
        error as Error
      ).message;
    }
  };
  d.addEventListener("close", onResume);
  return d;
}
