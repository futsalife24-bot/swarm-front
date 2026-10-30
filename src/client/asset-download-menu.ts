import {
  AssetDownloadStore,
  formatDownloadBytes,
  selectedAssets,
  type DownloadManifest,
} from "./asset-download";
import { closeMenuDialog, menuDialog } from "./menu-ui";
import "./asset-download-menu.css";

export function openAssetDownloadMenu(owner?: HTMLDialogElement) {
  const d = menuDialog(
    "データを事前ダウンロード",
    '<p class="download-intro">Wi-Fiで保存して、出撃時の読み込みを短く。協力プレイには通信が必要です。</p><div class="download-packs" aria-label="保存するデータ"></div><div class="download-controls"><div class="download-summary"></div><progress max="1" value="0" aria-label="保存の進み具合"></progress><div class="download-actions"><button type="button" data-download disabled>選んだデータを保存</button><button type="button" data-pause hidden>一時停止</button></div><p class="download-status" role="status" aria-live="polite">保存対象を確認しています…</p><small class="download-storage"></small><small>閉じると停止します。完了したファイルは再利用します。端末の空き容量によっては、保存データが自動で消去されることがあります。</small></div>',
    "出撃準備",
  );
  d.classList.add("download-dialog");
  d.querySelector(".menu-dialog-body")!.after(
    d.querySelector(".download-controls")!,
  );
  d.querySelector("h2")!.id = "download-dialog-title";
  d.setAttribute("aria-labelledby", "download-dialog-title");
  const status = d.querySelector<HTMLElement>(".download-status")!;
  const list = d.querySelector<HTMLElement>(".download-packs")!;
  const summary = d.querySelector<HTMLElement>(".download-summary")!;
  const storage = d.querySelector<HTMLElement>(".download-storage")!;
  const start = d.querySelector<HTMLButtonElement>("[data-download]")!;
  const pause = d.querySelector<HTMLButtonElement>("[data-pause]")!;
  const progress = d.querySelector<HTMLProgressElement>("progress")!;
  const lifetime = new AbortController();
  let transfer: AbortController | undefined,
    manifest: DownloadManifest | undefined;
  let saved = new Set<string>(),
    closed = false;
  const selected = new Set(["app", "common"]);
  let store: AssetDownloadStore | undefined;
  const ownerClosed = () => closeMenuDialog(d);
  owner?.addEventListener("close", ownerClosed, { once: true });
  d.addEventListener(
    "close",
    () => {
      closed = true;
      lifetime.abort();
      transfer?.abort();
      owner?.removeEventListener("close", ownerClosed);
    },
    { once: true },
  );
  const errorText = (error: unknown) =>
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "保存容量が足りません。端末の空き容量を確保して再開してください。完了済みのデータは残っています。"
      : error instanceof TypeError
        ? "通信できませんでした。接続を確認して再開してください。"
        : error instanceof Error
          ? error.message
          : "保存できませんでした。通信・空き容量を確認してください。";
  const render = () => {
    if (!manifest || closed) return;
    list.replaceChildren();
    for (const pack of manifest.packs) {
      const label = document.createElement("label");
      label.className = "download-pack";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selected.has(pack.id);
      input.disabled =
        !!transfer ||
        pack.id === "app" ||
        pack.id === "common" ||
        !pack.assets.length;
      input.dataset.pack = pack.id;
      input.onchange = () => {
        if (input.checked) selected.add(pack.id);
        else selected.delete(pack.id);
        render();
      };
      const details = document.createElement("span"),
        name = document.createElement("strong"),
        description = document.createElement("small"),
        state = document.createElement("span");
      name.textContent = pack.label;
      description.textContent = pack.description;
      details.append(name, description);
      const complete = pack.assets.filter((a) => saved.has(a.url)).length;
      state.className = "download-pack-state";
      state.textContent = pack.assets.length
        ? `${formatDownloadBytes(pack.assets.reduce((sum, a) => sum + a.bytes, 0))} · ${complete === pack.assets.length ? "保存済み" : `${complete}/${pack.assets.length} 保存`}`
        : "開発中は対象外";
      label.append(input, details, state);
      list.append(label);
    }
    const assets = selectedAssets(manifest, selected),
      remaining = assets.filter((a) => !saved.has(a.url));
    summary.textContent = `選択 ${formatDownloadBytes(assets.reduce((sum, a) => sum + a.bytes, 0))} ／ 追加保存 最大 ${formatDownloadBytes(remaining.reduce((sum, a) => sum + a.bytes, 0))}`;
    start.disabled = !!transfer || !remaining.length;
    start.textContent = remaining.length
      ? "選んだデータを保存・再開"
      : "選んだデータは保存済み";
    pause.hidden = !transfer;
  };
  const refreshSaved = async () => {
    if (manifest && store)
      saved = await store.saved(
        selectedAssets(manifest, new Set(manifest.packs.map((p) => p.id))),
      );
    try {
      const estimate = await navigator.storage?.estimate();
      if (estimate?.quota !== undefined && estimate.usage !== undefined)
        storage.textContent = `このサイトの使用量 約${formatDownloadBytes(estimate.usage)} ／ 保存可能な残量の目安 ${formatDownloadBytes(Math.max(0, estimate.quota - estimate.usage))}`;
    } catch {
      storage.textContent =
        "保存可能な容量は、このブラウザーでは取得できません。";
    }
    render();
  };
  start.onclick = async () => {
    if (!manifest || !store || transfer) return;
    transfer = new AbortController();
    const signal = transfer.signal;
    status.textContent = "保存しています。画面を開いたままお待ちください。";
    render();
    try {
      await store.download(selectedAssets(manifest, selected), signal, (p) => {
        progress.max = p.totalBytes || 1;
        progress.value = p.bytes;
        status.textContent = `保存 ${p.completed}/${p.total} 件 · ${formatDownloadBytes(p.bytes)} / ${formatDownloadBytes(p.totalBytes)}`;
      });
      status.textContent = "選んだデータを保存しました。次回から再利用します。";
    } catch (error) {
      status.textContent = signal.aborted
        ? "一時停止しました。完了したファイルから再開できます。"
        : errorText(error);
    } finally {
      transfer = undefined;
      if (!closed) {
        try {
          await refreshSaved();
        } catch (error) {
          status.textContent = errorText(error);
        }
      }
    }
  };
  pause.onclick = () => transfer?.abort();
  void (async () => {
    try {
      if (
        !isSecureContext ||
        !("caches" in globalThis) ||
        !("serviceWorker" in navigator)
      )
        throw new Error(
          "このブラウザーでは事前保存を利用できません。対応ブラウザーで開いてください。",
        );
      store = new AssetDownloadStore(
        new URL(import.meta.env.BASE_URL, location.href),
      );
      const result = await store.manifest(lifetime.signal);
      manifest = result.manifest;
      await refreshSaved();
      status.textContent = result.offline
        ? "前回の保存対象を表示しています。最新版の確認には通信が必要です。"
        : "容量を確認し、使う戦場を選んでください。保存済みの同じデータは再取得しません。";
    } catch (error) {
      if (!closed) status.textContent = errorText(error);
    }
  })();
  return d;
}
