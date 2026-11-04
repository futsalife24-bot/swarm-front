import { blocked } from "../shared/game";
import { supportHeight } from "../shared/terrain";
import type { Block } from "../shared/defs";

export interface BuddyPoint {
  x: number;
  y: number;
  z: number;
}
/** 装飾だけの保守的な追従。経路がない時は隠し、壁や高所を横切らない。 */
export function buddyPathClear(
  a: BuddyPoint,
  b: BuddyPoint,
  radius: number,
  blocks: Block[],
) {
  // 薄壁にも連続判定。足元より高い矩形を半径分膨張して線分と照合。
  for (const block of blocks) {
    if (block.h <= Math.min(a.y, b.y) + 0.02) continue;
    let lo = 0,
      hi = 1;
    for (const [start, delta, centre, half] of [
      [a.x, b.x - a.x, block.x, block.w / 2 + radius],
      [a.z, b.z - a.z, block.z, block.d / 2 + radius],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (Math.abs(start - centre) >= half) {
          lo = 2;
          break;
        }
      } else {
        const t1 = (centre - half - start) / delta,
          t2 = (centre + half - start) / delta;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
      }
    }
    if (lo <= hi) return false;
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    const y = a.y + (b.y - a.y) * t;
    if (blocked(x, z, radius, y + 0.02, blocks)) return false;
    // 足場縁では全周の支持面を確認。浮遊体も床の基準高を保つ。
    for (const [dx, dz] of [
      [0, 0],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
      [-radius * 0.71, -radius * 0.71],
      [radius * 0.71, -radius * 0.71],
      [-radius * 0.71, radius * 0.71],
      [radius * 0.71, radius * 0.71],
    ]) {
      if (Math.abs(supportHeight(x + dx, z + dz, blocks, y + 0.05) - y) > 0.3)
        return false;
    }
  }
  return true;
}

export function buddyFollowTarget(
  owner: BuddyPoint & { yaw: number },
  radius: number,
  blocks: Block[],
  previous?: BuddyPoint,
) {
  const side = 1.25 + radius;
  // 通常カメラの足元で切れない横前方。兵士・中央の照準線を空ける。
  for (const [right, back] of [
    [-side, -1.8],
    [side, -1.8],
    [-side, -2.6],
    [side, -2.6],
  ]) {
    const x =
      owner.x + Math.cos(owner.yaw) * right - Math.sin(owner.yaw) * back;
    const z =
      owner.z + Math.sin(owner.yaw) * right + Math.cos(owner.yaw) * back;
    const y = supportHeight(x, z, blocks, owner.y + 0.05);
    const target = { x, y, z };
    if (Math.abs(y - owner.y) > 0.3) continue;
    // 所有者直近では兵士半径を使う。到着位置・実移動は素材の全周半径を使う。
    if (
      !buddyPathClear(owner, target, 0.35, blocks) ||
      !buddyPathClear(target, target, radius, blocks)
    )
      continue;
    if (previous && !buddyPathClear(previous, target, radius, blocks)) continue;
    return target;
  }
  return null;
}
