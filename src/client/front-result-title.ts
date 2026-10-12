import type { FrontMode } from "../shared/front-run";
/** Display semantics only; the authoritative terminal phase stays unchanged. */
export function frontResultTitle(mode: FrontMode, phase: string) {
  if (mode === "survival") return phase === "victory" ? "撤収完了" : "戦闘終了";
  return phase === "victory" ? "作戦成功" : "任務終了";
}
