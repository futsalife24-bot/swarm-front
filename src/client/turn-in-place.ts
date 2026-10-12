/**
 * Presentation only: how the lower body follows a standing soldier's facing.
 * Small aim changes twist the hips while the feet stay planted; past a limit,
 * or after holding a twist, the feet step around to catch up. Never reads or
 * writes simulation state.
 */
export const TURN_PLANT_LIMIT = 0.62; // rad of hip twist before the feet must step
export const TURN_SETTLE_DELAY = 0.75; // s holding a moderate twist before re-squaring
export const TURN_SETTLE_MIN = 0.22; // rad: smaller twists are left as they are
export const TURN_STEP_TIME = 0.12; // s, exponential catch-up while stepping
export const TURN_STEP_MIN_SPEED = 3; // rad/s, so large turns still finish briskly
export const TURN_STEP_DONE = 0.04; // rad
/** Walk-cycle fraction per radian turned: one plant-limit turn is about half a cycle (one foot). */
export const TURN_STEP_CYCLE = 0.8;
/**
 * Walk-cycle phase where both boots are down (left heel strike at 0, right at
 * 0.5, each stance lasting 0.6 of the cycle). Steps start and end here, so the
 * walk legs hand back to the idle legs from a planted pose.
 */
export const TURN_REST_PHASE = 0.05;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class TurnInPlace {
  /** World-facing yaw of the feet/pelvis (game yaw convention). */
  feetYaw = 0;
  stepping = false;
  /** Walk-cycle phase for the step legs; always a rest phase when not stepping. */
  cycle = TURN_REST_PHASE;
  private held = 0;
  private stepFrom = TURN_REST_PHASE;
  private stepSpan = 0.5;
  private stepTurned = 0;
  private stepTotal = 0;
  private stepProgress = 0;

  reset(yaw: number) {
    this.feetYaw = wrap(yaw);
    this.stepping = false;
    this.held = 0;
    this.cycle = TURN_REST_PHASE;
  }
  /** While moving, the locomotion code owns the hips; remember where they point. */
  track(feetYaw: number) {
    this.reset(feetYaw);
  }
  /**
   * Standing update. Returns the hip twist (body yaw minus feet yaw, i.e. the
   * value used as the pelvis offset) and the walk-cycle fraction stepped this frame.
   */
  stand(yaw: number, dt: number) {
    dt = Math.max(0, Math.min(0.1, dt));
    let diff = wrap(yaw - this.feetYaw);
    const size = Math.abs(diff);
    if (!this.stepping) {
      this.held = size > TURN_SETTLE_MIN ? this.held + dt : 0;
      if (size > TURN_PLANT_LIMIT || this.held > TURN_SETTLE_DELAY) {
        this.stepping = true;
        this.stepFrom = this.cycle;
        this.stepSpan = 0.5;
        this.stepTurned = 0;
        this.stepTotal = size;
        this.stepProgress = 0;
      }
    }
    let travel = 0;
    if (this.stepping) {
      const step =
        Math.sign(diff) *
        Math.min(
          size,
          Math.max(
            size * (1 - Math.exp(-dt / TURN_STEP_TIME)),
            TURN_STEP_MIN_SPEED * dt,
          ),
        );
      this.feetYaw = wrap(this.feetYaw + step);
      diff = wrap(yaw - this.feetYaw);
      const done = Math.abs(diff) < TURN_STEP_DONE;
      // The legs follow the rotation, in whole half cycles (one foot each), so
      // the step lands with both boots down exactly when the feet are square.
      this.stepTurned += Math.abs(step);
      this.stepTotal = Math.max(
        this.stepTotal,
        this.stepTurned + (done ? 0 : Math.abs(diff)),
      );
      this.stepSpan = Math.max(
        this.stepSpan,
        0.5 * Math.round(this.stepTotal * TURN_STEP_CYCLE * 2),
      );
      const progress = done
        ? this.stepSpan
        : Math.max(
            this.stepProgress,
            (this.stepSpan * this.stepTurned) / this.stepTotal,
          );
      travel = progress - this.stepProgress;
      this.stepProgress = progress;
      this.cycle = (this.stepFrom + progress) % 1;
      if (done) {
        this.stepping = false;
        this.held = 0;
      }
    }
    return { twist: diff, travel, stepping: this.stepping };
  }
}

/** Remote soldiers arrive as 20 Hz yaw snapshots; ease the drawn facing between them. */
export function easeYaw(
  current: number,
  target: number,
  dt: number,
  tau = 0.06,
) {
  const d = wrap(target - current);
  if (Math.abs(d) > 2.9) return target; // near-reversal (or respawn): do not spin through
  return wrap(current + d * (1 - Math.exp(-Math.max(0, dt) / tau)));
}
