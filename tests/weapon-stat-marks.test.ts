import { expect, it } from "vitest";
import { stats, ROLLS, type Kind } from "../src/shared/defs";
import {
  makeWeapon,
  weaponStatVariance,
  varianceMark,
  varianceClass,
  type StoredWeapon,
} from "../src/shared/progression";
import { freshProgress } from "../src/client/progression-save";
import { gearWeaponRows } from "../src/client/gear-weapon-list";

const kinds: Kind[] = ["rifle", "shotgun", "rocket"];
const legacy: StoredWeapon = {
  id: "legacy-mark",
  kind: "rifle",
  rarity: 2,
  power: 1.2,
  effect: "quick",
  acquired: 0,
  testData: false,
  rolls: { power: 0.8, mag: 1.1, reload: 0.85, range: 0.9, rate: 1.001 },
};

it("reserves star and max color for exactly +20, including fractional boundaries", () => {
  for (const [n, mark, color] of [
    [-10, "▼", "low"],
    [0, "", "base"],
    [0.1, "▲", "good"],
    [10, "▲", "good"],
    [10.1, "▲\n▲", "great"],
    [19.9999, "▲\n▲", "great"],
    [20, "★", "max"],
    [20.0001, "▲\n▲", "great"],
    [25, "▲\n▲", "great"],
    [36, "▲\n▲", "great"],
  ] as const) {
    expect(varianceMark(n)).toBe(mark);
    expect(varianceClass(n)).toBe(color);
  }
});

it("checks every new-format roll, all three kinds and all five grades", () => {
  for (const kind of kinds)
    for (let rarity = 0; rarity < 5; rarity++)
      for (let n = -10; n <= 20; n++) {
        const w = makeWeapon(
          "all-new",
          kind,
          rarity,
          { power: n, reload: n, range: n, rate: n },
          false,
          0,
        );
        for (const key of ROLLS) {
          expect(weaponStatVariance(w, key)).toBe(key === "mag" ? 0 : n);
          expect(varianceMark(weaponStatVariance(w, key)) === "★").toBe(
            key !== "mag" && n === 20,
          );
        }
      }
});

it("checks every legal legacy power/roll for all kinds and grades against the same-grade modern baseline", () => {
  let checks = 0;
  for (const kind of kinds)
    for (let rarity = 0; rarity < 4; rarity++) {
      const base = stats(
        makeWeapon(
          "baseline",
          kind,
          rarity + 1,
          { power: 0, reload: 0, range: 0, rate: 0 },
          false,
          0,
        ),
      );
      for (const key of ROLLS)
        for (
          let milli = key === "power" ? 1000 : 800;
          milli <= (key === "power" ? 1360 : 1250);
          milli++
        ) {
          const w: StoredWeapon = {
            ...legacy,
            kind,
            rarity: rarity as 0 | 1 | 2 | 3,
            effect: "none",
            power: key === "power" ? milli / 1000 : 1,
            rolls: { [key]: milli / 1000 },
          };
          const actual = stats(w);
          const ratio =
            key === "power"
              ? actual.damage / base.damage
              : key === "mag"
                ? actual.mag / base.mag
                : key === "reload"
                  ? base.reload / actual.reload
                  : key === "range"
                    ? actual.range / base.range
                    : base.interval / actual.interval;
          const n = weaponStatVariance(w, key);
          expect(n).toBeCloseTo((ratio - 1) * 100, 9);
          // No valid legacy performance reaches +20% over these grade baselines.
          expect(varianceMark(n)).not.toBe("★");
          checks++;
        }
    }
  expect(checks).toBe(25980);
});

it("uses rounded ammunition and excludes special effects without mutating saves or combat", () => {
  const before = JSON.stringify(legacy),
    combat = stats(legacy);
  expect(weaponStatVariance(legacy, "mag")).toBeCloseTo((35 / 44 - 1) * 100);
  expect(weaponStatVariance(legacy, "reload")).toBeCloseTo(
    (1 / (0.85 * 1.15 ** 3) - 1) * 100,
  );
  expect(weaponStatVariance(legacy, "power")).toBeCloseTo(
    (1.2 / 1.15 ** 3 - 1) * 100,
  );
  for (const key of ROLLS)
    expect(weaponStatVariance(legacy, key)).toBe(
      weaponStatVariance({ ...legacy, effect: "none" }, key),
    );
  const save = freshProgress("normal");
  save.inventory[0] = legacy;
  save.soldiers[0].equipped[0] = legacy.id;
  const rows = gearWeaponRows([legacy], save, false, new Set(), 0);
  expect(rows.match(/<sup>▼<\/sup>/g)).toHaveLength(10);
  expect(rows).not.toContain("★");
  expect(JSON.stringify(legacy)).toBe(before);
  expect(stats(legacy)).toEqual(combat);
});

it("reproduces screenshot SSR rockets with differing powers and identical rounded magazines", () => {
  for (const power of [1.324, 1.359, 1.329, 1.271, 1.224]) {
    const w: StoredWeapon = {
      ...legacy,
      kind: "rocket",
      power,
      effect: "chain",
      rolls: { mag: 1.24, range: 1.25, rate: 1.25 },
    };
    expect(varianceMark(weaponStatVariance(w, "power"))).toBe("▼");
    expect(stats(w).mag).toBe(2);
    expect(weaponStatVariance(w, "mag")).toBeCloseTo(-100 / 3);
  }
});
