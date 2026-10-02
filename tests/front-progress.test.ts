import { describe, it, expect } from "vitest";
import {
  awardFrontProgress,
  readFrontProgress,
  FRONT_PROGRESS_KEY,
  emptyFrontProgress,
  validFrontProgress,
} from "../src/client/front-progress";
describe("改装版の独立進行", () => {
  it("履歴の不正な要素を例外なく拒否する", () => {
    expect(
      validFrontProgress({ ...emptyFrontProgress(), receipts: [null] }),
    ).toBe(false);
  });
  const fixture = () => {
    const data = new Map([
      ["swarm-front-save", "旧版の所持品"],
      ["daily-ledger", "旧版の日次台帳"],
    ]);
    return {
      data,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
  };
  it("報酬と解放を独立保存し、同一結果を二重受取しない", () => {
    const s = fixture(),
      receipt = {
        id: "run1",
        won: true,
        mode: "survival" as const,
        day: "2026-10-02",
        at: 100,
      };
    expect(awardFrontProgress(s, receipt)).toMatchObject({
      saved: true,
      reward: 100,
      progress: {
        wins: 1,
        runs: 1,
        credits: 100,
        unlocks: ["blast-core", "armor-piercer", "afterimage-mine", "fuse"],
      },
    });
    expect(awardFrontProgress(s, receipt)).toMatchObject({
      saved: true,
      reward: 0,
      progress: { wins: 1, runs: 1 },
    });
    expect(s.data.get("swarm-front-save")).toBe("旧版の所持品");
    expect(s.data.get("daily-ledger")).toBe("旧版の日次台帳");
  });
  it("日替わり報酬は1日1回、通常戦は繰り返せる", () => {
    const s = fixture();
    for (let i = 0; i < 4; i++)
      awardFrontProgress(s, {
        id: `r${i}`,
        won: true,
        mode: i < 2 ? "daily" : "defense",
        day: "2026-10-02",
        at: 100 + i,
      });
    expect(readFrontProgress(s).progress).toMatchObject({
      wins: 4,
      runs: 4,
      credits: 400,
      dailyWins: ["2026-10-02"],
    });
  });
  it("破損データと書込失敗は保持し、履歴整理後も二重報酬を防ぐ", () => {
    const s = fixture();
    s.data.set(FRONT_PROGRESS_KEY, "{不正}");
    const old = s.data.get(FRONT_PROGRESS_KEY);
    expect(
      awardFrontProgress(s, {
        id: "r",
        won: true,
        mode: "daily",
        day: "2026-10-02",
        at: 100,
      }).saved,
    ).toBe(false);
    expect(s.data.get(FRONT_PROGRESS_KEY)).toBe(old);
    const denied = {
      getItem: () => null,
      setItem: () => {
        throw Error("書込不可");
      },
    };
    expect(
      awardFrontProgress(denied, {
        id: "r",
        won: true,
        mode: "survival",
        day: "2026-10-02",
        at: 100,
      }),
    ).toMatchObject({ saved: false, reward: 0 });
    const full = fixture();
    for (let i = 0; i < 512; i++)
      awardFrontProgress(full, {
        id: `r${i}`,
        won: false,
        mode: "survival",
        day: "2026-10-02",
        at: 100 + i,
      });
    expect(
      awardFrontProgress(full, {
        id: "overflow",
        won: true,
        mode: "survival",
        day: "2026-10-02",
        at: 1000,
      }).saved,
    ).toBe(true);
    expect(readFrontProgress(full).progress).toMatchObject({
      runs: 513,
      wins: 1,
      receiptFloor: 100,
      credits: 10340,
    });
    expect(
      awardFrontProgress(full, {
        id: "r0",
        won: false,
        mode: "survival",
        day: "2026-10-02",
        at: 100,
      }),
    ).toMatchObject({ saved: true, reward: 0, progress: { runs: 513 } });
  });
});
