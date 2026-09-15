import { STAGES } from "../shared/stages";
import { missionKey, stageLabel } from "../shared/progression";
import type { ProgressSave } from "./progression-save";

function unlocked(save: ProgressSave, stage: number) {
  return (
    save.mode === "test" ||
    (stage === 21
      ? save.branch
      : stage === 1 || !!save.missions[missionKey(stage - 1, "normal")]?.[0])
  );
}

export function stagePickerLabel(save: ProgressSave, stage: number) {
  return `${stageLabel(stage)} ${
    unlocked(save, stage)
      ? stage === 21
        ? "街区奥部の調査"
        : STAGES[stage - 1].name
      : "？？？"
  }`;
}

export function renderStageOption(
  save: ProgressSave,
  option: HTMLOptionElement,
  button: HTMLButtonElement,
) {
  const stage = Number(option.value);
  const name = document.createElement("span");
  name.className = "stage-picker-name";
  name.textContent = stagePickerLabel(save, stage);
  button.replaceChildren(name);
  const progress = document.createElement("span");
  progress.className = "stage-picker-progress";
  for (const [label, difficulty] of [
    ["NORMAL", "normal"],
    ["HARD", "medium"],
    ["EXPERT", null],
  ] as const) {
    const available =
      difficulty !== null &&
      (difficulty === "normal"
        ? unlocked(save, stage)
        : save.mode === "test" ||
          !!save.missions[missionKey(stage, "normal")]?.[0]);
    const missions = difficulty
      ? (save.missions[missionKey(stage, difficulty)] ?? [])
      : [];
    const column = document.createElement("span");
    column.className = `stage-picker-difficulty${available ? "" : " is-locked"}`;
    column.setAttribute(
      "aria-label",
      `${label} ${available ? missions.filter(Boolean).length + "/3達成" : "未解放"}`,
    );
    const title = document.createElement("span");
    title.textContent = label;
    column.append(title);
    const stars = document.createElement("span");
    stars.className = "stage-picker-stars";
    stars.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
      const star = document.createElement("span");
      star.textContent = "★";
      if (available && missions[i]) star.className = "is-achieved";
      stars.append(star);
    }
    column.append(stars);
    progress.append(column);
  }
  button.append(progress);
}
