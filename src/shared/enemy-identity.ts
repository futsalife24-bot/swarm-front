import type { Enemy } from "./game";
import { ENEMIES } from "./defs";

/** Report and encounter identities. The saved `boss` and `worm` keys stay stable. */
export type EnemyReportId = keyof typeof ENEMIES | "worm";

export const ENEMY_REPORT_NAMES: Record<EnemyReportId, string> = {
  harrow: "HARROW",
  calyx: "CALYX",
  ant: "HOUND / VOLLEY",
  spider: "HOUND / LEAPER",
  crawler: "PLEAT",
  spitter: "PRISM",
  hornet: "RAY",
  boss: "FOUNDRY ZERO",
  worm: "CATENA",
};

export function enemyReportId(
  enemy: Pick<Enemy, "kind" | "segments">,
): EnemyReportId {
  return enemy.kind === "boss" && enemy.segments ? "worm" : enemy.kind;
}
