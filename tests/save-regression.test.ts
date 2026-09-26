import { expect, it } from "vitest";
import {
  fixtures,
  assertMigration,
} from "./fixtures/save-regression/index.mjs";
import {
  initializeProgress,
  loadProgress,
  newSaveKey,
  persistProgress,
} from "../src/client/progression-save";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

for (const fixture of fixtures) {
  it(`migrates frozen ${fixture.name} and preserves gear and growth for five writes`, () => {
    const store = storage();
    store.setItem(fixture.sourceKey, fixture.raw);
    const migrated = loadProgress("normal", store)!;
    assertMigration(migrated, fixture);
    for (let round = 1; round <= 5; round++) {
      const loaded = loadProgress("normal", store)!;
      expect(loaded).toEqual(migrated);
      migrated.coins++;
      persistProgress(migrated, store);
      expect(migrated.revision).toBe(round + 1);
    }
    expect(loadProgress("normal", store)).toEqual(migrated);
    expect(store.getItem(fixture.sourceKey)).toBe(fixture.raw);
    expect(store.getItem(fixture.sourceKey + fixture.backupSuffix)).toBe(
      fixture.raw,
    );
  });
}

it.each([
  "{broken",
  "null",
  "{}",
  '{"version":99}',
  '{"version":2,"mode":"normal"}',
])(
  "refuses damaged or unsupported progress %s without replacing either source",
  (raw) => {
    const store = storage();
    const fixture = fixtures[1];
    store.setItem(newSaveKey("normal"), raw);
    store.setItem(fixture.sourceKey, fixture.raw);
    expect(() => loadProgress("normal", store)).toThrow();
    expect(() => initializeProgress("normal", store)).toThrow();
    expect(store.getItem(newSaveKey("normal"))).toBe(raw);
    expect(store.getItem(fixture.sourceKey)).toBe(fixture.raw);
  },
);

it("treats absence as new data but rejects a stale write after deletion", () => {
  const store = storage();
  expect(loadProgress("normal", store)).toBeNull();
  const save = initializeProgress("normal", store);
  expect(loadProgress("normal", store)).toEqual(save);
  store.removeItem(newSaveKey("normal"));
  expect(() => persistProgress(save, store)).toThrow("削除");
  expect(store.getItem(newSaveKey("normal"))).toBeNull();
});
