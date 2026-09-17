import {
  createCloudSave,
  transferCode,
  cloudStatus,
  inspectCloud,
  restoreCloud,
  keepLocalAfterConflict,
  deleteCloudSave,
  syncCloud,
  claimCloudWeekly,
  type CloudState,
} from "./cloud-save";
import {
  loadProgress,
  newSaveKey,
  type ProgressSave,
} from "./progression-save";
import { WEEKLY_MISSIONS } from "../shared/weekly-missions";

type Dialog = (title: string, body: string) => HTMLDialogElement;
const labels: Record<CloudState, string> = {
  unlinked: "未接続",
  saved: "同期済み",
  pending: "同期待ち",
  saving: "同期中",
  offline: "接続できません・端末に保存中",
  conflict: "別端末の更新あり・保存の選択が必要",
};
const stamp = (n: number) =>
  n
    ? new Date(n).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST"
    : "未確認";
function operation(d: HTMLDialogElement) {
  let busy = false;
  d.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  return async (action: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    const buttons = [...d.querySelectorAll<HTMLButtonElement>("button")];
    const states = buttons.map((b) => b.disabled);
    buttons.forEach((b) => (b.disabled = true));
    const status = d.querySelector<HTMLElement>("[data-feedback]")!;
    status.textContent = "確認しています…";
    try {
      await action();
      status.textContent = "";
    } catch (e) {
      status.textContent = (e as Error).message;
    } finally {
      busy = false;
      buttons.forEach((b, i) => (b.disabled = states[i]));
    }
  };
}
function summary(s: ProgressSave | null) {
  if (!s) return "まだ保存がありません";
  const clears = Object.values(s.missions).filter((m) => m[0]).length;
  return `クリア ${clears} · 武器 ${s.inventory.length + s.pending.length}丁 · コイン ${s.coins}`;
}
export function openCloudSettings(dialog: Dialog, refreshed: () => void) {
  const code = transferCode();
  const d = dialog(
    "クラウド引き継ぎ",
    `<p>同じコードで最後に同期した最新の進行を復元できます。コードは本人用の秘密の鍵です。紛失時の復旧はできません。</p><p id="pt-cloud-state"></p><div class="continuity-actions">${code ? '<button id="pt-cloud-show">コードを表示</button><button id="pt-cloud-sync">今すぐ同期</button><button id="pt-cloud-restore">保存を比較</button><button id="pt-cloud-delete">クラウド保存を削除</button>' : '<button id="pt-cloud-create">クラウド保存を有効にする</button>'}</div><div id="pt-code-panel" hidden><label>引き継ぎコード<input id="pt-cloud-code" readonly autocomplete="off" spellcheck="false"></label><button id="pt-cloud-copy">コピー</button></div><label>別端末のコード<input id="pt-cloud-input" type="password" autocomplete="off" spellcheck="false" placeholder="SF1-…"></label><button id="pt-cloud-connect">入力した保存を確認</button><p data-feedback role="status"></p>`,
  );
  const run = operation(d);
  const status = () => {
    const s = cloudStatus();
    d.querySelector("#pt-cloud-state")!.textContent =
      `${labels[s.status]} · 最終同期 ${stamp(s.updatedAt)}`;
  };
  status();
  window.addEventListener("swarm-cloud-status", status);
  d.addEventListener(
    "close",
    () => window.removeEventListener("swarm-cloud-status", status),
    { once: true },
  );
  const bind = (id: string, action: () => Promise<void>) =>
    d
      .querySelector<HTMLButtonElement>(`#${id}`)
      ?.addEventListener("click", () => void run(action));
  bind("pt-cloud-create", async () => {
    await createCloudSave();
    d.close();
    openCloudSettings(dialog, refreshed);
  });
  bind("pt-cloud-show", async () => {
    const panel = d.querySelector<HTMLElement>("#pt-code-panel")!;
    panel.hidden = !panel.hidden;
    d.querySelector<HTMLInputElement>("#pt-cloud-code")!.value = panel.hidden
      ? ""
      : code!;
    d.querySelector("#pt-cloud-show")!.textContent = panel.hidden
      ? "コードを表示"
      : "コードを隠す";
  });
  bind("pt-cloud-copy", async () => {
    if (!navigator.clipboard)
      throw Error("コード欄を選択してコピーしてください。");
    await navigator.clipboard.writeText(code!);
    d.querySelector("#pt-cloud-copy")!.textContent = "コピー済み";
  });
  bind("pt-cloud-sync", async () => {
    await syncCloud();
    if (cloudStatus().status !== "saved")
      throw Error(labels[cloudStatus().status]);
  });
  const compare = async (target: string) => {
    const remote = await inspectCloud(target);
    const expected = localStorage.getItem(newSaveKey("normal"));
    const local = loadProgress("normal");
    if (!d.isConnected) return;
    d.close();
    const c = dialog(
      "保存を比較",
      `<div class="continuity-comparison"><section><h3>この端末</h3><p>${summary(local)}</p></section><section><h3>クラウド</h3><p>${summary(remote.save)}</p><p>${stamp(remote.updatedAt)}</p></section></div><p>クラウドを採用すると、端末の進行を置き換えます。現在の端末保存は控えとして残します。</p><div class="continuity-actions"><button id="pt-use-cloud">クラウドを採用</button>${code === target && local ? '<button id="pt-use-local">端末をクラウドへ保存</button>' : ""}<button id="pt-cloud-cancel">何も変更せず戻る</button></div><p data-feedback role="status"></p>`,
    );
    const choose = operation(c);
    c.querySelector<HTMLButtonElement>("#pt-cloud-cancel")!.onclick = () => {
      c.close();
      openCloudSettings(dialog, refreshed);
    };
    c.querySelector<HTMLButtonElement>("#pt-use-cloud")!.onclick = () =>
      void choose(async () => {
        restoreCloud(target, remote, expected);
        c.close();
        refreshed();
      });
    c.querySelector<HTMLButtonElement>("#pt-use-local")?.addEventListener(
      "click",
      () =>
        void choose(async () => {
          if (localStorage.getItem(newSaveKey("normal")) !== expected)
            throw Error("端末が更新されました。比較し直してください。");
          await keepLocalAfterConflict(remote.version);
          if (cloudStatus().status !== "saved")
            throw Error(labels[cloudStatus().status]);
          c.close();
          refreshed();
        }),
    );
  };
  bind("pt-cloud-restore", () => compare(code!));
  bind("pt-cloud-connect", () =>
    compare(d.querySelector<HTMLInputElement>("#pt-cloud-input")!.value.trim()),
  );
  bind("pt-cloud-delete", async () => {
    d.close();
    const c = dialog(
      "クラウド保存を削除",
      '<p>クラウド上の保存とコードを無効にします。この端末の進行は残ります。</p><button id="pt-cloud-delete-confirm">クラウド保存を削除する</button><p data-feedback role="status"></p>',
    );
    const remove = operation(c);
    c.querySelector<HTMLButtonElement>("#pt-cloud-delete-confirm")!.onclick =
      () =>
        void remove(async () => {
          await deleteCloudSave();
          c.close();
          openCloudSettings(dialog, refreshed);
        });
  });
}

