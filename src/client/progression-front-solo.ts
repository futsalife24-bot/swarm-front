import type { World } from "../shared/game";
import { enemyReportId } from "../shared/enemy-identity";
import { loadProgress, persistProgress } from "./progression-save";

type ProgressStorage = Pick<Storage, "getItem" | "setItem">;

export function recordFrontSoloEncounters(
  world: World,
  storage: ProgressStorage,
): string[] {
  if (world.phase !== "battle") return [];
  try {
    const save = loadProgress("normal", storage);
    if (!save) return [];
    const next = structuredClone(save);
    const recorded: string[] = [];
    for (const enemy of world.enemies) {
      const key = enemyReportId(enemy);
      if (!key || next.encounters[key] === "solo") continue;
      next.encounters[key] = "solo";
      recorded.push(key);
    }
    if (recorded.length) persistProgress(next, storage);
    return recorded;
  } catch {
    return [];
  }
}
