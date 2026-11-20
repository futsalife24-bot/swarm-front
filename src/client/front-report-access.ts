import { openBestiary } from "./bestiary";
import { highestClearedStage } from "./front-campaign";
import { loadProgress } from "./progression-save";
import type { ReportVoice } from "./report-identification";

/** Title access follows the saved solo/co-op encounter record, including distinct boss forms. */
export function openFrontBestiary(
  storage: Pick<Storage, "getItem">,
  voiceVolume: number,
  controlVoice?: ReportVoice,
) {
  let encounters: Record<string, "solo" | "coop"> = {};
  let clearedStages = 0;
  try {
    // Reading the report must not migrate or overwrite an invalid save.
    const save = loadProgress("normal", {
      getItem: (key) => storage.getItem(key),
    });
    encounters = save?.encounters ?? {};
    clearedStages = highestClearedStage(save);
  } catch {
    // A missing or invalid record leaves every report locked.
  }
  openBestiary({ encounters, clearedStages, voiceVolume, controlVoice });
}
