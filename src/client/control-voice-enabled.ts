// 既存の声選択キーの意味を変えず、再生の有効/無効を別に保存する。
export const CONTROL_VOICE_ENABLED_KEY = "swarm-front-control-voice-enabled-v1";
export function loadVoiceEnabled() {
  try {
    return localStorage.getItem(CONTROL_VOICE_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}
