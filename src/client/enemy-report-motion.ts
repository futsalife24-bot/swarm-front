import * as T from "three";
import type { Enemy } from "../shared/game";
import type { HoundClip } from "./hound-motion";
import { STRUCTURE_TIMING } from "../shared/structure-timing";
import { CALYX, calyxMuzzle } from "../shared/calyx";
import {
  HARROW,
  harrowBombOrigins,
  harrowMissileOrigins,
  harrowSnipeOrigins,
  type HarrowMissile,
} from "../shared/harrow";
import { HarrowEffects } from "./harrow-effects";
import { HARROW_FLIGHT_CYCLE } from "../shared/harrow-motion";
import {
  FOUNDRY_LASER_WARNING,
  foundryLaserOrigin,
} from "../shared/foundry-defs";

export type ReportMotion = "idle" | "move" | "attack";

const reportFlightHeight = HARROW.flightHeight / HARROW.scale;
const reportBombRouteLength = 40;
const reportBombFirst = 8;
export const HARROW_REPORT_SEQUENCE: {
  clip: HoundClip;
  duration: number;
  from?: number;
  to?: number;
  threat?: boolean;
}[] = [
  { clip: "Spin", duration: HARROW.spinDuration },
  { clip: "Idle", duration: 0.8 },
  { clip: "Dash", duration: HARROW.dashDuration },
  { clip: "Idle", duration: 0.8 },
  { clip: "Snipe", duration: HARROW.snipeDuration },
  { clip: "Idle", duration: 0.8 },
  {
    clip: "Threat",
    duration: Math.max(
      HARROW.threatDuration,
      HARROW.markerLead + HARROW.missileFlight,
    ),
    threat: true,
  },
  { clip: "Idle", duration: 0.8 },
  {
    clip: "Takeoff",
    duration: HARROW.takeoffDuration,
    from: 0,
    to: reportFlightHeight,
  },
  {
    clip: "Flight",
    duration: HARROW_FLIGHT_CYCLE,
    from: reportFlightHeight,
    to: reportFlightHeight,
  },
  {
    clip: "AirThreat",
    duration: HARROW.threatDuration,
    from: reportFlightHeight,
    to: reportFlightHeight,
    threat: true,
  },
  {
    clip: "BombPass",
    duration: Math.max(
      HARROW.bombDuration,
      HARROW.bombWind +
        ((reportBombFirst + 4 * HARROW.bombSpacing) / reportBombRouteLength) *
          HARROW.bombTravel +
        HARROW.bombFlight,
    ),
    from: reportFlightHeight,
    to: reportFlightHeight,
  },
  {
    clip: "Glide",
    duration: HARROW.glideDuration,
    from: reportFlightHeight,
    to: reportFlightHeight,
  },
  {
    clip: "Dive",
    duration: HARROW.diveDuration,
    from: reportFlightHeight,
    to: 0,
  },
  { clip: "Land", duration: HARROW.landDuration },
  { clip: "Idle", duration: 0.8 },
  ...(["TakeoffB", "TakeoffC", "TakeoffD"] as HoundClip[]).flatMap((clip) => [
    { clip, duration: HARROW.takeoffDuration, from: 0, to: reportFlightHeight },
    {
      clip: "Flight" as HoundClip,
      duration: 1.2,
      from: reportFlightHeight,
      to: reportFlightHeight,
    },
    {
      clip: "Land" as HoundClip,
      duration: HARROW.landDuration,
      from: reportFlightHeight,
      to: 0,
    },
    { clip: "Idle" as HoundClip, duration: 0.8 },
  ]),
  {
    clip: "Takeoff",
    duration: HARROW.takeoffDuration,
    from: 0,
    to: reportFlightHeight,
  },
  {
    clip: "Flight",
    duration: HARROW_FLIGHT_CYCLE,
    from: reportFlightHeight,
    to: reportFlightHeight,
  },
  {
    clip: "StaggerFall",
    duration: HARROW.staggerFallDuration,
    from: reportFlightHeight,
    to: 0,
  },
  { clip: "Land", duration: HARROW.landDuration },
  { clip: "Idle", duration: 0.8 },
];
function reportHarrowPosition(
  phase: (typeof HARROW_REPORT_SEQUENCE)[number],
  sample: number,
) {
  const fraction = Math.min(1, sample / phase.duration);
  const delayed = ["Takeoff", "TakeoffB", "TakeoffC", "TakeoffD"].includes(
    phase.clip,
  )
    ? Math.max(0, (fraction - 0.24) / 0.76)
    : fraction;
  const smooth = delayed * delayed * (3 - 2 * delayed);
  const height =
    (phase.from ?? 0) + ((phase.to ?? 0) - (phase.from ?? 0)) * smooth;
  const z =
    phase.clip === "BombPass"
      ? (-reportBombRouteLength *
          Math.max(
            0,
            Math.min(1, (sample - HARROW.bombWind) / HARROW.bombTravel),
          )) /
        HARROW.scale
      : phase.clip === "Dash"
        ? (-HARROW.dashDistance *
            Math.max(
              0,
              Math.min(1, (sample - HARROW.dashWind) / HARROW.dashTravel),
            )) /
          HARROW.scale
        : 0;
  return { height, z };
}
function reportHarrowPhase(time: number, selected?: HoundClip) {
  if (selected) {
    const phase = HARROW_REPORT_SEQUENCE.find(
      (phase) => phase.clip === selected,
    );
    if (phase) {
      const sample = time % phase.duration;
      return {
        ...phase,
        sample,
        ...reportHarrowPosition(phase, sample),
      };
    }
  }
  let sample =
    time %
    HARROW_REPORT_SEQUENCE.reduce((sum, phase) => sum + phase.duration, 0);
  for (const phase of HARROW_REPORT_SEQUENCE) {
    if (sample < phase.duration)
      return {
        ...phase,
        sample,
        clip:
          phase.threat && sample >= HARROW.threatDuration
            ? ("Idle" as HoundClip)
            : phase.clip,
        ...reportHarrowPosition(phase, sample),
      };
    sample -= phase.duration;
  }
  return {
    clip: "Idle" as HoundClip,
    duration: 0.8,
    sample: 0,
    height: 0,
    z: 0,
    threat: false,
  };
}

