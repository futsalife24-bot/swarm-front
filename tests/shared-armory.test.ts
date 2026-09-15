import { describe, expect, it } from "vitest";
import { stats } from "../src/shared/defs";
import { makeWeapon, validNewWeapon } from "../src/shared/progression";
import { fresh, SAVE_KEY, bankRewards } from "../src/client/save";
import {
  allWeapons,
  bank,
  freshProgress,
  loadProgress,
  newSaveKey,
  persistProgress,
  soldier,
} from "../src/client/progression-save";
import {
  loadSharedCoopSave,
  persistSharedCoopSave,
} from "../src/client/shared-armory";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
const normalKey = newSaveKey("normal");
const roll = (id: string) =>
  makeWeapon(
    id,
    "rifle",
    4,
    { power: 20, reload: -10, range: 5, rate: 10 },
    false,
    9,
  );

describe("shared normal and co-op armoury", () => {
  it("imports legacy verbatim in combat stats, equipment, locks and preferences once", () => {
    const old = fresh();
    old.inventory[0] = {
      ...old.inventory[0],
      rarity: 1,
      power: 1.123,
      effect: "quick",
      rolls: { mag: 1.125, reload: 0.85, range: 1.25, rate: 0.8 },
    };
    old.favorites = [old.inventory[0].id];
    old.powder = 40;
    old.volume = 0.72;
    old.receipts = ["old-win"];
    const raw = JSON.stringify(old),
      storage = memory({ [SAVE_KEY]: raw });
    const shared = loadSharedCoopSave(storage);
    expect(shared.inventory.map((w) => stats(w))).toEqual(
      old.inventory.map((w) => stats(w)),
    );
    expect(shared.equipped).toEqual(old.equipped);
    expect(shared.favorites).toEqual(old.favorites);
    expect(shared.powder).toBe(40);
    expect(shared.volume).toBe(0.72);
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
    expect(storage.getItem(`${SAVE_KEY}-before-shared-armory`)).toBe(raw);
    const normal = loadProgress("normal", storage)!;
    normal.inventory = normal.inventory.filter((w) => w.kind !== "rocket");
    persistProgress(normal, storage);
    expect(
      loadSharedCoopSave(storage).inventory.some((w) => w.kind === "rocket"),
    ).toBe(false);
  });

  it("keeps both existing saves, resolves colliding IDs, and banks excess without dropping", () => {
    const normal = freshProgress("normal"),
      old = fresh();
    normal.inventory[0].id = old.inventory[0].id;
    soldier(normal).equipped[0] = old.inventory[0].id;
    for (let i = 0; i < 15; i++) bank(normal, [roll(`new-${i}`)]);
    old.favorites = [old.inventory[0].id];
    const raw = JSON.stringify(normal);
    const storage = memory({
      [normalKey]: raw,
      [SAVE_KEY]: JSON.stringify(old),
    });
    const merged = loadProgress("normal", storage)!;
    expect(allWeapons(merged)).toHaveLength(
      allWeapons(normal).length + old.inventory.length,
    );
    expect(new Set(allWeapons(merged).map((w) => w.id)).size).toBe(
      allWeapons(merged).length,
    );
    expect(merged.pending.some((w) => w.id.startsWith("legacy-"))).toBe(true);
    expect(merged.locks[0]).toMatch(/^legacy-/);
    expect(soldier(merged).equipped).toEqual(soldier(normal).equipped);
    expect(storage.getItem(`${normalKey}-before-shared-armory`)).toBe(raw);
  });

  it("leaves both source saves unchanged when either backup or final write fails", () => {
    for (const failKey of [`${SAVE_KEY}-before-shared-armory`, normalKey]) {
      const before = JSON.stringify(freshProgress("normal"));
      const old = JSON.stringify(fresh());
      const base = memory({ [normalKey]: before, [SAVE_KEY]: old });
      const storage = {
        getItem: base.getItem,
        setItem: (key: string, value: string) => {
          if (key === failKey) throw new Error("quota");
          base.setItem(key, value);
        },
      };
      expect(() => loadSharedCoopSave(storage)).toThrow();
      expect(storage.getItem(normalKey)).toBe(before);
      expect(storage.getItem(SAVE_KEY)).toBe(old);
      expect(loadSharedCoopSave(base).sharedArmory).toBe(true);
    }
  });

  it("never imports test-mode weapons and rejects test-marked legacy data", () => {
    const storage = memory({
      [newSaveKey("test")]: JSON.stringify(freshProgress("test")),
    });
    const shared = loadSharedCoopSave(storage);
    expect(
      shared.inventory.every((w) => !(w as { testData?: boolean }).testData),
    ).toBe(true);
    const old = fresh();
    Object.assign(old.inventory[0], { testData: true });
    const poisoned = memory({ [SAVE_KEY]: JSON.stringify(old) });
    expect(() => loadSharedCoopSave(poisoned)).toThrow();
    expect(poisoned.getItem(normalKey)).toBeNull();
  });

  it("shares both reward formats, equipment, locks, powder and receipts", () => {
    const storage = memory();
    let coop = loadSharedCoopSave(storage);
    const normal = loadProgress("normal", storage)!;
    bank(normal, [roll("solo-reward")]);
    persistProgress(normal, storage);
    coop = loadSharedCoopSave(storage);
    expect(coop.inventory.some((w) => w.id === "solo-reward")).toBe(true);
    const legacyReward = { ...fresh().inventory[0], id: "coop-reward" };
    coop = bankRewards(coop, "coop-run", [legacyReward]);
    coop.equipped = ["solo-reward", "coop-reward"];
    coop.favorites = ["coop-reward"];
    coop.powder = 27;
    const prior = coop.sharedRevision!;
    persistSharedCoopSave(coop, storage);
    expect(coop.sharedRevision).toBeGreaterThan(prior);
    const next = loadProgress("normal", storage)!;
    expect(soldier(next).equipped).toEqual(coop.equipped);
    expect(next.locks).toEqual(coop.favorites);
    expect(next.powder).toBe(27);
    expect(next.receipts).toContain("coop-run");
    const repeat = bankRewards(loadSharedCoopSave(storage), "coop-run", [
      legacyReward,
    ]);
    persistSharedCoopSave(repeat, storage);
    expect(
      allWeapons(loadProgress("normal", storage)!).filter(
        (w) => w.id === legacyReward.id,
      ),
    ).toHaveLength(1);
  });

  it("rejects stale armoury writes but merges an encounters-only revision", () => {
    const storage = memory();
    const coop = loadSharedCoopSave(storage);
    const normal = loadProgress("normal", storage)!;
    normal.encounters.ant = "coop";
    persistProgress(normal, storage);
    coop.volume = 0.65;
    persistSharedCoopSave(coop, storage);
    expect(loadProgress("normal", storage)!.encounters.ant).toBe("coop");
    const stale = structuredClone(coop),
      latest = loadProgress("normal", storage)!;
    latest.locks.push(latest.inventory[0].id);
    persistProgress(latest, storage);
    const protectedRaw = storage.getItem(normalKey);
    expect(() => persistSharedCoopSave(stale, storage)).toThrow("別の画面");
    expect(storage.getItem(normalKey)).toBe(protectedRaw);
    expect(() => persistProgress(normal, storage)).toThrow("別の画面");
  });

  it("does not advance caller revisions or lose saved data after a failed normal write", () => {
    const base = memory();
    const coop = loadSharedCoopSave(base),
      revision = coop.sharedRevision;
    const before = base.getItem(normalKey);
    const storage = {
      getItem: base.getItem,
      setItem() {
        throw new Error("quota");
      },
    };
    coop.powder = 9;
    expect(() => persistSharedCoopSave(coop, storage)).toThrow();
    expect(coop.sharedRevision).toBe(revision);
    expect(base.getItem(normalKey)).toBe(before);
    persistSharedCoopSave(coop, base);
    expect(loadProgress("normal", base)!.powder).toBe(9);
  });

  it("strictly validates progression battle weapons", () => {
    const w = roll("strict");
    expect(validNewWeapon(w)).toBe(true);
    for (const bad of [
      { ...w, power: w.power + 0.01 },
      { ...w, acquired: -1 },
      { ...w, variance: { ...w.variance, rate: 21 } },
      { ...w, rolls: { mag: 1 } },
      { ...w, kind: "rocket", effect: "repel" },
      { ...w, id: "<bad>" },
    ])
      expect(validNewWeapon(bad)).toBe(false);
  });

  it("projects every soldier's protection and refreshes it after equipment changes", () => {
    const storage = memory();
    loadSharedCoopSave(storage);
    const normal = loadProgress("normal", storage)!;
    const rifle = roll("spare-rifle");
    bank(normal, [rifle]);
    normal.soldiers.push({
      ...structuredClone(soldier(normal)),
      id: "second",
      equipped: [rifle.id, normal.inventory[2].id],
    });
    persistProgress(normal, storage);
    const coop = loadSharedCoopSave(storage);
    expect(coop.protectedWeapons).toContain(rifle.id);
    const previous = coop.equipped[0];
    coop.equipped[0] = normal.inventory[2].id;
    persistSharedCoopSave(coop, storage);
    expect(coop.protectedWeapons).not.toContain(previous);
    expect(coop.protectedWeapons).toContain(rifle.id);
  });
});
