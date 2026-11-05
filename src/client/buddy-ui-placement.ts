/**
 * 固有スキルボタンの配置（純粋な値と関数だけ。DOM・CSS・buddy-ui.ts に依存しない）。
 * layout.ts から import しても、他モードへバディUIのモジュールやCSSを引き込まない。
 */

/** layout.ts の CONTROL_IDS に "buddy" を足す場合の標準配置（既存ボタンと重ならない位置）。 */
export const BUDDY_SKILL_PLACEMENT = {
  x: 0.92,
  y: 0.86,
  size: 1,
  label: "below",
} as const;
/**
 * 短い高さ用（ジャンプの上）。標準位置が既存ボタンと4px未満になる画面
 * （640×280・740×300 の安全領域ありなど）で使う。スキル名はボタンの左へ出す
 * （下に出すとジャンプに重なる）。既存ボタンは動かさない。
 */
export const BUDDY_SKILL_PLACEMENT_SHORT = {
  x: 0.64,
  y: 0.13,
  size: 1,
  label: "left",
} as const;
/** 標準配置のまま（本人が配置編集で動かしていない）の時に、この順で試す。 */
export const BUDDY_SKILL_PLACEMENTS = [
  BUDDY_SKILL_PLACEMENT,
  BUDDY_SKILL_PLACEMENT_SHORT,
] as const;
export type BuddySkillPlacement = (typeof BUDDY_SKILL_PLACEMENTS)[number];
export type BuddySkillLabelSide = BuddySkillPlacement["label"];

export interface BuddyBox {
  left: number;
  top: number;
  size: number;
}
/** layout.ts の overlaps と同じ軸並行の箱で、2つの箱の間隔（負は重なり）。 */
export const boxGap = (a: BuddyBox, b: BuddyBox) =>
  Math.max(
    b.left - (a.left + a.size),
    a.left - (b.left + b.size),
    b.top - (a.top + a.size),
    a.top - (b.top + b.size),
  );
/**
 * 表示中の既存ボタン（others）を動かさずに、固有スキルの位置を選ぶ。
 * 候補を順に resolve（layout.ts の resolveLayout と同じ式で箱にする関数）し、
 * 全ての既存ボタンと minGap 以上離れた最初の候補を返す。どれも満たさなければ
 * 最初の候補を返し（fits:false）、既存の overlaps の判定に任せる。
 */
export function pickBuddySkillPlacement<R extends BuddyBox>(
  others: readonly R[],
  resolve: (placement: BuddySkillPlacement) => R,
  minGap = 4,
  candidates: readonly BuddySkillPlacement[] = BUDDY_SKILL_PLACEMENTS,
) {
  for (const placement of candidates) {
    const rect = resolve(placement);
    if (others.every((o) => boxGap(rect, o) >= minGap))
      return { placement, rect, fits: true };
  }
  return {
    placement: candidates[0],
    rect: resolve(candidates[0]),
    fits: false,
  };
}
