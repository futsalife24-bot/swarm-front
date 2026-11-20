import { beforeEach, describe, expect, it, vi } from "vitest";
import { openBestiary } from "../src/client/bestiary";
import { openFrontBestiary } from "../src/client/front-report-access";
import { recordFrontSoloEncounters } from "../src/client/progression-front-solo";
import {
  freshProgress,
  loadProgress,
  newSaveKey,
} from "../src/client/progression-save";
import { createWorld, spawn } from "../src/shared/game";

vi.mock("../src/client/bestiary", () => ({ openBestiary: vi.fn() }));

const report = vi.mocked(openBestiary);

function storage() {
  const save = freshProgress("normal");
  save.encounters = { crawler: "coop" };
  const values = new Map<string, string>([
    [newSaveKey("normal"), JSON.stringify(save)],
  ]);
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function battleWorld() {
  const world = createWorld("front-solo-encounters");
  world.phase = "battle";
  spawn(world, "ant", 0, -4);
  spawn(world, "crawler", 2, -4);
  spawn(world, "boss", 4, -4, "worm");
  return world;
}

describe("front solo encounter recording", () => {
  beforeEach(() => report.mockClear());

  it("records every solo-encountered report identity and upgrades coop records", () => {
    const store = storage();

    expect(recordFrontSoloEncounters(battleWorld(), store).sort()).toEqual([
      "ant",
      "crawler",
      "worm",
    ]);

    const saved = loadProgress("normal", {
      getItem: (key) => store.getItem(key),
    });
    expect(saved?.encounters).toMatchObject({
      ant: "solo",
      crawler: "solo",
      worm: "solo",
    });
    expect(saved?.encounters.boss).toBeUndefined();
  });

  it("does not rewrite the save once the encounters are recorded", () => {
    const store = storage();
    const world = battleWorld();

    recordFrontSoloEncounters(world, store);
    const writes = store.setItem.mock.calls.length;

    expect(recordFrontSoloEncounters(world, store)).toEqual([]);
    expect(store.setItem).toHaveBeenCalledTimes(writes);
  });

  it("opens the recorded species in the report reached from the front title", () => {
    const store = storage();

    recordFrontSoloEncounters(battleWorld(), store);
    openFrontBestiary(store, 0.4);

    expect(report).toHaveBeenCalledWith({
      encounters: { ant: "solo", crawler: "solo", worm: "solo" },
      voiceVolume: 0.4,
      controlVoice: undefined,
    });
  });
});
