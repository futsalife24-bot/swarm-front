import type { World } from "../shared/game";
import type { ProgressSave } from "./progression-save";
import { assertSaveWriter } from "./save-writer";
import { MAPS, stageFor, type StagePlan } from "../shared/stages";
import { legacyCampaignPlan } from "../shared/legacy-campaign";
import { migrateLegacyHarrowCheckpoint } from "./harrow-checkpoint-migration";

export const BATTLE_CHECKPOINT_KEY = "swarm-front-battle-checkpoint-v1";
const LIMIT = 2_000_000;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface BattleCheckpoint {
  version: 1 | 2 | 3;
  savedAt: number;
  progress: string;
  world: World;
}

// Detect accidental truncation/corruption, not cheating. Local saves are user-controlled.
function checksum(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
function finiteTree(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (value && typeof value === "object")
    return Object.values(value).every((v) => finiteTree(v, depth + 1));
  return true;
}
function validPlan(plan: StagePlan | undefined): plan is StagePlan {
  return (
    !!plan &&
    Number.isInteger(plan.id) &&
    plan.id > 0 &&
    Number.isInteger(plan.map) &&
    plan.map >= 0 &&
    plan.map < MAPS.length &&
    typeof plan.elevated === "boolean" &&
    typeof plan.name === "string" &&
    typeof plan.brief === "string" &&
    [plan.hp, plan.damage, plan.lootExponent].every(
      (n) => typeof n === "number" && n > 0,
    ) &&
    typeof plan.dropRate === "number" &&
    plan.dropRate >= 0 &&
    plan.dropRate <= 1 &&
    Array.isArray(plan.waves) &&
    plan.waves.length > 0 &&
    plan.waves.every(
      (w) =>
        !!w &&
        typeof w.interval === "number" &&
        w.interval > 0 &&
        Number.isInteger(w.guards) &&
        w.guards >= 0 &&
        Array.isArray(w.bosses) &&
        w.bosses.every((b) => ["crown", "worm", "harrow"].includes(b)) &&
        !!w.troops &&
        typeof w.troops === "object" &&
        !Array.isArray(w.troops) &&
        Object.entries(w.troops).every(
          ([kind, count]) =>
            ["crawler", "ant", "spider", "spitter", "hornet", "calyx"].includes(
              kind,
            ) &&
            Number.isInteger(count) &&
            count >= 0,
        ),
    )
  );
}
export function writeBattleCheckpoint(
  world: World,
  progress: ProgressSave,
  storage: Store = localStorage,
  now = Date.now(),
) {
  assertSaveWriter(storage);
  if (
    world.defense ||
    progress.mode !== "normal" ||
    world.solo?.test ||
    !world.solo ||
    world.phase !== "battle" ||
    world.players.length !== 1 ||
    world.players[0].hp <= 0 ||
    progress.receipts.includes(world.run)
  )
    return false;
  if (!finiteTree(world)) throw Error("戦闘の中断保存に不正な数値があります。");
  world.campaignPlan = JSON.parse(JSON.stringify(stageFor(world))) as StagePlan;
  const checkpoint: BattleCheckpoint = {
    version: 3,
    savedAt: now,
    progress: JSON.stringify(progress),
    world,
  };
  const body = JSON.stringify(checkpoint);
  if (body.length > LIMIT) throw Error("戦闘の中断保存が上限を超えました。");
  storage.setItem(
    BATTLE_CHECKPOINT_KEY,
    JSON.stringify({ body, checksum: checksum(body) }),
  );
  return true;
}

export function readBattleCheckpoint(
  progress: ProgressSave,
  storage: Store = localStorage,
): BattleCheckpoint | null {
  const raw = storage.getItem(BATTLE_CHECKPOINT_KEY);
  if (!raw || progress.mode !== "normal") return null;
  if (raw.length > LIMIT * 2) throw Error("中断保存を読めません。");
  const envelope = JSON.parse(raw);
  if (
    typeof envelope?.body !== "string" ||
    checksum(envelope.body) !== envelope.checksum
  )
    throw Error("中断保存が破損しています。通常の進行保存は保持しています。");
  const value = JSON.parse(envelope.body) as BattleCheckpoint;
  const w = value.world;
  if (
    (value.version !== 1 && value.version !== 2 && value.version !== 3) ||
    w?.defense ||
    !w?.solo ||
    w.solo.test ||
    w.phase !== "battle" ||
    !Array.isArray(w.players) ||
    w.players.length !== 1 ||
    w.players[0].id !== "solo" ||
    w.players[0].hp <= 0 ||
    !Number.isFinite(value.savedAt) ||
    !finiteTree(w)
  )
    throw Error(
      "この中断保存には対応していません。通常の進行保存は保持しています。",
    );
  // Any progress update (including a claimed result or cloud restore) invalidates replay.
  if (
    value.progress !== JSON.stringify(progress) ||
    progress.receipts.includes(w.run)
  )
    return null;
  // v1 has no pinned roster. Restore the exact pre-expansion plan, including map
  // and difficulty multipliers, before any combat step can inspect its wave.
  if (value.version === 1 && !w.campaignPlan)
    w.campaignPlan = legacyCampaignPlan(w);
  if (
    !validPlan(w.campaignPlan) ||
    !Number.isInteger(w.wave) ||
    w.wave < 1 ||
    w.wave > w.campaignPlan.waves.length
  )
    throw Error(
      "この中断保存の編成を復元できません。通常の進行保存は保持しています。",
    );
  if (value.version < 3) {
    migrateLegacyHarrowCheckpoint(w);
    value.version = 3;
  }
  return value;
}
export function clearBattleCheckpoint(storage: Store = localStorage) {
  assertSaveWriter(storage);
  storage.removeItem(BATTLE_CHECKPOINT_KEY);
}
