/** 管制AI専用。進行・SE・BGMの既存キーを変更しない。 */
export const CONTROL_VOICE_RATE_KEY = "swarm-front-control-voice-rate-v1";
export type ControlVoiceRate = 1 | 1.3;
export function loadControlVoiceRate(): ControlVoiceRate {
  try {
    return localStorage.getItem(CONTROL_VOICE_RATE_KEY) === "1.3" ? 1.3 : 1;
  } catch {
    return 1;
  }
}
export function saveControlVoiceRate(rate: ControlVoiceRate) {
  try {
    localStorage.setItem(CONTROL_VOICE_RATE_KEY, String(rate));
    return true;
  } catch {
    return false;
  }
}
