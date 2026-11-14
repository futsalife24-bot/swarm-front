/** 設定 → 管制AIボイス: 声の選択・ダウンロード・試聴。 */
import { loadVoiceEnabled } from "./control-voice-enabled";
import { formatDownloadBytes } from "./asset-download";
import {
  CONTROL_VOICES,
  CONTROL_VOICE_NAMES,
  isControlVoiceUnlocked,
  loadControlVoice,
  type ControlVoiceId,
} from "./control-voice";
import {
  controlVoicePacks,
  type ControlVoicePackState,
  type ControlVoicePacks,
} from "./control-voice-packs";
import { closeMenuDialog, menuDialog } from "./menu-ui";
import "./control-voice-menu.css";

export interface ControlVoiceHost {
  setControlVoice(voice: ControlVoiceId): void;
  setControlVoiceEnabled(enabled: boolean): void;
  previewControlVoice(voice: ControlVoiceId): Promise<boolean>;
  stopControlPreview(): void;
}

const NOTES: Record<ControlVoiceId, string> = {
  hiromi: "既定の声・基礎訓練の音声を含む",
  hiyori: "管制AIの台詞",
  yoko: "管制AIの台詞",
};
const LOCKED: Record<ControlVoiceId, string> = {
  hiromi: "",
  hiyori: "支給ボックスで受け取ると使えます",
  yoko: "今後の配布で解放",
};
const STATE_LABEL: Record<ControlVoicePackState, string> = {
  missing: "未ダウンロード",
  downloading: "ダウンロード中",
  ready: "保存済み",
  outdated: "更新あり",
};

