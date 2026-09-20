import * as T from "three";
import {
  loadEnemyMotion,
  HoundMotionBatch,
  type HoundClip,
  type HoundVisualInput,
} from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";
export const STRUCTURE_ASSETS = {
  calyx: "calyx",
  crawler: "pleat",
  ant: "hound",
  spider: "leaper",
  spitter: "prism",
  hornet: "ray",
  boss: "foundry_zero",
} as const;
export type StructureVisualKind = keyof typeof STRUCTURE_ASSETS;
export type StructureInput = HoundVisualInput & {
  slot: number;
  calyx?: import("../shared/calyx").CalyxAttack;
  worldTime?: number;
};
type State = {
  clip: HoundClip;
  time: number;
  from: HoundClip;
  fromTime: number;
  blend: number;
  wind: number;
  cool: number;
};
export class StructureMotionController {
  readonly states = new Map<number, State>();
  constructor(readonly kind: StructureVisualKind) {}
  update(
    batch: Pick<HoundMotionBatch, "setPose">,
    inputs: readonly StructureInput[],
    dt: number,
  ) {
    dt = T.MathUtils.clamp(dt, 0, 0.1);
    const alive = new Set<number>(),
      spec =
        this.kind === "ant"
          ? { ...STRUCTURE_TIMING.crawler, wind: 0.8, cooldown: 2.7 }
          : STRUCTURE_TIMING[this.kind === "spider" ? "crawler" : this.kind];
    inputs.forEach((e, i) => {
      alive.add(e.id);
      let s = this.states.get(e.id);
      if (!s) {
        s = {
          clip: "Idle",
          time: (e.id % 29) / 7,
          from: "Idle",
          fromTime: 0,
          blend: 0.12,
          wind: 0,
          cool: e.cool,
        };
        this.states.set(e.id, s);
      }
      if (this.kind === "calyx") {
        const desired: HoundClip =
          e.calyx?.kind ?? (e.moving ? "Locomotion" : "Idle");
        if (desired !== s.clip) {
          s.from = s.clip;
          s.fromTime = s.time;
          s.clip = desired;
          s.time = 0;
          s.blend = 0;
        }
        s.time = e.calyx
          ? Math.max(0, (e.worldTime ?? 0) - e.calyx.started)
          : s.time + (desired === "Locomotion" ? e.distance / 0.65 : dt);
        s.blend = e.calyx ? Math.max(s.blend + dt, s.time) : s.blend + dt;
        // Freeze the outgoing spin: crossing 180° mid-fade would flip the
        // shortest quaternion arc and make the intermediate pose jump.
        batch.setPose(i, s.clip, s.time, s.from, s.fromTime, s.blend / 0.35);
        return;
      }
      const fired =
        e.wind <= 0 &&
        e.cool > spec.cooldown - 0.35 &&
        ((s.wind > 0 && e.cool > s.cool) || e.cool > s.cool + 0.4);
      const recovering =
        s.clip === "Lunge" && s.time >= spec.impact && s.time < spec.duration;
      const desired: HoundClip =
        e.wind > 0 || fired || recovering
          ? "Lunge"
          : e.moving
            ? "Locomotion"
            : "Idle";
      if (desired !== s.clip) {
        s.from = s.clip;
        s.fromTime = s.time;
        s.clip = desired;
        s.time = 0;
        s.blend = 0;
      }
      if (e.wind > 0)
        s.time = T.MathUtils.clamp(
          ((spec.wind - e.wind) / spec.wind) * spec.impact,
          0,
          spec.impact,
        );
      else if (fired) {
        s.time = spec.impact;
        s.blend = 0.12;
      } else if (s.clip === "Locomotion")
        s.time +=
          this.kind === "crawler" ||
          this.kind === "ant" ||
          this.kind === "spider"
            ? (e.distance / 0.72) * 0.8
            : this.kind === "boss"
              ? (e.distance / 0.48) * 2
              : dt;
      else s.time += dt;
      s.blend += dt;
      s.fromTime += dt;
      s.wind = e.wind;
      s.cool = e.cool;
      batch.setPose(i, s.clip, s.time, s.from, s.fromTime, s.blend / 0.12);
    });
    for (const id of this.states.keys())
      if (!alive.has(id)) this.states.delete(id);
  }
}
/** One GPU palette per species, independently timed instances. Never mutates World. */
export class StructureMotion {
  batch?: HoundMotionBatch;
  readonly controller: StructureMotionController;
  readonly loading: Promise<void>;
  error = "";
  enabled = true;
  private matrix = new T.Matrix4();
  private zero = new T.Matrix4().makeScale(0, 0, 0);
  private color = new T.Color();
  constructor(
    scene: T.Scene,
    capacity: number,
    readonly kind: StructureVisualKind,
  ) {
    this.controller = new StructureMotionController(kind);
    this.loading = loadEnemyMotion(STRUCTURE_ASSETS[kind])
      .then((asset) => {
        this.batch = new HoundMotionBatch(asset, capacity);
        this.batch.group.name =
          STRUCTURE_ASSETS[kind].toUpperCase() + "_PRODUCTION";
        scene.add(this.batch.group);
      })
      .catch((e) => {
        this.error = String(e);
        console.warn("Enemy asset unavailable; using fallback", kind, e);
      });
  }
  sync(source: T.InstancedMesh, inputs: readonly StructureInput[], dt: number) {
    const b = this.batch;
    if (!b || !this.enabled) {
      source.visible = true;
      this.controller.states.clear();
      b?.finish(0);
      return;
    }
    this.controller.update(b, inputs, dt);
    source.visible = source.count > inputs.length;
    inputs.forEach((e, i) => {
      source.getMatrixAt(e.slot, this.matrix);
      if (source.instanceColor) source.getColorAt(e.slot, this.color);
      else this.color.set(0xffffff);
      b.setTransform(i, this.matrix, this.color);
      if (source.visible) source.setMatrixAt(e.slot, this.zero);
    });
    if (source.visible) {
      source.instanceMatrix.needsUpdate = true;
      source.computeBoundingSphere();
    }
    b.finish(inputs.length);
  }
}
