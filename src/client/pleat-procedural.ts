import * as T from "three";
import { PLEAT_REST } from "../shared/pleat-locomotion";
import { HoundMotionBatch } from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";

type V3 = { x: number; y: number; z: number };
/** What the renderer needs from the authority: the body pose only. */
export type PleatPose = {
  body: V3;
  up: V3;
  forward: V3;
  poseForward?: V3;
  scale: number;
};
export type PleatSurfaceRay = (
  origin: V3,
  direction: V3,
  distance: number,
) => { point: V3; normal: V3 } | undefined;

/** Distances (m) from the camera that pick how much leg work an instance gets. */
export const PLEAT_DETAIL = { near: 24, mid: 48 } as const;

const smooth = (x: number) => {
  x = T.MathUtils.clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
type Foot = {
  point: T.Vector3;
  normal: T.Vector3;
  from: T.Vector3;
  fromNormal: T.Vector3;
  to: T.Vector3;
  toNormal: T.Vector3;
  /** Swing progress; 1 = planted. */
  t: number;
  duration: number;
  lift: number;
};
type Visual = {
  body: T.Vector3;
  rotation: T.Quaternion;
  feet: Foot[];
  previous: T.Vector3;
  lag: number;
  lagPrevious: number;
  wind: number;
  cool: number;
  release: number;
  /** Diagonal pair allowed to swing next (0: fore-L/hind-R, 1: fore-R/hind-L). */
  pair: number;
  /** Seconds since the bone palette was last written (distance thinning). */
  stale: number;
};
const PAIR = [0, 1, 1, 0];

/** Analytic two-link solve; the pole is projected orthogonal to the target axis. */
export function pleatKnee(
  hip: T.Vector3,
  target: T.Vector3,
  pole: T.Vector3,
  upper: number,
  lower: number,
  out = { knee: new T.Vector3(), ankle: new T.Vector3() },
  axis = new T.Vector3(),
  bend = new T.Vector3(),
) {
  axis.copy(target).sub(hip);
  const distance = T.MathUtils.clamp(
    axis.length(),
    Math.abs(upper - lower) + 1e-5,
    upper + lower - 1e-5,
  );
  if (axis.lengthSq() < 1e-12) axis.set(0, -1, 0);
  else axis.normalize();
  bend.copy(pole).addScaledVector(axis, -pole.dot(axis));
  if (bend.lengthSq() < 1e-10) bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
  if (bend.lengthSq() < 1e-10) bend.set(0, 0, 1).addScaledVector(axis, -axis.z);
  bend.normalize();
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  out.knee
    .copy(hip)
    .addScaledVector(axis, along)
    .addScaledVector(
      bend,
      Math.sqrt(Math.max(0, upper * upper - along * along)),
    );
  out.ankle.copy(hip).addScaledVector(axis, distance);
  return out;
}

/**
 * Per-instance legs placed by the renderer. The authority sends a body pose; the
 * feet step, plant and follow walls here, so their cost never reaches the server.
 * Near instances probe the map for footholds; distant ones walk on the body
 * plane and refresh their bones less often. Nothing here feeds back into World.
 */
export class PleatProcedural {
  private readonly visuals = new Map<number, Visual>();
  private readonly rest;
  private readonly positions: T.Vector3[];
  private readonly rotations: T.Quaternion[];
  private readonly scales: T.Vector3[];
  private readonly posed: T.Matrix4[];
  private readonly skin: T.Matrix4[];
  private readonly legs;
  private ray?: PleatSurfaceRay;
  private readonly viewer = new T.Vector3();
  private hasViewer = false;
  /** Instances updated in the latest frame per detail level (for diagnostics). */
  readonly detail = { near: 0, mid: 0, far: 0, posed: 0, probes: 0 };
  // Scratch objects: one update allocates nothing per instance.
  private readonly up = new T.Vector3();
  private readonly forward = new T.Vector3();
  private readonly right = new T.Vector3();
  private readonly basis = new T.Matrix4();
  private readonly target = new T.Quaternion();
  private readonly bodyTarget = new T.Vector3();
  private readonly home = new T.Vector3();
  private readonly step = new T.Vector3();
  private readonly transform = new T.Matrix4();
  private readonly inverse = new T.Matrix4();
  private readonly offset = new T.Matrix4().makeTranslation(0, -0.8, 0);
  private readonly unitScale = new T.Vector3();
  private readonly q = new T.Quaternion();
  private readonly v = new T.Vector3();
  private readonly w = new T.Vector3();
  private readonly axis = new T.Vector3(1, 0, 0);
  private readonly yAxis = new T.Vector3(0, 1, 0);
  private readonly pole = new T.Vector3();
  private readonly joint = { knee: new T.Vector3(), ankle: new T.Vector3() };
  private readonly axisScratch = new T.Vector3();
  private readonly bendScratch = new T.Vector3();
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
  /** Map surfaces for near footholds; omitted, feet walk on the body plane. */
  setSurface(ray: PleatSurfaceRay | undefined) {
    this.ray = ray;
  }
  /** Camera position for distance-based detail; omitted, every instance is near. */
  setViewer(position: V3 | undefined) {
    this.hasViewer = !!position;
    if (position) this.viewer.set(position.x, position.y, position.z);
  }
  beginFrame() {
    Object.assign(this.detail, {
      near: 0,
      mid: 0,
      far: 0,
      posed: 0,
      probes: 0,
    });
  }
  clear() {
    this.visuals.clear();
  }
  retain(ids: ReadonlySet<number>) {
    for (const id of this.visuals.keys())
      if (!ids.has(id)) this.visuals.delete(id);
  }
  /** Current contacts of one instance (tests and diagnostics). */
  contacts(id: number) {
    return this.visuals.get(id)?.feet.map((f) => ({
      point: f.point.clone(),
      normal: f.normal.clone(),
      planted: f.t >= 1,
    }));
  }
  /** Foot rest position on the plane under the body, in world space. */
  private homeOf(v: Visual, scale: number, i: number, out: T.Vector3) {
    return out
      .copy(v.body)
      .addScaledVector(this.up, -0.8 * scale)
      .addScaledVector(this.right, PLEAT_REST[i].x * scale)
      .addScaledVector(this.forward, -PLEAT_REST[i].z * scale);
  }
  /** A foothold near `goal`: map probe when near, otherwise the body plane. */
  private foothold(
    goal: T.Vector3,
    scale: number,
    probe: boolean,
    point: T.Vector3,
    normal: T.Vector3,
  ) {
    point.copy(goal);
    normal.copy(this.up);
    if (!probe || !this.ray) return;
    this.detail.probes++;
    const reach = 0.9 * scale;
    const hit =
      this.ray(
        this.w.copy(goal).addScaledVector(this.up, reach),
        this.v.copy(this.up).negate(),
        2 * reach,
      ) ??
      // A wall ahead of the stride (the body is about to climb it).
      this.ray(
        this.w.copy(goal).addScaledVector(this.up, 0.3 * scale),
        this.forward,
        reach,
      );
    if (hit) {
      point.set(hit.point.x, hit.point.y, hit.point.z);
      normal.set(hit.normal.x, hit.normal.y, hit.normal.z).normalize();
    }
  }
  update(
    slot: number,
    state: PleatPose,
    dt: number,
    wind: number,
    cool: number,
    color?: T.Color,
    id = slot,
  ) {
    dt = T.MathUtils.clamp(dt, 0, 0.05);
    const up = this.up.set(state.up.x, state.up.y, state.up.z).normalize();
    const pf = state.poseForward ?? state.forward;
    const forward = this.forward.set(pf.x, pf.y, pf.z);
    forward.addScaledVector(up, -forward.dot(up));
    if (forward.lengthSq() < 1e-8)
      forward.set(0, 0, -1).addScaledVector(up, up.z);
    if (forward.lengthSq() < 1e-8) forward.set(1, 0, 0);
    forward.normalize();
    const right = this.right.copy(forward).cross(up).normalize();
    const rotation = this.target.setFromRotationMatrix(
      this.basis.makeBasis(right, up, this.v.copy(forward).negate()),
    );
    const targetBody = this.bodyTarget.set(
      state.body.x,
      state.body.y,
      state.body.z,
    );
    const scale = Math.max(0.01, state.scale);
    const distance = this.hasViewer ? this.viewer.distanceTo(targetBody) : 0;
    const level =
      distance < PLEAT_DETAIL.near ? 0 : distance < PLEAT_DETAIL.mid ? 1 : 2;
    this.detail[level === 0 ? "near" : level === 1 ? "mid" : "far"]++;
    let v = this.visuals.get(id);
    const fresh = !v || v.body.distanceToSquared(targetBody) > 100 || dt === 0;
    if (!v || fresh) {
      v = {
        body: targetBody.clone(),
        rotation: rotation.clone(),
        feet: PLEAT_REST.map(() => ({
          point: new T.Vector3(),
          normal: new T.Vector3(),
          from: new T.Vector3(),
          fromNormal: new T.Vector3(),
          to: new T.Vector3(),
          toNormal: new T.Vector3(),
          t: 1,
          duration: 0.2,
          lift: 0,
        })),
        previous: targetBody.clone(),
        lag: v?.lag ?? 0,
        lagPrevious: v?.lagPrevious ?? 0,
        wind,
        cool,
        release: 10,
        pair: 0,
        stale: Infinity,
      };
      this.visuals.set(id, v);
      v.feet.forEach((f, i) =>
        this.foothold(
          this.homeOf(v!, scale, i, this.home),
          scale,
          level === 0,
          f.point,
          f.normal,
        ),
      );
    }
    const blend = 1 - Math.exp(-dt * 24);
    v.body.lerp(targetBody, blend);
    v.rotation.slerp(rotation, blend);
    // Feet: a diagonal pair swings while the other pair holds the body.
    const speed = dt > 0 ? v.body.distanceTo(v.previous) / dt : 0;
    let swinging = false;
    for (const f of v.feet) {
      if (f.t >= 1) continue;
      f.t = Math.min(1, f.t + dt / f.duration);
      const s = smooth(f.t);
      f.point.lerpVectors(f.from, f.to, s);
      f.normal.lerpVectors(f.fromNormal, f.toNormal, s).normalize();
      f.point.addScaledVector(
        this.w.copy(f.fromNormal).add(f.toNormal).add(up).normalize(),
        Math.sin(Math.PI * f.t) * f.lift,
      );
      if (f.t >= 1) {
        f.point.copy(f.to);
        f.normal.copy(f.toNormal);
      } else swinging = true;
    }
    if (!swinging) {
      const duration =
        T.MathUtils.clamp(0.3 - speed * 0.025, 0.14, 0.3) *
        Math.sqrt(scale / 1.5);
      v.feet.forEach((f, i) => {
        const home = this.homeOf(v!, scale, i, this.home);
        const drift = f.point.distanceTo(home);
        // Far beyond reach (a transfer outran the leg): replant without a swing.
        if (drift > 2.2 * scale) {
          this.foothold(home, scale, level === 0, f.point, f.normal);
          return;
        }
        if (
          PAIR[i] !== v!.pair ||
          (drift < 0.38 * scale &&
            f.normal.dot(up) > 0.7 &&
            !(speed < 0.05 && drift > 0.12 * scale))
        )
          return;
        // Land ahead of the rest point by half the travel of one swing.
        if (dt > 0)
          home.addScaledVector(
            this.step.copy(v!.body).sub(v!.previous),
            (duration * 0.5) / dt,
          );
        this.foothold(home, scale, level === 0, f.to, f.toNormal);
        f.from.copy(f.point);
        f.fromNormal.copy(f.normal);
        f.t = 0;
        f.duration = duration;
        f.lift =
          (0.2 +
            (Math.max(0, this.v.copy(f.to).sub(f.from).dot(up)) / scale) *
              0.4) *
          scale;
      });
      v.pair ^= 1;
    }
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
    const bodyUp = this.w.copy(this.yAxis).applyQuaternion(v.rotation);
    const displacement = this.v.copy(v.body).sub(v.previous).dot(bodyUp);
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
    const transform = this.transform
      .compose(v.body, v.rotation, this.unitScale.set(scale, scale, scale))
      .multiply(this.offset);
    // The body transform moves every frame; the bone palette may be refreshed
    // less often far away (mid: 30 Hz, far: 15 Hz), never during the attack.
    v.stale += dt;
    const interval =
      wind > 0 || attack > 0
        ? 0
        : level === 0
          ? 0
          : level === 1
            ? 1 / 30
            : 1 / 15;
    if (v.stale >= interval - 1e-6) {
      v.stale = 0;
      this.detail.posed++;
      this.pose(v, scale, transform, charge, attack);
      this.batch.setProceduralPose(slot, this.skin);
    }
    this.batch.setTransform(slot, transform, color);
  }
  private pose(
    v: Visual,
    scale: number,
    transform: T.Matrix4,
    charge: number,
    attack: number,
  ) {
    const inverse = this.inverse.copy(transform).invert();
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
      const q = this.q
        .setFromAxisAngle(
          this.axis,
          (rear ? v.lag : -v.lag * 0.55) +
            (name.startsWith("mantle")
              ? -0.1 * charge
              : 0.1 * charge - 0.16 * attack),
        )
        .multiply(this.rotations[i]);
      const p = this.v.copy(this.positions[i]);
      if (name === "keel" || name.startsWith("breast")) p.z -= 0.22 * attack;
      this.posed[i].compose(p, q, this.scales[i]);
    }
    this.legs.forEach((leg, i) => {
      const foot = v.feet[i];
      const hip = this.positions[leg.upper];
      const normal = this.w.copy(foot.normal).transformDirection(inverse);
      const target = this.v
        .copy(foot.point)
        .addScaledVector(foot.normal, 0.07 * scale)
        .applyMatrix4(inverse);
      const pole = this.pole.set(i % 2 ? 1 : -1, 0.8, i < 2 ? 0.2 : -0.2);
      const { knee, ankle } = pleatKnee(
        hip,
        target,
        pole,
        leg.l1,
        leg.l2,
        this.joint,
        this.axisScratch,
        this.bendScratch,
      );
      for (let segment = 0; segment < 2; segment++) {
        const bone = segment ? leg.lower : leg.upper,
          child = segment ? leg.toe : leg.lower,
          start = segment ? knee : hip,
          end = segment ? ankle : knee;
        const q = this.q
          .setFromUnitVectors(
            this.step
              .copy(this.positions[child])
              .sub(this.positions[bone])
              .normalize(),
            this.axisScratch.copy(end).sub(start).normalize(),
          )
          .multiply(this.rotations[bone]);
        this.posed[bone].compose(start, q, this.scales[bone]);
      }
      const toeRotation = this.q
        .setFromUnitVectors(this.yAxis, normal)
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
  }
}
