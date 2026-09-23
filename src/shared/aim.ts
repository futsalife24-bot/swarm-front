export const MIN_PITCH = -0.65;
export const MAX_PITCH = (80 * Math.PI) / 180;
export const NORMAL_FOV = 65;
// Magnification, expressed as the field of view it leaves. Scoped weapons carry
// their own factor; everything else keeps the original 2x.
export const scopeFov = (zoom = 2) =>
  (2 * Math.atan(Math.tan((NORMAL_FOV * Math.PI) / 360) / zoom) * 180) /
  Math.PI;
export const SCOPE_FOV = scopeFov(2);
export const clampPitch = (pitch: number) =>
  Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch));

// DeviceMotion rotationRate: alpha=X, beta=Y, gamma=Z (screen roll).
// These names differ from DeviceOrientation angles. Rates are deg/s.
export function gyroDelta(
  xRate: number,
  yRate: number,
  screenAngle: number,
  seconds: number,
  sensitivity = 1,
) {
  const a = (screenAngle * Math.PI) / 180;
  const dt = (Math.max(0, Math.min(0.05, seconds)) * Math.PI) / 180;
  return {
    yaw: -(yRate * Math.cos(a) + xRate * Math.sin(a)) * dt * sensitivity,
    pitch: (xRate * Math.cos(a) - yRate * Math.sin(a)) * dt * sensitivity,
  };
}
