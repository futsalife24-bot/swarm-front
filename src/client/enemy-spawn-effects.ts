import * as T from "three";
import type { Enemy, World } from "../shared/game";
import { ENEMIES } from "../shared/defs";
import { enemySize } from "../shared/enemy-size";
import { mapFor } from "../shared/stages";
import { supportHeight } from "../shared/terrain";

const ringGeometry = new T.RingGeometry(.88, 1, 48);
const stoneGeometry = new T.IcosahedronGeometry(1, 0);
const cloudGeometry = new T.PlaneGeometry(2, 2);
const pixels = new Uint8Array(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const i = (y * 32 + x) * 4;
  pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
  pixels[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - Math.hypot(x - 15.5, y - 15.5) / 15.5), 1.4));
}
const cloudTexture = new T.DataTexture(pixels, 32, 32);
cloudTexture.needsUpdate = true;
cloudTexture.magFilter = cloudTexture.minFilter = T.LinearFilter;

export const spawnStyle = (e: Pick<Enemy, "kind">) =>
  e.kind === "hornet" || e.kind === "spitter" ? "teleport" : "burrow";

type Arrival = {
  id: number; age: number; duration: number; radius: number; teleport: boolean;
  origin: T.Vector3; rings: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[];
  dust: T.InstancedMesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  stones: T.InstancedMesh<T.IcosahedronGeometry, T.MeshBasicMaterial>;
};

/** Presentation only: never writes an enemy, its transform, or its animation palette. */
export class EnemySpawnEffects {
  readonly items = new Map<number, Arrival>();
  private seen = new Set<number>();
  private run: string | undefined;
  private time = 0;
  private dummy = new T.Object3D();
  constructor(private scene: T.Scene) {}

  active(id: number) { return this.items.has(id); }

  clear() {
    for (const effect of this.items.values()) this.remove(effect);
    this.items.clear();
    this.seen.clear();
    this.run = undefined;
  }

  private remove(effect: Arrival) {
    for (const mesh of [...effect.rings, effect.dust, effect.stones]) {
      this.scene.remove(mesh);
      mesh.material.dispose();
      if (mesh instanceof T.InstancedMesh) mesh.dispose();
    }
    this.items.delete(effect.id);
  }

  update(w: World | null, dt: number, animate: boolean, camera: T.Camera) {
    if (!w || w.phase !== "battle") { this.clear(); return; }
    if (this.run !== w.run || w.time < this.time) {
      this.clear();
      this.run = w.run;
    }
    this.time = w.time;
    const alive = new Set(w.enemies.map(e => e.id));
    for (const effect of this.items.values()) {
      effect.age += animate ? Math.max(0, Math.min(.1, dt)) : 0;
      if (!alive.has(effect.id) || effect.age >= effect.duration) this.remove(effect);
    }
    // Prune dead IDs, while retaining completed arrivals for all living enemies.
    for (const id of this.seen) if (!alive.has(id)) this.seen.delete(id);
    for (const e of w.enemies) {
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      // Bounded even during a full simultaneous wave. Excess arrivals are not queued.
      if (this.items.size >= 24) continue;
      const teleport = spawnStyle(e) === "teleport";
      const radius = ENEMIES[e.kind].radius * enemySize(e);
      const floor = supportHeight(e.x, e.z, mapFor(w).blocks);
      const origin = new T.Vector3(e.x, teleport ? e.y + radius * .5 : floor + .08, e.z);
      const color = teleport ? 0x77edff : mapFor(w).biome === "snow" ? 0xcbd7de : 0x998370;
      const makeMaterial = (soft: boolean) => new T.MeshBasicMaterial({
        color, transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: teleport ? T.AdditiveBlending : T.NormalBlending,
        ...(soft ? { map: cloudTexture } : {}),
      });
      const rings = Array.from({ length: teleport ? 2 : 1 }, () => new T.Mesh(ringGeometry, makeMaterial(false)));
      const dust = new T.InstancedMesh(cloudGeometry, makeMaterial(true), 12);
      const stones = new T.InstancedMesh(stoneGeometry, makeMaterial(false), 12);
      for (const mesh of [...rings, dust, stones]) { mesh.frustumCulled = false; this.scene.add(mesh); }
      this.items.set(e.id, { id: e.id, age: 0, duration: teleport ? .8 : 1.05, radius, teleport, origin, rings, dust, stones });
    }
    for (const effect of this.items.values()) this.draw(effect, camera);
  }

  private draw(e: Arrival, camera: T.Camera) {
    const p = e.age / e.duration, fade = 1 - p, r = e.radius;
    e.rings.forEach((ring, i) => {
      ring.position.copy(e.origin);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      if (e.teleport) {
        ring.position.y += (i ? -1 : 1) * r * (.8 - p * 1.1);
        ring.scale.setScalar(r * (1.5 - p * .65));
      } else ring.scale.setScalar(r * (.8 + p * 1.4));
      ring.material.opacity = fade * (e.teleport ? .85 : .25);
    });
    e.dust.material.opacity = fade * (e.teleport ? .85 : .95);
    e.stones.material.opacity = fade;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12 + e.id * .71;
      const spread = r * (e.teleport ? 1.5 * fade : .35 + p * 1.25);
      const x = e.origin.x + Math.cos(angle) * spread;
      const z = e.origin.z + Math.sin(angle) * spread;
      this.dummy.position.set(x, e.origin.y + r * (e.teleport ? Math.sin(angle * 3 + p * 5) * fade : .3 + p * .65), z);
      this.dummy.quaternion.copy(camera.quaternion);
      this.dummy.scale.setScalar(r * (e.teleport ? .65 * fade : .85 + p * .6));
      this.dummy.updateMatrix();
      e.dust.setMatrixAt(i, this.dummy.matrix);
      this.dummy.position.y = e.origin.y + r * (e.teleport ? Math.cos(angle * 2) * fade : .08 + Math.max(0, 3.8 * p - 4 * p * p));
      this.dummy.rotation.set(angle + p * 6, angle * 2, p * 4);
      this.dummy.scale.setScalar(r * (e.teleport ? .055 : .11) * fade);
      this.dummy.updateMatrix();
      e.stones.setMatrixAt(i, this.dummy.matrix);
    }
    e.dust.instanceMatrix.needsUpdate = e.stones.instanceMatrix.needsUpdate = true;
  }
}
