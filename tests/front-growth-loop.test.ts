import { describe, expect, it } from "vitest";
import { stats, STARTERS, validBattleWeapon } from "../src/shared/defs";
import {
  makeWeapon,
  validNewWeapon,
  type NewWeapon,
} from "../src/shared/progression";
import {
  freshProgress,
  persistProgress,
  loadProgress,
  newSaveKey,
  validateProgress,
  soldier,
  grantResult,
} from "../src/client/progression-save";
import { convertWeapon, modifyWeapon } from "../src/client/weapon-workshop";
import {
  awardFrontCampaign,
  queueFrontCampaignReward,
  recoverFrontCampaignRewards,
  FRONT_PENDING_REWARDS_KEY,
  highestClearedStage,
} from "../src/client/front-campaign";
import {
  loadSharedCoopSave,
  persistSharedCoopSave,
} from "../src/client/shared-armory";
import { bankRewards } from "../src/client/save";
import { preservesGrowthSave } from "../src/shared/growth-save-guard";
import { frontResultTitle } from "../src/client/front-result-title";
import { recoverUnsavedResult } from "../src/client/save-recovery";
import { validCloudSave } from "../server/player-vault";
import {
  createFrontRun,
  getFrontRunView,
  chooseFrontUpgrade,
} from "../src/shared/front-run";

const storage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
const weapon = (run = "run", index = 0): NewWeapon => ({
  ...makeWeapon(
    `${run}-survival-0-${index}`,
    "rocket",
    1,
    { power: 0, reload: 0, range: 0, rate: 0 },
    false,
    index,
  ),
  level: 4,
});
const spoils = (run = "run") => ({
  weapons: [weapon(run)],
  kills: 31,
  clearedStage: 3,
});

