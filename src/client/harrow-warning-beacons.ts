import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Block } from "../shared/defs";
import { supportHeight } from "../shared/terrain";

// 承認済みの6mの目印。攻撃範囲ではなく、隠れた地面予告の位置を知らせる。
function beaconGeometry() {
  const up = new T.Vector3(0, 1, 0);
  const pieces = [
    [0, 0, 0, 0, 6, 0],
    [-0.6, 5.2, 0, 0, 4.5, 0],
    [0, 4.5, 0, 0.6, 5.2, 0],
  ].map(([ax, ay, az, bx, by, bz]) => {
    const a = new T.Vector3(ax, ay, az),
      b = new T.Vector3(bx, by, bz);
    const delta = b.clone().sub(a),
      length = delta.length();
    return new T.CylinderGeometry(0.06, 0.06, 1, 6).applyMatrix4(
      new T.Matrix4().compose(
        a.add(b).multiplyScalar(0.5),
        new T.Quaternion().setFromUnitVectors(up, delta.normalize()),
        new T.Vector3(1, length, 1),
      ),
    );
  });
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  return geometry;
}

export class HarrowWarningBeacons extends T.InstancedMesh<
  T.BufferGeometry,
  T.MeshBasicMaterial
> {
  private readonly placement = new T.Matrix4();
  constructor(readonly capacity = 42) {
    super(
      beaconGeometry(),
      new T.MeshBasicMaterial({
        color: 0xff4054,
        // 深度を書かない目印を不透明な地形より後に描き、上書きを防ぐ。
        transparent: true,
        depthTest: true,
        depthWrite: false,
      }),
      capacity,
    );
    this.name = "harrow-warning-beacons";
    this.count = 0;
    this.visible = false;
    this.frustumCulled = false;
    this.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }
  begin() {
    this.count = 0;
  }
  addMarker(point: { x: number; y: number; z: number }, blocks?: Block[]) {
    if (this.count >= this.capacity) return;
    const y = blocks
      ? supportHeight(point.x, point.z, blocks, point.y)
      : point.y;
    this.placement.makeTranslation(point.x, y + 0.15, point.z);
    this.setMatrixAt(this.count++, this.placement);
  }
  finish() {
    this.visible = this.count > 0;
    if (this.visible) this.instanceMatrix.needsUpdate = true;
  }
  override dispose() {
    super.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
