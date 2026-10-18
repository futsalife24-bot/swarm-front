import type { EnemyReportId } from "./enemy-identity";

/** Campaign encounter order. Keep unknown entries in their assigned slots. */
export const ENEMY_REPORT_ORDER = [
  "crawler",
  "ant",
  "spider",
  "spitter",
  "boss",
  "hornet",
  "bastion",
  "worm",
  "calyx",
  "harrow",
] as const satisfies readonly EnemyReportId[];
