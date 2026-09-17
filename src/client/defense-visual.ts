import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { World } from "../shared/game";

/** Authored Blender model; must load before daily admission is consumed. */
export class DefenseVisual {
  group = new T.Group();
  private model?: T.Group;
  private pending?: Promise<void>;
  private run = "";
  private elapsed = 0;
  private blast: T.Mesh;
  constructor(scene: T.Scene) {
    this.group.name = "DAILY_ARMORY";
    this.blast = new T.Mesh(
      new T.SphereGeometry(1, 12, 8),
      new T.MeshBasicMaterial({
        color: 0xffa244,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.blast.position.y = 1;
    this.group.add(this.blast);
    this.group.visible = false;
    scene.add(this.group);
  }
  load(): Promise<void> {
    if (this.model) return Promise.resolve();
    return (this.pending ??= new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}assets/maps/armory_v2.glb`)
      .then(({ scene }) => {
        if (!scene.getObjectByName("INTACT_shell"))
          throw new Error("武器庫モデルが不正です");
        scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.model = scene;
        this.group.add(scene);
      })
      .finally(() => {
        this.pending = undefined;
      }));
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
    this.model?.traverse((o) => {
      if (o.name.startsWith("INTACT_")) o.visible = level > 0;
      if (o.name.startsWith("RUIN_")) o.visible = level === 0;
      if (o.name.startsWith("STATUS_"))
        o.visible = Number(o.name.slice(7)) < level;
      if (o.name.startsWith("DAMAGE_"))
        o.visible = level > 0 && Number(o.name.slice(7)) <= 5 - level;
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
    camera.position.set(p.x + 5 - zoom, 3.5 - zoom * 0.4, p.z + 7 - zoom * 2);
    camera.lookAt(p.x, 1.25, p.z);
  }
}
