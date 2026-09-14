import * as T from "three";
import type { IdleSpecies } from "./enemy-idle-clip";
import { STRUCTURE_TIMING } from "../shared/structure-timing";

const smooth = (x: number) => {
  x = T.MathUtils.clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Build pressure, hold the silhouette, then release into the original impact pose. */
export const windupPressure = (progress: number) =>
  smooth(progress / 0.58) * (1 - smooth((progress - 0.78) / 0.22));

/** Visual-only overlay, baked once. Original impact/recovery and bone lengths are retained. */
export function enemyWindupClip(
  model: T.Group,
  bones: T.Bone[],
  species: IdleSpecies,
  source: T.AnimationClip,
) {
  const impact =
    STRUCTURE_TIMING[
      species === "prism"
        ? "spitter"
        : species === "ray"
          ? "hornet"
          : species === "foundry_zero"
            ? "boss"
            : "crawler"
    ].impact;
  const rest = bones.map((b) => ({
    b,
    p: b.position.clone(),
    q: b.quaternion.clone(),
    s: b.scale.clone(),
  }));
  const body = bones.find((b) => b.name === "body")!;
  const legs = bones
    .filter((b) => b.name.endsWith("_upper"))
    .map((upper) => ({
      upper,
      lower: bones.find(
        (b) => b.name === upper.name.replace("_upper", "_lower"),
      )!,
      toe: bones.find((b) => b.name === upper.name.replace("_upper", "_toe"))!,
    }));
  const mixer = new T.AnimationMixer(model),
    action = mixer.clipAction(source);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const turn = new T.Quaternion(),
    angles = new T.Euler(),
    times: number[] = [];
  const values = bones.map(() => ({
    p: [] as number[],
    q: [] as number[],
    s: [] as number[],
  }));
  const aim = (bone: T.Bone, child: T.Bone, target: T.Vector3) => {
    const origin = bone.getWorldPosition(new T.Vector3());
    const delta = new T.Quaternion().setFromUnitVectors(
      child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),
      target.clone().sub(origin).normalize(),
    );
    const world = delta.multiply(bone.getWorldQuaternion(new T.Quaternion()));
    bone.quaternion.copy(
      bone
        .parent!.getWorldQuaternion(new T.Quaternion())
        .invert()
        .multiply(world),
    );
    model.updateMatrixWorld(true);
  };
  const frames = Math.round(source.duration * 60);
  for (let f = 0; f <= frames; f++) {
    const time = f / 60,
      u = time / impact,
      pressure = windupPressure(u);
    times.push(time);

    mixer.setTime(time);
    model.updateMatrixWorld(true);
    const sampled = bones.map((b) => ({
      p: b.position.clone(),
      q: b.quaternion.clone(),
      s: b.scale.clone(),
    }));
    if (pressure > 0 && u < 1) {
      const grounded =
        species === "pleat" || species === "hound" || species === "leaper";
      const targets = grounded
        ? legs.map((leg) => {
            const hip = leg.upper.getWorldPosition(new T.Vector3()),
              knee = leg.lower.getWorldPosition(new T.Vector3()),
              foot = leg.toe.getWorldPosition(new T.Vector3());
            return {
              ...leg,
              hip,
              knee,
              foot,
              l1: hip.distanceTo(knee),
              l2: knee.distanceTo(foot),
              q: leg.toe.getWorldQuaternion(new T.Quaternion()),
            };
          })
        : [];
      if (grounded) {
        body.position.y -=
          (species === "leaper" ? 0.2 : species === "hound" ? 0.18 : 0.13) *
          pressure;
        body.position.z += 0.1 * pressure;
      }
      for (const b of bones) {
        const n = b.name;
        if (species === "prism" && n.startsWith("shield_")) {
          const i = Number(n.slice(7));
          // Each plate pitches about its own horizontal axis, rather than orbiting the core.
          const spin =
            smooth((u - i * 0.013) / (0.78 - i * 0.013)) * Math.PI * 2;
          b.quaternion.premultiply(
            turn.setFromEuler(angles.set((i % 2 ? -1 : 1) * spin, 0, 0)),
          );
          b.position.x += Math.sign(b.position.x) * 0.38 * pressure;
          b.position.z += (i % 2 ? 1 : -1) * 0.24 * pressure;
          b.position.y += 0.18 * pressure;
        } else if (species === "pleat") {
          const side = n.endsWith("_L") ? -1 : 1;
          if (n.startsWith("breast_") || n.startsWith("flank_")) {
            b.quaternion.multiply(
              turn.setFromEuler(angles.set(0, side * 0.48 * pressure, 0)),
            );
            b.position.x += side * 0.08 * pressure;
          }
          if (n.startsWith("mantle_"))
            b.quaternion.multiply(
              turn.setFromEuler(angles.set(-0.22 * pressure, 0, 0)),
            );
        } else if (species === "hound" || species === "leaper") {
          if (n.startsWith("spine_")) {
            const i = Number(n.slice(6));
            b.position.y += (0.18 + i * 0.04) * pressure;
            b.quaternion.multiply(
              turn.setFromEuler(
                angles.set(-0.42 * pressure, (i - 1) * 0.16 * pressure, 0),
              ),
            );
          }
          if (n === "ring")
            b.quaternion.multiply(
              turn.setFromEuler(angles.set(-0.3 * pressure, 0, 0)),
            );
        } else if (species === "ray") {
          if (n.startsWith("fin_"))
            b.quaternion.premultiply(
              turn.setFromEuler(
                angles.set(0, 0, Number(n.slice(4)) * 0.42 * pressure),
              ),
            );
          if (n.startsWith("tail_")) {
            const [, tail, segment] = n.split("_").map(Number);
            b.position.x += (tail - 1) * 0.1 * segment * pressure;
            b.position.y += 0.08 * segment * pressure;
          }
        } else if (species === "foundry_zero" && n.startsWith("crane_")) {
          const side = Number(n.slice(6));
          b.quaternion.multiply(
            turn.setFromEuler(
              angles.set(
                -0.55 * pressure,
                side * 0.42 * pressure,
                side * 0.2 * pressure,
              ),
            ),
          );
        }
      }
      model.updateMatrixWorld(true);
      // Preserve the authored toe contacts even when the body crouches more deeply.
      for (const leg of targets) {
        const hip = leg.upper.getWorldPosition(new T.Vector3()),
          axis = leg.foot.clone().sub(hip),
          d = T.MathUtils.clamp(
            axis.length(),
            Math.abs(leg.l1 - leg.l2) + 1e-6,
            leg.l1 + leg.l2 - 1e-6,
          );
        axis.normalize();
        const bend = leg.knee.clone().sub(leg.hip);
        bend.addScaledVector(axis, -bend.dot(axis)).normalize();
        const along = (leg.l1 ** 2 - leg.l2 ** 2 + d * d) / (2 * d),
          knee = hip
            .clone()
            .addScaledVector(axis, along)
            .addScaledVector(
              bend,
              Math.sqrt(Math.max(0, leg.l1 ** 2 - along ** 2)),
            );
        aim(leg.upper, leg.lower, knee);
        aim(leg.lower, leg.toe, hip.clone().addScaledVector(axis, d));
        leg.toe.quaternion.copy(
          leg.toe
            .parent!.getWorldQuaternion(new T.Quaternion())
            .invert()
            .multiply(leg.q),
        );
        model.updateMatrixWorld(true);
      }
    }
    bones.forEach((b, i) => {
      b.position.toArray(values[i].p, f * 3);
      b.quaternion.toArray(values[i].q, f * 4);
      b.scale.toArray(values[i].s, f * 3);
    });
    // Mixer caches unchanged channels: restore the sampled pose, not the bind pose.
    bones.forEach((b, i) => {
      b.position.copy(sampled[i].p);
      b.quaternion.copy(sampled[i].q);
      b.scale.copy(sampled[i].s);
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  for (const r of rest) {
    r.b.position.copy(r.p);
    r.b.quaternion.copy(r.q);
    r.b.scale.copy(r.s);
  }
  model.updateMatrixWorld(true);
  return new T.AnimationClip(
    "Lunge",
    source.duration,
    bones.flatMap((b, i) => [
      new T.VectorKeyframeTrack(`${b.name}.position`, times, values[i].p),
      new T.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values[i].q),
      new T.VectorKeyframeTrack(`${b.name}.scale`, times, values[i].s),
    ]),
  );
}
