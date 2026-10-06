import * as T from "three";
import type { FrontMine, FrontPlayerCombat } from "../shared/front-combat";

/** 4人×（素材最大3＋融合最大3＋基礎2）。描画だけを扱う。 */
export const FRONT_MINE_CAPACITY = 32;
export class FrontMineVisuals {
  readonly body = this.mesh(
    new T.CylinderGeometry(0.62, 0.83, 0.24, 6),
    0x69828f,
  );
  readonly core = this.mesh(new T.OctahedronGeometry(0.25), 0xffffff);
  readonly ring = this.mesh(new T.TorusGeometry(0.94, 0.045, 4, 32), 0xffffff);
  private marker = new T.Object3D();
  constructor(scene: T.Scene) {
    scene.add(this.body, this.core, this.ring);
  }
  private mesh(geometry: T.BufferGeometry, color: number) {
    const mesh = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({ color }),
      FRONT_MINE_CAPACITY,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    return mesh;
  }
  update(
    mines: readonly FrontMine[],
    players: Record<string, FrontPlayerCombat>,
    time: number,
    own: string,
  ) {
    const count = Math.min(mines.length, FRONT_MINE_CAPACITY),
      m = this.marker;
    for (let i = 0; i < count; i++) {
      const mine = mines[i],
        fused = (players[mine.owner]?.levels["fusion-counter"] || 0) > 0;
      const color = new T.Color(
        fused ? 0xffcf68 : mine.owner === own ? 0x65ffe2 : 0x73baff,
      );
      m.position.set(mine.x, mine.y + 0.16, mine.z);
      m.rotation.set(0, Math.PI / 6, 0);
      m.scale.setScalar(1);
      m.updateMatrix();
      this.body.setMatrixAt(i, m.matrix);
      m.position.y = mine.y + 0.4;
      m.rotation.y = time * 1.4;
      m.scale.setScalar(1 + 0.08 * Math.sin(time * 3 + mine.id));
      m.updateMatrix();
      this.core.setMatrixAt(i, m.matrix);
      this.core.setColorAt(i, color);
      m.position.y = mine.y + 0.05;
      m.rotation.set(Math.PI / 2, 0, 0);
      m.scale.setScalar(1 + 0.05 * Math.sin(time * 2 + mine.id));
      m.updateMatrix();
      this.ring.setMatrixAt(i, m.matrix);
      this.ring.setColorAt(i, color);
    }
    for (const mesh of [this.body, this.core, this.ring]) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
