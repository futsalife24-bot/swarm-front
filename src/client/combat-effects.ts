import { cleanCapture } from "./clean-capture";
import * as T from "three";
import type { Event, Projectile } from "../shared/game";

const sphere = new T.IcosahedronGeometry(1, 1);
const blastSphere = new T.SphereGeometry(1, 32, 20);
const ring = new T.RingGeometry(0.97, 1, 64);
const slug = new T.CapsuleGeometry(0.035, 0.35, 2, 5);
const cloud = new T.PlaneGeometry(2, 2);
// Procedural billowing alpha: soft edges and mottled density without asset downloads.
const texels = new Uint8Array(64 * 64 * 4);
for (let y = 0; y < 64; y++)
  for (let x = 0; x < 64; x++) {
    const u = (x - 31.5) / 31.5,
      v = (y - 31.5) / 31.5;
    const noise =
      0.72 +
      0.16 * Math.sin(x * 0.43 + Math.sin(y * 0.31) * 2) +
      0.12 * Math.cos(y * 0.57 + Math.sin(x * 0.23) * 3);
    const a = Math.pow(Math.max(0, 1 - Math.hypot(u, v)), 0.75) * noise;
    const i = (y * 64 + x) * 4;
    texels[i] = texels[i + 1] = texels[i + 2] = 255;
    texels[i + 3] = Math.round(a * 255);
  }
const cloudTexture = new T.DataTexture(texels, 64, 64);
cloudTexture.magFilter = cloudTexture.minFilter = T.LinearFilter;
cloudTexture.needsUpdate = true;
type Effect = {
  mesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  age: number;
  duration: number;
  size: number;
  velocity: T.Vector3;
  kind:
    | "bullet"
    | "trail"
    | "flash"
    | "fire"
    | "smoke"
    | "ring"
    | "spark"
    | "shell"
    | "billow";
};

