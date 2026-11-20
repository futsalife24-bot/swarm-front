import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshProgress, newSaveKey } from "../src/client/progression-save";
import { openBestiary } from "../src/client/bestiary";
import { openFrontBestiary } from "../src/client/front-report-access";
import type { ReportVoice } from "../src/client/report-identification";

vi.mock("../src/client/bestiary", () => ({ openBestiary: vi.fn() }));

const report = vi.mocked(openBestiary);
const storageFor = (value: string | null) => ({
  getItem: vi.fn((key: string) =>
    key === newSaveKey("normal") ? value : null,
  ),
  setItem: vi.fn(),
});

describe("front title report access", () => {
  beforeEach(() => report.mockClear());

  it("passes the existing selected-voice queue into the report", () => {
    const controlVoice = {
      announce: vi.fn(),
      controlVoice: { stop: vi.fn() },
    } as unknown as ReportVoice;
    openFrontBestiary(storageFor(null), 0.4, controlVoice);
    expect(report).toHaveBeenCalledWith({
      encounters: {},
      clearedStages: 0,
      voiceVolume: 0.4,
      controlVoice,
    });
  });

  it.each([
    [{ boss: "solo" as const }, { boss: "solo" }],
    [{ worm: "solo" as const }, { worm: "solo" }],
    [
      { boss: "coop" as const, worm: "solo" as const },
      { boss: "coop", worm: "solo" },
    ],
  ])(
    "passes the saved encounter states without unlocking the other boss form",
    (encounters, expected) => {
      const save = freshProgress("normal");
      save.encounters = encounters;
      const storage = storageFor(JSON.stringify(save));

      openFrontBestiary(storage, 0.4);

      expect(report).toHaveBeenCalledWith({
        encounters: expected,
        clearedStages: 0,
        voiceVolume: 0.4,
        controlVoice: undefined,
      });
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it("keeps reports locked when storage reads are denied", () => {
    const storage = {
      getItem: () => {
        throw new Error("storage denied");
      },
    };
    openFrontBestiary(storage, 0.2);
    expect(report).toHaveBeenCalledWith({
      encounters: {},
      clearedStages: 0,
      voiceVolume: 0.2,
      controlVoice: undefined,
    });
  });

  it.each([null, "{bad save"])(
    "keeps all reports locked when normal progress is missing or invalid",
    (raw) => {
      const storage = storageFor(raw);
      openFrontBestiary(storage, 0.2);
      expect(report).toHaveBeenCalledWith({
        encounters: {},
        clearedStages: 0,
        voiceVolume: 0.2,
        controlVoice: undefined,
      });
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );
});
