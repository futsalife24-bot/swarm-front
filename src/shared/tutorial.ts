/**
 * 基礎訓練の世界（tutorial-proposal §4-1・§8-3 W2）。
 * 既存の訓練射撃場（training.ts）を土台に、次だけを足す:
 * - T8 用の「倒せる訓練標的」（攻撃しない。訓練場の敵は w.training で行動しない）
 * - T9 用の見本の武器ドロップ1個（回収しても持ち帰れない）
 * - T10 用の救急箱（本編ソロと同じ useMedkit・1回の訓練で1回）と、減った体力
 * 保証: 報酬・未確定戦利品・ドロップを外へ持ち出さない。保存データには触れない。
 */
import { step, spawn, type Input } from "./game";
import { STARTERS, type Weapon } from "./defs";
import { TARGETS, createTrainingWorld, resetTargets } from "./training";
import { maxHp, useMedkit } from "./solo-progression";

export const TUTORIAL_PLAYER = "training";
/** T8 で倒す訓練標的の数と体力（数発で倒せる程度）。 */
export const TUTORIAL_KILL_TARGETS = 3;
export const TUTORIAL_TARGET_HP = 60;
export const SAMPLE_DROP_ID = "tutorial-sample";
/** 倒せる標的の置き場所（固定標的の正面寄り）。 */
const KILL_SPOTS = [
  { x: -6, z: 2 },
  { x: 0, z: -2 },
  { x: 6, z: 2 },
];

export type TutorialWorld = ReturnType<typeof createTrainingWorld>;
export type TutorialArena = "practice" | "kill" | "drop" | "health";
/** T10 の開始時の体力（最大の割合）。自動回復（半分まで）と救急箱（全回復）の両方が見える量。 */
export const HEALTH_DRILL_HP = 0.25;

export function createTutorialWorld(weapons: Weapon[] = STARTERS.slice(0, 2)) {
  const w = createTrainingWorld(weapons);
  w.tutorialKit = { medkit: true };
  return w;
}

/** T8: 固定標的を外し、倒せる訓練標的を並べる。 */
export function placeKillTargets(w: TutorialWorld) {
  w.enemies = [];
  w.projectiles = [];
  for (const spot of KILL_SPOTS.slice(0, TUTORIAL_KILL_TARGETS)) {
    spawn(w, "crawler", spot.x, spot.z, "crown", 0);
    const e = w.enemies.at(-1)!;
    e.hp = e.maxHp = TUTORIAL_TARGET_HP;
    e.size = 1;
    e.y = 0;
  }
}

/** 見本の武器までの距離。回収半径（3m）より遠く、画面で見える近さ。 */
export const SAMPLE_DROP_DISTANCE = 6;
/** 訓練場の壁（x ±23・z -47〜23 が内側）から離した、置いてよい範囲。 */
const DROP_BOUNDS = { minX: -20, maxX: 20, minZ: -44, maxZ: 20 };
/** 練習標的と重ならない距離（標的に隠れて見えなくならないように）。 */
const TARGET_CLEARANCE = 2.5;
/**
 * T9: 兵士の向いている先（訓練場の壁の内側・練習標的と重ならない所）に見本の武器を1個だけ置く。
 * 持ち帰れない。T8 の後で標的が欠けていても、ここで練習標的を戻してから置く
 * （置いた後の stepTutorial で標的を戻すと、ドロップまで消えていたため）。
 */
export function placeSampleDrop(w: TutorialWorld, yaw = w.players[0].yaw) {
  resetTargets(w);
  const p = w.players[0];
  const weapon: Weapon = { ...STARTERS[0], id: SAMPLE_DROP_ID };
  const inside = (x: number, z: number) =>
    x >= DROP_BOUNDS.minX &&
    x <= DROP_BOUNDS.maxX &&
    z >= DROP_BOUNDS.minZ &&
    z <= DROP_BOUNDS.maxZ;
  const clear = (x: number, z: number) =>
    w.enemies.every((e) => Math.hypot(e.x - x, e.z - z) >= TARGET_CLEARANCE);
  // 正面 → 斜め → 横 → 後ろの順に、置ける所を探す（前方 = (sin yaw, -cos yaw)）。
  let spot: { x: number; z: number } | undefined;
  for (const turn of [0, 1, -1, 2, -2, 3, -3, 4])
    for (const distance of [SAMPLE_DROP_DISTANCE, SAMPLE_DROP_DISTANCE - 1.5]) {
      if (spot) break;
      const a = yaw + (turn * Math.PI) / 4,
        x = p.x + Math.sin(a) * distance,
        z = p.z - Math.cos(a) * distance;
      if (inside(x, z) && clear(x, z)) spot = { x, z };
    }
  // 兵士が壁際の隅にいても、訓練場の中央寄りの空いた所に置く。
  spot ??= { x: 4, z: 12 };
  w.pending[TUTORIAL_PLAYER] = [];
  w.drops = [
    {
      type: "weapon",
      id: SAMPLE_DROP_ID,
      x: spot.x,
      z: spot.z,
      owner: TUTORIAL_PLAYER,
      weapon,
    },
  ];
}

/** T10: 練習標的に戻し、体力を減らして自動回復と救急箱を試せるようにする。 */
export function prepareHealthDrill(w: TutorialWorld) {
  resetTargets(w);
  const p = w.players[0];
  p.hp = Math.min(p.hp, maxHp(w) * HEALTH_DRILL_HP);
  // 被弾直後と同じ扱い（自動回復は数秒たってから始まる）。
  p.safe = 0;
}

/** 訓練の1tick。arena で標的とドロップの扱いだけを変える。 */
export function stepTutorial(
  w: TutorialWorld,
  input: Input,
  arena: TutorialArena,
  dt = 0.05,
) {
  const p = w.players[0];
  // 救急箱（タッチの救急箱ボタン・E / H）。本編ソロと同じ useMedkit を使う。
  if (input.revive) useMedkit(w, w.tutorialKit);
  const before = p.hp,
    half = maxHp(w) * 0.5;
  step(w, { [TUTORIAL_PLAYER]: input }, dt);
  // 自動回復は本編ソロと同じく半分まで（訓練場の世界は協力扱いで全快まで戻るため）。
  p.hp = Math.min(p.hp, Math.max(before, half));
  // 報酬は常に空。ドロップは見本の1個だけを残す（撃破で落ちた物は消す）。
  w.rewards = {};
  const sample =
    arena === "drop" ? w.drops.filter((d) => d.id === SAMPLE_DROP_ID) : [];
  // 回収の数え上げは drop の間だけ。ほかの場面では未確定戦利品を持たない。
  if (arena !== "drop") w.pending[TUTORIAL_PLAYER] = [];
  // 練習用の固定標的は、撃たれても元に戻す（既存の訓練射撃場と同じ）。
  // resetTargets はドロップも空にするので、見本の武器は戻した後に置き直す。
  if (arena !== "kill" && w.enemies.length !== TARGETS.length) resetTargets(w);
  w.drops = sample;
}

/** 訓練を抜けるときに、戦利品が残っていないことを保証する。 */
export function clearTutorialLoot(w: TutorialWorld) {
  w.drops = [];
  w.pending[TUTORIAL_PLAYER] = [];
  w.rewards = {};
}
