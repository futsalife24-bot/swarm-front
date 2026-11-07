import type { BuddyKind } from "./buddy-assets";
import { BUDDY_COMBAT, buddyChargeFraction } from "../shared/buddy-combat";

/** 表示専用。旧snapshotでは未定義のまま通常姿勢へ戻す。 */
export interface BuddySkillMotionState {
  chargeStartedAt?: number;
  skillStartedAt?: number;
  skillImpactAt?: number;
  skillCharge?: number;
}
export interface BuddySkillPose {
  casting: boolean;
  charging: boolean;
  clipProgress: number;
  jump: number;
  scaleY: number;
  scaleXZ: number;
}
export const BUDDY_SKILL_RECOVERY = BUDDY_COMBAT.recoveryDuration;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => n * n * (3 - 2 * n);

/**
 * 加算積分せず、権威時刻から同じ姿勢を直接求める。描画dt・再接続・読込遅延で
 * 跳躍や着地をやり直さず、足元の座標／衝突／ダメージを変更しない。
 */
export function sampleBuddySkillPose(
  kind: BuddyKind,
  state: BuddySkillMotionState | undefined,
  time: number,
  reducedMotion = false,
): BuddySkillPose {
  const pose: BuddySkillPose = {
    casting: false,
    charging: false,
    clipProgress: 0,
    jump: 0,
    scaleY: 1,
    scaleXZ: 1,
  };
  if (!state || !Number.isFinite(time)) return pose;
  const charge = Number.isFinite(state.skillCharge)
    ? clamp(state.skillCharge!)
    : 0;
  const start = state.skillStartedAt ?? -1;
  const impact = state.skillImpactAt ?? -1;
  const strength = reducedMotion ? 0.25 : 1;
  if (
    Number.isFinite(start) &&
    Number.isFinite(impact) &&
    start >= 0 &&
    impact > start &&
    time >= start &&
    time < impact + BUDDY_SKILL_RECOVERY
  ) {
    pose.casting = true;
    const windup = clamp((time - start) / (impact - start));
    const recovery = clamp((time - impact) / BUDDY_SKILL_RECOVERY);
    // 採用Displayの大きな動作を着地側へ合わせ、終端は一度だけ再生する。
    pose.clipProgress = time < impact ? windup * 0.65 : 0.65 + recovery * 0.35;
    if (kind === "tatara") {
      if (time >= impact) {
        const settle = 1 - smooth(recovery);
        pose.scaleY -= 0.24 * settle * strength;
        pose.scaleXZ += 0.12 * settle * strength;
      } else if (windup < 0.24) {
        const crouch = Math.sin((windup / 0.24) * Math.PI);
        const held = charge * (1 - windup / 0.24);
        pose.scaleY -= (0.26 * crouch + 0.08 * held) * strength;
        pose.scaleXZ += (0.1 * crouch + 0.03 * held) * strength;
      } else {
        const flight = (windup - 0.24) / 0.76;
        pose.jump =
          4 *
          flight *
          (1 - flight) *
          (1.05 + 0.45 * charge) *
          (reducedMotion ? 0.15 : 1);
        const stretch = Math.sin(flight * Math.PI * 2) * strength;
        pose.scaleY += 0.08 * stretch;
        pose.scaleXZ -= 0.035 * stretch;
      }
    } else {
      const accent = Math.sin(windup * Math.PI) * (1 - recovery) * strength;
      pose.scaleY += 0.04 * accent;
      pose.scaleXZ -= 0.02 * accent;
    }
    return pose;
  }
  const chargingAt = state.chargeStartedAt ?? -1;
  if (Number.isFinite(chargingAt) && chargingAt >= 0 && time >= chargingAt) {
    pose.charging = true;
    const elapsed = time - chargingAt;
    const pulse = reducedMotion ? 0 : Math.sin(elapsed * Math.PI * 6) * 0.012;
    const crouch =
      (0.025 + 0.055 * buddyChargeFraction(elapsed) + pulse) *
      clamp(elapsed / 0.12);
    pose.scaleY -= crouch * strength;
    pose.scaleXZ += crouch * strength * 0.4;
  }
  return pose;
}
