/** 支給ボックスの画面（ホームから開く）。個別受取と一括受取。 */
import {
  loadSupplyBox,
  receivable,
  receiveSupplyBox,
  rewardLabel,
  type SupplyBoxItem,
  type SupplyBoxReceiver,
} from "./supply-box";
import { menuReward } from "./menu-effects";
import "./supply-box.css";

type Dialog = (title: string, content: string) => HTMLDialogElement;
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const date = (at: number) => {
  const d = new Date(at + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

/** ホームのバッジに出す件数（読めない保存は0件扱い。開いたときに理由を出す）。 */
export function supplyBoxCount() {
  try {
    return loadSupplyBox().items.length;
  } catch {
    return 0;
  }
}

export function openSupplyBox(
  dialog: Dialog,
  receiver: SupplyBoxReceiver,
  changed: () => void,
) {
  const d = dialog(
    "支給ボックス",
    '<p class="sb-intro">配布された支給品は、受け取るまでここに保管されます。</p><div class="sb-list" aria-label="受け取れる支給品"></div><p class="sb-status" role="status" aria-live="polite"></p>',
  );
  d.classList.add("sb-dialog");
  const list = d.querySelector<HTMLElement>(".sb-list")!;
  const status = d.querySelector<HTMLElement>(".sb-status")!;
  const all = document.createElement("button");
  all.type = "button";
  all.className = "sb-all primary";
  all.textContent = "すべて受け取る";
  d.querySelector(".dialog-close")!.before(all);
  const receive = (ids: string[], from: Element | null) => {
    try {
      const { received } = receiveSupplyBox(ids, receiver);
      if (!received.length) return;
      status.textContent = `受け取りました：${summary(received)}`;
      // 押したボタンが描き直しで消える前に、演出の始点を測る。
      menuReward(status, from);
      changed();
      draw();
    } catch (error) {
      status.textContent = (error as Error).message;
    }
  };
  function draw() {
    let items: SupplyBoxItem[];
    try {
      items = loadSupplyBox().items;
    } catch (error) {
      list.innerHTML = "";
      all.disabled = true;
      status.textContent = (error as Error).message;
      return;
    }
    const ready = items.filter((item) => receivable(item, receiver));
    all.disabled = !ready.length;
    list.innerHTML = items.length
      ? items
          .map((item) => {
            const ok = receivable(item, receiver);
            return `<section class="sb-row" data-source="${item.source}"><b>${esc(item.title)}</b><span class="sb-reward">${esc(rewardLabel(item.reward))}</span><small>${esc(ok ? item.detail : "進行を開始すると受け取れます")}</small><time>${date(item.at)}</time><button type="button" data-sb-id="${esc(item.id)}" ${ok ? "" : "disabled"}>${ok ? "受け取る" : "進行開始後"}</button></section>`;
          })
          .join("")
      : '<p class="sb-empty">受け取れる支給品はありません。</p>';
    list
      .querySelectorAll<HTMLButtonElement>("[data-sb-id]")
      .forEach(
        (button) =>
          (button.onclick = () => receive([button.dataset.sbId!], button)),
      );
  }
  all.onclick = () => {
    try {
      receive(
        loadSupplyBox()
          .items.filter((item) => receivable(item, receiver))
          .map((item) => item.id),
        all,
      );
    } catch (error) {
      status.textContent = (error as Error).message;
    }
  };
  draw();
  return d;
}

function summary(items: readonly SupplyBoxItem[]) {
  const coins = items.reduce(
    (n, i) => n + (i.reward.kind === "coins" ? i.reward.amount : 0),
    0,
  );
  const voices = items.filter((i) => i.reward.kind === "control-voice");
  return [coins ? `${coins}コイン` : "", ...voices.map((i) => i.title)]
    .filter(Boolean)
    .join("・");
}
