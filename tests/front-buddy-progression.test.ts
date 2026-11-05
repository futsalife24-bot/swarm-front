import { describe, expect, it } from "vitest";
import {
  BUDDY_IDS,
  buddyGrowthFactor,
  buddyLevel,
  buddyXpForLevel,
  breakthroughBuddy,
  chooseStarterBuddy,
  drawBuddy,
  equipBuddy,
  freshBuddyProgress,
  settleBuddyRun,
  validBuddyProgress,
} from "../src/shared/buddy-progression";

const policy = { allOwnedPity: "reset" as const };
const starter = () => chooseStarterBuddy(freshBuddyProgress(), "tatara");
describe("バディの収集と育成", () => {
  it("旧保存から独立して初回選択し、再選択・未所持装備を拒否する", () => {
    const old = { weapons: ["rifle"] };
    const fresh = freshBuddyProgress();
    const p = chooseStarterBuddy(fresh, "yosuga");
    expect(old).toEqual({ weapons: ["rifle"] });
    expect(fresh.owned).toEqual({});
    expect(p.selected).toBe("yosuga");
    expect(() => chooseStarterBuddy(p, "tobari")).toThrow();
    expect(() => equipBuddy(p, "oriha")).toThrow();
    expect(equipBuddy(p, null).selected).toBeNull();
    expect(validBuddyProgress(p)).toBe(true);
    expect(validBuddyProgress(undefined)).toBe(false);
  });
  it("通常抽選の区間は4個体で均等、入力不正では消費しない", () => {
    const p = { ...starter(), tickets: 1 };
    [0, 0.25, 0.5, 0.75].forEach((random, i) =>
      expect(
        drawBuddy(p, `draw-${i}`, () => random, policy).receipt.buddyId,
      ).toBe(BUDDY_IDS[i]),
    );
    for (const random of [NaN, Infinity, -0.01, 1])
      expect(() => drawBuddy(p, "bad", () => random, policy)).toThrow();
    expect(p.tickets).toBe(1);
    expect(p.draws).toHaveLength(0);
  });
  it("4回被った次は未所持から均等抽選し、新規で保証をリセットする", () => {
    let p = { ...starter(), tickets: 10 };
    for (let n = 0; n < 4; n++)
      p = drawBuddy(p, `duplicate-${n}`, () => 0, policy).progress;
    expect(p.pity).toBe(4);
    expect(p.fragments).toBe(4);
    [0, 1 / 3, 2 / 3].forEach((random, i) => {
      const result = drawBuddy(p, "guarantee", () => random, policy);
      expect(result.receipt.buddyId).toBe(BUDDY_IDS[i + 1]);
      expect(result.receipt.guaranteed).toBe(true);
      expect(result.progress.pity).toBe(0);
    });
  });
  it("抽選要求の再送は乱数もチケットも再消費しない", () => {
    const first = drawBuddy(
      { ...starter(), tickets: 1 },
      "same",
      () => 0.5,
      policy,
    );
    const again = drawBuddy(
      first.progress,
      "same",
      () => {
        throw Error("再抽選禁止");
      },
      policy,
    );
    expect(again.replayed).toBe(true);
    expect(again.progress).toBe(first.progress);
    expect(again.receipt).toEqual(first.receipt);
  });
  it("全所持後は共通素材へ変換し、全所持カウント方針を明示する", () => {
    let p = { ...starter(), tickets: 10 };
    for (let i = 1; i < 4; i++)
      p = drawBuddy(p, `new-${i}`, () => i / 4, policy).progress;
    p.pity = 3;
    const reset = drawBuddy(p, "reset", () => 0, policy);
    const freeze = drawBuddy(p, "freeze", () => 0, { allOwnedPity: "freeze" });
    expect(reset.progress.pity).toBe(0);
    expect(freeze.progress.pity).toBe(3);
    expect(reset.progress.fragments).toBe(1);
    expect(reset.receipt.guaranteed).toBe(false);
  });
  it("初回突破報酬と戦果は重複せず、3回の反復で1枚と素材を得る", () => {
    const reward = {
      run: "r1",
      stage: 1,
      win: true,
      buddyId: "tatara" as const,
      repeatUnits: 1,
    };
    let p = settleBuddyRun(starter(), reward);
    expect(p.tickets).toBe(2);
    expect(p.fragments).toBe(1);
    expect(settleBuddyRun(p, reward)).toBe(p);
    for (let i = 0; i < 3; i++)
      p = settleBuddyRun(p, { ...reward, run: `repeat-${i}` });
    expect(p.tickets).toBe(3);
    expect(p.fragments).toBe(2);
    expect(p.repeatUnits).toBe(0);
    expect(p.owned.tatara!.xp).toBe(440);
    const defeat = settleBuddyRun(p, {
      ...reward,
      run: "defeat",
      stage: 2,
      win: false,
    });
    expect(defeat.tickets).toBe(p.tickets);
    expect(defeat.fragments).toBe(p.fragments);
    expect(defeat.repeatUnits).toBe(p.repeatUnits);
    expect(defeat.clearedStages).not.toContain(2);
    expect(defeat.owned.tatara!.xp).toBe(440);
    expect(
      settleBuddyRun(defeat, {
        ...reward,
        run: "defeat",
        stage: 2,
        win: false,
      }),
    ).toBe(defeat);
    expect(defeat.runs.filter((id) => id === "defeat")).toHaveLength(1);
  });
  it("戦果で終了時選択を使わず、同行した個体だけを育てる", () => {
    const p = starter();
    p.owned.yosuga = { xp: 0, breakthrough: 0 };
    p.selected = "yosuga";
    const result = settleBuddyRun(p, {
      run: "battle",
      stage: 1,
      win: true,
      buddyId: "tatara",
      repeatUnits: 1,
    });
    expect(result.owned.tatara!.xp).toBe(110);
    expect(result.owned.yosuga!.xp).toBe(0);
    expect(() =>
      settleBuddyRun(p, {
        run: "battle",
        stage: 100,
        win: true,
        buddyId: "tatara",
        repeatUnits: 1,
      }),
    ).toThrow();
  });
  it("共通素材で上限を3段階開放し、最大成長幅を制限する", () => {
    let p = starter();
    p.fragments = 19;
    expect(() => breakthroughBuddy(p, "tatara")).toThrow();
    for (let tier = 0; tier < 3; tier++) {
      p.owned.tatara!.xp = buddyXpForLevel(10 * (tier + 1));
      p = breakthroughBuddy(p, "tatara");
      expect(p.owned.tatara!.breakthrough).toBe(tier + 1);
    }
    expect(p.fragments).toBe(0);
    expect(() => breakthroughBuddy(p, "tatara")).toThrow();
    p.owned.tatara!.xp = buddyXpForLevel(40);
    expect(buddyLevel(p.owned.tatara!)).toBe(40);
    expect(buddyGrowthFactor(40)).toBeCloseTo(1.195);
    expect(() => buddyGrowthFactor(41)).toThrow();
  });
  it("破損した保存・重複履歴・過大通貨を新規化せず拒否する", () => {
    const p = starter();
    for (const patch of [
      { tickets: -1 },
      { pity: 5 },
      { runs: ["r", "r"] },
      { tickets: Infinity },
      { owned: { tatara: { xp: 999999, breakthrough: 0 } } },
      { selected: "tobari" },
      { starterChosen: false },
    ])
      expect(validBuddyProgress({ ...p, ...patch })).toBe(false);
    expect(() =>
      drawBuddy(
        { ...p, tickets: 1, fragments: 1000000 },
        "overflow",
        () => 0,
        policy,
      ),
    ).toThrow();
  });
});
