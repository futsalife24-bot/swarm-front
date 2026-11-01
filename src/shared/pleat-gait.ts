// 旧PLEAT(足4本の接地計算)が平地で実際に出していた速さ。胴体中心の移動へ
// 置き換えても速度・難易度を変えないため、指示速度をこの表で実効速度へ変換する。
// 測定: scripts/calibrate-pleat-speed.test.ts（基点 3035376）、
// 結果: docs/evidence/pleat-lightweight-20261101/legacy-speed.json
const SCALES = [
  1, 1.2, 1.275, 1.35, 1.425, 1.5, 1.575, 1.65, 1.725, 1.8, 1.95, 2.1, 2.25,
  2.625, 3,
];
const SPEEDS = [1, 1.5, 2, 3.5, 5.25, 7.7, 11.55];
/** 実効速度 ÷ 指示速度（30秒平均）。行はSCALES、列はSPEEDS。 */
const RATIO = [
  [1, 1, 1, 0.494, 0.29, 0.198, 0.132],
  [1, 1, 0.764, 0.504, 0.324, 0.221, 0.147],
  [1, 1, 1, 0.506, 0.371, 0.235, 0.157],
  [1, 1, 1, 0.566, 0.399, 0.277, 0.185],
  [0.999, 0.918, 0.689, 0.567, 0.512, 0.292, 0.194],
  [1, 1, 1, 0.611, 0.527, 0.292, 0.195],
  [1, 1, 0.861, 0.675, 0.592, 0.327, 0.218],
  [1, 1, 1, 0.728, 0.607, 0.332, 0.221],
  [1, 1, 1, 0.811, 0.555, 0.346, 0.23],
  [1, 1, 1, 0.728, 0.577, 0.349, 0.233],
  [1, 1, 1, 0.81, 0.531, 0.386, 0.254],
  [1, 1, 1, 0.722, 0.59, 0.439, 0.292],
  [1, 1, 1, 1, 0.61, 0.553, 0.319],
  [1, 1, 1, 1, 1, 0.526, 0.373],
  [1, 1, 1, 1, 0.819, 0.526, 0.393],
];
/** 静止から胴体が0.5m進むまでの秒数（攻撃後の再発進の遅さ）。 */
const START = [
  [0.8, 0.6, 0.55, 0.6, 0.6, 0.6, 0.6],
  [0.8, 0.65, 0.55, 0.55, 0.55, 0.55, 0.55],
  [0.8, 0.65, 0.55, 0.55, 0.55, 0.55, 0.55],
  [0.8, 0.65, 0.55, 0.55, 0.55, 0.55, 0.55],
  [0.8, 0.65, 0.55, 0.55, 0.5, 0.5, 0.5],
  [0.8, 0.65, 0.6, 0.55, 0.5, 0.5, 0.5],
  [0.8, 0.65, 0.6, 0.5, 0.5, 0.5, 0.5],
  [0.8, 0.65, 0.6, 0.45, 0.5, 0.45, 0.45],
  [0.8, 0.65, 0.6, 0.45, 0.45, 0.45, 0.45],
  [0.8, 0.65, 0.6, 0.5, 0.45, 0.45, 0.45],
  [0.85, 0.7, 0.6, 0.5, 0.45, 0.45, 0.45],
  [0.85, 0.7, 0.6, 0.45, 0.45, 0.45, 0.45],
  [0.85, 0.7, 0.6, 0.45, 0.45, 0.45, 0.45],
  [0.85, 0.75, 0.6, 0.5, 0.4, 0.4, 0.4],
  [0.9, 0.75, 0.65, 0.5, 0.45, 0.4, 0.4],
];

function bracket(axis: number[], value: number): [number, number, number] {
  if (value <= axis[0]) return [0, 0, 0];
  for (let i = 1; i < axis.length; i++)
    if (value <= axis[i])
      return [i - 1, i, (value - axis[i - 1]) / (axis[i] - axis[i - 1])];
  return [axis.length - 1, axis.length - 1, 0];
}
function sample(table: number[][], scale: number, speed: number) {
  const [a, b, u] = bracket(SCALES, scale),
    [c, d, v] = bracket(SPEEDS, speed);
  const low = table[a][c] + (table[a][d] - table[a][c]) * v,
    high = table[b][c] + (table[b][d] - table[b][c]) * v;
  return low + (high - low) * u;
}
/** 指示速度を、旧PLEATが同じ条件で実際に進んだ速さへ変換する。 */
export function pleatGaitSpeed(scale: number, speed: number) {
  if (speed <= 1) return speed;
  return speed * sample(RATIO, scale, speed);
}
/** 静止から0.5mまでの旧実測時間に合う加速度(胴体の追従遅れ0.1秒を差し引く)。 */
export function pleatGaitAcceleration(scale: number, speed: number) {
  const seconds = Math.max(
    0.25,
    sample(START, scale, Math.max(1, speed)) - 0.1,
  );
  return 1 / (seconds * seconds);
}
