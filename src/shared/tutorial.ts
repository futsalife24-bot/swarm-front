/**
 * 基礎訓練の世界（tutorial-proposal §4-1・§8-3 W2）。
 * 既存の訓練射撃場（training.ts）を土台に、次だけを足す:
 * - T8 用の「倒せる訓練標的」（攻撃しない。訓練場の敵は w.training で行動しない）
 * - T9 用の見本の武器ドロップ1個（回収しても持ち帰れない）
 * 保証: 報酬・未確定戦利品・ドロップを外へ持ち出さない。保存データには触れない。
 */
import { step, spawn, type Input } from "./game";
import { STARTERS, type Weapon } from "./defs";
import { TARGETS, createTrainingWorld, resetTargets } from "./training";

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
export type TutorialArena = "practice" | "kill" | "drop";

export function createTutorialWorld(weapons: Weapon[] = STARTERS.slice(0, 2)) {
  return createTrainingWorld(weapons);
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

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
/** T9: 兵士の近く（訓練場の壁の内側）に見本の武器を1個だけ置く（持ち帰れない）。 */
export function placeSampleDrop(w: TutorialWorld) {
  const p = w.players[0];
  const weapon: Weapon = { ...STARTERS[0], id: SAMPLE_DROP_ID };
  w.pending[TUTORIAL_PLAYER] = [];
  w.drops = [
    {
      type: "weapon",
      id: SAMPLE_DROP_ID,
      x: clamp(p.x, -18, 18),
      z: clamp(p.z - 6, -40, 18),
      owner: TUTORIAL_PLAYER,
      weapon,
    },
  ];
}

/** 訓練の1tick。arena で標的とドロップの扱いだけを変える。 */
export function stepTutorial(
  w: TutorialWorld,
  input: Input,
  arena: TutorialArena,
  dt = 0.05,
) {
  step(w, { [TUTORIAL_PLAYER]: input }, dt);
  // 報酬は常に空。ドロップは見本の1個だけを残す（撃破で落ちた物は消す）。
  w.rewards = {};
  w.drops =
    arena === "drop" ? w.drops.filter((d) => d.id === SAMPLE_DROP_ID) : [];
  // 回収の数え上げは drop の間だけ。ほかの場面では未確定戦利品を持たない。
  if (arena !== "drop") w.pending[TUTORIAL_PLAYER] = [];
  // 練習用の固定標的は、撃たれても元に戻す（既存の訓練射撃場と同じ）。
  if (arena !== "kill" && w.enemies.length !== TARGETS.length) resetTargets(w);
}

/** 訓練を抜けるときに、戦利品が残っていないことを保証する。 */
export function clearTutorialLoot(w: TutorialWorld) {
  w.drops = [];
  w.pending[TUTORIAL_PLAYER] = [];
  w.rewards = {};
}
