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
  armoryLevelLimit,
  levelUpCost,
  levelUpWeapon,
  levelPlan,
} from "../src/client/weapon-workshop";

describe("武器庫のレベル強化", () => {
  it.each([10, 20, 30, 40, 50])(
    "レア度上限Lv%iまで現行コストと基礎威力+6%で強化する",
    (cap) => {
      let save = freshProgress("normal");
      save.powder = 10000;
      save.inventory[0].rarity = cap / 10 - 1;
      save.inventory[0].power = 1.15 ** save.inventory[0].rarity;
      const id = save.inventory[0].id;
      const base = stats(save.inventory[0]).damage;
      expect(armoryLevelLimit(save.inventory[0])).toBe(cap);
      for (let level = 1; level < cap; level++) {
        const before = structuredClone(save);
        const cost = 2 + level * 2;
        expect(levelUpCost(save.inventory[0])).toBe(cost);
        const next = levelUpWeapon(save, id);
        expect(next.inventory[0].level).toBe(level + 1);
        expect(next.powder).toBe(save.powder - cost);
        expect(stats(next.inventory[0]).damage).toBeCloseTo(
          base * (1 + level * 0.06),
        );
        expect(save).toEqual(before);
        save = next;
      }
      expect(save.powder).toBe(10000 - (cap - 1) * (cap + 2));
      const capped = structuredClone(save);
      expect(() => levelUpWeapon(save, id)).toThrow(`上限 Lv${cap}`);
      expect(save).toEqual(capped);
    },
  );

  it.each([15, 25, 26, 60])(
    "上限超過の既存N Lv%iのレベル・全性能・素材を保持する",
    (level) => {
      const save = freshProgress("normal");
      save.inventory[0].rarity = 0;
      save.inventory[0].level = level;
      save.powder = 10000;
      const before = structuredClone(save);
      const damage = stats(save.inventory[0]);
      expect(() => levelUpWeapon(save, save.inventory[0].id)).toThrow(
        "上限 Lv10",
      );
      expect(save).toEqual(before);
      expect(stats(save.inventory[0])).toEqual(damage);
    },
  );

  it("一括強化は所持数で止まり、個別強化と同じ状態を1回で作る", () => {
    const save = freshProgress("normal");
    save.powder = 18;
    const w = save.inventory[0];
    expect(levelPlan(w, save.powder, 99)).toMatchObject({
      target: 4,
      maximum: 4,
      total: 18,
    });
    expect(levelPlan(w, save.powder, 2).total).toBe(4);
    expect(levelPlan(w, 3, 4)).toMatchObject({ target: 1, total: 0 });
    expect(() => levelUpWeapon(save, w.id, 5)).toThrow("不足");
    const oneAtATime = [2, 3, 4].reduce((s) => levelUpWeapon(s, w.id), save);
    expect(levelUpWeapon(save, w.id, 4)).toEqual(oneAtATime);
    expect(save.powder).toBe(18);
  });
  it.each([0, 1, 1.5, NaN, Infinity, 51])(
    "不正な目標 %s は確定できない",
    (goal) => {
      const save = freshProgress("normal");
      save.powder = 10000;
      expect(() => levelUpWeapon(save, save.inventory[0].id, goal)).toThrow(
        "範囲外",
      );
      expect(save.powder).toBe(10000);
    },
  );

  it("SSRの既存Lv30をLv40まで強化できる", () => {
    let save = freshProgress("normal");
    save.inventory[0].rarity = 3;
    save.inventory[0].power = 1.15 ** 3;
    save.inventory[0].level = 30;
    save.powder = 710;
    for (let level = 30; level < 40; level++)
      save = levelUpWeapon(save, save.inventory[0].id);
    expect(save.inventory[0].level).toBe(40);
    expect(save.powder).toBe(0);
  });

  it.each([0, 1, 2, 3])(
    "旧形式のrarity=%iも表示レア度の上限に従う",
    (rarity) => {
      const save = freshProgress("normal");
      const { format, ...legacy } = save.inventory[0];
      expect(armoryLevelLimit({ ...legacy, rarity })).toBe((rarity + 2) * 10);
    },
  );

  it("不足・対象外は保存状態を変えない", () => {
    const save = freshProgress("normal");
    const original = structuredClone(save);
    expect(() => levelUpWeapon(save, save.inventory[0].id)).toThrow("不足");
    expect(() => levelUpWeapon(save, "unknown")).toThrow("見つかりません");
    expect(save).toEqual(original);
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
