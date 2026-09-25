/** Shared HARROW scale and motion timing, independent of simulation imports. */
export const HARROW_SCALE = 1.95;
export const HARROW_MOVE_SPEED = 0.64;
export const HARROW_WALK_AUTHORED_SPEED = HARROW_MOVE_SPEED / HARROW_SCALE;
export const HARROW_MOTION_STRETCH = 1.75;
export const HARROW_FLIGHT_CYCLE = 16.8;

/** Grounded Spin: plant wings, accelerate through one turn, then recover. */
export const HARROW_SPIN_TIMING = {
  wind: 1.15,
  turn: 1.05,
  duration: 3,
} as const;
export function harrowSpinRotation(age: number) {
  const turn = Math.max(
    0,
    Math.min(1, (age - HARROW_SPIN_TIMING.wind) / HARROW_SPIN_TIMING.turn),
  );
  return Math.PI * 2 * turn * turn * (3 - 2 * turn);
}
