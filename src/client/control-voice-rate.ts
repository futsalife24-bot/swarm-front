/** 管制AI専用。進行・SE・BGMの既存キーを変更しない。 */
export const CONTROL_VOICE_RATE_KEY = "swarm-front-control-voice-rate-v1";
export const CONTROL_VOICE_RATES = [1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
export type ControlVoiceRate = (typeof CONTROL_VOICE_RATES)[number];
export const isControlVoiceRate = (rate: number): rate is ControlVoiceRate =>
  CONTROL_VOICE_RATES.includes(rate as ControlVoiceRate);
export function loadControlVoiceRate(): ControlVoiceRate {
  try {
    const rate = Number(localStorage.getItem(CONTROL_VOICE_RATE_KEY));
    return isControlVoiceRate(rate) ? rate : 1;
  } catch {
    return 1;
  }
}
export function saveControlVoiceRate(rate: ControlVoiceRate) {
  if (!isControlVoiceRate(rate)) return false;
  try {
    localStorage.setItem(CONTROL_VOICE_RATE_KEY, String(rate));
    return true;
  } catch {
    return false;
  }
}
