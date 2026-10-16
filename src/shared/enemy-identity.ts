import type { Enemy } from "./game";
import { ENEMIES } from "./defs";

/**
 * レポート本文・声・会敵動画が未制作のローカル候補。遭遇記録・会敵演出・
 * エネミーレポートの対象外にし、仮の文面や素材を表示しない。
 */
export type ReportlessEnemyKind = "bastion";
export const REPORTLESS_ENEMIES: readonly ReportlessEnemyKind[] = ["bastion"];
export type ReportEnemyKind = Exclude<Enemy["kind"], ReportlessEnemyKind>;

/** Report and encounter identities. The saved `boss` and `worm` keys stay stable. */
export type EnemyReportId =
  | Exclude<keyof typeof ENEMIES, ReportlessEnemyKind>
  | "worm";

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
): EnemyReportId | undefined {
  if (enemy.kind === "bastion") return undefined;
  return enemy.kind === "boss" && enemy.segments ? "worm" : enemy.kind;
}
