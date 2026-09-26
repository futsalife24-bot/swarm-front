import { describe, expect, it } from "vitest";
import { musicForBattle, musicForScreen } from "../src/client/bgm";
import { STAGES, HARROW_BRANCH } from "../src/shared/stages";

describe("map battle music", () => {
  it.each([
    [1, 0],
    [5, 1],
    [11, 2],
    [2, 3],
    [13, 4],
    [10, 5],
  ])(
    "plays the map of stage %i in solo and cooperative battles",
    (stage, map) => {
      expect(musicForScreen("battle", false, { stage })).toBe(`map-${map}`);
      expect(
        musicForBattle({ stage, solo: { stage, difficulty: "medium" } }),
      ).toBe(`map-${map}`);
    },
  );
  it("covers every campaign stage and elevated route", () => {
    for (const plan of [...STAGES, HARROW_BRANCH]) {
      expect(musicForBattle({ campaignPlan: plan })).toBe(`map-${plan.map}`);
    }
  });
  it("follows a saved active plan instead of a changed stage selection", () => {
    expect(musicForBattle({ stage: 1, campaignPlan: STAGES[9] })).toBe("map-5");
  });
  it("leaves training and an absent world silent", () => {
    expect(musicForBattle({ stage: 1, training: true })).toBeNull();
    expect(musicForBattle()).toBeNull();
    expect(musicForBattle(null)).toBeNull();
  });
  it("rejects an unknown map instead of requesting a missing asset", () => {
    expect(
      musicForBattle({ campaignPlan: { ...STAGES[0], map: 99 } }),
    ).toBeNull();
  });
  it("preserves menu, loading, clear and defeat routing", () => {
    const world = { stage: 13 };
    expect(musicForScreen("gear", false, world)).toBe("prepare");
    expect(musicForScreen("lobby", false, world)).toBe("lobby");
    expect(musicForScreen("loading", false, world)).toBeUndefined();
    expect(musicForScreen("layout", false, world)).toBeUndefined();
    expect(musicForScreen("stage-clear", true, world)).toBe("clear");
    expect(musicForScreen("collection", true, world)).toBe("clear");
    expect(musicForScreen("result", true, world)).toBe("victory");
    expect(musicForScreen("result", false, world)).toBeNull();
    expect(musicForScreen("down", false, world)).toBeNull();
  });
});