export function openControlVoiceMenu(
  owner: HTMLDialogElement | undefined,
  host: ControlVoiceHost,
  packs: ControlVoicePacks = controlVoicePacks,
) {
  const d = menuDialog(
    "管制AIボイス",
    '<p class="cv-intro">声は端末に保存して使います。未ダウンロードの声は再生されません。</p><div class="cv-list" role="radiogroup" aria-label="使う声"></div><p class="cv-status" role="status" aria-live="polite"></p><small class="cv-note">保存先はこのブラウザです。端末の空き容量が少ないと自動で消えることがあります。チュートリアルの音声はヒロミの声で再生します。</small>',
    "SETTINGS / VOICE",
  );
  d.classList.add("cv-dialog");
  const list = d.querySelector<HTMLElement>(".cv-list")!;
  const status = d.querySelector<HTMLElement>(".cv-status")!;
  const progress = new Map<ControlVoiceId, number>();
  let closed = false;
  const ownerClosed = () => closeMenuDialog(d);
  owner?.addEventListener("close", ownerClosed, { once: true });
  const unsubscribe = packs.subscribe(() => void render());
  d.addEventListener(
    "close",
    () => {
      closed = true;
      // 閉じても保存中のダウンロードは止めない（完了すれば保存される）。
      host.stopControlPreview();
      unsubscribe();
      owner?.removeEventListener("close", ownerClosed);
    },
    { once: true },
  );
  let drawing = 0;
  async function render() {
    const generation = ++drawing;
    const selected = loadVoiceEnabled() ? loadControlVoice() : "none";
    const states = await Promise.all(
      CONTROL_VOICES.map((voice) => packs.state(voice)),
    );
    if (closed || generation !== drawing) return;
    list.replaceChildren(
      noVoiceRow(selected === "none"),
      ...CONTROL_VOICES.map((voice, i) =>
        row(voice, states[i], selected === voice),
      ),
    );
  }
  function noVoiceRow(selected: boolean) {
    const el = document.createElement("div");
    el.className = "cv-row cv-none";
    el.dataset.voice = "none";
    el.dataset.selected = String(selected);
    el.innerHTML = `<label class="cv-pick"><input type="radio" name="cv-voice" value="none" ${selected ? "checked" : ""}><b>ボイスなし</b></label><span class="cv-state">${selected ? "選択中" : ""}</span>`;
    el.querySelector("input")!.onchange = () => {
      host.setControlVoiceEnabled(false);
      status.textContent = "管制AIボイスをオフにしました。";
      void render();
    };
    return el;
  }
  function row(
    voice: ControlVoiceId,
    state: ControlVoicePackState,
    selected: boolean,
  ) {
    const unlocked = voice !== "yoko" && isControlVoiceUnlocked(voice),
      entry = packs.entry(voice);
    const el = document.createElement("div");
    el.className = "cv-row";
    el.dataset.voice = voice;
    el.dataset.selected = String(selected);
    el.dataset.state = unlocked ? state : "locked";
    const pick = document.createElement("label");
    pick.className = "cv-pick";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cv-voice";
    radio.value = voice;
    radio.checked = selected;
    radio.disabled = !unlocked;
    radio.onchange = () => {
      host.setControlVoice(voice);
      status.textContent =
        state === "ready"
          ? `${CONTROL_VOICE_NAMES[voice]}の声に切り替えました。`
          : `${CONTROL_VOICE_NAMES[voice]}を選びました。ダウンロードするまで音声は再生されません。`;
      void render();
    };
    const name = document.createElement("b");
    name.textContent =
      CONTROL_VOICE_NAMES[voice] + (selected ? " · 選択中" : "");
    const note = document.createElement("small");
    note.textContent = unlocked ? NOTES[voice] : LOCKED[voice];
    pick.append(radio, name, note);
    const size = document.createElement("span");
    size.className = "cv-size";
    size.textContent = entry ? formatDownloadBytes(entry.bytes) : "—";
    const label = document.createElement("span");
    label.className = "cv-state";
    const percent = progress.get(voice);
    label.textContent = !unlocked
      ? "未解放"
      : state === "downloading" && percent !== undefined
        ? `${STATE_LABEL[state]} ${percent}%`
        : STATE_LABEL[state];
    el.append(pick, size, label);
    const preview = document.createElement("button");
    preview.type = "button";
    preview.dataset.cvAction = "preview";
    preview.textContent = "試聴";
    preview.setAttribute("aria-label", `${CONTROL_VOICE_NAMES[voice]}を試聴`);
    preview.disabled = !unlocked || state !== "ready";
    preview.title = !unlocked
      ? "未解放のため試聴できません"
      : state !== "ready"
        ? "ダウンロード後に試聴できます"
        : "代表台詞を再生";
    preview.onclick = async () => {
      preview.disabled = true;
      const played = await host.previewControlVoice(voice);
      if (closed) return;
      status.textContent = played
        ? `${CONTROL_VOICE_NAMES[voice]}のサンプルを再生しています。`
        : "試聴できません。音量・保存状態を確認してください。";
      preview.disabled = false;
    };
    el.append(preview);
    if (unlocked && entry && state !== "ready") {
      const action = document.createElement("button");
      action.type = "button";
      action.dataset.cvAction = "download";
      action.textContent = state === "outdated" ? "更新" : "ダウンロード";
      action.disabled = state === "downloading";
      action.setAttribute(
        "aria-label",
        `${CONTROL_VOICE_NAMES[voice]}の音声を${action.textContent}`,
      );
      action.onclick = () => void download(voice);
      el.append(action);
    }
    return el;
  }
  async function download(voice: ControlVoiceId) {
    status.textContent = `${CONTROL_VOICE_NAMES[voice]}の音声をダウンロードしています…`;
    progress.set(voice, 0);
    try {
      await packs.download(voice, (received, total) => {
        const percent = Math.floor((received / Math.max(1, total)) * 100);
        if (percent === progress.get(voice)) return;
        progress.set(voice, percent);
        const label = list.querySelector(
          `.cv-row[data-voice="${voice}"] .cv-state`,
        );
        if (label) label.textContent = `ダウンロード中 ${percent}%`;
      });
      if (!closed)
        status.textContent = `${CONTROL_VOICE_NAMES[voice]}の音声を保存しました。`;
    } catch (error) {
      if (!closed)
        status.textContent =
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "保存容量が足りません。端末の空き容量を確保して再試行してください。"
            : error instanceof TypeError
              ? "通信できませんでした。接続を確認して再試行してください。"
              : (error as Error).message;
    } finally {
      progress.delete(voice);
      void render();
    }
  }
  void render();
  return d;
}
