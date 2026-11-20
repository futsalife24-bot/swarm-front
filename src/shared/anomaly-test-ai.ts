import type { Enemy, Player, World } from "./game";
import { enemyReportId, type EnemyReportId } from "./enemy-identity";
import {
  ANOMALY_SKILLS,
  anomalySkillForReport,
  type AnomalySkillId,
} from "./anomaly-test";

export interface AnomalyTestAiState {
  cursor: number;
  activeSkill?: AnomalySkillId;
  activeAt: number;
  stage?: string;
  progress?: number;
  armedAt?: number;
}

function aiStates(w: World): Record<number, AnomalyTestAiState> {
  if (!w.anomalyTest) return {};
  return (w.anomalyTest.ai ??= {});
}

function aiState(w: World, e: Enemy): AnomalyTestAiState {
  const states = aiStates(w);
  return (states[e.id] ??= { cursor: 0, activeAt: 0 });
}

function settingFor(w: World, e: Enemy) {
  if (!w.anomalyTest) return undefined;
  const id = anomalyTestEnemyId(w, e);
  return id ? w.anomalyTest.enemies[id] : undefined;
}

export function anomalyTestEnemyId(w: World, e: Enemy): EnemyReportId | undefined {
  const id = enemyReportId(e);
  if (id) return id;
  if (e.segments && (w.anomalyTest?.enemies.worm.count ?? 0) > 0) return "worm";
  if (e.kind === "boss" && (w.anomalyTest?.enemies.boss.count ?? 0) > 0)
    return "boss";
  return undefined;
}

function plannedSkills(
  w: World,
  e: Enemy,
  id: EnemyReportId,
): readonly AnomalySkillId[] {
  const setting = settingFor(w, e);
  if (!setting) return [];
  const source =
    setting.action === "sequence"
      ? setting.sequence?.length
        ? setting.sequence
        : ANOMALY_SKILLS[id].map((entry) => entry.id)
      : setting.action === "repeat" && setting.skill
        ? [setting.skill]
        : [];
  if (!setting.stance) return source;
  const filtered = source.filter(
    (skillId) => anomalySkillForReport(id, skillId)?.stance === setting.stance,
  );
  return filtered.length ? filtered : source;
}

export function resetAnomalyTestAi(w: World, e: Enemy) {
  if (w.anomalyTest?.ai) delete w.anomalyTest.ai[e.id];
}

export function anomalyTestAction(w: World, e: Enemy) {
  return settingFor(w, e)?.action;
}

export function anomalyTestStance(w: World, e: Enemy) {
  return settingFor(w, e)?.stance;
}

export function anomalyTestDesiredSkill(w: World, e: Enemy) {
  const setting = settingFor(w, e);
  if (!setting || (setting.action !== "sequence" && setting.action !== "repeat"))
    return undefined;
  const state = aiState(w, e);
  if (state.activeSkill) return state.activeSkill;
  const id = anomalyTestEnemyId(w, e);
  if (!id) return undefined;
  const skills = plannedSkills(w, e, id);
  if (!skills.length) return undefined;
  return skills[state.cursor % skills.length];
}

export function anomalyTestArmSkill(w: World, e: Enemy) {
  const state = aiState(w, e);
  const chosen = anomalyTestDesiredSkill(w, e);
  if (!chosen || state.armedAt !== undefined) return false;
  state.armedAt = w.time;
  return true;
}

export function anomalyTestSkillArmed(w: World, e: Enemy) {
  return w.anomalyTest?.ai?.[e.id]?.armedAt !== undefined;
}

export function anomalyTestDisarmSkill(w: World, e: Enemy) {
  aiState(w, e).armedAt = undefined;
}

export function anomalyTestBeginSkill(w: World, e: Enemy, skill?: AnomalySkillId) {
  const state = aiState(w, e);
  const chosen = skill ?? anomalyTestDesiredSkill(w, e);
  if (!chosen || state.activeSkill) return false;
  state.activeSkill = chosen;
  state.activeAt = w.time;
  state.stage = undefined;
  state.progress = 0;
  state.armedAt = undefined;
  return true;
}

export function anomalyTestCompleteSkill(
  w: World,
  e: Enemy,
  skill?: AnomalySkillId,
) {
  const state = aiState(w, e);
  if (!state.activeSkill || (skill && state.activeSkill !== skill)) return false;
  const id = enemyReportId(e);
  if (id && settingFor(w, e)?.action === "sequence") {
    const skills = plannedSkills(w, e, id);
    if (skills.length) state.cursor = (state.cursor + 1) % skills.length;
  }
  state.activeSkill = undefined;
  state.activeAt = 0;
  state.stage = undefined;
  state.progress = 0;
  state.armedAt = undefined;
  return true;
}

export function anomalyTestActiveSkill(w: World, e: Enemy) {
  return aiState(w, e).activeSkill;
}

export function anomalyTestActiveAge(w: World, e: Enemy) {
  const state = aiState(w, e);
  return state.activeSkill ? Math.max(0, w.time - state.activeAt) : 0;
}

export function anomalyTestStage(w: World, e: Enemy) {
  return aiState(w, e).stage;
}

export function setAnomalyTestStage(w: World, e: Enemy, stage?: string) {
  aiState(w, e).stage = stage;
}

export function anomalyTestProgress(w: World, e: Enemy) {
  return aiState(w, e).progress ?? 0;
}

export function setAnomalyTestProgress(w: World, e: Enemy, progress: number) {
  aiState(w, e).progress = progress;
}

export function anomalyTestMovement(w: World, e: Enemy) {
  const action = settingFor(w, e)?.action;
  return action === "follow" || action === "orbit" ? action : undefined;
}

export function anomalyTestMoveTarget(w: World, e: Enemy, target: Player): Player {
  if (anomalyTestMovement(w, e) !== "orbit") return target;
  const direction = e.id % 2 ? 1 : -1;
  const radius = 9 + (e.id % 4) * 2;
  const angle = w.time * 0.4 * direction + e.id * 2.399963229728653;
  return {
    ...target,
    x: target.x + Math.cos(angle) * radius,
    z: target.z + Math.sin(angle) * radius,
  };
}
