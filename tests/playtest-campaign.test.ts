import { expect, it } from "vitest";
import {
  BRANCH_3,
  BRANCH_15,
  SOLO_STAGE_IDS,
  campaignNumber,
  normalSaveId,
} from "../src/shared/campaign";
import {
  freshProgress,
  canSortie,
  validateProgress,
  grantResult,
  persistProgress,
} from "../src/client/progression-save";
import { recoverUnsavedResult } from "../src/client/save-recovery";
import { stageLabel, victoryCoins } from "../src/shared/progression";
import {
  defenseStage,
  beginDefense,
  settleDefense,
} from "../src/shared/daily-rewards";
import { stageFor, STAGES, mapFor, MAPS } from "../src/shared/stages";
import { createWorld, addPlayer, start } from "../src/shared/game";
import { initSolo } from "../src/shared/solo-progression";
import {
  readBattleCheckpoint,
  writeBattleCheckpoint,
} from "../src/client/battle-checkpoint";

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
};

it("daily defense at ST21 keeps its world number and late-game reward tiers", () => {
  const save = freshProgress("normal");
  save.missions[`${normalSaveId(21)}:normal`] = [true, false, false];
  const run = "campaign-defense-21";
  const active = beginDefense(save, "2026-09-22", run, () => 0.5);
  expect(active.dailyDefense!.stage).toBe(21);
  const settled = settleDefense(active, run, "victory", 2000, 2000, () => 0.5);
  const rewards = settled.inventory.filter((w) => w.id.startsWith(run));
  expect(rewards.length).toBeGreaterThan(1);
  expect(rewards.every((w) => w.rarity === 2)).toBe(true);
  expect(validateProgress(settled)).toEqual(settled);
});

it("preserves legacy 3-A progress and unlocks new normal stages without treating it as ST21", () => {
  const save = freshProgress("normal");
  save.branch = true;
  save.missions["21:normal"] = [true, true, true];
  const old = JSON.stringify(save);
  expect(validateProgress(save)).toEqual(JSON.parse(old));
  expect(stageLabel(BRANCH_3)).toBe("3-A");
  expect(canSortie(save, normalSaveId(21), "normal")).toBe(false);
  expect(defenseStage(save)).toBe(1);
  save.missions["20:normal"] = [true, false, false];
  expect(canSortie(save, normalSaveId(21), "normal")).toBe(true);
  expect(canSortie(save, normalSaveId(22), "normal")).toBe(false);
  save.missions["22:normal"] = [true, false, false];
  expect(canSortie(save, normalSaveId(22), "normal")).toBe(true);
  expect(defenseStage(save)).toBe(21);
  expect(stageLabel(normalSaveId(25))).toBe("ST25");
  expect(new Set(SOLO_STAGE_IDS).size).toBe(27);
});

it("15-A unlocks independently after ST15 and uses its own HARROW roster, map, rewards and checkpoint", () => {
  const save = freshProgress("normal");
  expect(canSortie(save, BRANCH_15, "normal")).toBe(false);
  save.missions["15:normal"] = [true, false, false];
  expect(canSortie(save, BRANCH_15, "normal")).toBe(true);
  expect(canSortie(save, BRANCH_15, "medium")).toBe(false);
  expect(canSortie(save, 16, "normal")).toBe(true);
  const world = createWorld("branch-checkpoint", 17, campaignNumber(BRANCH_15));
  initSolo(world, BRANCH_15, "normal", false, save.soldiers[0].levels);
  addPlayer(world, "solo", save.inventory.slice(0, 2));
  start(world);
  expect(stageFor(world).waves.flatMap((w) => w.bosses)).toEqual(["harrow"]);
  expect(mapFor(world)).toBe(MAPS[3]);
  const store = storage();
  expect(writeBattleCheckpoint(world, save, store)).toBe(true);
  expect(stageFor(readBattleCheckpoint(save, store)!.world)).toEqual(
    stageFor(world),
  );
  expect(victoryCoins(BRANCH_15, "normal")).toBe(380);
  expect(
    STAGES.filter((s) => s.waves.some((w) => w.bosses.includes("harrow"))).map(
      (s) => s.id,
    ),
  ).toEqual([20, 25]);
});

it.each([normalSaveId(21), normalSaveId(25), BRANCH_15])(
  "recovers new stage %i rewards once and preserves progression cap",
  (stage) => {
    const base = freshProgress("normal");
    base.points = 120;
    const store = storage();
    persistProgress(base, store);
    const pending = grantResult(
      base,
      {
        run: `new-stage-${stage}`,
        stage,
        difficulty: "normal",
        win: true,
        time: 90,
        kills: 30,
        missions: [true, true, true],
        weapons: [],
        collected: 0,
      },
      () => 0.5,
    );
    const recovered = recoverUnsavedResult(base, pending, store);
    expect(recovered.coins).toBe(base.coins + victoryCoins(stage, "normal"));
    expect(recovered.points).toBe(120);
    expect(recovered.missions[`${stage}:normal`]).toEqual([true, true, true]);
    expect(recoverUnsavedResult(base, pending, store)).toEqual(recovered);
    expect(validateProgress(recovered)).toEqual(recovered);
  },
);
