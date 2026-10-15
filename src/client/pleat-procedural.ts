import * as T from "three";
import type { PleatState } from "../shared/pleat-locomotion";
import { HoundMotionBatch } from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";

const vector = (p: { x: number; y: number; z: number }) =>
  new T.Vector3(p.x, p.y, p.z);
const smooth = (x: number) => {
  x = T.MathUtils.clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
type Visual = {
  body: T.Vector3;
  rotation: T.Quaternion;
  feet: T.Vector3[];
  normals: T.Vector3[];
  previous: T.Vector3;
  lag: number;
  lagPrevious: number;
  wind: number;
  cool: number;
  release: number;
};

/** Analytic two-link solve; the pole is projected orthogonal to the target axis. */
export function pleatKnee(
  hip: T.Vector3,
  target: T.Vector3,
  pole: T.Vector3,
  upper: number,
  lower: number,
) {
  const axis = target.clone().sub(hip);
  const distance = T.MathUtils.clamp(
    axis.length(),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  if (axis.lengthSq() < 1e-12) axis.set(0, -1, 0);
  else axis.normalize();
  const bend = pole.clone().addScaledVector(axis, -pole.dot(axis));
  if (bend.lengthSq() < 1e-10) bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
  if (bend.lengthSq() < 1e-10) bend.set(0, 0, 1).addScaledVector(axis, -axis.z);
  bend.normalize();
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  return {
    knee: hip
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(
        bend,
        Math.sqrt(Math.max(0, upper * upper - along * along)),
      ),
    ankle: hip.clone().addScaledVector(axis, distance),
  };
}

/** Per-instance raycast-controller poses, with no animation-clip sampling. */
export class PleatProcedural {
  private readonly visuals = new Map<number, Visual>();
  private readonly rest;
  private readonly positions: T.Vector3[];
  private readonly rotations: T.Quaternion[];
  private readonly scales: T.Vector3[];
  private readonly posed: T.Matrix4[];
  private readonly skin: T.Matrix4[];
  private readonly legs;
  constructor(private readonly batch: HoundMotionBatch) {
    const rest = batch.asset.proceduralRest;
    if (!rest) throw new Error("PLEAT procedural rest rig unavailable");
    this.rest = rest;
    this.positions = rest.world.map((m) =>
      new T.Vector3().setFromMatrixPosition(m),
    );
    this.rotations = rest.world.map((m) =>
      new T.Quaternion().setFromRotationMatrix(m),
    );
    this.scales = rest.world.map((m) => new T.Vector3().setFromMatrixScale(m));
    this.posed = rest.world.map((m) => m.clone());
    this.skin = rest.world.map(() => new T.Matrix4());
    this.legs = ["fore_L", "fore_R", "hind_L", "hind_R"].map((name) => {
      const upper = rest.names.indexOf(name + "_upper"),
        lower = rest.names.indexOf(name + "_lower"),
        toe = rest.names.indexOf(name + "_toe");
      return {
        upper,
        lower,
        toe,
        l1: this.positions[upper].distanceTo(this.positions[lower]),
        l2: this.positions[lower].distanceTo(this.positions[toe]),
      };
    });
  }
  clear() {
    this.visuals.clear();
  }
  retain(ids: ReadonlySet<number>) {
    for (const id of this.visuals.keys())
      if (!ids.has(id)) this.visuals.delete(id);
  }
  update(
    slot: number,
    state: PleatState,
    dt: number,
    wind: number,
    cool: number,
    color?: T.Color,
    id = slot,
  ) {
    dt = T.MathUtils.clamp(dt, 0, 0.05);
    const up = vector(state.up).normalize(),
      forward = vector(state.poseForward ?? state.forward);
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-8)
      forward.set(0, 0, -1).addScaledVector(up, up.z);
    if (forward.lengthSq() < 1e-8) forward.set(1, 0, 0);
    forward.normalize();
    const right = forward.clone().cross(up).normalize();
    const rotation = new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(right, up, forward.clone().negate()),
    );
    const targetBody = vector(state.body);
    let v = this.visuals.get(id);
    if (!v || v.body.distanceToSquared(targetBody) > 100 || dt === 0) {
      v = {
        body: targetBody.clone(),
        rotation: rotation.clone(),
        feet: state.feet.map((f) => vector(f.point)),
        normals: state.feet.map((f) => vector(f.normal)),
        previous: targetBody.clone(),
        lag: 0,
        lagPrevious: 0,
        wind,
        cool,
        release: 10,
      };
      this.visuals.set(id, v);
    }
    const blend = 1 - Math.exp(-dt * 24);
    v.body.lerp(targetBody, blend);
    v.rotation.slerp(rotation, blend);
    state.feet.forEach((foot, i) => {
      v!.feet[i].lerp(vector(foot.point), blend);
      v!.normals[i].lerp(vector(foot.normal), blend).normalize();
    });
    if (
      wind <= 0 &&
      cool > 0.85 &&
      ((v.wind > 0 && cool > v.cool) || cool > v.cool + 0.4)
    )
      v.release = 0;
    else v.release += dt;
    v.wind = wind;
    v.cool = cool;
    const charge =
      wind > 0
        ? smooth(1 - wind / STRUCTURE_TIMING.crawler.wind)
        : Math.max(0, 1 - v.release / 0.32);
    const attack =
      wind > 0 ? 0 : Math.sin(Math.PI * Math.min(1, v.release / 0.32)) * charge;
    const bodyUp = new T.Vector3(0, 1, 0).applyQuaternion(v.rotation);
    const displacement = v.body.clone().sub(v.previous).dot(bodyUp);
    const oldLag = v.lag;
    // Verlet spring on the existing rear mantle; fixed substeps keep damping frame-independent.
    if (dt > 0) {
      const steps = Math.max(1, Math.ceil(dt * 120)),
        h = dt / steps;
      let velocity = (v.lag - v.lagPrevious) / Math.max(dt, 1 / 120);
      for (let i = 0; i < steps; i++) {
        velocity += (-90 * v.lag - 13 * velocity) * h;
        v.lag += velocity * h;
      }
      v.lag = T.MathUtils.clamp(v.lag - displacement * 0.35, -0.12, 0.12);
    }
    v.lagPrevious = oldLag;
    v.previous.copy(v.body);
    const scale = Math.max(0.01, state.scale);
    const transform = new T.Matrix4()
      .compose(v.body, v.rotation, new T.Vector3(scale, scale, scale))
      .multiply(new T.Matrix4().makeTranslation(0, -0.8, 0));
    const inverse = transform.clone().invert();
    this.rest.world.forEach((m, i) => this.posed[i].copy(m));
    for (const name of [
      "mantle_front",
      "mantle_rear",
      "breast_L",
      "breast_R",
      "keel",
    ]) {
      const i = this.rest.names.indexOf(name);
      const rear = name === "mantle_rear";
      const q = new T.Quaternion()
        .setFromAxisAngle(
          new T.Vector3(1, 0, 0),
          (rear ? v.lag : -v.lag * 0.55) +
            (name.startsWith("mantle")
              ? -0.1 * charge
              : 0.1 * charge - 0.16 * attack),
        )
        .multiply(this.rotations[i]);
      const p = this.positions[i].clone();
      if (name === "keel" || name.startsWith("breast")) p.z -= 0.22 * attack;
      this.posed[i].compose(p, q, this.scales[i]);
    }
    this.legs.forEach((leg, i) => {
      const hip = this.positions[leg.upper];
      const normal = v!.normals[i].clone().transformDirection(inverse);
      const target = v!.feet[i]
        .clone()
        .addScaledVector(v!.normals[i], 0.07 * scale)
        .applyMatrix4(inverse);
      const pole = new T.Vector3(i % 2 ? 1 : -1, 0.8, i < 2 ? 0.2 : -0.2);
      const { knee, ankle } = pleatKnee(hip, target, pole, leg.l1, leg.l2);
      for (const [bone, child, start, end] of [
        [leg.upper, leg.lower, hip, knee],
        [leg.lower, leg.toe, knee, ankle],
      ] as const) {
        const q = new T.Quaternion()
          .setFromUnitVectors(
            this.positions[child].clone().sub(this.positions[bone]).normalize(),
            end.clone().sub(start).normalize(),
          )
          .multiply(this.rotations[bone]);
        this.posed[bone].compose(start, q, this.scales[bone]);
      }
      const toeRotation = new T.Quaternion()
        .setFromUnitVectors(new T.Vector3(0, 1, 0), normal)
        .multiply(this.rotations[leg.toe]);
      this.posed[leg.toe].compose(ankle, toeRotation, this.scales[leg.toe]);
    });
    this.posed.forEach((m, i) =>
      this.skin[i]
        .copy(this.rest.prefix)
        .multiply(m)
        .multiply(this.rest.inverseBind[i])
        .multiply(this.rest.bind),
    );
    this.batch.setProceduralPose(slot, this.skin);
    this.batch.setTransform(slot, transform, color);
  }
}
