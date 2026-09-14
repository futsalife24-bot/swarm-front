import * as T from "three";

type Step = {
  from: T.Vector3;
  to: T.Vector3;
  rotation: T.Quaternion;
  progress: number;
  distance: number;
  duration: number;
  lift: number;
  lead: number;
};
type Leg = {
  upper: T.Object3D;
  lower: T.Object3D;
  foot: T.Object3D;
  hip: T.Vector3;
  knee: T.Vector3;
  toe: T.Vector3;
  upperDirection: T.Vector3;
  lowerDirection: T.Vector3;
  upperRotation: T.Quaternion;
  lowerRotation: T.Quaternion;
  footRotation: T.Quaternion;
  upperLength: number;
  lowerLength: number;
  clearance: number;
  seed: number;
  stepIndex: number;
  nextTravel: number;
  anchor: T.Vector3;
  rotation: T.Quaternion;
  step?: Step;
};
type Unit = {
  root: T.Object3D;
  legs: Leg[];
  previous: T.Vector3;
  rotation: T.Quaternion;
  travel: number;
  ready: boolean;
  cycle: number;
};

function required(root: T.Object3D, name: string) {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`FOUNDRY ZERO gait requires ${name}`);
  return node;
}

// Sample only at lift-off. Stable per-leg sequences avoid frame-to-frame jitter
// and do not consume gameplay randomness.
function variation(seed: number, index: number, lane: number) {
  let value =
    (seed ^
      Math.imul(index + 1, 0x9e3779b9) ^
      Math.imul(lane + 1, 0x85ebca6b)) >>>
    0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** Distance-driven stepping. Planted feet remain fixed in the view's game frame. */
export class FoundryWormGait {
  private readonly units: Unit[];
  private lastTime?: number;
  private readonly inverse = new T.Quaternion();
  private readonly rotation = new T.Quaternion();
  private readonly target = new T.Vector3();
  private readonly direction = new T.Vector3();
  private readonly pole = new T.Vector3();
  private readonly knee = new T.Vector3();
  private readonly axis = new T.Vector3();

  constructor(units: readonly T.Object3D[]) {
    units[0].updateWorldMatrix(true, true);
    this.units = units.map((root, unitIndex) => {
      const legs: Leg[] = [];
      root.traverse((node) => {
        const match = node.name.match(/_LEG_([LR])(\d+)$/);
        if (!match) return;
        const upper = required(node, `${node.name}_UPPER`);
        const lower = required(node, `${node.name}_LOWER`);
        const foot = required(node, `${node.name}_FOOT`);
        const hip = upper.position.clone(),
          knee = lower.position.clone(),
          toe = foot.position.clone();
        const upperDirection = knee.clone().sub(hip),
          lowerDirection = toe.clone().sub(knee);
        const upperLength = upperDirection.length(),
          lowerLength = lowerDirection.length();
        if (upperLength < 0.01 || lowerLength < 0.01)
          throw new Error(`${node.name} has invalid leg lengths`);
        foot.updateWorldMatrix(true, true);
        const footWorld = foot.getWorldPosition(new T.Vector3());
        const bounds = new T.Box3().setFromObject(foot);
        legs.push({
          upper,
          lower,
          foot,
          hip,
          knee,
          toe,
          upperDirection: upperDirection.normalize(),
          lowerDirection: lowerDirection.normalize(),
          upperRotation: upper.quaternion.clone(),
          lowerRotation: lower.quaternion.clone(),
          footRotation: foot.quaternion.clone(),
          upperLength,
          lowerLength,
          clearance: Math.max(0, footWorld.y - bounds.min.y),
          seed:
            unitIndex * 17 +
            Number(match[2]) * 3 +
            (match[1] === "R" ? 101 : 307),
          stepIndex: 0,
          nextTravel: 0,
          anchor: new T.Vector3(),
          rotation: new T.Quaternion(),
        });
      });
      if (legs.length !== (unitIndex === 0 ? 6 : 4))
        throw new Error(`${root.name} has an unexpected leg structure`);
      return {
        root,
        legs,
        previous: root.position.clone(),
        rotation: root.quaternion.clone(),
        travel: 0,
        ready: false,
        cycle: Math.min(
          1.35,
          Math.min(...legs.map((leg) => leg.upperLength + leg.lowerLength)) *
            0.62,
        ),
      };
    });
  }

  ground?: (x:number,z:number)=>number;

  private reset(unit: Unit) {
    unit.travel = 0;
    unit.ready = true;
    for (const leg of unit.legs) {
      leg.anchor
        .copy(leg.toe)
        .applyQuaternion(unit.root.quaternion)
        .add(unit.root.position);
      leg.anchor.y = (this.ground?.(leg.anchor.x,leg.anchor.z) ?? unit.root.position.y) + leg.clearance;
      leg.rotation.copy(unit.root.quaternion).multiply(leg.footRotation);
      leg.step = undefined;
      leg.stepIndex = 0;
      leg.nextTravel = unit.cycle * (0.08 + variation(leg.seed, 0, 0) * 0.74);
    }
  }

  update(time: number) {
    const elapsed = this.lastTime === undefined ? 0 : time - this.lastTime;
    const dt = Math.max(0, Math.min(0.1, elapsed));
    this.lastTime = time;
    for (const unit of this.units) {
      if (!unit.root.visible) {
        unit.ready = false;
        continue;
      }
      const distance = Math.hypot(
        unit.root.position.x - unit.previous.x,
        unit.root.position.z - unit.previous.z,
      );
      const turn = unit.rotation.angleTo(unit.root.quaternion);
      const reset =
        !unit.ready ||
        elapsed < 0 ||
        elapsed > 0.3 ||
        distance > 2 ||
        Math.abs(unit.root.position.y - unit.previous.y) > 0.15;
      if (reset) this.reset(unit);
      const moved = !reset && (distance > 0.00005 || turn > 0.00005);
      const travel = moved ? distance + turn * 1.35 : 0;
      unit.travel += travel;
      this.inverse.copy(unit.root.quaternion).invert();
      for (const leg of unit.legs) {
        this.target
          .copy(leg.anchor)
          .sub(unit.root.position)
          .applyQuaternion(this.inverse);
        const reach = this.target.distanceTo(leg.hip);
        const overreach = reach > (leg.upperLength + leg.lowerLength) * 0.92;
        if (
          !leg.step &&
          moved &&
          (unit.travel >= leg.nextTravel || overreach)
        ) {
          const index = ++leg.stepIndex;
          const lead =
            unit.cycle * (0.25 + variation(leg.seed, index, 1) * 0.17);
          leg.nextTravel =
            unit.travel +
            unit.cycle * (0.72 + variation(leg.seed, index, 0) * 0.45);
          const to = leg.toe.clone();
          to.z -= lead;
          to.applyQuaternion(unit.root.quaternion).add(unit.root.position);
          to.y = (this.ground?.(to.x,to.z) ?? unit.root.position.y) + leg.clearance;
          leg.step = {
            from: leg.anchor.clone(),
            to,
            rotation: unit.root.quaternion.clone().multiply(leg.footRotation),
            progress: 0,
            distance: unit.cycle * (0.3 + variation(leg.seed, index, 2) * 0.15),
            duration: 0.11 + variation(leg.seed, index, 3) * 0.045,
            lift: 0.14 + variation(leg.seed, index, 4) * 0.15,
            lead,
          };
        }
        if (leg.step) {
          const step = leg.step;
          if (moved) {
            // Replan only an airborne landing during a turn. Supporting feet
            // retain their anchors; a pending landing follows the current reach.
            step.to.copy(leg.toe);
            step.to.z -= step.lead;
            step.to
              .applyQuaternion(unit.root.quaternion)
              .add(unit.root.position);
            step.to.y = (this.ground?.(step.to.x,step.to.z) ?? unit.root.position.y) + leg.clearance;
            step.rotation.copy(unit.root.quaternion).multiply(leg.footRotation);
          }
          // A stopped unit finishes its current step instead of freezing a foot in air.
          step.progress = Math.min(
            1,
            step.progress +
              Math.min(
                moved ? travel / step.distance : dt / 0.15,
                dt / step.duration,
              ),
          );
          const smooth =
            step.progress * step.progress * (3 - 2 * step.progress);
          leg.anchor.lerpVectors(step.from, step.to, smooth);
          leg.anchor.y += Math.sin(Math.PI * step.progress) * step.lift;
          leg.rotation.slerp(step.rotation, smooth);
          if (step.progress === 1) {
            leg.anchor.copy(step.to);
            leg.rotation.copy(step.rotation);
            leg.step = undefined;
          }
        }
        this.solve(unit, leg);
      }
      unit.previous.copy(unit.root.position);
      unit.rotation.copy(unit.root.quaternion);
    }
  }

  private solve(unit: Unit, leg: Leg) {
    this.target
      .copy(leg.anchor)
      .sub(unit.root.position)
      .applyQuaternion(this.inverse);
    this.direction.copy(this.target).sub(leg.hip);
    const requested = this.direction.length();
    const length = T.MathUtils.clamp(
      requested,
      Math.abs(leg.upperLength - leg.lowerLength) + 0.00001,
      leg.upperLength + leg.lowerLength - 0.00001,
    );
    this.direction.multiplyScalar(1 / Math.max(requested, 0.00001));
    this.target.copy(leg.hip).addScaledVector(this.direction, length);
    this.pole.copy(leg.knee).sub(leg.hip);
    this.pole.addScaledVector(this.direction, -this.pole.dot(this.direction));
    if (this.pole.lengthSq() < 0.000001)
      this.pole.set(1, 0, 0).cross(this.direction);
    this.pole.normalize();
    const along =
      (leg.upperLength ** 2 - leg.lowerLength ** 2 + length ** 2) /
      (2 * length);
    const height = Math.sqrt(Math.max(0, leg.upperLength ** 2 - along ** 2));
    this.knee
      .copy(leg.hip)
      .addScaledVector(this.direction, along)
      .addScaledVector(this.pole, height);
    leg.upper.position.copy(leg.hip);
    this.axis.copy(this.knee).sub(leg.hip).normalize();
    this.rotation.setFromUnitVectors(leg.upperDirection, this.axis);
    leg.upper.quaternion.copy(this.rotation).multiply(leg.upperRotation);
    leg.lower.position.copy(this.knee);
    this.axis.copy(this.target).sub(this.knee).normalize();
    this.rotation.setFromUnitVectors(leg.lowerDirection, this.axis);
    leg.lower.quaternion.copy(this.rotation).multiply(leg.lowerRotation);
    leg.foot.position.copy(this.target);
    leg.foot.quaternion.copy(this.inverse).multiply(leg.rotation);
    // View-only diagnostics used by the renderer check, never added to World.
    leg.foot.userData.foundryContact =
      !leg.step && Math.abs(requested - length) < 0.0001;
    leg.foot.userData.foundryReachError = Math.abs(requested - length);
  }
}
