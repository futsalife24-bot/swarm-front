import { expect, it } from "vitest";
import { saveFrontRunRewards } from "../src/client/front-reward-status";
import {
  FRONT_PROGRESS_KEY,
  readFrontProgress,
} from "../src/client/front-progress";
import { FRONT_PENDING_REWARDS_KEY } from "../src/client/front-campaign";
import {
  freshProgress,
  newSaveKey,
  persistProgress,
} from "../src/client/progression-save";

function setup() {
  const map = new Map<string, string>();
  const failures = new Set<string>();
  let cleanupFailure = false;
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (
        failures.has(key) ||
        (cleanupFailure && key === FRONT_PENDING_REWARDS_KEY && value === "[]")
      )
        throw Error("試験用の保存失敗");
      map.set(key, value);
    },
  };
  const save = freshProgress("normal");
  save.armoryMigration = 1;
  save.coins = 7;
  persistProgress(save, storage);
  return {
    storage,
    map,
    failures,
    failCleanup: (value: boolean) => {
      cleanupFailure = value;
    },
    coins: () => JSON.parse(map.get(newSaveKey("normal"))!).coins,
  };
}
const receipt = {
  id: "test-run",
  won: true,
  mode: "survival" as const,
  day: "2026-10-11",
  at: 1791644400000,
};
for (const failed of ["progress", "campaign", "both"] as const) {
  it(`${failed}の保存失敗後も成功分の表示を維持し、連打/再接続で二重付与しない`, () => {
    const s = setup();
    if (failed !== "campaign") s.failures.add(FRONT_PROGRESS_KEY);
    if (failed !== "progress") s.failures.add(newSaveKey("normal"));
    const first = saveFrontRunRewards(s.storage, s.storage, receipt, 180);
    expect(first.error).toBe(true);
    if (failed === "progress") expect(first.text).toContain("攻略コイン +30");
    if (failed === "campaign") expect(first.text).toContain("功績 +100");
    s.failures.clear();
    const retry = saveFrontRunRewards(
      s.storage,
      s.storage,
      receipt,
      180,
      first,
    );
    expect(retry.error).toBe(false);
    expect(retry.text).toBe("功績 +100 · 攻略コイン +30");
    expect(
      saveFrontRunRewards(s.storage, s.storage, receipt, 180, retry).text,
    ).toBe(retry.text);
    // Memory state is absent after a reload; persisted receipts still identify earned amounts.
    expect(saveFrontRunRewards(s.storage, s.storage, receipt, 180).text).toBe(
      retry.text,
    );
    expect(readFrontProgress(s.storage).progress.credits).toBe(100);
    expect(s.coins()).toBe(37);
  });
}
it("コイン確定後のpending消去失敗でも、再試行は1回分の額を表示する", () => {
  const s = setup();
  s.failCleanup(true);
  const first = saveFrontRunRewards(s.storage, s.storage, receipt, 180);
  expect(first.error).toBe(true);
  expect(s.coins()).toBe(37);
  s.failCleanup(false);
  const retry = saveFrontRunRewards(s.storage, s.storage, receipt, 180, first);
  expect(retry.text).toBe("功績 +100 · 攻略コイン +30");
  expect(retry.error).toBe(false);
  expect(s.coins()).toBe(37);
});
it("別作戦の保留コインと今回の表示額を混ぜず、新しい作戦へ表示を持ち越さない", () => {
  const s = setup();
  s.storage.setItem(
    FRONT_PENDING_REWARDS_KEY,
    JSON.stringify([{ runId: "old", seconds: 120 }]),
  );
  const first = saveFrontRunRewards(s.storage, s.storage, receipt, 180);
  expect(first.text).toBe("功績 +100 · 攻略コイン +30");
  expect(s.coins()).toBe(57);
  const next = saveFrontRunRewards(
    s.storage,
    s.storage,
    { ...receipt, id: "next", won: false, at: receipt.at + 1 },
    10,
    first,
  );
  expect(next.text).toBe("功績 +20 · 攻略コイン +0");
  expect(s.coins()).toBe(57);
});
it("日替わりでは攻略コインを保存せず、正当な0功績も維持する", () => {
  const s = setup();
  const daily = { ...receipt, mode: "daily" as const };
  const first = saveFrontRunRewards(s.storage, s.storage, daily, null);
  expect(first.text).toBe("功績 +200");
  const next = saveFrontRunRewards(
    s.storage,
    s.storage,
    { ...daily, id: "daily-again", at: daily.at + 1 },
    null,
    first,
  );
  expect(next.text).toBe("功績 +0");
  expect(s.coins()).toBe(7);
  expect(s.map.has(FRONT_PENDING_REWARDS_KEY)).toBe(false);
});
