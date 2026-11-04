import * as T from "three";

/** 画像や常時エフェクトを使わず、3つの低負荷メッシュで宝箱を描く。 */
export class FrontChestVisuals {
  private marker = new T.Object3D();
  readonly body = this.mesh(new T.BoxGeometry(1.45, 0.7, 1.05), 0x8c531e);
  readonly lid = this.mesh(new T.BoxGeometry(1.5, 0.3, 1.1), 0xf4c66e);
  readonly lock = this.mesh(new T.BoxGeometry(0.26, 0.42, 1.14), 0xffdf90);
  constructor(scene: T.Scene) {
    scene.add(this.body, this.lid, this.lock);
  }
  private mesh(geometry: T.BufferGeometry, color: number) {
    const mesh = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({ color }),
      128,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    return mesh;
  }
  update(chests: readonly { x: number; y: number; z: number }[]) {
    const count = Math.min(chests.length, 128);
    for (let i = 0; i < count; i++) {
      const chest = chests[i];
      for (const [mesh, y] of [
        [this.body, 0.4],
        [this.lid, 0.88],
        [this.lock, 0.65],
      ] as const) {
        this.marker.position.set(chest.x, chest.y + y, chest.z);
        this.marker.updateMatrix();
        mesh.setMatrixAt(i, this.marker.matrix);
      }
    }
    for (const mesh of [this.body, this.lid, this.lock]) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
