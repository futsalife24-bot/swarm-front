import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const fixtures = JSON.parse(
  fs.readFileSync(new URL("manifest.json", import.meta.url), "utf8"),
).map((entry) => {
  const raw = fs.readFileSync(
    new URL(`${entry.name}.json`, import.meta.url),
    "utf8",
  );
  assert.equal(createHash("sha256").update(raw).digest("hex"), entry.sha256);
  return { ...entry, raw, source: JSON.parse(raw) };
});

// Expectations come from the frozen input, not freshProgress/current defaults.
export function assertMigration(actual, fixture) {
  const old = fixture.source;
  assert.equal(actual.version, 2);
  assert.equal(actual.mode, "normal");
  assert.equal(actual.armoryMigration, 1);
  assert.equal(actual.revision, 1);
  if (old.version === 1) {
    assert.deepEqual(
      actual.inventory,
      old.inventory.map((w, acquired) => ({
        ...w,
        acquired: acquired + 3,
        testData: false,
      })),
    );
    assert.deepEqual(actual.soldiers[0].equipped, old.equipped);
    assert.deepEqual(actual.locks, old.favorites);
    assert.equal(actual.powder, 40);
    assert.equal(actual.coopPreferences.volume, 0.72);
    assert.equal(actual.coopPreferences.frameRate, 60);
    assert.deepEqual(actual.receipts, ["fixture-old-win"]);
  } else {
    for (const [field, expected] of Object.entries(old)) {
      if (field !== "revision")
        assert.deepEqual(actual[field], expected, field);
    }
    assert.equal(actual.coins, 137);
    assert.equal(actual.soldiers[0].levels.hp, 2);
    assert.equal(actual.accessories[0].rarity, 3);
    assert.equal(actual.selectedSoldier, "fixture-reserve");
  }
}
