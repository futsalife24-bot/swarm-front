import type { EnemyReportId } from "./enemy-identity";

export const ANOMALY_MAX_TOTAL = 120;
export const ANOMALY_MAX_BOSS = 3;
export const ANOMALY_BOSS_IDS = ["harrow", "boss", "worm"] as const;
export type AnomalyBossId = (typeof ANOMALY_BOSS_IDS)[number];

export type AnomalyTestMode = "observe" | "live";
export type AnomalyTestDifficulty = "normal" | "hard";
export type AnomalyTestLoadout = "standard" | "armory";
export type AnomalyStageId = number | "3-A" | "15-A";
export type AnomalyTestAction =
  | "free"
  | "wait"
  | "follow"
  | "orbit"
  | "sequence"
  | "repeat";
export type AnomalyTestStance = "ground" | "air";

export type AnomalySkillId =
  | "pleat-strike"
  | "volley"
  | "leaper-jump"
  | "prism-shot"
  | "ray-shot"
  | "bastion-guard"
  | "bastion-brace"
  | "bastion-warn"
  | "bastion-open"
  | "bastion-shot"
  | "calyx-slam"
  | "pollen-shot"
  | "foundry-burst"
  | "worm-laser"
  | "omega"
  | "harrow-spin"
  | "harrow-dash"
  | "harrow-snipe"
  | "harrow-ground-missile"
  | "harrow-air-missile"
  | "harrow-bomb"
  | "harrow-dive";

export interface AnomalySkill {
  id: AnomalySkillId;
  label: string;
  stance?: AnomalyTestStance;
}

const skill = (
  id: AnomalySkillId,
  label: string,
  stance?: AnomalyTestStance,
): AnomalySkill => ({ id, label, stance });

export const ANOMALY_SKILLS: Record<EnemyReportId, readonly AnomalySkill[]> = {
  crawler: [skill("pleat-strike", "突撃")],
  ant: [skill("volley", "散布射撃")],
  spider: [skill("leaper-jump", "跳躍突撃")],
  spitter: [skill("prism-shot", "エネルギー弾")],
  hornet: [skill("ray-shot", "翼射撃")],
  bastion: [
    skill("bastion-guard", "速射耐性"),
    skill("bastion-brace", "装甲強化"),
    skill("bastion-warn", "射撃警戒"),
    skill("bastion-open", "装甲解除"),
    skill("bastion-shot", "照準射撃"),
  ],
  calyx: [skill("calyx-slam", "地面衝撃"), skill("pollen-shot", "花粉弾")],
  boss: [skill("foundry-burst", "炉心バースト")],
  worm: [skill("worm-laser", "胴節レーザー"), skill("omega", "Ω攻撃")],
  harrow: [
    skill("harrow-spin", "地上回転", "ground"),
    skill("harrow-dash", "突進", "ground"),
    skill("harrow-snipe", "狙撃", "ground"),
    skill("harrow-ground-missile", "地上ミサイル", "ground"),
    skill("harrow-air-missile", "空中ミサイル", "air"),
    skill("harrow-bomb", "爆撃", "air"),
    skill("harrow-dive", "急降下", "air"),
  ],
};

export const ANOMALY_ACTION_NAMES: Record<AnomalyTestAction, string> = {
  free: "自由",
  wait: "待機",
  follow: "移動のみ・追従",
  orbit: "移動のみ・周回",
  sequence: "攻撃を順番に反復",
  repeat: "指定した技を反復",
};

export const ANOMALY_STAGE_LABELS: Record<AnomalyStageId, string> = {
  ...Object.fromEntries(
    Array.from({ length: 25 }, (_, index) => [index + 1, `ST${index + 1}`]),
  ),
  "3-A": "3-A",
  "15-A": "15-A",
} as Record<AnomalyStageId, string>;

export function anomalyStageIds(): AnomalyStageId[] {
  return [
    ...Array.from({ length: 25 }, (_, index) => index + 1 as AnomalyStageId),
    "3-A",
    "15-A",
  ];
}

export function validAnomalyStage(stage: unknown): stage is AnomalyStageId {
  return (
    (typeof stage === "number" &&
      Number.isInteger(stage) &&
      stage >= 1 &&
      stage <= 25) ||
    stage === "3-A" ||
    stage === "15-A"
  );
}

export function anomalyStageInternal(stage: AnomalyStageId): {
  stage: number;
  soloStage: number;
} {
  if (stage === "3-A") return { stage: 3, soloStage: 21 };
  if (stage === "15-A") return { stage: 15, soloStage: 27 };
  return { stage, soloStage: stage };
}

export function anomalySkillsFor(
  id: EnemyReportId,
  stance?: AnomalyTestStance,
): readonly AnomalySkill[] {
  const entries = ANOMALY_SKILLS[id];
  return stance ? entries.filter((entry) => entry.stance === stance) : entries;
}

export function anomalySkillLabel(id: AnomalySkillId): string {
  for (const entries of Object.values(ANOMALY_SKILLS)) {
    const found = entries.find((entry) => entry.id === id);
    if (found) return found.label;
  }
  return id;
}

export function anomalySkillForReport(
  id: EnemyReportId,
  skillId: AnomalySkillId,
): AnomalySkill | undefined {
  return ANOMALY_SKILLS[id].find((entry) => entry.id === skillId);
}