/** Fixed specimen targets let the viewer observe ten missiles without a live World. */
export function reportHarrowMissiles(
  airborne = false,
  variant: "arc" | "snipe" | "bomb" = "arc",
): HarrowMissile[] {
  const specimen = {
    id: 1,
    kind: "harrow",
    x: 0,
    y: airborne ? HARROW.flightHeight : 0,
    z: 0,
    harrowAirborne: airborne,
  } as Enemy;
  const origins =
    variant === "snipe"
      ? harrowSnipeOrigins(specimen, Math.PI)
      : harrowMissileOrigins(
          {
            x: 0,
            y: airborne ? HARROW.flightHeight : 0,
            z: 0,
            harrowAirborne: airborne,
          },
          Math.PI,
        );
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 10;
    const bombRow = Math.floor(i / 2);
    const bombAlong = reportBombFirst + bombRow * HARROW.bombSpacing;
    const bombOrigins =
      variant === "bomb"
        ? harrowBombOrigins(
            { x: 0, y: HARROW.flightHeight, z: -bombAlong },
            Math.PI,
          )
        : undefined;
    const launch =
      variant === "snipe"
        ? HARROW.snipeWind + i * HARROW.snipeInterval
        : variant === "bomb"
          ? HARROW.bombWind +
            (bombAlong / reportBombRouteLength) * HARROW.bombTravel
          : HARROW.markerLead;
    return {
      id: i + 1,
      owner: 1,
      origin:
        variant === "bomb"
          ? bombOrigins![i % 2 ? bombRow + 5 : bombRow]
          : origins[i],
      target:
        variant === "bomb"
          ? {
              x: i % 2 ? -HARROW.bombSide : HARROW.bombSide,
              y: 0,
              z: -bombAlong,
            }
          : variant === "snipe"
            ? { x: 0, y: 0.9, z: -12 }
            : { x: Math.sin(angle) * 4, y: 0, z: -7 + Math.cos(angle) * 3 },
      launch,
      impact:
        launch +
        (variant === "snipe"
          ? HARROW.snipeFlight
          : variant === "bomb"
            ? HARROW.bombFlight
            : HARROW.missileFlight),
      damage: HARROW.missileDamage,
      radius: HARROW.missileRadius,
      trajectory: variant === "arc" ? "arc" : "straight",
    };
  });
}

