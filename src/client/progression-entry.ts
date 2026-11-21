import { SAVE_KEY } from "./save";
import { legacyProgressKey } from "./progression-save";

export function hasLegacyProgress(
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return (
    storage.getItem(legacyProgressKey) !== null ||
    storage.getItem(SAVE_KEY) !== null
  );
}

export function shouldConfirmProgression(
  screen: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): boolean {
  return screen === "intro" && hasLegacyProgress(storage);
}
