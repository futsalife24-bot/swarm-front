/** 設定 → 管制AIボイス: 声の選択と、声ごとのダウンロード・削除（2026-11-14）。 */
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
    '<p class="cv-intro">声は端末に保存して使います。未ダウンロードの声は字幕だけで進みます（エラーにはなりません）。</p><div class="cv-list" role="radiogroup" aria-label="使う声"></div><p class="cv-status" role="status" aria-live="polite"></p><small class="cv-note">保存先はこのブラウザです。端末の空き容量が少ないと自動で消えることがあります。チュートリアルの音声はヒロミの声で再生します。</small>',
    "SETTINGS / VOICE",
  );
  d.classList.add("cv-dialog");
  const list = d.querySelector<HTMLElement>(".cv-list")!;
  const status = d.querySelector<HTMLElement>(".cv-status")!;
  const progress = new Map<ControlVoiceId, number>();
  const lifetime = new AbortController();
  let closed = false;
  const ownerClosed = () => closeMenuDialog(d);
  owner?.addEventListener("close", ownerClosed, { once: true });
  const unsubscribe = packs.subscribe(() => void render());
  d.addEventListener(
    "close",
    () => {
      closed = true;
      // 閉じても保存中のダウンロードは止めない（完了すれば保存される）。
      lifetime.abort();
      unsubscribe();
      owner?.removeEventListener("close", ownerClosed);
    },
    { once: true },
  );
  let drawing = 0;
  async function render() {
    const generation = ++drawing;
    const selected = loadControlVoice();
    const states = await Promise.all(
      CONTROL_VOICES.map((voice) => packs.state(voice)),
    );
    if (closed || generation !== drawing) return;
    list.replaceChildren(
      ...CONTROL_VOICES.map((voice, i) =>
        row(voice, states[i], selected === voice),
      ),
    );
  }
  function row(
    voice: ControlVoiceId,
    state: ControlVoicePackState,
    selected: boolean,
  ) {
    const unlocked = isControlVoiceUnlocked(voice),
      entry = packs.entry(voice);
    const el = document.createElement("div");
    el.className = "cv-row";
    el.dataset.voice = voice;
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
          : `${CONTROL_VOICE_NAMES[voice]}を選びました。ダウンロードするまでは字幕だけで進みます。`;
      void render();
    };
    const name = document.createElement("b");
    name.textContent = CONTROL_VOICE_NAMES[voice];
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
    if (unlocked && entry) {
      const action = document.createElement("button");
      action.type = "button";
      action.dataset.cvAction = state === "ready" ? "delete" : "download";
      action.textContent =
        state === "ready"
          ? "削除"
          : state === "outdated"
            ? "更新"
            : "ダウンロード";
      action.disabled = state === "downloading";
      action.setAttribute(
        "aria-label",
        `${CONTROL_VOICE_NAMES[voice]}の音声を${action.textContent}`,
      );
      action.onclick = () =>
        void (state === "ready" ? remove(voice) : download(voice));
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
  async function remove(voice: ControlVoiceId) {
    try {
      await packs.remove(voice);
      status.textContent = `${CONTROL_VOICE_NAMES[voice]}の音声を削除しました。字幕だけで進みます。`;
    } catch {
      status.textContent = "削除できませんでした。再試行してください。";
    }
    void render();
  }
  void render();
  return d;
}
