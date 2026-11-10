import * as T from "three";
import type { Enemy } from "../shared/game";
import { omegaPads } from "../shared/catena-omega";

/** 判定と同じ円の和集合を描く。描画枠を上限40体×15節で確保。 */
export class OmegaWarning {
  readonly mesh = new T.InstancedMesh(
    new T.CircleGeometry(1, 48),
    new T.MeshBasicMaterial({
      color: 0xff241f,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    600,
  );
  private object = new T.Object3D();
  constructor() {
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }
  update(enemies: readonly Enemy[], time: number) {
    let i = 0;
    for (const e of enemies)
      for (const p of omegaPads(e, time)) {
        if (e.hp <= 0 || i >= 600) continue;
        this.object.position.set(p.x, 0.06, p.z);
        this.object.rotation.set(-Math.PI / 2, 0, 0);
        this.object.scale.setScalar(p.radius);
        this.object.updateMatrix();
        this.mesh.setMatrixAt(i++, this.object.matrix);
      }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
