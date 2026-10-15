import { openBestiary } from "./bestiary";
import { loadProgress } from "./progression-save";

/** Title access follows the saved solo/co-op encounter record, including distinct boss forms. */
export function openFrontBestiary(
  storage: Pick<Storage, "getItem">,
  voiceVolume: number,
) {
  let encounters: Record<string, "solo" | "coop"> = {};
  try {
    // Reading the report must not migrate or overwrite an invalid save.
    encounters =
      loadProgress("normal", { getItem: (key) => storage.getItem(key) })
        ?.encounters ?? {};
  } catch {
    // A missing or invalid record leaves every report locked.
  }
  openBestiary({ encounters, voiceVolume });
}
