import { expect, it } from "vitest";
import { bankRewards } from "../src/client/save";
import { loadProgress } from "../src/client/progression-save";
import {
  loadSharedCoopSave,
  persistSharedCoopSave,
} from "../src/client/shared-armory";
import { STARTERS } from "../src/shared/defs";

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

it("banks a cooperative clear once across the clear banner, result and later settings write", () => {
  const storage = memory();
  let shared = loadSharedCoopSave(storage);
  const reward = { ...STARTERS[0], id: "campaign-run-weapon", level: 2 };
  const storeResult = () => {
    const next = bankRewards(shared, "campaign-run", [reward]);
    persistSharedCoopSave(next, storage, { run: "campaign-run", stage: 2 });
    shared = next;
  };
  storeResult();
  const first = loadProgress("normal", storage)!;
  expect(first.coins).toBe(120);
  expect(first.powder).toBe(4);
  storeResult();
  const repeated = loadProgress("normal", storage)!;
  expect(repeated.coins).toBe(first.coins);
  expect(repeated.points).toBe(first.points);
  expect(repeated.materials).toBe(first.materials);
  expect(repeated.inventory).toEqual(first.inventory);
  shared.volume = 0.5;
  persistSharedCoopSave(shared, storage);
  const afterSettings = loadProgress("normal", storage)!;
  expect(afterSettings.powder).toBe(first.powder);
  expect(afterSettings.coins).toBe(first.coins);
  expect(afterSettings.receipts).toEqual(first.receipts);
  expect(shared.receipts).toContain("coop-campaign:campaign-run");
  expect(shared.powder).toBe(4);
});

it("does not roll back campaign powder when settings are the first write after a clear", () => {
  const storage = memory();
  const shared = bankRewards(loadSharedCoopSave(storage), "settings-run", []);
  persistSharedCoopSave(shared, storage, { run: "settings-run", stage: 2 });
  shared.volume = 0.5;
  persistSharedCoopSave(shared, storage);
  expect(loadProgress("normal", storage)!.powder).toBe(4);
  expect(loadProgress("normal", storage)!.receipts).toContain(
    "coop-campaign:settings-run",
  );
});

it("publishes the campaign receipt to the caller only after a successful retry", () => {
  const storage = memory();
  const next = bankRewards(loadSharedCoopSave(storage), "retry-run", []);
  const before = structuredClone(next);
  const unavailable = {
    getItem: storage.getItem,
    setItem() {
      throw Error("quota");
    },
  };
  expect(() =>
    persistSharedCoopSave(next, unavailable, { run: "retry-run", stage: 2 }),
  ).toThrow();
  expect(next).toEqual(before);
  expect(loadProgress("normal", storage)!.coins).toBe(0);
  persistSharedCoopSave(next, storage, { run: "retry-run", stage: 2 });
  persistSharedCoopSave(next, storage, { run: "retry-run", stage: 2 });
  expect(loadProgress("normal", storage)!.coins).toBe(120);
  expect(loadProgress("normal", storage)!.powder).toBe(4);
});
