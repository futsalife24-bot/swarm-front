import * as T from "three";

export type IdleSpecies =
  "hound" | "leaper" | "pleat" | "prism" | "ray" | "foundry_zero";

/** Six-second inspection/combat idle. Bake once into the existing GPU palette. */
export function enemyIdleClip(
  model: T.Group,
  bones: T.Bone[],
  species: IdleSpecies,
) {
  model.updateMatrixWorld(true);
  const rest = bones.map((b) => ({
    b,
    p: b.position.clone(),
    q: b.quaternion.clone(),
    s: b.scale.clone(),
  }));
  const body = bones.find((b) => b.name === "body")!;
  const legs = bones
    .filter(
      (b) =>
        b.name.endsWith("_upper") &&
        b.children.some((c) => c.name.endsWith("_lower")),
    )
    .map((upper) => {
      const lower = bones.find(
        (b) => b.name === upper.name.replace("_upper", "_lower"),
      )!;
      const toe = bones.find(
        (b) => b.name === upper.name.replace("_upper", "_toe"),
      )!;
      const hip = upper.getWorldPosition(new T.Vector3()),
        knee = lower.getWorldPosition(new T.Vector3()),
        foot = toe.getWorldPosition(new T.Vector3());
      const axis = foot.clone().sub(hip).normalize();
      return {
        upper,
        lower,
        toe,
        foot,
        bend: knee
          .clone()
          .sub(hip)
          .addScaledVector(axis, -knee.clone().sub(hip).dot(axis))
          .normalize(),
        l1: hip.distanceTo(knee),
        l2: knee.distanceTo(foot),
        toeQ: toe.getWorldQuaternion(new T.Quaternion()),
      };
    });
  const reset = () => {
    for (const r of rest) {
      r.b.position.copy(r.p);
      r.b.quaternion.copy(r.q);
      r.b.scale.copy(r.s);
    }
  };
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
  const times: number[] = [],
    values = bones.map(() => ({ p: [] as number[], q: [] as number[] }));
  const turn = new T.Quaternion(),
    axisY = new T.Vector3(0, 1, 0),
    euler = new T.Euler();
  for (let frame = 0; frame <= 360; frame++) {
    reset();
    const phase = (frame / 360) * Math.PI * 2;
    times.push(frame / 60);
    if (legs.length)
      body.position.y -=
        (species === "leaper" ? 0.16 : species === "hound" ? 0.09 : 0.06) *
        (1 - Math.cos(phase * 2)) *
        0.5;
    for (const r of rest) {
      const b = r.b,
        n = b.name;
      if (species === "prism") {
        if (n.startsWith("shield_")) {
          const i = Number(n.slice(7));
          // Rotate the complete suspended formation: neighbouring plates keep their clearance.
          b.position.applyAxisAngle(axisY, phase);
          b.position.y += 0.045 * Math.sin(phase * 2 + i * 0.6);
          b.quaternion.premultiply(turn.setFromAxisAngle(axisY, phase));
        } else if (n === "body") b.position.y += 0.07 * Math.sin(phase * 2);
      } else if (species === "ray") {
        if (n.startsWith("fin_"))
          b.quaternion.premultiply(
            turn.setFromAxisAngle(
              new T.Vector3(0, 0, 1),
              Number(n.slice(4)) * 0.24 * Math.sin(phase * 2),
            ),
          );
        if (n.startsWith("tail_")) {
          const [, tail, segment] = n.split("_").map(Number),
            wave = phase * 2 - segment * 0.6 + tail * 0.7;
          b.position.x += 0.12 * Math.sin(wave);
          b.position.y += 0.06 * Math.cos(wave);
          b.quaternion.premultiply(
            turn.setFromAxisAngle(axisY, -0.11 * Math.cos(wave)),
          );
        }
      } else if (species === "pleat") {
        if (n.startsWith("breast_") || n.startsWith("flank_")) {
          const side = n.endsWith("_L") ? -1 : 1,
            wave =
              (1 - Math.cos(phase * 2 + (n.startsWith("flank_") ? 0.8 : 0))) *
              0.5;
          b.quaternion.multiply(
            turn.setFromAxisAngle(axisY, side * 0.2 * wave),
          );
          b.position.x += side * 0.055 * wave;
        }
        if (n.startsWith("mantle_"))
          b.quaternion.multiply(
            turn.setFromAxisAngle(
              new T.Vector3(1, 0, 0),
              0.075 * Math.sin(phase * 2 + (n.endsWith("rear") ? 1 : 0)),
            ),
          );
      } else if (species === "hound" || species === "leaper") {
        if (n.startsWith("spine_")) {
          const i = Number(n.slice(6)),
            wave = phase * 2 - i * 0.7;
          b.position.y += 0.09 * Math.sin(wave);
          b.quaternion.multiply(
            turn.setFromAxisAngle(axisY, 0.18 * Math.sin(wave)),
          );
        }
        if (n === "ring")
          b.quaternion.multiply(
            turn.setFromAxisAngle(axisY, 0.2 * Math.sin(phase)),
          );
      } else if (species === "foundry_zero" && n.startsWith("crane_")) {
        const side = Number(n.slice(6));
        b.quaternion.multiply(
          turn.setFromEuler(
            euler.set(
              0.12 * Math.sin(phase * 2 + side),
              side * 0.22 * Math.sin(phase),
              side * 0.1 * Math.sin(phase * 2),
            ),
          ),
        );
      }
    }
    model.updateMatrixWorld(true);
    // Bend the existing rigid joints around fixed toe targets; no foot sliding or scaling.
    for (const leg of legs) {
      const hip = leg.upper.getWorldPosition(new T.Vector3()),
        axis = leg.foot.clone().sub(hip);
      const d = T.MathUtils.clamp(
        axis.length(),
        Math.abs(leg.l1 - leg.l2) + 1e-5,
        leg.l1 + leg.l2 - 1e-5,
      );
      axis.normalize();
      const bend = leg.bend
        .clone()
        .addScaledVector(axis, -leg.bend.dot(axis))
        .normalize();
      const along = (leg.l1 ** 2 - leg.l2 ** 2 + d * d) / (2 * d);
      const knee = hip
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
          .multiply(leg.toeQ),
      );
      model.updateMatrixWorld(true);
    }
    bones.forEach((b, i) => {
      b.position.toArray(values[i].p, frame * 3);
      b.quaternion.toArray(values[i].q, frame * 4);
    });
  }
  reset();
  model.updateMatrixWorld(true);
  return new T.AnimationClip(
    "Idle",
    6,
    bones.flatMap((b, i) => [
      new T.VectorKeyframeTrack(`${b.name}.position`, times, values[i].p),
      new T.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values[i].q),
    ]),
  );
}
