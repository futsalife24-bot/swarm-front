import { describe, expect, it } from "vitest";
import {
  ADOPTED,
  choosePlan,
  eligible,
  phaseOf,
  validatePlan,
} from "../public/supply-reveal/effect-selection.js";

const ten = (last = 3, first = 4, initialLast = 2) => ({
  multi: true,
  tiers: [first, 1, 1, 1, 1, 1, 1, 1, 1, last],
  initialTiers: [1, 1, 1, 1, 1, 1, 1, 1, 1, initialLast],
});
const single = (tier: number) => ({ multi: false, tiers: [tier] });
const noCue = [0, 0, 0];

describe("採用合図と局面", () => {
  it("既存6案と新規11案だけを候補にする", () => {
    expect(ADOPTED).toHaveLength(17);
    expect(ADOPTED).toEqual([
      1,
      2,
      3,
      4,
      9,
      10,
      "response",
      "signature",
      "heartbeat",
      "multilock",
      "sonic",
      "reverse",
      "reverseSeal",
      "lamp",
      "landing",
      "delayed",
      "skeleton",
    ]);
    expect(ADOPTED.map(phaseOf)).toEqual([
      0, 1, 1, 2, 2, 2, 0, 0, 1, 0, 1, 0, 0, 0, 1, 2, 2,
    ]);
  });

  it.each([
    ["response", 5],
    ["signature", 5],
    ["heartbeat", 5],
    ["multilock", 4],
    ["sonic", 4],
    ["reverse", 4],
    ["reverseSeal", 4],
    ["lamp", 4],
    ["landing", 4],
    ["delayed", 4],
    ["skeleton", 4],
  ])("%sの下限を守る", (id, tier) => {
    expect(eligible(id, single(tier))).toBe(true);
    expect(eligible(id, single(tier - 1))).toBe(false);
  });

  it("数値の旧プレビューAPIは維持する", () => {
    expect(eligible(3, single(4))).toBe(false);
    expect(eligible(3, single(4), true)).toBe(true);
    expect(eligible(10, single(5))).toBe(true);
  });
});

describe("固定結果からの再生計画", () => {
  it("局面ごとに一つ、全新案を対象と共に固定できる", () => {
    for (const id of ADOPTED) {
      const m = ten(3, 5);
      if (id === 3 || id === 9) m.tiers[0] = 4;
      const request = [...noCue];
      request[phaseOf(id)] = id as never;
      const plan = choosePlan(m, request);
      expect(plan.phases[phaseOf(id)]).toBe(id);
      const targeted = [
        3,
        4,
        9,
        10,
        "heartbeat",
        "sonic",
        "landing",
        "delayed",
        "skeleton",
      ].includes(id);
      expect(plan.targets[phaseOf(id)]).toBe(targeted ? 0 : null);
      expect(validatePlan(m, plan)).toBe(true);
    }
  });

  it("単発SSRは一局面のみで、新規②を出せる", () => {
    for (const id of ["sonic", "landing"]) {
      const plan = choosePlan(single(4), id);
      expect(plan.phases[1]).toBe(id);
      expect(plan.targets[1]).toBe(0);
    }
    expect(() => choosePlan(single(4), ["multilock", "sonic", 0])).toThrow();
    expect(choosePlan(single(3), undefined).phases).toEqual(noCue);
    expect(() => choosePlan(single(4), "response")).toThrow();
  });

  it("単発BUDDYは複数局面と同一箱を許す", () => {
    const plan = choosePlan(single(5), ["signature", "heartbeat", 10]);
    expect(plan.targets).toEqual([null, 0, 0]);
    expect(validatePlan(single(5), plan)).toBe(true);
    expect(
      choosePlan(single(5), ["reverse", "landing", "delayed"]).targets,
    ).toEqual([null, 0, 0]);
  });

  it("10連SSR1個は一局面、2個以上とBUDDYありは複数局面を許す", () => {
    expect(() => choosePlan(ten(3, 4), [1, "sonic", 0])).toThrow();
    const two = ten(4, 4, 2);
    expect(choosePlan(two, [1, "sonic", 4]).phases).toEqual([1, "sonic", 4]);
    const buddy = ten(3, 5);
    expect(choosePlan(buddy, ["response", "sonic", 10]).targets).toEqual([
      null,
      0,
      0,
    ]);
  });

  it("最後枠デフォルト色は②を占有し、別局面の可否にも数える", () => {
    const lastOnly = ten(4, 1, 1);
    const implicit = choosePlan(lastOnly, false);
    expect(implicit.phases).toEqual([0, "last-default", 0]);
    expect(implicit.implicitLast).toBe(true);
    expect(() => choosePlan(lastOnly, [1, 0, 0])).toThrow();
    expect(() => choosePlan(lastOnly, [0, "landing", 0])).toThrow();
    const two = ten(4, 4, 1);
    expect(choosePlan(two, [1, 0, 0]).phases).toEqual([1, "last-default", 0]);
    expect(() => choosePlan(two, [0, "sonic", 0])).toThrow();
  });

  it("最後枠SRはデフォルト色から補正し、N/Rの最終枠を拒否する", () => {
    const { initialTiers: _omitted, ...withoutInitial } = ten(3, 4, 1);
    expect(choosePlan(withoutInitial, false).initialTiers[9]).toBe(2);
    expect(() => choosePlan(ten(3, 4, 1), false)).toThrow();
    expect(() => choosePlan(ten(2, 4, 1), false)).toThrow();
    expect(() => choosePlan(ten(1, 4, 1), false)).toThrow();
  });

  it("固定指定の位相、対象、箱色を検証し、結果を変更しない", () => {
    const m = ten(3, 5);
    const before = structuredClone(m);
    const plan = choosePlan(m, ["response", "heartbeat", 10]);
    expect(m).toEqual(before);
    expect(() => choosePlan(m, ["heartbeat", 0, 0])).toThrow();
    expect(() => choosePlan(m, [0, 0, 0, 0])).toThrow();
    expect(() => validatePlan(m, { ...plan, targets: [null, 1, 0] })).toThrow();
    expect(() =>
      validatePlan(m, { ...plan, initialTiers: Array(10).fill(1) }),
    ).toThrow();
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.phases)).toBe(true);
    expect(Object.isFrozen(plan.targets)).toBe(true);
    expect(Object.isFrozen(plan.initialTiers)).toBe(true);
  });

  it("既存候補だけで局面組合せを選び、新案を出さない", () => {
    const enabled = [1, 2, 3, 4, 9, 10];
    const plan = choosePlan(ten(3, 5), undefined, () => 0, false, enabled);
    expect(plan.phases).toEqual([1, 2, 4]);
    expect(
      plan.phases.every((id) => id === 0 || enabled.includes(id as number)),
    ).toBe(true);
  });

  it("多数の決定的乱数でも約束と対象を守る", () => {
    const cases = [
      single(1),
      single(3),
      single(4),
      single(5),
      ten(3, 4),
      ten(4, 4, 1),
      ten(3, 5),
    ];
    for (const m of cases)
      for (let i = 0; i < 100; i++) {
        const plan = choosePlan(m, undefined, () => i / 100);
        expect(validatePlan(m, plan)).toBe(true);
        expect(plan.phases.filter(Boolean).length).toBeLessThanOrEqual(
          m.tiers.includes(5) ||
            (m.multi && m.tiers.filter((tier) => tier >= 4).length >= 2)
            ? 3
            : 1,
        );
      }
    expect(() => choosePlan(single(4), undefined, () => 1)).toThrow();
  });
});
