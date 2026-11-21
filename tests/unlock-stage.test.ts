import { describe, expect, it } from "vitest";
import {
  UNLOCK_ALIASES,
  UNLOCK_ENTRIES,
  unlockState,
  type UnlockEntry,
} from "../src/client/unlock-stage";
import type { MenuDestination } from "../src/client/menu-navigation";
import {
  baseCardView,
  campaignMenuUnlocked,
} from "../src/client/unlock-wiring";
import { freshProgress, type ProgressSave } from "../src/client/progression-save";
import { freshBuddyProgress } from "../src/shared/buddy-progression";
import { OPERATION_KEYS } from "../src/client/tutorial-flags";

const noFlags = { seen: [] as string[] };
const isOpen = (
  state: ReturnType<typeof unlockState>,
  entry: UnlockEntry,
) => state.entries[entry].open;

function saveAtStage(stage: number, mode: "normal" | "test" = "normal") {
  const save = freshProgress(mode);
  for (let index = 1; index <= stage; index += 1)
    save.missions[`${index}:normal`] = [true, false, false];
  return save;
}

const requiredStage: Record<UnlockEntry, number> = {
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

describe("unlockState (C-7 U0)", () => {
  it("matches every entry in the stage table for S0 through S3", () => {
    for (const stage of [0, 1, 2, 3]) {
      const state = unlockState(saveAtStage(stage), noFlags);
      expect(state.stage, `S${stage}`).toBe(stage);
      for (const entry of UNLOCK_ENTRIES) {
        expect(isOpen(state, entry), `${entry}@S${stage}`).toBe(
          stage >= requiredStage[entry],
        );
      }
    }
  });

  it("returns a reason for each closed entry and none for open entries", () => {
    const state = unlockState(saveAtStage(0), noFlags);
    for (const entry of UNLOCK_ENTRIES) {
      const result = state.entries[entry];
      expect(result.reason.length > 0, entry).toBe(!result.open);
    }
    expect(state.entries.base.reason).toBe(
      "ST1 前哨掃討のクリアで開きます",
    );
    expect(state.entries.growth.reason).toBe("ST2 のクリアで開きます");
    expect(state.entries.enemyReport.reason).toBe(
      "敵と遭遇すると記録が始まります",
    );
  });

  it("opens entries early when their usage record exists", () => {
    const cases: {
      entry: UnlockEntry;
      apply: (save: ProgressSave) => void;
    }[] = [
      {
        entry: "enemyReport",
        apply: (save) => void (save.encounters = { hound: "solo" }),
      },
      {
        entry: "buddy",
        apply: (save) => {
          save.buddies = freshBuddyProgress();
          save.buddies.starterChosen = true;
        },
      },
      {
        entry: "supply",
        apply: (save) => void save.receipts.push("supply:first10"),
      },
      { entry: "growth", apply: (save) => void (save.points = 1) },
      {
        entry: "accessories",
        apply: (save) =>
          void (save.accessories = [
            {
              id: "a",
              kind: "pickup",
              rarity: 1,
              locked: false,
              testData: false,
            },
          ]),
      },
      {
        entry: "survivalCards",
        apply: (save) =>
          void (save.survival = {
            bestSeconds: 0,
            bestKills: 0,
            runs: 1,
            weapons: 0,
            highestClearedStage: 0,
          }),
      },
      {
        entry: "weekly",
        apply: (save) =>
          void (save.weekly = {
            week: "2026-W48",
            campaign: [],
            defense: [],
            claimed: ["m1"],
          }),
      },
      {
        entry: "dailyDefense",
        apply: (save) =>
          void (save.dailyDefense = {
            day: "2026-11-21",
            run: "r",
            stage: 1,
            state: "active",
            collected: [],
            bonus: 0,
          }),
      },
    ];
    for (const testCase of cases) {
      const save = saveAtStage(0);
      testCase.apply(save);
      const state = unlockState(save, noFlags);
      expect(isOpen(state, testCase.entry), testCase.entry).toBe(true);
      for (const late of [
        "dailyDefense",
        "accessories",
        "survivalCards",
        "workshop",
      ] as const) {
        if (late !== testCase.entry)
          expect(isOpen(state, late), `${testCase.entry}/${late}`).toBe(false);
      }
    }
  });

  it("opens the home base when a base child has a usage record", () => {
    const save = saveAtStage(0);
    save.buddies = freshBuddyProgress();
    save.buddies.starterChosen = true;
    const state = unlockState(save, noFlags);
    expect(isOpen(state, "base")).toBe(true);
    expect(isOpen(state, "buddy")).toBe(true);
    expect(isOpen(state, "accessories")).toBe(false);
  });

  it("keeps the pending-weapon safety valve at S0", () => {
    const save = saveAtStage(0);
    save.pending = [save.inventory[0]];
    const state = unlockState(save, noFlags);
    expect(isOpen(state, "base")).toBe(true);
    expect(isOpen(state, "weapons")).toBe(true);
    expect(isOpen(state, "growth")).toBe(false);
    expect(isOpen(state, "buddy")).toBe(false);
  });

  it("opens everything for developer mode, test saves and the all-unlock flag", () => {
    const states = [
      unlockState(saveAtStage(0), noFlags, { developerMode: true }),
      unlockState(saveAtStage(0, "test"), noFlags),
      unlockState(saveAtStage(0), { seen: ["ftue:unlock:all"] }),
    ];
    for (const state of states) {
      for (const entry of UNLOCK_ENTRIES)
        expect(isOpen(state, entry), entry).toBe(true);
    }
  });

  it("treats a missing save and an empty save as S0", () => {
    for (const save of [null, saveAtStage(0)]) {
      const state = unlockState(save, noFlags);
      expect(state.stage).toBe(0);
      expect(isOpen(state, "solo")).toBe(true);
      expect(isOpen(state, "base")).toBe(false);
      expect(isOpen(state, "weapons")).toBe(false);
    }
  });

  it("never re-locks entries when the saved stage falls below the device record", () => {
    const olderSave = saveAtStage(0);
    const state = unlockState(olderSave, {
      seen: ["ftue:unlock:1", "ftue:unlock:2"],
    });
    expect(state.stage).toBe(2);
    expect(isOpen(state, "base")).toBe(true);
    expect(isOpen(state, "weekly")).toBe(true);
    expect(isOpen(state, "growth")).toBe(true);
    expect(isOpen(state, "dailyDefense")).toBe(false);
    const allOpen = unlockState(olderSave, { seen: ["ftue:unlock:3"] });
    for (const entry of UNLOCK_ENTRIES)
      expect(isOpen(allOpen, entry), entry).toBe(true);
  });

  it("does not use operation flags for the stage", () => {
    const state = unlockState(saveAtStage(0), {
      seen: OPERATION_KEYS.map((key) => `op:${key}`),
    });
    expect(isOpen(state, "base")).toBe(false);
    expect(isOpen(state, "weapons")).toBe(false);
    expect(isOpen(state, "growth")).toBe(false);
    expect(isOpen(state, "solo")).toBe(true);
  });

  it("maps common navigation and URL destinations onto the same entries", () => {
    const state = unlockState(saveAtStage(2), noFlags);
    for (const [alias, entry] of Object.entries(UNLOCK_ALIASES)) {
      expect(UNLOCK_ENTRIES, alias).toContain(entry);
    }
    expect(UNLOCK_ALIASES.navBase).toBe("base");
    expect(UNLOCK_ALIASES.urlBase).toBe("base");
    expect(UNLOCK_ALIASES.navWorkshop).toBe("workshop");
    expect(UNLOCK_ALIASES.urlMenuEnemyReport).toBe("enemyReport");
    expect(state.entries[UNLOCK_ALIASES.navBase]).toEqual(state.entries.base);
    expect(state.entries[UNLOCK_ALIASES.urlBase]).toEqual(state.entries.base);
    expect(isOpen(state, UNLOCK_ALIASES.navBase)).toBe(true);
    expect(isOpen(state, UNLOCK_ALIASES.navWorkshop)).toBe(false);
  });

  it("has no side effects on the save or flags", () => {
    const save = saveAtStage(1);
    const flags = Object.freeze({
      seen: Object.freeze(["ftue:unlock:2"]),
    });
    const beforeSave = JSON.stringify(save);
    const beforeFlags = JSON.stringify(flags);
    const first = unlockState(save, flags);
    const second = unlockState(save, flags);
    expect(first).toEqual(second);
    expect(JSON.stringify(save)).toBe(beforeSave);
    expect(JSON.stringify(flags)).toBe(beforeFlags);
  });
});

describe("C-7 U2 wiring", () => {
  it("gates common navigation through the matching U0 entries", () => {
    const expected: Record<MenuDestination, (stage: number) => boolean> = {
      base: (stage) => stage >= 1,
      gear: () => true,
      armory: (stage) => stage >= 1,
      workshop: (stage) => stage >= 3,
      supply: (stage) => stage >= 1,
      report: (stage) => stage >= 1,
      settings: () => true,
      title: () => true,
    };
    for (const stage of [0, 1, 2, 3]) {
      const state = unlockState(saveAtStage(stage), noFlags);
      for (const [destination, open] of Object.entries(expected)) {
        expect(
          campaignMenuUnlocked(destination as MenuDestination, state),
          `${destination}@S${stage}`,
        ).toBe(open(stage));
      }
    }
  });

  it("shows F8 status text only on open base cards", () => {
    const s0 = unlockState(saveAtStage(0), noFlags);
    expect(baseCardView(s0, "weapons", "3丁を所持")).toEqual({
      disabled: true,
      ariaDisabled: true,
      status: "ST1 前哨掃討のクリアで開きます",
    });
    expect(baseCardView(s0, "growth", "兵士ごとの成長を管理").status).toBe(
      "ST2 のクリアで開きます",
    );
    const s1 = unlockState(saveAtStage(1), noFlags);
    expect(baseCardView(s1, "weapons", "3丁を所持")).toEqual({
      disabled: false,
      ariaDisabled: false,
      status: "3丁を所持",
    });
    expect(baseCardView(s1, "growth", "兵士ごとの成長を管理").status).toBe(
      "ST2 のクリアで開きます",
    );
    const s3 = unlockState(saveAtStage(3), noFlags);
    for (const entry of [
      "weapons",
      "accessories",
      "growth",
      "buddy",
      "supply",
      "survivalCards",
      "workshop",
    ] as const)
      expect(baseCardView(s3, entry, "現在の状態").status).toBe("現在の状態");
  });

  it("keeps mode-disabled cards disabled without a lock announcement", () => {
    const state = unlockState(
      saveAtStage(3, "test"),
      noFlags,
      { mode: "test" },
    );
    expect(baseCardView(state, "supply", "通常プレイで利用できます", true)).toEqual(
      {
        disabled: true,
        ariaDisabled: false,
        status: "通常プレイで利用できます",
      },
    );
    expect(baseCardView(state, "workshop", "通常プレイで利用できます", true)).toEqual(
      {
        disabled: true,
        ariaDisabled: false,
        status: "通常プレイで利用できます",
      },
    );
  });

  it("wires the pending-weapon safety valve into navigation and cards", () => {
    const save = saveAtStage(0);
    save.pending = [save.inventory[0]];
    const state = unlockState(save, noFlags);
    expect(campaignMenuUnlocked("base", state)).toBe(true);
    expect(campaignMenuUnlocked("armory", state)).toBe(true);
    expect(baseCardView(state, "weapons", "整理待ち 1丁").disabled).toBe(false);
    expect(baseCardView(state, "weapons", "整理待ち 1丁").status).toBe(
      "整理待ち 1丁",
    );
    expect(campaignMenuUnlocked("workshop", state)).toBe(false);
  });
});
