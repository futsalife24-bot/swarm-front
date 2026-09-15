import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
/** DEV-only static visual adapter. Receives instance transforms, never World state. */
export class EnemyGlbDebug {
  readonly group = new T.Group();
  readonly parts: T.InstancedMesh[] = [];
  private local: T.Matrix4[] = [];
  private matrix = new T.Matrix4();
  private composed = new T.Matrix4();
  private color = new T.Color();
  enabled = true;
  ready = false;
  error = "";
  readonly loading: Promise<void>;
  constructor(scene: T.Scene, capacity: number, name: string) {
    this.group.name = `${name.toUpperCase()}_V1_DEBUG`;
    this.group.visible = false;
    scene.add(this.group);
    this.loading = new GLTFLoader()
      .loadAsync(`${import.meta.env.BASE_URL}assets/enemies/${name}_v1.glb`)
      .then(({ scene: model }) => {
        model.updateMatrixWorld(true);
        model.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          const part = new T.InstancedMesh(
            object.geometry,
            object.material,
            capacity,
          );
          part.name = object.name;
          part.count = 0;
          part.instanceMatrix.setUsage(T.DynamicDrawUsage);
          this.local.push(object.matrixWorld.clone());
          this.parts.push(part);
          this.group.add(part);
        });
        this.ready = this.parts.length >= 3 && this.parts.length <= 5;
        if (!this.ready)
          this.error = "Unexpected prototype material batch count";
      })
      .catch((error) => {
        this.error = String(error);
        console.warn(`${name} GLB unavailable; keeping Current`, error);
      });
  }
  sync(source: T.InstancedMesh) {
    const active = this.enabled && this.ready;
    source.visible = !active;
    this.group.visible = active && source.count > 0;
    for (let p = 0; p < this.parts.length; p++) {
      const part = this.parts[p];
      part.count = active ? source.count : 0;
      if (!active) continue;
      for (let i = 0; i < source.count; i++) {
        source.getMatrixAt(i, this.matrix);
        part.setMatrixAt(
          i,
          this.composed.multiplyMatrices(this.matrix, this.local[p]),
        );
        if (source.instanceColor) {
          source.getColorAt(i, this.color);
          part.setColorAt(i, this.color);
        }
      }
      part.instanceMatrix.needsUpdate = true;
      if (part.instanceColor) part.instanceColor.needsUpdate = true;
      part.computeBoundingSphere();
    }
  }
}
