import { describe, expect, it } from "vitest";
import { supplyResults } from "../src/client/supply-presentation";
import { makeWeapon } from "../src/shared/progression";
import type { SupplyReward } from "../src/shared/supply-contract";
import { drawSupply, orderSupplyRewards } from "../src/shared/supply-policy";

const requestId = "11111111-1111-4111-8111-111111111111";
const shard = (amount: number): SupplyReward => ({ type: "shard", amount });
const weapon = (rarity: 0 | 1 | 2 | 3, index: number): SupplyReward => ({
  type: "weapon",
  weapon: makeWeapon(
    `supply-order-${index}`,
    "rifle",
    rarity,
    { power: 0, reload: 0, range: 0, rate: 0 },
    false,
    index,
  ),
});
const high = (reward: SupplyReward) =>
  reward.type === "buddy" ||
  (reward.type === "weapon" && reward.weapon.rarity >= 2);

describe("補給10連の確定位置", () => {
  it("単発と10枠以外は順序を変えない", () => {
    for (const rewards of [[weapon(2, 0)], [weapon(2, 0), shard(10)]]) {
      const ordered = orderSupplyRewards(rewards);
      expect(ordered).toEqual(rewards);
      expect(ordered).not.toBe(rewards);
      expect(ordered[0]).toBe(rewards[0]);
    }
  });

  it.each([
    ["SR", weapon(2, 3)],
    ["SSR", weapon(3, 3)],
    ["バディ", { type: "buddy", buddyId: "oriha" } as SupplyReward],
  ])("途中の%sを末尾へ移し、個数・同一性・入力を保つ", (_name, winner) => {
    const rewards = Array.from({ length: 10 }, (_, i) => shard(i + 1));
    rewards[3] = winner;
    const before = [...rewards];
    const ordered = orderSupplyRewards(rewards);
    expect(ordered[9]).toBe(winner);
    expect(ordered[3]).toBe(before[9]);
    expect(ordered.slice(0, 3)).toEqual(before.slice(0, 3));
    expect(ordered.slice(4, 9)).toEqual(before.slice(4, 9));
    expect(ordered).toHaveLength(10);
    expect(new Set(ordered)).toEqual(new Set(before));
    expect(rewards).toEqual(before);
    before.forEach((item, i) => expect(rewards[i]).toBe(item));
  });

  it("末尾が当たりなら既存の並びを保ち、複数当たりでも個数を変えない", () => {
    const rewards = [
      weapon(2, 0),
      ...Array.from({ length: 8 }, (_, i) => shard(i + 1)),
      weapon(3, 9),
    ];
    const ordered = orderSupplyRewards(rewards);
    ordered.forEach((item, i) => expect(item).toBe(rewards[i]));
    expect(ordered.filter(high)).toHaveLength(2);

    const middle = [...rewards];
    middle[9] = shard(10);
    middle[5] = { type: "buddy", buddyId: "oriha" };
    const moved = orderSupplyRewards(middle);
    expect(moved[9]).toBe(middle[5]);
    expect(moved.filter(high)).toHaveLength(2);
    expect(middle[9]).toEqual(shard(10));
  });

  it("既に確定した受領の表示だけを末尾当たりにする", () => {
    const rewards = [
      weapon(2, 0),
      ...Array.from({ length: 9 }, (_, i) => shard(i + 1)),
    ];
    const before = [...rewards];
    const results = supplyResults(rewards);
    expect(results[9]).toMatchObject({ type: "weapon", rarity: "SR" });
    expect(results[0]).toMatchObject({ type: "shard", amount: 9 });
    before.forEach((item, i) => expect(rewards[i]).toBe(item));
  });

  it("幅広いseedの10連で末尾がSR以上になり、単発の個数は1", () => {
    for (let seed = 0; seed < 500; seed++) {
      let state = seed + 1;
      const rng = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
      const receipt = drawSupply(10, requestId, 1000, rng);
      expect(receipt.rewards).toHaveLength(10);
      expect(high(receipt.rewards[9])).toBe(true);
    }
    expect(drawSupply(1, requestId, 1000, () => 0.1).rewards).toHaveLength(1);
  });

  it.each([
    [0.1, "weapon", 2],
    [0.8, "weapon", 3],
    [0.99, "buddy", -1],
  ])(
    "当たりゼロ時だけ末尾を条件付き置換し、9件の通常Nを保つ",
    (guarantee, type, rarity) => {
      let calls = 0;
      const receipt = drawSupply(10, requestId, 1000, () => {
        const value = calls++ === 100 ? guarantee : 0.1;
        return value;
      });
      expect(
        receipt.rewards
          .slice(0, 9)
          .every((r) => r.type === "weapon" && r.weapon.rarity === 0),
      ).toBe(true);
      expect(receipt.rewards[9].type).toBe(type);
      if (receipt.rewards[9].type === "weapon")
        expect(receipt.rewards[9].weapon.rarity).toBe(rarity);
      expect(receipt.rewards.filter(high)).toHaveLength(1);
    },
  );

  it("通常枠に当たりがある場合は追加抽選せず10件の内訳を保つ", () => {
    let calls = 0;
    const receipt = drawSupply(10, requestId, 1000, () =>
      calls++ === 0 ? 0.8 : 0.1,
    );
    expect(calls).toBe(102);
    expect(receipt.rewards.filter(high)).toHaveLength(1);
    expect(
      receipt.rewards.filter(
        (r) => r.type === "weapon" && r.weapon.rarity === 0,
      ),
    ).toHaveLength(9);
    expect(receipt.rewards[9]).toMatchObject({
      type: "weapon",
      weapon: { rarity: 2, id: `supply_${requestId.replaceAll("-", "")}_0` },
    });
  });
});
