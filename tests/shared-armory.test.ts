import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import { recoverUnsavedResult } from "../src/client/save-recovery";
import { describe, expect, it } from "vitest";
import { stats } from "../src/shared/defs";
import { makeWeapon, validNewWeapon } from "../src/shared/progression";
import {
  fresh,
  SAVE_KEY,
  bankRewards,
  dismantleWeapons,
} from "../src/client/save";
import {
  SaveConflictError,
  grantResult,
  appendCollected,
  chooseReward,
  prepareChoice,
  dismantle,
  validateProgress,
  legacyProgressKey,
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
      [legacyProgressKey]: raw,
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
    expect(storage.getItem(`${legacyProgressKey}-before-shared-armory`)).toBe(
      raw,
    );
  });

  it("leaves both source saves unchanged when either backup or final write fails", () => {
    for (const failKey of [`${SAVE_KEY}-before-shared-armory`, normalKey]) {
      const before = JSON.stringify(freshProgress("normal"));
      const old = JSON.stringify(fresh());
      const base = memory({ [legacyProgressKey]: before, [SAVE_KEY]: old });
      const storage = {
        getItem: base.getItem,
        setItem: (key: string, value: string) => {
          if (key === failKey) throw new Error("quota");
          base.setItem(key, value);
        },
      };
      expect(() => loadSharedCoopSave(storage)).toThrow();
      expect(storage.getItem(legacyProgressKey)).toBe(before);
      expect(storage.getItem(normalKey)).toBeNull();
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

it("isolates v3 from the actual previous release writer and keeps its latest migrated rewards", () => {
  const previous = freshProgress("normal");
  previous.armoryMigration = 1;
  previous.revision = 8;
  bank(previous, [roll("latest-old-shared-reward")]);
  const sourceRaw = JSON.stringify(previous);
  const storage = memory({
    [legacyProgressKey]: sourceRaw,
    [SAVE_KEY]: JSON.stringify(fresh()),
  });
  const latest = loadProgress("normal", storage)!;
  expect(
    allWeapons(latest).some((w) => w.id === "latest-old-shared-reward"),
  ).toBe(true);
  bank(latest, [roll("new-v3-reward")]);
  persistProgress(latest, storage);
  const protectedRaw = storage.getItem(normalKey);
  const source = execFileSync(
    "git",
    ["show", "d947dd8:src/client/progression-save.ts"],
    { encoding: "utf8" },
  );
  const fn = source.slice(
    source.indexOf("export function persistProgress("),
    source.indexOf("export function initializeProgress("),
  );
  const javascript = transformSync(fn.replace("export function", "function"), {
    loader: "ts",
    target: "es2022",
  }).code;
  const oldPersist = new Function(
    "validateProgress",
    "newSaveKey",
    `${javascript}; return persistProgress;`,
  )(validateProgress, (mode: string) => `swarm-front-progression-v2-${mode}`);
  previous.coins = 777;
  oldPersist(previous, storage);
  expect(JSON.parse(storage.getItem(legacyProgressKey)!).coins).toBe(777);
  expect(storage.getItem(normalKey)).toBe(protectedRaw);
  expect(loadProgress("normal", storage)).toEqual(latest);
  expect(storage.getItem(`${legacyProgressKey}-before-shared-v3`)).toBe(
    sourceRaw,
  );
});

it("recovers only unsaved run rewards onto current equipment and does not double grant", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = loadProgress("normal", storage)!;
  const pending = grantResult(
    base,
    {
      run: "recover-run",
      stage: 1,
      difficulty: "normal",
      win: true,
      time: 20,
      kills: 4,
      missions: [true, true, false],
      weapons: [roll("unsaved-win")],
      collected: 0,
    },
    () => 0.5,
  );
  const latest = structuredClone(base);
  latest.locks = [latest.inventory[0].id];
  latest.coins = 100;
  persistProgress(latest, storage);
  expect(() => persistProgress(pending, storage)).toThrow(SaveConflictError);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(recovered.locks).toEqual(latest.locks);
  expect(recovered.coins).toBe(100 + pending.result!.coins);
  expect(recovered.result!.choice).toBe("normal");
  const saved = storage.getItem(normalKey);
  expect(recoverUnsavedResult(base, pending, storage)).toEqual(recovered);
  expect(storage.getItem(normalKey)).toBe(saved);
  recovered.inventory = recovered.inventory.filter(
    (w) => w.id !== "unsaved-win",
  );
  persistProgress(recovered, storage);
  expect(
    allWeapons(recoverUnsavedResult(base, pending, storage)).some(
      (w) => w.id === "unsaved-win",
    ),
  ).toBe(false);
});

it("recovers a collection delta without resurrecting old dismantled rewards and retains quota retry", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  let base = loadProgress("normal", storage)!;
  base = grantResult(
    base,
    {
      run: "collect-run",
      stage: 1,
      difficulty: "normal",
      win: true,
      time: 20,
      kills: 4,
      missions: [true, false, false],
      weapons: [roll("old-drop")],
      collected: 0,
    },
    () => 0.5,
  );
  persistProgress(base, storage);
  const pending = appendCollected(base, [roll("new-drop")]);
  const latest = structuredClone(base);
  latest.result!.choice = "normal";
  latest.inventory = latest.inventory.filter((w) => w.id !== "old-drop");
  persistProgress(latest, storage);
  const raw = storage.getItem(normalKey);
  expect(() =>
    recoverUnsavedResult(base, pending, {
      getItem: storage.getItem,
      setItem() {
        throw new Error("quota");
      },
    }),
  ).toThrow("端末へ保存");
  expect(storage.getItem(normalKey)).toBe(raw);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(allWeapons(recovered).some((w) => w.id === "old-drop")).toBe(false);
  expect(allWeapons(recovered).some((w) => w.id === "new-drop")).toBe(true);
  expect(recovered.coins).toBe(latest.coins);
});

it("recomputes first-clear rewards and preserves another pending run during recovery", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = loadProgress("normal", storage)!;
  const input = {
    stage: 1,
    difficulty: "normal" as const,
    win: true,
    time: 20,
    kills: 4,
    missions: [true, false, false],
    collected: 0,
  };
  const pending = grantResult(
    base,
    { ...input, run: "stale-first", weapons: [roll("stale-first-drop")] },
    () => 0.5,
  );
  const latest = grantResult(
    base,
    { ...input, run: "current-first", weapons: [roll("current-first-drop")] },
    () => 0.5,
  );
  persistProgress(latest, storage);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(recovered.points).toBe(latest.points);
  expect(recovered.materials).toBe(latest.materials);
  expect(recovered.result).toEqual(latest.result);
  expect(recovered.coins).toBe(latest.coins + pending.result!.coins);
  expect(allWeapons(recovered).some((w) => w.id === "stale-first-drop")).toBe(
    true,
  );
});

