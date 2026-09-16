import { expect, it } from "vitest";
import { stats } from "../src/shared/defs";
import { makeWeapon, weaponStatVariance, varianceMark, type StoredWeapon } from "../src/shared/progression";
import { freshProgress } from "../src/client/progression-save";
import { gearWeaponRows } from "../src/client/gear-weapon-list";

const legacy: StoredWeapon = {
  id: "legacy-mark", kind: "rifle", rarity: 2, power: 1.2,
  effect: "quick", acquired: 0, testData: false,
  rolls: { power: 0.8, mag: 1.1, reload: 0.85, range: 0.9, rate: 1.001 },
};

it("restores legacy marks from actual stored modifiers without changing combat or saves", () => {
  const before = JSON.stringify(legacy), combat = stats(legacy);
  expect(["power", "mag", "reload", "range", "rate"].map(k =>
    weaponStatVariance(legacy, k as "power"))).toEqual([20, 10, 15, -10, 0.1]);
  // Damage uses power, not rolls.power; reload excludes the quick effect.
  expect(varianceMark(weaponStatVariance(legacy, "reload"))).toBe("▲\n▲");
  const save = freshProgress("normal");
  save.inventory[0] = legacy;
  save.soldiers[0].equipped[0] = legacy.id;
  const rows = gearWeaponRows([legacy], save, false, new Set(), 0);
  expect(rows.match(/<sup>★<\/sup>/g)).toHaveLength(2);
  expect(rows.match(/<sup>▼<\/sup>/g)).toHaveLength(2);
  expect(rows.match(/<sup>▲\n▲<\/sup>/g)).toHaveLength(2);
  expect(JSON.stringify(legacy)).toBe(before);
  expect(stats(legacy)).toEqual(combat);
});

it("keeps new-format marks and fixed magazines, with neutral missing legacy rolls", () => {
  const modern = makeWeapon("new-mark", "rifle", 3,
    { power: -10, reload: 11, range: 20, rate: 0 }, false, 1);
  expect(["power", "mag", "reload", "range", "rate"].map(k =>
    weaponStatVariance(modern, k as "power"))).toEqual([-10, 0, 11, 20, 0]);
  expect(weaponStatVariance({ ...legacy, power: 1, rolls: undefined }, "reload")).toBe(0);
  expect(weaponStatVariance({ ...legacy, rolls: { reload: 1.1 } }, "reload")).toBe(-10);
});
