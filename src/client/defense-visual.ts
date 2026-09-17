import * as T from "three";
import type { World } from "../shared/game";

/** Compact armored weapon vault; footprint fits the existing target/collision radius. */
export class DefenseVisual {
  group = new T.Group();
  private panels: T.Mesh[] = [];
  private core: T.Mesh;
  private blast: T.Mesh;
  private run = "";
  private elapsed = 0;
  private debris = new T.Group();
  constructor(scene: T.Scene) {
    this.group.name = "DAILY_ARMORY";
    const metal = new T.MeshStandardMaterial({
      color: 0x63716c,
      roughness: 0.8,
      metalness: 0.5,
    });
    this.core = new T.Mesh(new T.CylinderGeometry(0.72, 0.85, 1.7, 6), metal);
    this.core.position.y = 0.85;
    this.group.add(this.core);
    const cap = new T.Mesh(new T.CylinderGeometry(0.92, 0.86, 0.2, 6), metal);
    cap.position.y = 1.8;
    this.group.add(cap);
    for (let i = 0; i < 5; i++) {
      const panel = new T.Mesh(
        new T.BoxGeometry(0.12, 0.08, 0.045),
        new T.MeshStandardMaterial({
          color: 0x83f0c1,
          emissive: 0x397653,
          emissiveIntensity: 1.2,
        }),
      );
      panel.position.set((i - 2) * 0.15, 1.35, 0.76);
      this.panels.push(panel);
      this.group.add(panel);
      const shard = new T.Mesh(new T.BoxGeometry(0.35, 0.15, 0.28), metal);
      shard.position.set(
        Math.sin(i * 2.4) * 0.7,
        0.15,
        Math.cos(i * 2.4) * 0.7,
      );
      shard.rotation.set(i, i * 2, i / 2);
      this.debris.add(shard);
    }
    const door = new T.Mesh(
      new T.BoxGeometry(0.72, 0.8, 0.06),
      new T.MeshStandardMaterial({
        color: 0x293533,
        metalness: 0.7,
        roughness: 0.4,
      }),
    );
    door.position.set(0, 0.65, 0.74);
    this.group.add(door);
    const seal = new T.Mesh(
      new T.BoxGeometry(0.45, 0.1, 0.075),
      new T.MeshStandardMaterial({ color: 0xc9a25f }),
    );
    seal.position.set(0, 0.8, 0.78);
    this.group.add(seal);
    this.blast = new T.Mesh(
      new T.SphereGeometry(1, 12, 8),
      new T.MeshBasicMaterial({
        color: 0xffa244,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.blast.position.y = 0.9;
    this.group.add(this.debris, this.blast);
    this.group.visible = false;
    scene.add(this.group);
  }
  update(w: World | null, dt: number) {
    this.group.visible = !!w?.defense;
    if (!w?.defense) return;
    if (this.run !== w.run) {
      this.run = w.run;
      this.elapsed = 0;
    }
    const d = w.defense,
      ratio = Math.max(0, d.armory.hp / d.maxHp);
    const level = ratio <= 0 ? 0 : Math.min(5, Math.floor(ratio * 5) + 1);
    this.group.userData.damageLevel = level;
    this.group.position.set(d.armory.x, 0, d.armory.z);
    this.panels.forEach((p, i) => (p.visible = i < level));
    const colors = [0x242322, 0x583c35, 0x74614b, 0x777567, 0x6d7c72, 0x63716c];
    (this.core.material as T.MeshStandardMaterial).color.setHex(colors[level]);
    this.core.scale.y = level ? 1 : 0.25;
    this.core.position.y = level ? 0.85 : 0.23;
    this.debris.visible = !level;
    // Hide intact door and lid in the separate destroyed state.
    this.group.children.forEach((o, i) => {
      if (i === 1 || i === 7 || i === 8) o.visible = level > 0;
    });
    if (w.phase !== "battle" && w.phase !== "lobby")
      this.elapsed += Math.min(0.1, dt);
    this.blast.visible = level === 0 && this.elapsed < 0.8;
    this.blast.scale.setScalar(0.2 + this.elapsed * 4);
    (this.blast.material as T.MeshBasicMaterial).opacity = Math.max(
      0,
      0.75 - this.elapsed,
    );
  }
  camera(w: World | null, camera: T.PerspectiveCamera) {
    if (!w?.defense || w.phase === "battle" || w.phase === "lobby") return;
    const p = w.defense.armory,
      zoom = Math.min(1, this.elapsed / 2);
    camera.position.set(p.x + 5 - zoom, 3 - zoom * 0.4, p.z + 6 - zoom * 2);
    camera.lookAt(p.x, 0.8, p.z);
  }
}