/** Isolated inspection timeline. Does not receive or mutate the active World. */
export function reportPose(
  kind: Enemy["kind"],
  mode: ReportMotion,
  time: number,
  selectedHarrowAttack?: HoundClip,
) {
  if (kind === "harrow") {
    const phase = reportHarrowPhase(
      time,
      mode === "attack" ? selectedHarrowAttack : undefined,
    );
    return {
      clip:
        mode === "attack"
          ? phase.clip
          : mode === "move"
            ? ("Locomotion" as HoundClip)
            : ("Idle" as HoundClip),
      sample: mode === "attack" ? phase.sample : time,
      height: mode === "attack" ? phase.height : 0,
      z: mode === "attack" ? phase.z : 0,
      impact: phase.threat ? HARROW.markerLead : HARROW.spinWind,
      cycle: phase.sample,
    };
  }
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
      sample: mode === "attack" ? sample : mode === "move" ? time * 3 : time,
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
  private readonly harrow = new HarrowEffects();
  private readonly harrowMissiles = reportHarrowMissiles();
  private readonly harrowAirMissiles = reportHarrowMissiles(true);
  private readonly harrowSnipeMissiles = reportHarrowMissiles(false, "snipe");
  private readonly harrowBombMissiles = reportHarrowMissiles(true, "bomb");
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
    // Report models use authored units, while combat uses HARROW.scale.
    this.harrow.root.scale.setScalar(1 / HARROW.scale);
    this.root.add(this.ring, ...this.bolts, ...this.beams, this.harrow.root);
  }
  update(
    kind: Enemy["kind"],
    worm: boolean,
    mode: ReportMotion,
    time: number,
    selectedHarrowAttack?: HoundClip,
  ) {
    this.root.children.forEach((o) => (o.visible = false));
    this.harrow.update(null);
    if (mode !== "attack") return;
    const pose = reportPose(kind, mode, time, selectedHarrowAttack);
    if (kind === "harrow") {
      const phase = reportHarrowPhase(time, selectedHarrowAttack);
      this.harrow.root.visible = true;
      const attack =
        phase.clip === "Spin" || phase.clip === "Glide" || phase.clip === "Dive"
          ? phase.clip
          : undefined;
      const enemies: Enemy[] = attack
        ? [
            {
              id: 1,
              kind: "harrow",
              x: 0,
              y: phase.height * HARROW.scale,
              z: 0,
              hp: 100,
              maxHp: 100,
              cool: 0,
              wind: 0,
              hurt: 0,
              tx: 0,
              tz: 0,
              harrow: {
                kind: attack,
                started: 0,
                fired: false,
                yaw: Math.PI,
                to: { x: 0, y: 0, z: 0 },
              },
            },
          ]
        : [];
      this.harrow.update({
        time: phase.sample,
        harrowMissiles:
          phase.clip === "Snipe"
            ? this.harrowSnipeMissiles
            : phase.clip === "BombPass"
              ? this.harrowBombMissiles
              : phase.threat
                ? phase.clip === "AirThreat"
                  ? this.harrowAirMissiles
                  : this.harrowMissiles
                : [],
        enemies,
      });
      return;
    }
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
        const bolt = this.bolts[0],
          origin = calyxMuzzle({ x: 0, y: 0, z: 0 }, Math.PI),
          flight = 1.2,
          dy = (0.04 - origin.y) / flight + 0.5 * CALYX.gravity * flight;
        bolt.visible = true;
        bolt.scale.setScalar(2);
        bolt.position.set(
          0,
          origin.y + dy * age - 0.5 * CALYX.gravity * age * age,
          origin.z + ((-8 - origin.z) / flight) * age,
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
    this.harrow.dispose();
    this.root.children.forEach((o) => (o as T.Mesh).geometry.dispose());
    this.material.dispose();
    this.root.removeFromParent();
  }
}
