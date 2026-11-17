import { campaignNumber, normalSaveId } from "./campaign";
import { rarityWeights, varianceWeights, type Difficulty } from "./progression";

/** A one-line preview after first clearing a main campaign stage. */
export function nextStageDropChange(
  stage: number,
  difficulty: Difficulty,
): string | null {
  const current = campaignNumber(stage);
  if (current >= 25) return null;
  const before = rarityWeights(normalSaveId(current), difficulty);
  const after = rarityWeights(normalSaveId(current + 1), difficulty);
  const labels = ["N", "R", "SR", "SSR", "LR"];
  const changed = labels
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => Math.abs(after[i] - before[i]) > 1e-9)
    .map(
      ({ name, i }) =>
        `${name} ${(before[i] * 100).toFixed(1)}%→${(after[i] * 100).toFixed(1)}%`,
    )
    .join("、");
  const high = (at: number) => {
    const weights = varianceWeights(normalSaveId(at));
    return ((weights[3] + weights[4]) * 100).toFixed(1);
  };
  return `ST${current + 1}から：${changed}、高水準ロール率 ${high(current)}%→${high(current + 1)}%`;
}
