import { describe, it, expect } from "vitest";
import {
  bankRewards,
  discardWeapon,
  dismantleWeapons,
  fresh,
  parseSave,
} from "../src/client/save";
import { STARTERS } from "../src/shared/defs";

describe("persistent armory", () => {
  const full = () => ({
    ...fresh(),
    inventory: STARTERS.flatMap((w) =>
      Array.from({ length: 8 }, (_, i) => ({
        ...w,
        id: i ? `${w.kind}-${i}` : w.id,
      })),
    ),
  });
  it("banks overflow across reloads and repeated receipts without loss or duplication", () => {
    const loot = [{ ...STARTERS[0], id: "new-rifle" }];
    const saved = bankRewards(full(), "run", loot);
    expect(saved.pendingWeapons).toEqual(loot);
    expect(bankRewards(parseSave(JSON.stringify(saved)), "run", loot)).toEqual(
      saved,
    );
    const next = bankRewards(saved, "run2", [{ ...loot[0], id: "second" }]);
    expect(next.pendingWeapons).toHaveLength(2);
    const resolved = discardWeapon(next, "rifle-1");
    expect(resolved.inventory.some((w) => w.id === "new-rifle")).toBe(true);
    expect(resolved.pendingWeapons?.map((w) => w.id)).toEqual(["second"]);
    expect(next.inventory.some((w) => w.id === "rifle-1")).toBe(true);
  });
  it("protects equipped and favorite weapons, including waiting favorites", () => {
    const saved = bankRewards(full(), "run", [
      { ...STARTERS[0], id: "waiting" },
    ]);
    saved.favorites = ["rifle-1", "waiting"];
    for (const id of [saved.equipped[0], "rifle-1", "waiting"])
      expect(() => discardWeapon(saved, id)).toThrow("保護");
    const next = discardWeapon(saved, "rifle-2");
    expect(next.favorites).toEqual(saved.favorites);
    expect(next.inventory.some((w) => w.id === "waiting")).toBe(true);
  });
  it("loads old saves and rejects malformed or overlapping pending data", () => {
    expect(parseSave(JSON.stringify(fresh()))).toEqual(fresh());
    expect(() =>
      parseSave(JSON.stringify({ ...fresh(), pendingWeapons: [STARTERS[0]] })),
    ).toThrow();
    expect(() =>
      parseSave(JSON.stringify({ ...fresh(), favorites: ["missing"] })),
    ).toThrow();
  });
});

describe("dismantling powder", () => {
  it("awards each rarity once, removes inventory and pending together, and reloads", () => {
    const save = fresh();
    const loot = [0, 1, 2, 3].map((rarity) => ({
      ...STARTERS[0],
      id: "dust-" + rarity,
      rarity,
    })) as typeof save.inventory;
    save.inventory.push(...loot.slice(0, 2));
    save.pendingWeapons = loot.slice(2);
    const before = structuredClone(save);
    const next = dismantleWeapons(save, [...loot.map((w) => w.id), loot[0].id]);
    expect(next.powder).toBe(44);
    expect(next.inventory).toEqual(STARTERS);
    expect(next.pendingWeapons).toEqual([]);
    expect(parseSave(JSON.stringify(next)).powder).toBe(44);
    expect(save).toEqual(before);
    expect(() => dismantleWeapons(next, [loot[0].id])).toThrow();
  });
  it("rejects the entire batch when it includes protected or missing weapons", () => {
    const save = fresh();
    save.inventory.push({ ...STARTERS[0], id: "free" });
    save.pendingWeapons = [{ ...STARTERS[0], id: "favorite" }];
    save.favorites = ["favorite"];
    const before = structuredClone(save);
    for (const id of [save.equipped[0], "favorite", "missing"]) {
      expect(() => dismantleWeapons(save, ["free", id])).toThrow();
      expect(save).toEqual(before);
    }
  });
  it("accepts legacy saves and rejects invalid powder balances or overflow", () => {
    expect(parseSave(JSON.stringify(fresh())).powder ?? 0).toBe(0);
    for (const powder of [-1, 0.5, "1", null, Number.MAX_SAFE_INTEGER + 1])
      expect(() => parseSave(JSON.stringify({ ...fresh(), powder }))).toThrow();
    expect(() =>
      dismantleWeapons({ ...fresh(), powder: Number.MAX_SAFE_INTEGER }, [
        STARTERS[2].id,
      ]),
    ).toThrow();
  });
});
