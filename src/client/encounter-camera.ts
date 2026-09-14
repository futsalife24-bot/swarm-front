import * as T from "three";

/** Orbit the frozen specimen instead of crossing its body on a rear-to-front shot. */
export function encounterCamera(camera: T.PerspectiveCamera, focus: T.Vector3, front: T.Vector3, distance: number) {
  const start = camera.position.clone().sub(focus);
  const initialRotation = camera.quaternion.clone();
  const startAngle = Math.atan2(start.x, start.z);
  const endAngle = Math.hypot(front.x, front.z) > .001 ? Math.atan2(front.x, front.z) : startAngle;
  const angle = Math.atan2(Math.sin(endAngle - startAngle), Math.cos(endAngle - startAngle));
  const startRadius = Math.hypot(start.x, start.z);
  const endHeight = distance * .18;
  const endRadius = Math.sqrt(distance * distance - endHeight * endHeight);
  const pose = camera.clone();
  const right = new T.Vector3();
  const aim = new T.Vector3();
  return (progress: number) => {
    const t = T.MathUtils.clamp(progress, 0, 1);
    if (t === 0) {
      pose.position.copy(camera.position);
      pose.quaternion.copy(initialRotation);
      return pose;
    }
    const yaw = startAngle + angle * t;
    const radius = T.MathUtils.lerp(startRadius, endRadius, t);
    pose.position.set(focus.x + Math.sin(yaw) * radius,
      focus.y + T.MathUtils.lerp(start.y, endHeight, t), focus.z + Math.cos(yaw) * radius);
    pose.lookAt(focus);
    right.set(1, 0, 0).applyQuaternion(pose.quaternion);
    aim.copy(focus).addScaledVector(right, -distance * .14 * t);
    pose.lookAt(aim);
    pose.quaternion.slerpQuaternions(initialRotation, pose.quaternion.clone(), Math.min(1, t * 4));
    return pose;
  };
}
