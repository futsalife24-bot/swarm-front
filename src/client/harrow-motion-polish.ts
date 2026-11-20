import * as T from "three";
import { HARROW_FLIGHT_CYCLE } from "../shared/harrow-motion";

export const HARROW_LANDING_RECOVERY = 0.3;
const smooth = (x: number) => {
  x = T.MathUtils.clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Continuous beat: horizontal -> up -> down -> horizontal, with distal lag. */
export function harrowWingStroke(phase: number, lag = 0) {
  const u = ((phase % 1) + 1) % 1;
  // A periodic, monotone time warp adds distal lag without changing either
  // angular extreme or stopping the joints at the neutral clip seam.
  const delayed = u - 2 * lag * Math.sin(Math.PI * u) ** 2;
  const s = -Math.sin(delayed * Math.PI * 2);
  const angle = 0.55 * s - 0.1 * s * s;
  return angle === 0 ? 0 : angle;
}

/** Re-time only the visible crouch. The authority still owns height and impact. */
export function harrowLandingSample(
  age: number,
  duration: number,
  descending: boolean,
) {
  const elapsed = T.MathUtils.clamp(age, 0, duration);
  const peak = duration * 0.22;
  if (descending) return peak * smooth((elapsed / duration - 0.75) / 0.25);
  const absorb = 0.14;
  return elapsed < absorb
    ? peak * smooth(elapsed / absorb)
    : T.MathUtils.lerp(
        peak,
        duration,
        smooth((elapsed - absorb) / (duration - absorb)),
      );
}

/** One load-time pass; only the two previously rigid elbows need new samples. */
export function polishHarrowFlight(
  model: T.Group,
  bones: T.Bone[],
  clip: T.AnimationClip,
) {
  const tracks = clip.tracks.filter((track) =>
    /^Wing_(upper|fore|fan)[LR]\.quaternion$/.test(track.name),
  );
  if (tracks.length !== 6) throw new Error("Unexpected HARROW wing tracks");
  const rig = tracks.map((track) => {
    const bone = bones.find(
      (bone) =>
        T.PropertyBinding.sanitizeNodeName(bone.name) ===
        track.name.split(".")[0],
    );
    if (!bone) throw new Error("HARROW wing bone missing");
    return {
      track,
      bone,
      values: new Float32Array(tracks[0].times.length * 4),
      original: new T.Quaternion(),
    };
  });
  const times = tracks[0].times;
  if (
    tracks.some(
      (track) =>
        track.times.length !== 2 &&
        (track.times.length !== times.length ||
          track.times.some((t, i) => t !== times[i])),
    )
  )
    throw new Error("HARROW wing key times differ");
  const rest = bones.map((bone) => ({
    bone,
    p: bone.position.clone(),
    q: bone.quaternion.clone(),
    s: bone.scale.clone(),
  }));
  const mixer = new T.AnimationMixer(model),
    action = mixer.clipAction(clip);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  model.updateMatrixWorld(true);
  const forward = new T.Vector3(1, 0, 0).transformDirection(model.matrixWorld);
  const up = new T.Vector3(0, 1, 0).transformDirection(model.matrixWorld);
  const span = new T.Vector3(0, 0, 1).transformDirection(model.matrixWorld);
  const local = new T.Vector3(),
    world = new T.Quaternion(),
    turn = new T.Quaternion();
  const rotate = (bone: T.Bone, angle: number, axis = forward) => {
    local.copy(axis).applyQuaternion(bone.getWorldQuaternion(world).invert());
    bone.quaternion.multiply(turn.setFromAxisAngle(local, angle)).normalize();
    model.updateMatrixWorld(true);
  };
  for (let frame = 0; frame < times.length; frame++) {
    const time = times[frame];
    mixer.setTime(time);
    model.updateMatrixWorld(true);
    for (const row of rig) row.original.copy(row.bone.quaternion);
    if (frame > 0 && frame < times.length - 1) {
      for (const side of ["L", "R"]) {
        const sign = side === "L" ? 1 : -1;
        const authoredPhase =
          (time / HARROW_FLIGHT_CYCLE) * (side === "L" ? 7 : 5);
        const old = 0.18 * (1 - Math.cos(authoredPhase * Math.PI * 2));
        // The main beat closes both wings together; the existing asymmetric
        // fan animation remains underneath the progressively delayed bend.
        const phase = (time / HARROW_FLIGHT_CYCLE) * 7;
        for (const row of rig.filter((row) =>
          row.track.name.endsWith(side + ".quaternion"),
        )) {
          const upper = row.track.name.includes("upper"),
            fore = row.track.name.includes("fore"),
            stroke = harrowWingStroke(phase, upper ? 0 : fore ? 0.04 : 0.08);
          const angle = upper ? stroke - old : stroke * (fore ? 0.4 : 0.22);
          rotate(row.bone, sign * angle);
          rotate(
            row.bone,
            -sign *
              (upper ? (side === "L" ? 1.17 : 1.2) : fore ? 0.12 : 0.08) *
              Math.pow(Math.max(0, stroke / 0.45), 3),
            up,
          );
        }
      }
      // Turn the entire old full-amplitude wing trajectory about its span.
      // A brief neutral seam keeps the existing takeoff/landing boundaries.
      const planeBlend =
        T.MathUtils.smootherstep(time / 0.35, 0, 1) *
        T.MathUtils.smootherstep((clip.duration - time) / 0.35, 0, 1);
      for (const row of rig.filter((row) => row.track.name.includes("upper")))
        rotate(row.bone, T.MathUtils.degToRad(42) * planeBlend, span);
    }
    for (const row of rig) {
      row.bone.quaternion.toArray(row.values, frame * 4);
      // AnimationMixer skips constant channels. Restore its sampled pose so
      // our temporary articulation cannot accumulate into the next frame.
      row.bone.quaternion.copy(row.original);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  for (const row of rest) {
    row.bone.position.copy(row.p);
    row.bone.quaternion.copy(row.q);
    row.bone.scale.copy(row.s);
  }
  model.updateMatrixWorld(true);
  for (const row of rig) {
    // Use a common nonzero angular tangent on both sides of the neutral
    // loop seam. The original endpoint poses themselves stay untouched.
    const start = new T.Quaternion().fromArray(row.values, 0);
    const end = new T.Quaternion().fromArray(row.values, row.values.length - 4);
    const next = new T.Quaternion().fromArray(row.values, 4);
    const previous = new T.Quaternion().fromArray(
      row.values,
      row.values.length - 8,
    );
    const forwardPast = end.clone().invert().multiply(previous).invert();
    const nextPose = next
      .slerp(start.clone().multiply(forwardPast), 0.5)
      .normalize();
    const step = start.clone().invert().multiply(nextPose);
    const previousPose = end.clone().multiply(step.invert()).normalize();
    nextPose.toArray(row.values, 4);
    previousPose.toArray(row.values, row.values.length - 8);
    if (row.track.values.length === row.values.length)
      row.track.values.set(row.values);
    else {
      row.track.times = times;
      row.track.values = row.values;
    }
    // The authored constant elbows used STEP interpolation. Once articulated,
    // they need quaternion interpolation too, or every sample holds then jumps.
    row.track.setInterpolation(T.InterpolateLinear);
  }
}
