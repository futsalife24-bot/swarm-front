import type { World } from "../shared/game";
import { loadProgress, persistProgress } from "./progression-save";
// The limited co-op exception records silhouettes only; no new combat or loot
// settings are transmitted to the legacy authoritative server.
export function recordCoopEncounters(w: World) {
  if (w.phase !== "battle") return;
  const s = loadProgress("normal");
  if (!s) return;
  let changed = false;
  for (const e of w.enemies) {
    const key = e.segments ? "worm" : e.kind;
    if (!s.encounters[key]) {
      s.encounters[key] = "coop";
      changed = true;
    }
  }
  if (changed) persistProgress(s);
}
