/** Parent-provided APNG/image assets can be installed here after review. */
export type OperationCueKind = "sortie" | "return" | "end" | "clear";
export const OPERATION_CUE_ASSETS: Partial<
  Record<OperationCueKind, { animated: string; still: string }>
> = {};
