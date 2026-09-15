import { WEAPONS, EFFECT_POOLS, type Kind, type Weapon } from "./defs";
import { STAGES, troopCount } from "./stages";

export type Difficulty = "normal" | "medium";
export type Skill = "hp" | "aim" | "move" | "swap";
export const SKILLS: Skill[] = ["hp", "aim", "move", "swap"];
export const SKILL_NAMES = {
  hp: "最大HP",
  aim: "AIM",
  move: "移動速度",
  swap: "武器切替速度",
};
export const COSTS = [0, 3, 15, 40, 75, 120];
export const SWAP_TIMES = [1, 0.85, 0.7, 0.55, 0.45, 0.35];
export const GRADES = ["N", "R", "SR", "SSR", "LR"];
export const YIELDS = [1, 2, 3, 10, 30];
export const CAPACITY = { total: 160, perKind: 16 };
export type VarianceKey = "power" | "reload" | "range" | "rate";
export const VARIANCE_KEYS: VarianceKey[] = [
  "power",
  "reload",
  "range",
  "rate",
];
export type Variances = Record<VarianceKey, number>;
export type NewWeapon = Weapon & {
  format: 2;
  variance: Variances;
  testData: boolean;
  acquired: number;
};
export const MAGAZINES = {
  rifle: [32, 36, 40, 44, 48],
  shotgun: [7, 8, 9, 10, 11],
  rocket: [2, 2, 3, 3, 4],
};
export const ACCESSORY_NAMES = {
  pickup: "回収距離",
  healing: "回復ドロップ量",
  recovery: "自動回復開始",
};
export type AccessoryKind = keyof typeof ACCESSORY_NAMES;
export interface Accessory {
  id: string;
  kind: AccessoryKind;
  rarity: number;
  locked: boolean;
  testData: boolean;
}
export const ACCESSORY_VALUES = {
  pickup: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75],
  healing: [0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.3],
  recovery: [5, 4.8, 4.6, 4.4, 4.2, 4, 3],
};
export const BRANCH_POINT = { x: 0, z: -36, radius: 6 };
export const BRANCH_HINT =
  "ST3の北側、街区中央の通りを奥まで調査して生還する。";
// Implementer provisional settings; accepted economy/skill values are above.
export const settings = (stage: number, difficulty: Difficulty) => {
  const base = STAGES[(stage === 21 ? 3 : stage) - 1];
  const troops = base.waves.reduce(
    (n, w) => n + troopCount(w) + w.bosses.length * 28,
    0,
  );
  return {
    timeLimit: Math.ceil(
      (90 + troops * 4) * (difficulty === "medium" ? 1.15 : 1),
    ),
    waveWait: base.waves.map(() => (difficulty === "medium" ? 35 : 45)),
    enemyCap: 120,
    difficultyHp: difficulty === "medium" ? 1.25 : 1,
    difficultyDamage: difficulty === "medium" ? 1.15 : 1,
  };
};
export const missionKey = (stage: number, difficulty: Difficulty) =>
  `${stage}:${difficulty}`;
export const stageLabel = (stage: number) =>
  stage === 21 ? "3-A" : `ST${stage}`;
export const victoryCoins = (stage: number, d: Difficulty) =>
  (100 + 20 * ((stage === 21 ? 3 : stage) - 1)) * (d === "medium" ? 1.5 : 1);
export function rarityWeights(stage: number, d: Difficulty) {
  if (stage === 21)
    return d === "normal" ? [0.75, 0.25, 0, 0, 0] : [0, 0.65, 0.35, 0, 0];
  if (d === "normal")
    return stage <= 5
      ? [0.8, 0.2, 0, 0, 0]
      : stage <= 10
        ? [0, 0.8, 0.2, 0, 0]
        : [0, 0, 0.8, 0.2, 0];
  return stage <= 5
    ? [0, 0.7, 0.3, 0, 0]
    : stage >= 18
      ? [0, 0, 0.699, 0.3, 0.001]
      : [0, 0, 0.7, 0.3, 0];
}
export function weighted(weights: number[], rng: () => number) {
  const r = rng();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r < sum) return i;
  }
  return weights.length - 1;
}
export function rollVariance(rng: () => number) {
  const band = weighted([0.2, 0.1, 0.57, 0.1, 0.03], rng);
  return band === 0
    ? -10 + Math.floor(rng() * 10)
    : band === 1
      ? 0
      : band === 2
        ? 1 + Math.floor(rng() * 9)
        : band === 3
          ? 10 + Math.floor(rng() * 10)
          : 20;
}
export function makeWeapon(
  id: string,
  kind: Kind,
  rarity: number,
  variance: Variances,
  testData: boolean,
  acquired: number,
  effect: Weapon["effect"] = "none",
): NewWeapon {
  if (
    !Object.hasOwn(WEAPONS, kind) ||
    !Number.isInteger(rarity) ||
    rarity < 0 ||
    rarity > 4 ||
    !VARIANCE_KEYS.every(
      (k) =>
        Number.isInteger(variance[k]) &&
        variance[k] >= -10 &&
        variance[k] <= 20,
    )
  )
    throw new Error("武器の指定値が範囲外です");
  return {
    id,
    kind,
    rarity: rarity as Weapon["rarity"],
    power: 1.15 ** rarity * (1 + variance.power / 100),
    effect,
    format: 2,
    variance: { ...variance },
    testData,
    acquired,
  };
}
export function rollWeapon(
  id: string,
  stage: number,
  d: Difficulty,
  testData: boolean,
  acquired: number,
  rng: () => number,
): NewWeapon {
  const kind = (["rifle", "shotgun", "rocket"] as Kind[])[
    Math.floor(rng() * 3)
  ];
  const rarity = weighted(rarityWeights(stage, d), rng);
  const variance = Object.fromEntries(
    VARIANCE_KEYS.map((k) => [k, rollVariance(rng)]),
  ) as Variances;
  const effect =
    rarity && rng() < 0.6
      ? EFFECT_POOLS[kind][Math.floor(rng() * EFFECT_POOLS[kind].length)]
      : "none";
  return makeWeapon(id, kind, rarity, variance, testData, acquired, effect);
}
export function newStats(w: NewWeapon) {
  const d = WEAPONS[w.kind],
    scale = 1.15 ** w.rarity;
  return {
    ...d,
    damage: d.damage * scale * (1 + w.variance.power / 100),
    mag: MAGAZINES[w.kind][w.rarity],
    reload: d.reload / (scale * (1 + w.variance.reload / 100)),
    range: d.range * scale * (1 + w.variance.range / 100),
    interval: d.interval / (scale * (1 + w.variance.rate / 100)),
  };
}
export const varianceClass = (n: number) =>
  n < 0
    ? "low"
    : n === 0
      ? "base"
      : n <= 10
        ? "good"
        : n < 20
          ? "great"
          : "max";
export const varianceMark = (n: number) =>
  n < 0 ? "▼" : n === 0 ? "" : n <= 10 ? "▲" : n < 20 ? "▲\n▲" : "★";
