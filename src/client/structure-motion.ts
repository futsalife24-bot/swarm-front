import * as T from "three";
import {
  loadEnemyMotion,
  HoundMotionBatch,
  type HoundClip,
  type HoundVisualInput,
} from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";
import { HARROW_MOVE_SPEED } from "../shared/harrow-motion";
import { PleatProcedural } from "./pleat-procedural";
import type { PleatPose } from "./pleat-procedural";
import type { Block } from "../shared/map-blocks";
import { surfaceRay } from "../shared/surface-ray";
export const STRUCTURE_ASSETS = {
  harrow: "harrow",
  calyx: "calyx",
  crawler: "pleat",
  ant: "hound",
  spider: "leaper",
  spitter: "prism",
  hornet: "ray",
  boss: "foundry_zero",
} as const;
/** Length of the LEAPER Leap clip; matches the authoritative 0.9 s jump. */
const LEAP_SECONDS = 0.9;
export function harrowTakeoffClip(seed = 0): HoundClip {
  const clips: HoundClip[] = ["Takeoff", "TakeoffB", "TakeoffC", "TakeoffD"];
  return clips[Math.min(3, Math.max(0, Math.floor(seed * 4)))];
}
export type StructureVisualKind = keyof typeof STRUCTURE_ASSETS;
export type StructureInput = HoundVisualInput & {
  pleat?: PleatPose;
  slot: number;
  calyx?: import("../shared/calyx").CalyxAttack;
  harrow?: import("../shared/harrow").HarrowAttack;
  harrowAirborne?: boolean;
  /** LEAPER jump progress 0..1 while the authoritative jump is active (visual only). */
  leap?: number;
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
      if (this.kind === "crawler" && e.pleat) {
        this.states.delete(e.id);
        return;
      }
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
      if (this.kind === "harrow") {
        const desired: HoundClip =
          (e.harrow?.kind === "Threat" && e.harrowAirborne
            ? "AirThreat"
            : e.harrow?.kind === "Takeoff"
              ? harrowTakeoffClip(e.harrow.flapSeed)
              : e.harrow?.kind) ??
          (e.harrowAirborne ? "Flight" : e.moving ? "Locomotion" : "Idle");
        if (desired !== s.clip) {
          s.from = s.clip;
          s.fromTime = s.time;
          s.clip = desired;
          s.time = 0;
          s.blend = 0;
        }
        s.time = e.harrow
          ? Math.max(0, (e.worldTime ?? 0) - e.harrow.started)
          : s.time +
            (desired === "Locomotion" ? e.distance / HARROW_MOVE_SPEED : dt);
        s.blend = e.harrow ? Math.max(s.blend + dt, s.time) : s.blend + dt;
        const blendTime =
          desired === "Land"
            ? 0.35
            : desired === "Flight" || desired === "Glide"
              ? 0.24
              : 0.15;
        batch.setPose(
          i,
          s.clip,
          s.time,
          s.from,
          s.fromTime,
          s.blend / blendTime,
        );
        return;
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
      // VOLLEY uses 1.2s after melee and 2.7s after its three-round shot.
      const releaseCooldown = this.kind === "ant" ? 1.2 : spec.cooldown;
      const fired =
        e.wind <= 0 &&
        e.cool > releaseCooldown - 0.35 &&
        ((s.wind > 0 && e.cool > s.cool) || e.cool > s.cool + 0.4);
      const recovering =
        s.clip === "Lunge" && s.time >= spec.impact && s.time < spec.duration;
      const leaping = this.kind === "spider" && e.leap !== undefined;
      const desired: HoundClip = leaping
        ? "Leap"
        : e.wind > 0 || fired || recovering
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
      if (leaping) {
        s.time = e.leap! * LEAP_SECONDS;
        s.blend += dt;
        s.fromTime += dt;
        s.wind = e.wind;
        s.cool = e.cool;
        batch.setPose(i, s.clip, s.time, s.from, s.fromTime, s.blend / 0.08);
        return;
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
  private pleat?: PleatProcedural;
  private blocks?: Block[];
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
        if (kind === "crawler") this.pleat = new PleatProcedural(this.batch);
        this.batch.group.name =
          STRUCTURE_ASSETS[kind].toUpperCase() + "_PRODUCTION";
        scene.add(this.batch.group);
      })
      .catch((e) => {
        this.error = String(e);
        console.warn("Enemy asset unavailable; using fallback", kind, e);
      });
  }
  /** Renderer-placed PLEAT contacts of one instance (review page, diagnostics). */
  pleatContacts(id: number) {
    return this.pleat?.contacts(id);
  }
  /** Camera and map for PLEAT leg detail and footholds; other species ignore it. */
  setSurroundings(viewer: T.Vector3, blocks: Block[]) {
    if (!this.pleat) return;
    this.pleat.setViewer(viewer);
    if (blocks === this.blocks) return;
    this.blocks = blocks;
    this.pleat.setSurface((origin, direction, distance) =>
      surfaceRay(origin, direction, distance, blocks),
    );
  }
  sync(source: T.InstancedMesh, inputs: readonly StructureInput[], dt: number) {
    const b = this.batch;
    this.pleat?.beginFrame();
    if (!b || !this.enabled) {
      source.visible = true;
      this.controller.states.clear();
      this.pleat?.clear();
      b?.finish(0);
      return;
    }
    this.controller.update(b, inputs, dt);
    source.visible = source.count > inputs.length;
    inputs.forEach((e, i) => {
      source.getMatrixAt(e.slot, this.matrix);
      if (source.instanceColor) source.getColorAt(e.slot, this.color);
      else this.color.set(0xffffff);
      if (e.pleat && this.pleat) {
        this.pleat.update(i, e.pleat, dt, e.wind, e.cool, this.color, e.id);
        if (source.visible) source.setMatrixAt(e.slot, this.zero);
        return;
      }
      b.setTransform(i, this.matrix, this.color);
      if (source.visible) source.setMatrixAt(e.slot, this.zero);
    });
    if (source.visible) {
      source.instanceMatrix.needsUpdate = true;
      source.computeBoundingSphere();
    }
    b.finish(inputs.length);
    this.pleat?.retain(new Set(inputs.map((e) => e.id)));
  }
}
