/** Producer event contract; received artwork is preserved without rebuilding. */
export const OPERATION_CUE_IDS = [
  "adv-sortie",
  "adv-extract",
  "adv-failed",
  "adv-complete",
  "srv-sortie",
  "srv-extract",
  "srv-ended",
] as const;
export type OperationCueKind = (typeof OPERATION_CUE_IDS)[number];
export type OperationCueVariant = "standard" | "mobile";
export interface OperationCueSource {
  apng: string;
  png: string;
}
export type OperationCueSources = Partial<
  Record<OperationCueKind, Record<OperationCueVariant, OperationCueSource>>
>;
export const OPERATION_CUE_LABELS: Record<OperationCueKind, string> = {
  "adv-sortie": "出撃",
  "adv-extract": "撤収完了",
  "adv-failed": "作戦失敗",
  "adv-complete": "作戦達成",
  "srv-sortie": "出撃",
  "srv-extract": "撤収完了",
  "srv-ended": "戦闘終了",
};
export const OPERATION_CUE_TIMING: Record<
  OperationCueKind,
  { inMs: number; holdMs: number; outMs: number; durationMs: number }
> = {
  "adv-sortie": { inMs: 520, holdMs: 1100, outMs: 360, durationMs: 1980 },
  "adv-extract": { inMs: 560, holdMs: 1500, outMs: 400, durationMs: 2460 },
  "adv-failed": { inMs: 640, holdMs: 1800, outMs: 420, durationMs: 2860 },
  "adv-complete": { inMs: 700, holdMs: 1900, outMs: 440, durationMs: 3040 },
  "srv-sortie": { inMs: 640, holdMs: 1100, outMs: 380, durationMs: 2120 },
  "srv-extract": { inMs: 600, holdMs: 1500, outMs: 420, durationMs: 2520 },
  "srv-ended": { inMs: 640, holdMs: 1600, outMs: 400, durationMs: 2640 },
};
export function operationCueForResult(
  mode: "advance" | "survival",
  phase: "victory" | "defeat",
): OperationCueKind {
  return mode === "survival"
    ? phase === "victory"
      ? "srv-extract"
      : "srv-ended"
    : phase === "victory"
      ? "adv-complete"
      : "adv-failed";
}
export function operationCuePlan(
  id: OperationCueKind,
  profile: {
    mobile: boolean;
    lowPower: boolean;
    reduced: boolean;
    off: boolean;
  },
) {
  const timing = OPERATION_CUE_TIMING[id],
    still = profile.reduced || profile.off;
  return {
    variant:
      profile.mobile || profile.lowPower
        ? ("mobile" as const)
        : ("standard" as const),
    format: still ? ("png" as const) : ("apng" as const),
    fadeMs: still && !profile.off ? 160 : 0,
    durationMs: still
      ? timing.holdMs + (profile.off ? 0 : 320)
      : timing.durationMs,
  };
}
/** The approved transfer layout retains each variant and original filename. */
export function operationCueSourcesAt(baseUrl = import.meta.env.BASE_URL) {
  const root = `${baseUrl.replace(/\/?$/, "/")}assets/event-banners/`;
  return Object.fromEntries(
    OPERATION_CUE_IDS.map((id) => [
      id,
      Object.fromEntries(
        (["standard", "mobile"] as const).map((variant) => [
          variant,
          {
            apng: `${root}${variant}/${id}.apng`,
            png: `${root}${variant}/${id}.png`,
          },
        ]),
      ),
    ]),
  ) as Record<
    OperationCueKind,
    Record<OperationCueVariant, OperationCueSource>
  >;
}
/** Received at transfer d4482b1; all 28 files and manifest references verified. */
export const OPERATION_CUE_ASSETS: OperationCueSources =
  operationCueSourcesAt();