it("recovers proportional defeat coins exactly once", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = loadProgress("normal", storage)!;
  const pending = grantResult(
    base,
    {
      run: "defeat-recovery",
      stage: 2,
      difficulty: "normal",
      win: false,
      time: 20,
      kills: 4,
      missions: [false, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.5,
  );
  // The actual defeat() path adds proportional coins after grantResult.
  pending.coins += 17;
  pending.result!.coins = 17;
  const latest = structuredClone(base);
  latest.coins = 100;
  persistProgress(latest, storage);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(recovered.coins).toBe(117);
  expect(recovered.result!.coins).toBe(17);
  expect(recovered.result!.firstCoins).toBe(0);
  expect(recoverUnsavedResult(base, pending, storage).coins).toBe(117);
});

it("recovers the ST3 branch unlock made by victory", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = loadProgress("normal", storage)!;
  const pending = grantResult(
    base,
    {
      run: "branch-recovery",
      stage: 3,
      difficulty: "normal",
      win: true,
      time: 20,
      kills: 4,
      missions: [true, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.5,
  );
  pending.branch = true;
  expect(recoverUnsavedResult(base, pending, storage).branch).toBe(true);
});

it("keeps concurrent collection weapons in the recovered result record", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  let base = loadProgress("normal", storage)!;
  base = grantResult(
    base,
    {
      run: "parallel-collection",
      stage: 1,
      difficulty: "normal",
      win: true,
      time: 20,
      kills: 4,
      missions: [true, false, false],
      weapons: [roll("initial-item")],
      collected: 0,
    },
    () => 0.5,
  );
  persistProgress(base, storage);
  const pending = appendCollected(base, [roll("pending-item")]);
  const latest = appendCollected(base, [roll("concurrent-item")]);
  persistProgress(latest, storage);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(recovered.result!.collected).toBe(2);
  expect(recovered.result!.weapons.map((w) => w.id).sort()).toEqual(
    ["initial-item", "pending-item", "concurrent-item"].sort(),
  );
  expect(recovered.coins).toBe(latest.coins);
});

it("does not display or credit a duplicate ST21 first-clear bonus", () => {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = loadProgress("normal", storage)!;
  const pending = grantResult(
    base,
    {
      run: "st21-stale",
      stage: 21,
      difficulty: "normal",
      win: true,
      time: 20,
      kills: 4,
      missions: [true, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.5,
  );
  expect(pending.result!.firstCoins).toBe(500);
  const latest = structuredClone(base);
  latest.missions["21:normal"] = [true, false, false];
  latest.coins = 900;
  persistProgress(latest, storage);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(recovered.coins).toBe(900 + pending.result!.coins);
  expect(recovered.result!.coins).toBe(pending.result!.coins);
  expect(recovered.result!.firstCoins).toBe(0);
  expect(recovered.result!.first).toBe(false);
  expect(recovered.result!.weapons).toHaveLength(0);
});

it("retries migration after quota then old-source edits without overwriting prior backups", () => {
  for (const alreadyShared of [false, true]) {
    const previous = freshProgress("normal");
    if (alreadyShared) previous.armoryMigration = 1;
    const legacy = fresh();
    const originalNormal = JSON.stringify(previous);
    const originalLegacy = JSON.stringify(legacy);
    const storage = memory({
      [legacyProgressKey]: originalNormal,
      [SAVE_KEY]: originalLegacy,
    });
    const quota = {
      getItem: storage.getItem,
      setItem(key: string, value: string) {
        if (key === normalKey) throw new Error("quota");
        storage.setItem(key, value);
      },
    };
    expect(() => loadProgress("normal", quota)).toThrow();
    previous.coins = 321;
    legacy.powder = 17;
    storage.setItem(legacyProgressKey, JSON.stringify(previous));
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));
    const next = loadProgress("normal", storage)!;
    expect(next.coins).toBe(321);
    const suffix = alreadyShared ? "before-shared-v3" : "before-shared-armory";
    expect(storage.getItem(`${legacyProgressKey}-${suffix}`)).toBe(
      originalNormal,
    );
    expect(storage.getItem(`${legacyProgressKey}-${suffix}-1`)).toBe(
      JSON.stringify(previous),
    );
    if (!alreadyShared) {
      expect(next.powder).toBe(17);
      expect(storage.getItem(`${SAVE_KEY}-before-shared-armory`)).toBe(
        originalLegacy,
      );
      expect(storage.getItem(`${SAVE_KEY}-before-shared-armory-1`)).toBe(
        JSON.stringify(legacy),
      );
    }
  }
});

function collectionRecoveryFixture() {
  const storage = memory();
  loadSharedCoopSave(storage);
  const base = grantResult(
    loadProgress("normal", storage)!,
    {
      run: "receipt-run",
      stage: 1,
      difficulty: "normal",
      win: true,
      time: 10,
      kills: 1,
      missions: [true, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.5,
  );
  persistProgress(base, storage);
  const x = roll("receipt-x"),
    y = roll("receipt-y");
  const pending = appendCollected(base, [x, y]);
  let latest = chooseReward(
    prepareChoice(appendCollected(base, [x]), () => 0.5),
    false,
  );
  latest = dismantle(latest, [x.id]);
  return { storage, base, pending, latest, x, y };
}

it.each([false, true])(
  "does not resurrect normally received and dismantled collection rewards (later run: %s)",
  (laterRun) => {
    const fixture = collectionRecoveryFixture();
    const { storage, base, pending, x, y } = fixture;
    let { latest } = fixture;
    if (laterRun)
      latest = grantResult(
        latest,
        {
          run: "later-run",
          stage: 1,
          difficulty: "normal",
          win: false,
          time: 1,
          kills: 0,
          missions: [false, false, false],
          weapons: [],
          collected: 0,
        },
        () => 0.5,
      );
    persistProgress(latest, storage);
    const powder = latest.powder,
      coins = latest.coins;
    expect(latest.weaponReceipts!.ids).toContain(x.id);
    let recovered = recoverUnsavedResult(base, pending, storage);
    expect(allWeapons(recovered).some((w) => w.id === x.id)).toBe(false);
    expect(allWeapons(recovered).filter((w) => w.id === y.id)).toHaveLength(1);
    expect(recovered.powder).toBe(powder);
    expect(recovered.coins).toBe(coins);
    recovered = dismantle(recovered, [y.id]);
    persistProgress(recovered, storage);
    const dismantledPowder = recovered.powder;
    const replay = chooseReward(
      prepareChoice(pending, () => 0.5),
      false,
    );
    // Different recovery identity: receipt history, not just exact replay detection, protects Y.
    const again = recoverUnsavedResult(base, replay, storage);
    expect(allWeapons(again).some((w) => [x.id, y.id].includes(w.id))).toBe(
      false,
    );
    expect(again.powder).toBe(dismantledPowder);
    const raw = storage.getItem(normalKey);
    recoverUnsavedResult(base, replay, storage);
    expect(storage.getItem(normalKey)).toBe(raw);
  },
);

it("keeps weapon receipt history across co-op dismantling and a later result", () => {
  const { storage, base, pending, x } = collectionRecoveryFixture();
  const accepted = chooseReward(
    prepareChoice(appendCollected(base, [x]), () => 0.5),
    false,
  );
  persistProgress(accepted, storage);
  const coop = dismantleWeapons(loadSharedCoopSave(storage), [x.id]);
  persistSharedCoopSave(coop, storage);
  const latest = grantResult(
    loadProgress("normal", storage)!,
    {
      run: "after-coop",
      stage: 1,
      difficulty: "normal",
      win: false,
      time: 1,
      kills: 0,
      missions: [false, false, false],
      weapons: [],
      collected: 0,
    },
    () => 0.5,
  );
  persistProgress(latest, storage);
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(allWeapons(recovered).some((w) => w.id === x.id)).toBe(false);
  expect(recovered.powder).toBe(coop.powder);
});

it("uses the retained result for pre-ledger saves and refuses unknowable historical recovery", () => {
  const { storage, base, pending, latest, x, y } = collectionRecoveryFixture();
  delete latest.weaponReceipts;
  // Simulate the exact old format: bypass the new writer's automatic receipt retention.
  storage.setItem(normalKey, JSON.stringify(latest));
  const recovered = recoverUnsavedResult(base, pending, storage);
  expect(allWeapons(recovered).some((w) => w.id === x.id)).toBe(false);
  expect(allWeapons(recovered).filter((w) => w.id === y.id)).toHaveLength(1);
  const historical = structuredClone(latest);
  delete historical.result;
  storage.setItem(normalKey, JSON.stringify(historical));
  const raw = storage.getItem(normalKey);
  expect(() => recoverUnsavedResult(base, pending, storage)).toThrow(
    "古い受領履歴",
  );
  expect(storage.getItem(normalKey)).toBe(raw);
});
