import type { Enemy } from "./game";
import { ENEMIES } from "./defs";

/**
 * レポート本文・声・会敵動画が未制作の種。遭遇記録・会敵演出・
 * エネミーレポートの対象外にし、仮の文面や素材を表示しない。
 * 現在は該当なし（BASTION は 2026-10-18 に正式登録）。
 */
export type ReportlessEnemyKind = never;
export const REPORTLESS_ENEMIES: readonly string[] = [];
export type ReportEnemyKind = Exclude<Enemy["kind"], ReportlessEnemyKind>;

/** Report and encounter identities. The saved `boss` and `worm` keys stay stable. */
export type EnemyReportId =
  Exclude<keyof typeof ENEMIES, ReportlessEnemyKind> | "worm";

export const ENEMY_REPORT_NAMES: Record<EnemyReportId, string> = {
  harrow: "HARROW",
  calyx: "CALYX",
  bastion: "BASTION",
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
  return enemy.kind === "boss" && enemy.segments ? "worm" : enemy.kind;
}