describe("permanent growth loop", () => {
  it("connects one ST1 clear, survival extraction and an affordable first modification", () => {
    const store = storage(),
      base = freshProgress("normal");
    base.armoryMigration = 1;
    const clear = grantResult(
      base,
      {
        run: "first-advance",
        stage: 1,
        difficulty: "normal",
        win: true,
        time: 90,
        kills: 5,
        missions: [true, false, false],
        weapons: [],
        collected: 0,
      },
      () => 0.5,
    );
    persistProgress(clear, store);
    expect(clear.powder).toBe(3);
    const reward = { ...weapon("first-loop"), level: 2 };
    awardFrontCampaign(store, "first-loop", 61, {
      weapons: [reward],
      kills: 1,
      clearedStage: 1,
    });
    const collected = loadProgress("normal", store)!,
      next = modifyWeapon(collected, reward.id, "damage");
    expect(next.powder).toBe(0);
    expect(next.inventory.find((w) => w.id === reward.id)?.mods?.damage).toBe(
      1,
    );
    persistProgress(next, store);
    expect(highestClearedStage(loadProgress("normal", store))).toBe(1);
  });
  it("keeps permanent speed when a run upgrade projects equipment and leaves the stored original unchanged", () => {
    const original = { ...weapon(), mods: { damage: 2, speed: 2, mag: 1 } };
    const run = createFrontRun({
      runId: "growth-battle",
      seed: 5,
      mode: "survival",
      fusion: true,
      players: [
        {
          id: "solo",
          equipment: [original, { ...original, id: "second", kind: "heavy" }],
        },
      ],
    });
    const offer = getFrontRunView(run, "solo").offer!;
    chooseFrontUpgrade(
      run,
      "solo",
      {
        runId: "growth-battle",
        offerId: offer.id,
        revision: offer.revision,
        requestId: "pick",
        cardId: offer.defaultCardId,
      },
      0,
    );
    expect((stats(run.world.players[0].weapons[0]) as any).speed).toBe(
      (stats(original) as any).speed,
    );
    expect(run.originalEquipment!.solo[0]).toEqual(original);
    expect(original.mods).toEqual({ damage: 2, speed: 2, mag: 1 });
  });
  it("validates additive cloud fields and rejects stripped growth and malformed items", () => {
    const save = freshProgress("normal");
    save.inventory[0].mods = { damage: 2 };
    expect(validCloudSave(save)).toBe(true);
    expect(validCloudSave({ ...save, inventory: [null] })).toBe(false);
    expect(
      validCloudSave({
        ...save,
        inventory: [{ ...save.inventory[0], level: 999 }],
      }),
    ).toBe(false);
    const old = structuredClone(save);
    delete old.inventory[0].mods;
    expect(preservesGrowthSave(save as any, old as any)).toBe(false);
    expect(
      preservesGrowthSave(save as any, { ...save, inventory: [null] } as any),
    ).toBe(false);
  });
  it("uses positive survival captions without altering victory or defeat semantics", () => {
    expect(frontResultTitle("survival", "defeat")).toBe("戦闘終了");
    expect(frontResultTitle("survival", "victory")).toBe("撤収完了");
    expect(frontResultTitle("defense", "defeat")).toBe("任務終了");
  });
  it("reads old saves unchanged and preserves original combat stats", () => {
    const s = storage(),
      save = freshProgress("normal");
    save.armoryMigration = 1;
    save.inventory.push({
      ...STARTERS[0],
      id: "legacy",
      acquired: 3,
      testData: false,
    });
    save.serial = 4;
    persistProgress(save, s);
    const raw = s.getItem(newSaveKey("normal"));
    const before = stats(save.inventory[3]);
    const read = loadProgress("normal", s)!;
    expect(stats(read.inventory[3])).toEqual(before);
    expect(read.inventory[3].level).toBeUndefined();
    expect(s.getItem(newSaveKey("normal"))).toBe(raw);
    expect(validateProgress(read)).toBe(read);
  });
  it("converts equipped weapons at the same level and identity, preserving dormant modifications", () => {
    const s = freshProgress("normal");
    s.powder = 100;
    s.inventory[0] = {
      ...weapon(),
      id: s.inventory[0].id,
      mods: { damage: 2, speed: 3, mag: 1 },
    };
    const next = convertWeapon(s, s.inventory[0].id, "rifle");
    expect(next.inventory[0]).toMatchObject({
      id: s.inventory[0].id,
      level: 4,
      rarity: 1,
      mods: { damage: 2, speed: 3, mag: 1 },
    });
    expect(soldier(next).equipped).toEqual(soldier(s).equipped);
    const back = convertWeapon(next, s.inventory[0].id, "rocket");
    expect(stats(back.inventory[0])).toEqual(stats(s.inventory[0]));
    expect(back.powder).toBeLessThan(next.powder);
    expect(s.powder).toBe(100);
  });
  it("modifies only the chosen stat and validates battle equipment in both formats", () => {
    const s = freshProgress("normal");
    s.powder = 100;
    const before = stats(s.inventory[0]);
    const after = modifyWeapon(s, s.inventory[0].id, "damage");
    expect(stats(after.inventory[0]).damage).toBeGreaterThan(before.damage);
    expect(stats(after.inventory[0]).mag).toBe(before.mag);
    expect(validBattleWeapon(after.inventory[0])).toBe(true);
    expect(() => modifyWeapon(s, s.inventory[0].id, "speed")).toThrow();
    expect(validBattleWeapon({ ...STARTERS[0], mods: { damage: 2 } })).toBe(
      true,
    );
    expect(validNewWeapon({ ...s.inventory[0], level: 0 })).toBe(false);
    expect(validNewWeapon({ ...s.inventory[0], mods: { damage: 11 } })).toBe(
      false,
    );
  });
  it("keeps locks, existing material purposes and family capacity", () => {
    const s = freshProgress("normal");
    s.powder = 100;
    s.materials = 7;
    s.locks = [s.inventory[0].id];
    expect(() => convertWeapon(s, s.inventory[0].id, "rocket")).toThrow();
    expect(() => modifyWeapon(s, s.inventory[0].id, "damage")).toThrow();
    s.locks = [];
    const next = modifyWeapon(s, s.inventory[0].id, "mag");
    expect(next.materials).toBe(7);
    for (let i = 0; i < 15; i++)
      s.inventory.push({
        ...s.inventory[2],
        id: `rocket-${i}`,
        acquired: s.serial++,
      });
    expect(() => convertWeapon(s, s.inventory[0].id, "rocket")).toThrow(/上限/);
  });
  it("banks weapons and records atomically on defeat, deduplicates results and restores on reboot", () => {
    const s = storage();
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    persistProgress(save, s);
    expect(queueFrontCampaignReward(s, "run", 125, spoils())).toBe(20);
    expect(queueFrontCampaignReward(s, "run", 125, spoils())).toBe(0);
    const read = loadProgress("normal", s)!;
    expect(read.inventory).toHaveLength(4);
    expect(read.coins).toBe(20);
    expect(read.survival).toMatchObject({
      bestSeconds: 125,
      bestKills: 31,
      runs: 1,
      weapons: 1,
    });
    expect(read.inventory[3].acquired).toBe(3);
    expect(read.inventory[3].mods).toBeUndefined();
  });
  it("recovers failed writes and failed queue cleanup without duplicate weapons or coins", () => {
    const s = storage();
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    persistProgress(save, s);
    const failing = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === newSaveKey("normal")) throw Error("quota");
        s.setItem(k, v);
      },
    };
    expect(() =>
      queueFrontCampaignReward(failing, "run", 125, spoils()),
    ).toThrow();
    expect(loadProgress("normal", s)!.inventory).toHaveLength(3);
    expect(s.getItem(FRONT_PENDING_REWARDS_KEY)).toContain("run");
    expect(recoverFrontCampaignRewards(s)).toBe(20);
    const cleanupFail = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === FRONT_PENDING_REWARDS_KEY && v === "[]") throw Error("quota");
        s.setItem(k, v);
      },
    };
    expect(() =>
      queueFrontCampaignReward(cleanupFail, "second", 125, spoils("second")),
    ).toThrow();
    expect(recoverFrontCampaignRewards(s)).toBe(0);
    expect(loadProgress("normal", s)!.inventory).toHaveLength(5);
    expect(loadProgress("normal", s)!.coins).toBe(40);
  });
  it("preserves full armory and puts excess weapons in pending", () => {
    const s = storage();
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    for (let i = 0; i < 15; i++)
      save.inventory.push({
        ...save.inventory[2],
        id: `full-${i}`,
        acquired: save.serial++,
      });
    persistProgress(save, s);
    awardFrontCampaign(s, "run", 125, spoils());
    const read = loadProgress("normal", s)!;
    expect(read.inventory).toHaveLength(18);
    expect(read.pending).toHaveLength(1);
    expect(read.pending[0].id).toBe("run-survival-0-0");
  });
  it("refuses mismatched runs, invalid levels, oversized rewards and stale growth removal", () => {
    const s = storage();
    expect(() => queueFrontCampaignReward(s, "other", 125, spoils())).toThrow();
    expect(() =>
      queueFrontCampaignReward(s, "run", 125, {
        ...spoils(),
        weapons: [{ ...weapon(), level: 60 }],
      }),
    ).toThrow();
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    save.powder = 30;
    persistProgress(save, s);
    const stale = structuredClone(save),
      modified = modifyWeapon(save, save.inventory[0].id, "damage");
    persistProgress(modified, s);
    expect(() => persistProgress(stale, s)).toThrow();
    stale.revision = modified.revision;
    expect(() => persistProgress(stale, s)).toThrow(/恒久成長/);
    expect(preservesGrowthSave(modified as any, stale as any)).toBe(false);
  });
  it("uses highest cleared campaign progress and one-time advance powder without changing old skill materials", () => {
    const s = freshProgress("normal");
    s.materials = 7;
    const input = {
      run: "advance",
      stage: 3,
      difficulty: "normal" as const,
      win: true,
      time: 90,
      kills: 5,
      missions: [true, false, false],
      weapons: [],
      collected: 0,
    };
    const next = grantResult(s, input, () => 0.5);
    expect(next.powder).toBe(5);
    expect(next.materials).toBe(8);
    expect(highestClearedStage(next)).toBe(3);
    expect(grantResult(next, input, () => 0.5)).toBe(next);
  });
  it("recovers unsaved advance powder only once and preserves previous inventory", () => {
    const store = storage(),
      base = freshProgress("normal");
    base.armoryMigration = 1;
    persistProgress(base, store);
    const pending = grantResult(
      base,
      {
        run: "recover-advance",
        stage: 3,
        difficulty: "normal",
        win: true,
        time: 90,
        kills: 5,
        missions: [true, false, false],
        weapons: [],
        collected: 0,
      },
      () => 0.5,
    );
    const result = recoverUnsavedResult(base, pending, store);
    expect(result.powder).toBe(5);
    expect(result.inventory).toEqual(base.inventory);
    expect(recoverUnsavedResult(base, pending, store).powder).toBe(5);
  });
  it("saves cooperative campaign weapons, currency and unlocks through one shared commit", () => {
    const s = storage();
    const save = freshProgress("normal");
    save.armoryMigration = 1;
    persistProgress(save, s);
    const shared = loadSharedCoopSave(s);
    const next = bankRewards(shared, "coop", [
      { ...STARTERS[0], id: "coop-weapon", level: 2 },
    ]);
    persistSharedCoopSave(next, s, { run: "coop", stage: 2 });
    const read = loadProgress("normal", s)!;
    expect(read.powder).toBe(4);
    expect(read.coins).toBe(120);
    expect(read.missions["2:normal"][0]).toBe(true);
    persistSharedCoopSave(next, s, { run: "coop", stage: 2 });
    expect(loadProgress("normal", s)!.powder).toBe(4);
  });
});
