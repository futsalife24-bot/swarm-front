import { describe, expect, it } from "vitest";
import { freshProgress, bank } from "../src/client/progression-save";
import { makeWeapon, CAPACITY } from "../src/shared/progression";
import {
  freshBuddyProgress,
  chooseStarterBuddy,
} from "../src/shared/buddy-progression";
import { preservesGrowthSave } from "../src/shared/growth-save-guard";
import { applySupplyReceipt } from "../src/client/supply-rewards";
import {
  validSupplyReceipt,
  type SupplyReceipt,
} from "../src/shared/supply-contract";

const requestId = "11111111-1111-4111-8111-111111111111";
const weapon = (i: number) =>
  makeWeapon(
    `supply-test-${i}`,
    "rifle",
    3,
    { power: 4, reload: 0, range: 8, rate: -2 },
    false,
    i,
  );
const receipt = (rewards: SupplyReceipt["rewards"]): SupplyReceipt => ({
  version: 1,
  requestId,
  count: rewards.length === 10 ? 10 : 1,
  createdAt: 1_000,
  rewards,
});

describe("サーバー確定した補給の受領", () => {
  it("演出の再生回数・再送で武装片を二重付与しない", () => {
    const before = freshProgress("normal"),
      r = receipt([{ type: "shard", amount: 10 }]);
    const next = applySupplyReceipt(before, r);
    expect(next.powder).toBe(before.powder + 10);
    expect(applySupplyReceipt(next, r)).toBe(next);
    expect(before.powder).toBe(0);
    expect(before.receipts).not.toContain(`supply:${requestId}`);
  });

  it("武器を解体した後の再送でも同じ武器が戻らない", () => {
    const r = receipt([{ type: "weapon", weapon: weapon(0) }]);
    const next = applySupplyReceipt(freshProgress("normal"), r);
    next.inventory = next.inventory.filter((w) => w.id !== "supply-test-0");
    expect(applySupplyReceipt(next, r)).toBe(next);
    expect(next.inventory.some((w) => w.id === "supply-test-0")).toBe(false);
  });

  it("10連の新規バディと同一バディの被りを同じ受領で処理する", () => {
    const before = freshProgress("normal");
    before.buddies = chooseStarterBuddy(freshBuddyProgress(), "tatara");
    const r = receipt([
      { type: "buddy", buddyId: "oriha" },
      { type: "buddy", buddyId: "oriha" },
      ...Array.from({ length: 8 }, () => ({
        type: "shard" as const,
        amount: 10,
      })),
    ]);
    const next = applySupplyReceipt(before, r);
    expect(next.buddies!.owned.oriha).toEqual({ xp: 0, breakthrough: 0 });
    expect(next.buddies!.fragments).toBe(1);
    expect(next.buddies!.tickets).toBe(0);
    expect(next.buddies!.pity).toBe(0);
    expect(next.powder).toBe(80);
    expect(applySupplyReceipt(next, r).powder).toBe(80);
  });

  it("初回バディの無料選択を、補給の入手で消費・自動選択しない", () => {
    const before = freshProgress("normal");
    const snapshot = JSON.stringify(before);
    expect(() =>
      applySupplyReceipt(
        before,
        receipt([{ type: "buddy", buddyId: "oriha" }]),
      ),
    ).toThrow("初回バディ");
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("武器一覧の上限でも既存の保留枠へ受領し失わない", () => {
    const before = freshProgress("normal");
    for (let i = 0; i < CAPACITY.perKind; i++) bank(before, [weapon(i)]);
    const r = receipt([{ type: "weapon", weapon: weapon(90) }]);
    const next = applySupplyReceipt(before, r);
    expect(next.pending.some((w) => w.id === "supply-test-90")).toBe(true);
    expect(before.pending.some((w) => w.id === "supply-test-90")).toBe(false);
  });

  it("壊れた受領を一部だけ適用せず、元の保存を保持する", () => {
    const before = freshProgress("normal"),
      snapshot = JSON.stringify(before);
    const r = receipt(
      Array.from({ length: 10 }, () => ({
        type: "shard" as const,
        amount: 10,
      })),
    );
    r.rewards[9] = { type: "shard", amount: -1 };
    expect(() => applySupplyReceipt(before, r)).toThrow();
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("重複した武器ID、件数不一致、テスト保存を拒否する", () => {
    const r = receipt(
      Array.from({ length: 10 }, () => ({
        type: "weapon" as const,
        weapon: weapon(0),
      })),
    );
    expect(validSupplyReceipt(r)).toBe(false);
    expect(
      validSupplyReceipt({
        ...receipt([{ type: "shard", amount: 10 }]),
        count: 10,
      }),
    ).toBe(false);
    expect(() =>
      applySupplyReceipt(
        freshProgress("test"),
        receipt([{ type: "shard", amount: 10 }]),
      ),
    ).toThrow();
  });

  it("旧画面・古いバックアップの上書きで受領記録を失わせない", () => {
    const before = freshProgress("normal");
    const next = applySupplyReceipt(
      before,
      receipt([{ type: "shard", amount: 10 }]),
    );
    expect(
      preservesGrowthSave(
        before as unknown as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
      ),
    ).toBe(true);
    expect(
      preservesGrowthSave(
        next as unknown as Record<string, unknown>,
        before as unknown as Record<string, unknown>,
      ),
    ).toBe(false);
  });
});
