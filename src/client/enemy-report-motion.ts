import * as T from "three";
import type { Enemy } from "../shared/game";
import type { HoundClip } from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";
import {
  FOUNDRY_LASER_WARNING,
  foundryLaserOrigin,
} from "../shared/foundry-defs";

export type ReportMotion = "idle" | "move" | "attack";

/** Isolated inspection timeline. Does not receive or mutate the active World. */
export function reportPose(
  kind: Enemy["kind"],
  mode: ReportMotion,
  time: number,
) {
  if (kind === "calyx") {
    const cycle = time % 6.6,
      shot = cycle >= 3,
      sample = shot ? cycle - 3 : cycle;
    const clip: HoundClip =
      mode === "move"
        ? "Locomotion"
        : mode === "idle"
          ? "Idle"
          : sample < (shot ? 2.8 : 2.2)
            ? shot
              ? "PollenShot"
              : "Slam"
            : "Idle";
    return {
      clip,
      sample: mode === "attack" ? sample : time,
      height: 0,
      impact: shot ? 1.6 : 1,
      cycle: sample,
    };
  }
  const base =
    STRUCTURE_TIMING[kind === "ant" || kind === "spider" ? "crawler" : kind];
  const spec = kind === "ant" ? { ...base, impact: 0.8, duration: 1.55 } : base;
  const cycle = time % (spec.duration + 0.8);
  let clip: HoundClip =
    mode === "move"
      ? "Locomotion"
      : mode === "attack" && cycle < spec.duration
        ? "Lunge"
        : "Idle";
  let sample = mode === "attack" ? cycle : time;
  if (kind === "ant" && mode === "attack" && clip === "Lunge")
    sample = cycle < 0.8 ? (cycle / 0.8) * 0.45 : 0.45 + cycle - 0.8;
  let height = 0;
  if (kind === "spider" && mode === "move") {
    const t = time % 2;
    clip = "Locomotion";
    sample = t;
    // Inspection arc fits the resting camera; combat jump distance is unchanged.
    height =
      t > 0.4 && t < 1.25 ? Math.sin(((t - 0.4) / 0.85) * Math.PI) * 0.65 : 0;
  }
  return { clip, sample, height, impact: spec.impact, cycle };
}

export function reportWorm(mode: ReportMotion, time: number): Enemy {
  const distance = mode === "move" ? -time * 4.2 : 0;
  const phase = time % 3.2;
  const nodes = Array.from({ length: 8 }, (_, i) => ({
    x: mode === "move" ? Math.sin(time * 0.8 - i * 0.32) * 0.42 : 0,
    y: 0,
    z: distance + i * 3.2,
    heading: Math.PI,
    partHp: 100,
    ...(mode === "attack"
      ? {
          pulseAim: { x: 1.5, y: 1.2, z: distance - 14 },
          acidAt: time - phase + FOUNDRY_LASER_WARNING,
        }
      : {}),
  }));
  return {
    id: 1,
    kind: "boss",
    ...nodes[0],
    segments: nodes.slice(1),
    hp: 800,
    maxHp: 800,
    cool: 0,
    wind: 0,
    hurt: 0,
    tx: 0,
    tz: 0,
  };
}

/** Compact visual effects indicate the direction and kind of the observed attack. */
export class ReportEffects {
  readonly root = new T.Group();
  private material = new T.MeshBasicMaterial({
    color: 0x7aeaff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  private ring = new T.Mesh(
    new T.TorusGeometry(1, 0.026, 6, 64),
    this.material,
  );
  private bolts = Array.from(
    { length: 8 },
    () => new T.Mesh(new T.SphereGeometry(0.095, 8, 6), this.material),
  );
  private beams = Array.from(
    { length: 8 },
    () => new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1, 6), this.material),
  );
  constructor() {
    this.ring.rotation.x = Math.PI / 2;
    this.root.add(this.ring, ...this.bolts, ...this.beams);
  }
  update(kind: Enemy["kind"], worm: boolean, mode: ReportMotion, time: number) {
    this.root.children.forEach((o) => (o.visible = false));
    if (mode !== "attack") return;
    const pose = reportPose(kind, mode, time);
    const age = pose.cycle - pose.impact;
    this.material.opacity = 0.8;
    this.material.color.setHex(kind === "calyx" ? 0xcbb957 : 0x7aeaff);
    if (kind === "calyx") {
      if (age < 0) return;
      if (time % 6.6 < 3) {
        if (age > 0.3) return;
        this.ring.visible = true;
        this.ring.scale.setScalar(0.15 + age * 4);
        this.ring.position.set(0, 0.06, -0.5 - age * 3);
      } else {
        if (age > 1.2) return;
        const bolt = this.bolts[0];
        bolt.visible = true;
        bolt.scale.setScalar(2);
        bolt.position.set(
          0,
          1.21 + 2 * age - 2.5 * age * age,
          -0.105 - age * 3,
        );
      }
      return;
    }
    if (worm) {
      const phase = time % 3.2;
      const e = reportWorm(mode, time);
      [e, ...e.segments!].forEach((node, i) => {
        if (phase > FOUNDRY_LASER_WARNING + 0.2) return;
        const origin = foundryLaserOrigin(node, i);
        const a = new T.Vector3(origin.x, origin.y, origin.z),
          b = new T.Vector3(1.5, 1.2, -14);
        this.line(
          this.beams[i],
          a,
          b,
          phase < FOUNDRY_LASER_WARNING ? 0.22 : 1,
        );
      });
      return;
    }
    if (age < 0 || age > 0.65) return;
    this.material.opacity = 0.9 * (1 - age / 0.7);
    if (kind === "crawler" || kind === "spider" || kind === "boss") {
      this.ring.visible = true;
      const scale = kind === "boss" ? 0.6 + age * 7 : 0.25 + age * 4;
      this.ring.scale.setScalar(scale);
      this.ring.position.set(0, 0.06, kind === "crawler" ? -0.96 - age * 5 : 0);
    } else if (kind === "hornet") {
      this.line(
        this.beams[0],
        new T.Vector3(0, 1, -0.4),
        new T.Vector3(0, -1, -4),
        1,
      );
    } else {
      const count = kind === "ant" ? 5 : 1;
      for (let i = 0; i < count; i++) {
        const bolt = this.bolts[i],
          angle = (i - (count - 1) / 2) * 0.2;
        bolt.visible = true;
        bolt.position.set(
          Math.sin(angle) * age * 6,
          1.1,
          -0.8 - Math.cos(angle) * age * 6,
        );
        bolt.scale.setScalar(kind === "spitter" ? 2 : 1);
      }
    }
  }
  private line(mesh: T.Mesh, a: T.Vector3, b: T.Vector3, width: number) {
    mesh.visible = true;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    mesh.scale.set(width, a.distanceTo(b), width);
  }
  dispose() {
    this.root.children.forEach((o) => (o as T.Mesh).geometry.dispose());
    this.material.dispose();
    this.root.removeFromParent();
  }
}
