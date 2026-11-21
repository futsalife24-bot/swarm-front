import { highestClearedStage } from "./front-campaign";
import type { ProgressSave } from "./progression-save";

export const UNLOCK_ENTRIES = [
  "solo",
  "coop",
  "base",
  "enemyReport",
  "supplyBox",
  "weekly",
  "dailyDefense",
  "tutorial",
  "tutorialWeaponUpgradeGuide",
  "settings",
  "settingsDeveloper",
  "sortiePrep",
  "title",
  "weapons",
  "buddy",
  "supply",
  "growth",
  "accessories",
  "survivalCards",
  "workshop",
  "weaponWorkshopButton",
] as const;
export type UnlockEntry = (typeof UNLOCK_ENTRIES)[number];

export const UNLOCK_ALIASES = {
  navBase: "base",
  navWeaponList: "weapons",
  navSupply: "supply",
  navWorkshop: "workshop",
  navEnemyReport: "enemyReport",
  navSettings: "settings",
  navSortiePrep: "sortiePrep",
  navTitle: "title",
  urlBase: "base",
  urlMenuBase: "base",
  urlMenuWeapons: "weapons",
  urlMenuSupply: "supply",
  urlMenuWorkshop: "workshop",
  urlMenuEnemyReport: "enemyReport",
  urlMenuSettings: "settings",
  urlMenuWeekly: "weekly",
  urlMenuDailyDefense: "dailyDefense",
} as const;

export interface UnlockContext {
  developerMode?: boolean;
  mode?: string;
}
export interface UnlockFlags {
  readonly seen?: readonly string[];
}
export interface UnlockEntryState {
  open: boolean;
  reason: string;
}
export interface UnlockState {
  stage: number;
  entries: Record<UnlockEntry, UnlockEntryState>;
  aliases: typeof UNLOCK_ALIASES;
}

type FlagInput = UnlockFlags | readonly string[] | null | undefined;

const STAGE_REQUIREMENTS: Record<UnlockEntry, number> = {
  solo: 0,
  coop: 0,
  base: 1,
  enemyReport: 1,
  supplyBox: 0,
  weekly: 2,
  dailyDefense: 3,
  tutorial: 0,
  tutorialWeaponUpgradeGuide: 3,
  settings: 0,
  settingsDeveloper: 3,
  sortiePrep: 0,
  title: 0,
  weapons: 1,
  buddy: 1,
  supply: 1,
  growth: 2,
  accessories: 3,
  survivalCards: 3,
  workshop: 3,
  weaponWorkshopButton: 3,
};

const CLOSED_REASONS: Record<UnlockEntry, string> = {
  solo: "",
  coop: "",
  base: "ST1 前哨掃討のクリアで開きます",
  enemyReport: "敵と遭遇すると記録が始まります",
  supplyBox: "",
  weekly: "ST2 のクリアで開きます",
  dailyDefense: "ST3 のクリアで開きます",
  tutorial: "",
  tutorialWeaponUpgradeGuide: "ST3 のクリアで開きます",
  settings: "",
  settingsDeveloper: "ST3 のクリアで開きます",
  sortiePrep: "",
  title: "",
  weapons: "ST1 前哨掃討のクリアで開きます",
  buddy: "ST1 前哨掃討のクリアで開きます",
  supply: "ST1 前哨掃討のクリアで開きます",
  growth: "ST2 のクリアで開きます",
  accessories: "ST3 のクリアで開きます",
  survivalCards: "ST3 のクリアで開きます",
  workshop: "ST3 のクリアで開きます",
  weaponWorkshopButton: "ST3 のクリアで開きます",
};

const ALWAYS_OPEN = new Set<UnlockEntry>([
  "solo",
  "coop",
  "supplyBox",
  "tutorial",
  "settings",
  "sortiePrep",
  "title",
]);

function recordedSeen(flags: FlagInput): readonly string[] {
  if (Array.isArray(flags)) return flags as readonly string[];
  return (flags as UnlockFlags | null | undefined)?.seen ?? [];
}

function recordedStage(seen: readonly string[]) {
  for (const stage of [3, 2, 1]) {
    if (seen.includes(`ftue:unlock:${stage}`)) return stage;
  }
  return 0;
}

export function unlockState(
  save: ProgressSave | null,
  flags: FlagInput,
  context: UnlockContext = {},
): UnlockState {
  const seen = recordedSeen(flags);
  const allOpen =
    !!context.developerMode ||
    context.mode === "test" ||
    save?.mode === "test" ||
    seen.includes("ftue:unlock:all");
  const stage = Math.min(
    3,
    Math.max(highestClearedStage(save), recordedStage(seen)),
  );
  const pending = (save?.pending?.length ?? 0) > 0;
  const growthUsed =
    (save?.unlocked?.length ?? 0) > 0 ||
    (save?.soldiers?.length ?? 0) >= 2 ||
    (save?.points ?? 0) > 0 ||
    (save?.soldiers ?? []).some((soldier) =>
      Object.values(soldier.levels ?? {}).some((level) => level > 0),
    );
  const workshopOpen = allOpen || stage >= STAGE_REQUIREMENTS.workshop;

  const usage: Partial<Record<UnlockEntry, boolean>> = {
    enemyReport: Object.keys(save?.encounters ?? {}).length > 0,
    buddy: save?.buddies?.starterChosen === true,
    supply: (save?.receipts ?? []).some((receipt) =>
      receipt.startsWith("supply:"),
    ),
    growth: growthUsed,
    accessories: (save?.accessories?.length ?? 0) > 0,
    survivalCards: (save?.survival?.runs ?? 0) >= 1,
    weekly: (save?.weekly?.claimed?.length ?? 0) > 0,
    dailyDefense: !!save?.dailyDefense,
    weapons: pending,
    tutorialWeaponUpgradeGuide: workshopOpen,
    weaponWorkshopButton: workshopOpen,
  };
  const baseChildUsage = (
    ["weapons", "buddy", "supply", "growth", "accessories", "survivalCards"] as const
  ).some((entry) => usage[entry] === true);

  const entries = {} as Record<UnlockEntry, UnlockEntryState>;
  for (const entry of UNLOCK_ENTRIES) {
    let open =
      allOpen ||
      ALWAYS_OPEN.has(entry) ||
      stage >= STAGE_REQUIREMENTS[entry] ||
      usage[entry] === true;
    if (entry === "base" && (pending || baseChildUsage)) open = true;
    entries[entry] = {
      open,
      reason: open ? "" : CLOSED_REASONS[entry],
    };
  }
  return { stage, entries, aliases: UNLOCK_ALIASES };
}