import type { ControlVoiceLine } from "./control-voice-lines";
import "./control-captions.css";

// 既存の声選択キーの意味を変えず、再生の有効/無効を別に保存する。
export const CONTROL_VOICE_ENABLED_KEY = "swarm-front-control-voice-enabled-v1";
export const CONTROL_CAPTIONS_KEY = "swarm-front-control-captions-v1";
export type CaptionMode = "always" | "missing" | "never";
export function loadVoiceEnabled() {
  try {
    return localStorage.getItem(CONTROL_VOICE_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}
export function loadCaptionMode(): CaptionMode {
  try {
    const v = localStorage.getItem(CONTROL_CAPTIONS_KEY);
    if (v === "always" || v === "missing") return v;
  } catch {
    /* 保存不可でも従来どおり */
  }
  return "never";
}
export const captionVisible = (mode: CaptionMode, audible: boolean) =>
  mode === "always" || (mode === "missing" && !audible);

/** 操作案内とは独立した台詞字幕。各Sound（訓練iframeを含む）で共有する。 */
export class ControlCaptions {
  private node?: HTMLDivElement;
  private timer?: ReturnType<typeof setTimeout>;
  show(line: ControlVoiceLine, audible: boolean) {
    if (!captionVisible(loadCaptionMode(), audible)) {
      this.clear();
      return;
    }
    const node = (this.node ??= document.createElement("div"));
    node.className = "control-caption";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("popover", "manual");
    node.dataset.line = line.id;
    node.textContent = `管制AI｜${line.text}`;
    if (!node.isConnected) document.body.append(node);
    // 古いブラウザや画面離脱中でも、字幕の都合でゲーム処理を止めない。
    try {
      if (typeof node.showPopover === "function") node.showPopover();
      else node.removeAttribute("popover");
    } catch {
      node.removeAttribute("popover");
    }
    clearTimeout(this.timer);
    // 長文を読める猶予。音声終了をゲーム進行の条件にはしない。
    this.timer = setTimeout(
      () => this.clear(),
      Math.min(12000, Math.max(4000, line.text.length * 160)),
    );
  }
  clear() {
    clearTimeout(this.timer);
    this.node?.remove();
  }
}

/** 本体はボイス画面。トップのリンクもこの同じselectへ入る。 */
export function mountCaptionSetting(root: HTMLElement, changed: () => void) {
  const label = document.createElement("label");
  label.className = "cv-captions";
  label.textContent = "管制AIの字幕 ";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "管制AIの字幕");
  select.innerHTML =
    '<option value="always">常に表示</option><option value="missing">音声がないときだけ</option><option value="never">表示しない</option>';
  select.value = loadCaptionMode();
  select.onchange = () => {
    try {
      localStorage.setItem(CONTROL_CAPTIONS_KEY, select.value);
      changed();
    } catch {
      select.value = loadCaptionMode();
    }
  };
  label.append(select);
  root.append(label);
  return select;
}
