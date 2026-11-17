import { describe, expect, it } from "vitest";
import { stats } from "../src/shared/defs";
import {
  freshProgress,
  persistProgress,
  loadProgress,
  SaveConflictError,
} from "../src/client/progression-save";
import { preservesGrowthSave } from "../src/shared/growth-save-guard";
import {
  ARMORY_LEVEL_LIMIT,
  levelUpCost,
  levelUpWeapon,
} from "../src/client/weapon-workshop";

describe("武器庫のレベル強化", () => {
  it("Lv25まで必要な武装片だけ消費し、威力を即時に上げる", () => {
    let save = freshProgress("normal");
    save.powder = 1000;
    const id = save.inventory[0].id;
    expect(levelUpCost(save.inventory[0])).toBe(4);
    for (let level = 1; level < ARMORY_LEVEL_LIMIT; level++) {
      const before = save.inventory[0];
      const cost = levelUpCost(before);
      const next = levelUpWeapon(save, id);
      expect(next.inventory[0].level).toBe(level + 1);
      expect(next.powder).toBe(save.powder - cost);
      expect(stats(next.inventory[0]).damage).toBeGreaterThan(
        stats(before).damage,
      );
      save = next;
    }
    expect(levelUpCost({ ...save.inventory[0], level: 24 })).toBe(50);
    expect(() => levelUpWeapon(save, id)).toThrow("上限");
  });

  it("不足・対象外・旧Lv26以上は保存状態を変えない", () => {
    const save = freshProgress("normal");
    const original = structuredClone(save);
    expect(() => levelUpWeapon(save, save.inventory[0].id)).toThrow("不足");
    expect(() => levelUpWeapon(save, "unknown")).toThrow("見つかりません");
    expect(save).toEqual(original);
    save.inventory[0].level = 26;
    save.powder = 100;
    expect(() => levelUpWeapon(save, save.inventory[0].id)).toThrow("上限");
    expect(save.inventory[0].level).toBe(26);
  });

  it("同じ保存を二度確定すると版衝突で二重消費を防ぐ", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const save = freshProgress("normal");
    save.powder = 20;
    persistProgress(save, storage);
    const first = levelUpWeapon(save, save.inventory[0].id);
    const second = levelUpWeapon(save, save.inventory[0].id);
    persistProgress(first, storage);
    expect(() => persistProgress(second, storage)).toThrow(SaveConflictError);
    expect(loadProgress("normal", storage)?.inventory[0].level).toBe(2);
    expect(loadProgress("normal", storage)?.powder).toBe(16);
  });

  it("保存失敗時に素材を失わず、旧保存によるLv巻戻しを拒否する", () => {
    const values = new Map<string, string>();
    let fail = false;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (fail) throw Error("書き込み失敗");
        values.set(key, value);
      },
    };
    const save = freshProgress("normal");
    save.powder = 10;
    persistProgress(save, storage);
    const next = levelUpWeapon(save, save.inventory[0].id);
    fail = true;
    expect(() => persistProgress(next, storage)).toThrow("保存できません");
    expect(loadProgress("normal", storage)?.inventory[0].level).toBeUndefined();
    expect(loadProgress("normal", storage)?.powder).toBe(10);
    fail = false;
    persistProgress(next, storage);
    const older = structuredClone(save);
    older.revision = next.revision;
    expect(preservesGrowthSave(next, older)).toBe(false);
    expect(() => persistProgress(older, storage)).toThrow(SaveConflictError);
    expect(loadProgress("normal", storage)?.inventory[0].level).toBe(2);
    expect(loadProgress("normal", storage)?.powder).toBe(6);
  });
});
