/** 生存の属性カード。表示と権威側の戦闘で同じ数値を使う。 */
const rank = (level: number) => Math.max(1, Math.min(3, level));
export const FRONT_ELEMENT_RULES = {
  burnDuration: 3,
  burnInterval: 0.5,
  burnDamage: (level: number) => 3 + 3 * rank(level),
  freezeDuration: (level: number) => 0.25 + 0.25 * rank(level),
  freezeRecovery: 2,
  chainRange: 6,
  chainTargets: (level: number) => 1 + rank(level),
  chainDamage: (level: number) => 12 + 6 * rank(level),
} as const;

export type FrontElement = "fire" | "ice" | "lightning";
export const FRONT_ELEMENT_NAMES: Record<FrontElement, string> = {
  fire: "火炎",
  ice: "氷結",
  lightning: "電撃",
};
