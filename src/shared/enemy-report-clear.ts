import { STAGES } from "./stages";
import {
  ENEMY_REPORT_NAMES,
  type EnemyReportId,
} from "./enemy-identity";

const BOSS_REPORT_IDS: Record<string, EnemyReportId> = {
  crown: "boss",
  worm: "worm",
  harrow: "harrow",
};

function firstClearStages(): Record<EnemyReportId, number> {
  const result = {} as Record<EnemyReportId, number>;
  for (const stage of STAGES) {
    for (const wave of stage.waves) {
      for (const kind of Object.keys(wave.troops) as EnemyReportId[]) {
        result[kind] ??= stage.id;
      }
      for (const boss of wave.bosses) {
        const id = BOSS_REPORT_IDS[boss];
        if (id) result[id] ??= stage.id;
      }
    }
  }
  for (const id of Object.keys(ENEMY_REPORT_NAMES) as EnemyReportId[])
    result[id] ??= Number.MAX_SAFE_INTEGER;
  return result;
}

export const ENEMY_REPORT_CLEAR_STAGE = firstClearStages();

/** Clear gating for report names, details, models, voice and films. */
export function enemyReportRevealed(
  id: EnemyReportId,
  access: "solo" | "coop" | undefined,
  clearedStages = Number.POSITIVE_INFINITY,
) {
  return access === "solo" && clearedStages >= ENEMY_REPORT_CLEAR_STAGE[id];
}