export function openWeeklyMissions(dialog: Dialog, refreshed: () => void) {
  const d = dialog(
    "週間ミッション",
    '<p>月曜の日本時間0時に更新。オフラインのクリアは次に同期した週へ反映します。</p><div id="pt-weekly-list"></div><p data-feedback role="status"></p>',
  );
  const run = operation(d);
  const draw = async () => {
    const code = transferCode();
    if (!code) throw Error("設定のクラウド引き継ぎを有効にしてください。");
    await syncCloud();
    if (cloudStatus().status !== "saved")
      throw Error(labels[cloudStatus().status]);
    const remote = await inspectCloud(code);
    if (!d.isConnected) return;
    const weekly =
      remote.save.weekly?.week === remote.week ? remote.save.weekly : undefined;
    d.querySelector("#pt-weekly-list")!.innerHTML = WEEKLY_MISSIONS.map((m) => {
      const count = weekly?.[m.kind].length ?? 0,
        claimed = weekly?.claimed.includes(m.id);
      return `<section class="weekly-row"><strong>${m.label}</strong><span>${Math.min(count, m.target)} / ${m.target} · ${m.coins}コイン</span><button data-weekly-id="${m.id}" ${claimed || count < m.target ? "disabled" : ""}>${claimed ? "受取済み" : "受け取る"}</button></section>`;
    }).join("");
    d.querySelectorAll<HTMLButtonElement>("[data-weekly-id]").forEach(
      (b) =>
        (b.onclick = () =>
          void run(async () => {
            await claimCloudWeekly(b.dataset.weeklyId!);
            refreshed();
            await draw();
          })),
    );
  };
  void run(draw);
}
