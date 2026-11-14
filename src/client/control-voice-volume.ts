import type { Sound } from "./audio";

/** 管制AI専用の倍率。既存の進行保存・SE設定には書き込まない。 */
export const CONTROL_VOICE_VOLUME_KEY = "swarm-front-control-voice-volume-v1";
export function loadControlVoiceVolume(fallback = 1): number {
  try {
    const raw = localStorage.getItem(CONTROL_VOICE_VOLUME_KEY);
    if (raw === null) {
      // 初回の旧SE倍率を保存し、次回起動でもSE変更に引きずられないようにする。
      localStorage.setItem(CONTROL_VOICE_VOLUME_KEY, JSON.stringify(fallback));
      return fallback;
    }
    if (raw !== null) {
      const value = JSON.parse(raw);
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
      )
        return value;
    }
  } catch {
    /* 保存不可・破損時も元データは残す。 */
  }
  return fallback;
}

export function mountControlVoiceVolume(
  after: Element,
  sound: Sound,
  status?: Element,
) {
  const label = document.createElement("label");
  label.className = "setting-row";
  label.innerHTML = `<span class="setting-name">管制AI音量</span><span class="setting-control"><input data-control-voice-volume aria-label="管制AI音量" type="range" min="0" max="1" step="0.05"><output></output></span>`;
  const input = label.querySelector("input")!;
  const output = label.querySelector("output")!;
  const show = () => {
    input.value = String(sound.controlVoiceVolume);
    output.textContent = `${Math.round(sound.controlVoiceVolume * 100)}%`;
  };
  show();
  input.oninput = () => {
    try {
      const value = Number(input.value);
      localStorage.setItem(CONTROL_VOICE_VOLUME_KEY, JSON.stringify(value));
      sound.controlVoiceVolume = value;
      sound.unlock();
      if (status) status.textContent = "設定を保存しました。";
    } catch {
      if (status)
        status.textContent =
          "設定を保存できませんでした。変更前の設定を維持しています。";
    }
    show();
  };
  after.after(label);
}
