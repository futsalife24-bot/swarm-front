import { expect, it, vi } from "vitest";
vi.mock("../src/client/weapon-help", () => ({ effectHelp: () => "なし" }));
import {
  freshProgress,
  loadProgress,
  persistProgress,
} from "../src/client/progression-save";
import { setResultWeaponLock } from "../src/client/result-weapon-lock";
import { frontResultRewardsMarkup } from "../src/client/front-result-ui";

function fixture() {
  const values = new Map<string, string>();
  let failing = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failing) throw Error("disk");
      values.set(key, value);
    },
  };
  const save = freshProgress("normal");
  persistProgress(save, storage);
  return {
    storage,
    save,
    fail: () => {
      failing = true;
    },
  };
}
it("最新保存を基準にロック・解除し、無関係な進捗を保持", () => {
  const s = fixture(),
    id = s.save.inventory[0].id;
  s.save.coins = 123;
  persistProgress(s.save, s.storage);
  const locked = setResultWeaponLock(s.storage, id, false);
  expect(locked.locks).toContain(id);
  expect(locked.coins).toBe(123);
  expect(setResultWeaponLock(s.storage, id, true).locks).not.toContain(id);
});
it("重複した古いロック要求を逆向きの操作にしない", () => {
  const s = fixture(),
    id = s.save.inventory[0].id;
  setResultWeaponLock(s.storage, id, false);
  expect(() => setResultWeaponLock(s.storage, id, false)).toThrow(
    "更新されました",
  );
  expect(loadProgress("normal", s.storage)!.locks).toContain(id);
});
it("未所持と未保存は書き込まず、保存失敗でもロック成功を捏造しない", () => {
  const s = fixture(),
    id = s.save.inventory[0].id;
  expect(() => setResultWeaponLock(s.storage, "not-owned", false)).toThrow(
    "保存を確認できません",
  );
  s.fail();
  expect(() => setResultWeaponLock(s.storage, id, false)).toThrow();
  expect(loadProgress("normal", s.storage)!.locks).not.toContain(id);
});
it("保留保存済みの武器もロックできる", () => {
  const s = fixture();
  const weapon = { ...s.save.inventory[0], id: "pending-reward" };
  s.save.pending.push(weapon);
  persistProgress(s.save, s.storage);
  expect(setResultWeaponLock(s.storage, weapon.id, false).locks).toContain(
    weapon.id,
  );
});
it("結果の名前は詳細ボタン、右端はロック。未保存だけ無効", () => {
  const s = fixture();
  const html = frontResultRewardsMarkup({
    coins: 0,
    treasureCoins: 0,
    progress: "",
    campaign: "",
    error: true,
    eligible: true,
    save: s.save,
    weapons: [{ weapon: s.save.inventory[0] as any, state: "unsaved" }],
  });
  expect(html).toContain("data-detail=");
  expect(html).toMatch(/data-lock=[^>]+disabled/);
  expect(html).toContain("未保存");
});