/** Short-lived, bounded visual effects; combat damage remains in shared/game. */
export class CombatEffects {
  items: Effect[] = [];
  private spare: Effect[] = [];
  budget = 180;
  detail = 1;
  origin = new T.Vector3();
  trailTime = 0;
  constructor(
    private scene: T.Scene,
    private capture = cleanCapture,
  ) {}
  add(
    kind: Effect["kind"],
    x: number,
    y: number,
    z: number,
    size: number,
    duration: number,
    color: number,
    velocity = new T.Vector3(),
  ) {
    if (
      (kind === "bullet" || kind === "trail") &&
      this.capture.tracerOpacity === 0
    )
      return;
    if (this.items.length >= this.budget) return;
    const flat = kind === "ring";
    const soft =
      kind === "fire" ||
      kind === "smoke" ||
      kind === "flash" ||
      kind === "billow";
    const spareIndex = this.spare.findIndex((e) => e.kind === kind);
    const reused =
      spareIndex < 0 ? undefined : this.spare.splice(spareIndex, 1)[0];
    const mesh =
      reused?.mesh ??
      new T.Mesh(
        soft
          ? cloud
          : flat
            ? ring
            : kind === "shell"
              ? blastSphere
              : kind === "bullet"
                ? slug
                : sphere,
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          depthWrite: false,
          map: soft ? cloudTexture : null,
          side: flat ? T.DoubleSide : T.FrontSide,
        }),
      );
    mesh.material.color.setHex(color);
    mesh.material.opacity =
      kind === "bullet" || kind === "trail" ? this.capture.tracerOpacity : 1;
    mesh.quaternion.identity();
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(size);
    if (kind === "shell") mesh.material.opacity = 0.075;
    if (flat) mesh.rotation.x = -Math.PI / 2;
    if (kind === "bullet")
      mesh.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        velocity.clone().normalize(),
      );
    this.scene.add(mesh);
    this.items.push(
      Object.assign(reused ?? {}, {
        mesh,
        age: 0,
        duration,
        size,
        velocity,
        kind,
      }),
    );
  }
  event(e: Event) {
    if (e.type === "shot") {
      const delta = new T.Vector3(e.tx! - e.x, e.ty! - e.y, e.tz! - e.z);
      const distance = delta.length();
      const dir = delta.normalize();
      // A discrete moving slug, never a full muzzle-to-target beam.
      if (e.weapon !== "rocket" && distance > 0.1)
        this.add(
          "bullet",
          e.x,
          e.y,
          e.z,
          e.weapon === "shotgun" ? 0.7 : 1.4,
          distance / 150,
          0xffd58a,
          dir.clone().multiplyScalar(150),
        );
      this.add(
        "flash",
        e.x + dir.x * 0.8,
        e.y + dir.y * 0.8,
        e.z + dir.z * 0.8,
        0.24,
        0.055,
        0xffefbc,
      );
    }
    if (e.type === "burst") {
      const radius = e.radius ?? 6.5;
      // The ground circle is the sphere/ground intersection, including airbursts.
      if (e.y < radius)
        this.add(
          "ring",
          e.x,
          0.06,
          e.z,
          Math.sqrt(radius * radius - e.y * e.y),
          0.8,
          0xffb76c,
        );
      this.add("shell", e.x, e.y, e.z, radius, 0.8, 0xffb45b);
      // Evenly distribute fire over the above-ground spherical cap, including its crown.
      // Velocity stores the final offset for these expanding billows.
      const bottom = Math.max(-1, -e.y / radius);
      const count =
        this.detail < 1 ||
        this.origin.distanceToSquared(new T.Vector3(e.x, e.y, e.z)) > 625
          ? 18
          : 36;
      for (let i = 0; i < count; i++) {
        const up = bottom + ((1 - bottom) * (i + 0.5)) / count;
        const angle = i * Math.PI * (3 - Math.sqrt(5));
        const horizontal = Math.sqrt(1 - up * up);
        this.add(
          "billow",
          e.x,
          e.y,
          e.z,
          radius * 0.22,
          0.8,
          i % 3 === 0 ? 0xffdf8b : 0xff792b,
          new T.Vector3(
            Math.cos(angle) * horizontal,
            up,
            Math.sin(angle) * horizontal,
          ).multiplyScalar(radius * 0.84),
        );
      }
      const sparks = count === 18 ? 6 : 12;
      for (let i = 0; i < sparks; i++) {
        const angle = (i * Math.PI * 2) / sparks;
        const speed = radius * (0.6 + Math.random() * 0.4);
        this.add(
          "fire",
          e.x,
          Math.max(0.3, e.y),
          e.z,
          radius * 0.22,
          0.5 + Math.random() * 0.15,
          i % 2 ? 0xff7025 : 0xffd878,
          new T.Vector3(
            Math.cos(angle) * speed,
            1 + Math.random() * 3,
            Math.sin(angle) * speed,
          ),
        );
        if (i % 2 === 0)
          this.add(
            "smoke",
            e.x,
            Math.max(0.4, e.y),
            e.z,
            radius * 0.18,
            1.2,
            0x625b53,
            new T.Vector3(
              Math.cos(angle) * speed * 0.45,
              2,
              Math.sin(angle) * speed * 0.45,
            ),
          );
      }
    }
    if (e.type === "acid") {
      this.add("flash", e.x, e.y, e.z, 0.35, 0.12, 0xb4f4ff);
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        this.add(
          "spark",
          e.x,
          Math.max(0.1, e.y),
          e.z,
          0.1,
          0.18,
          0x65edff,
          new T.Vector3(
            Math.cos(a) * 2.5,
            2 + Math.random(),
            Math.sin(a) * 2.5,
          ),
        );
      }
    }
  }
  trails(projectiles: Projectile[], dt: number) {
    this.trailTime += dt;
    if (this.trailTime < 0.045) return;
    this.trailTime = 0;
    for (const q of projectiles) {
      this.add(
        q.rocket ? "smoke" : this.capture.enabled ? "trail" : "spark",
        q.x,
        q.y,
        q.z,
        q.rocket ? 0.15 : 0.08,
        q.rocket ? 0.4 : 0.18,
        q.rocket ? 0x9c9386 : 0x65edff,
      );
      if (q.rocket) this.add("flash", q.x, q.y, q.z, 0.22, 0.08, 0xffac48);
    }
  }
  update(dt: number, camera?: T.Camera) {
    for (const e of this.items) {
      if (
        camera &&
        (e.kind === "fire" ||
          e.kind === "smoke" ||
          e.kind === "flash" ||
          e.kind === "billow")
      )
        e.mesh.quaternion.copy(camera.quaternion);
      const previousAge = e.age;
      e.age += dt;
      const t = Math.min(1, e.age / e.duration);
      const expand = (age: number) =>
        1 - Math.pow(1 - Math.min(1, age / 0.16), 3);
      e.mesh.position.addScaledVector(
        e.velocity,
        e.kind === "billow" ? expand(e.age) - expand(previousAge) : dt,
      );

      const scale =
        e.kind === "shell"
          ? expand(e.age)
          : e.kind === "billow"
            ? 0.4 + 0.6 * expand(e.age)
            : e.kind === "ring"
              ? Math.min(1, t * 4)
              : e.kind === "smoke"
                ? 0.5 + t * 2.5
                : e.kind === "fire"
                  ? 0.6 + Math.sin(t * Math.PI) * 0.9
                  : 1;
      e.mesh.scale.setScalar(e.size * scale);
      e.mesh.material.opacity =
        (e.kind === "shell"
          ? 0.075
          : e.kind === "billow"
            ? 0.85
            : e.kind === "smoke"
              ? 0.42
              : 1) *
        (1 - t) *
        (e.kind === "bullet" || e.kind === "trail"
          ? this.capture.tracerOpacity
          : 1);
      if (t === 1) {
        this.scene.remove(e.mesh);
        // Keep GPU programs/materials warm during sustained multi-player fire.
        if (this.spare.length < 180) this.spare.push(e);
        else e.mesh.material.dispose();
      }
    }
    this.items = this.items.filter((e) => e.age < e.duration);
  }
  clear() {
    for (const e of [...this.items, ...this.spare]) {
      this.scene.remove(e.mesh);
      e.mesh.material.dispose();
    }
    this.items = [];
    this.spare = [];
    this.trailTime = 0;
  }
}
