import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadHoundMotion, HoundMotionBatch, HoundMotionController, type HoundVisualInput } from './hound-motion';

/** Development-only visual adapter. Never receives or mutates a World. */
export class HoundGlbDebug {
  readonly group = new T.Group();
  readonly parts: T.InstancedMesh[] = [];
  private local: T.Matrix4[] = [];
  private matrix = new T.Matrix4();
  private composed = new T.Matrix4();
  private color = new T.Color();
  enabled = true;
  ready = false;
  error = '';
  readonly loading: Promise<void>;
  motion?: HoundMotionBatch;
  readonly controller = new HoundMotionController();

  constructor(scene: T.Scene, capacity: number, version: 'v2' | 'v3' | 'motion' = 'v2') {
    this.group.name = `HOUND_${version.toUpperCase()}_DEBUG`;
    this.group.visible = false;
    scene.add(this.group);
    if (version === 'motion') {
      this.loading = loadHoundMotion().then(asset => {
        this.motion = new HoundMotionBatch(asset, capacity);
        this.group.add(this.motion.group);this.parts.push(...this.motion.parts);this.ready = true;
      }).catch(error => { this.error = String(error); console.warn('HOUND motion unavailable; keeping current model',error); });
      return;
    }
    this.loading = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/enemies/hound_blockout_${version}.glb`)
      .then(({scene: model}) => {
        model.updateMatrixWorld(true);
        model.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          const mesh = new T.InstancedMesh(object.geometry, object.material, capacity);
          mesh.name = object.name;
          mesh.count = 0;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          this.local.push(object.matrixWorld.clone());
          this.parts.push(mesh);
          this.group.add(mesh);
        });
        this.ready = this.parts.length === (version === 'v3' ? 4 : 10);
        if (!this.ready) this.error = 'Unexpected HOUND part count';
      }).catch(error => {
        this.error = String(error);
        console.warn('HOUND debug GLB unavailable; keeping current model', error);
      });
  }

  sync(source: T.InstancedMesh, inputs: readonly HoundVisualInput[] = [], dt = 0) {
    const active = this.ready && this.enabled;
    source.visible = !active;
    this.group.visible = active && source.count > 0;
    if (!active) return;
    if (this.motion) {
      this.controller.update(this.motion, inputs, dt);
      for (let i=0;i<source.count;i++) {
        source.getMatrixAt(i,this.matrix);
        if(source.instanceColor)source.getColorAt(i,this.color);else this.color.set(0xffffff);
        this.motion.setTransform(i,this.matrix,this.color);
      }
      this.motion.finish(source.count);return;
    }
    for (let p = 0; p < this.parts.length; p++) {
      const part = this.parts[p];
      part.count = source.count;
      for (let i = 0; i < source.count; i++) {
        source.getMatrixAt(i, this.matrix);
        part.setMatrixAt(i, this.composed.multiplyMatrices(this.matrix, this.local[p]));
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
