import { describe, it, expect } from "vitest";
import {
  FRONT_BASE_IDS,
  FRONT_FUSIONS,
  FRONT_FUSION_IDS,
  FRONT_UPGRADE_IDS,
  FRONT_UPGRADE_CATALOG,
  createFrontUpgradeState,
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
  selectFrontUpgrade,
  isValidFrontUpgradeState,
  getEligibleFrontUpgrades,
  frontEffectiveLevels,
  frontEvolvedFamilies,
  type FrontUpgradeState,
  type FrontUpgradeId,
} from "../src/shared/front-upgrades";
import {
  createFrontRun,
  chooseFrontUpgrade,
  stepFrontRun,
  getFrontRunView,
  returnFrontRun,
} from "../src/shared/front-run";
import { stats, STARTERS } from "../src/shared/defs";
import { makeWeapon } from "../src/shared/progression";
import {
  recordFrontKill,
  beginFrontShot,
  frontManualHit,
} from "../src/shared/front-combat";
import { spawn, step, neutral } from "../src/shared/game";

function built(
  values: Partial<Record<FrontUpgradeId, number>>,
): FrontUpgradeState {
  const base = createFrontUpgradeState(
    "fusion-test",
    51,
    undefined,
    FRONT_BASE_IDS,
  );
  const levels = { ...base.levels, ...values };
  const picks = Object.values(levels).reduce((a, b) => a + b, 0);
  const s = {
    ...base,
    levels,
    picks,
    revision: picks,
    rightsGranted: 119,
    rightsSpent: picks - 1,
    initialCardId: "afterimage-mine" as const,
    evolved: frontEvolvedFamilies({ levels }).length > 0,
    offer: null,
    offerSerial: picks,
    processedRequestIds: Array.from({ length: picks }, (_, i) => `prior-${i}`),
  };
  expect(isValidFrontUpgradeState(s)).toBe(true);
  return s;
}
function select(s: FrontUpgradeState, id?: FrontUpgradeId) {
  const opened = s.offer ? s : openFrontUpgradeOffer(s).state,
    o = opened.offer!;
  expect(o).not.toBeNull();
  const req = {
    runId: opened.runId,
    offerId: o.id,
    revision: o.revision,
    requestId: `pick-${s.picks}`,
    cardId: id ?? o.defaultCardId,
  };
  const result = selectFrontUpgrade(opened, req);
  expect(result.ok).toBe(true);
  expect(isValidFrontUpgradeState(result.state)).toBe(true);
  expect(selectFrontUpgrade(result.state, req).ok).toBe(false);
  return result.state;
}
describe("融合と個人候補", () => {
  it("ロケットへ射撃強化を固定し、着弾前の武器切替で返却先を変えない", () => {
    const r = createFrontRun({
      runId: "rocket",
      seed: 1,
      fusion: true,
      players: [{ id: "p", equipment: [STARTERS[2], STARTERS[0]] }],
    });
    const p = r.world.players[0],
      c = r.world.front!.players.p;
    c.levels = frontEffectiveLevels({
      ...r.upgrades.p.levels,
      "power-cell": 3,
      "reserve-rounds": 2,
    });
    step(r.world, { p: { ...neutral(), fire: true } }, 0.05);
    const q = r.world.projectiles.find((q) => q.owner === "p")!;
    expect(q.frontSlot).toBe(0);
    expect(q.frontShot).toBeGreaterThan(0);
    expect(q.damage).toBeCloseTo(stats(STARTERS[2]).damage * 1.3);
    p.slot = 1;
    p.ammo = [0, 1];
    const e = spawn(r.world, "crawler", 25, 25, "crown", 0)!;
    frontManualHit(
      r.world,
      e,
      9999,
      "p",
      q.frontShot!,
      0,
      "rocket",
      q.frontSlot,
    );
    expect(p.ammo[0]).toBe(2);
    expect(p.ammo[1]).toBe(1);
  });
  it.each(FRONT_FUSION_IDS)(
    "%s：満枠から1枠空く・効果継承・素材再取得禁止・保存復元",
    (fusion) => {
      const values: Partial<Record<FrontUpgradeId, number>> = {
        "afterimage-mine": 1,
      };
      for (const id of FRONT_FUSIONS[fusion])
        values[id] = FRONT_UPGRADE_CATALOG[id].maxLevel;
      for (const id of FRONT_BASE_IDS) {
        if (Object.keys(values).length >= 6) break;
        values[id] ??= 1;
      }
      const before = built(values),
        offered = openFrontUpgradeOffer(before);
      expect(offered.ok).toBe(true);
      expect(offered.state.offer!.cardIds).toContain(fusion);
      let next = select(offered.state, fusion);
      expect(Object.values(next.levels).filter((n) => n > 0)).toHaveLength(5);
      expect(next.levels[fusion]).toBe(1);
      for (const id of FRONT_FUSIONS[fusion]) {
        expect(next.levels[id]).toBe(0);
        expect(frontEffectiveLevels(next.levels)[id]).toBeGreaterThanOrEqual(
          before.levels[id],
        );
        expect(getEligibleFrontUpgrades(next)).not.toContain(id);
      }
      next = JSON.parse(JSON.stringify(next));
      expect(isValidFrontUpgradeState(next)).toBe(true);
      expect(getEligibleFrontUpgrades(next)).toContain(fusion);
      for (let n = 0; n < 100 && next.levels[fusion] < 3; n++) {
        const opened = openFrontUpgradeOffer(next);
        expect(opened.ok).toBe(true);
        next = select(
          opened.state,
          opened.state.offer!.cardIds.includes(fusion)
            ? fusion
            : opened.state.offer!.defaultCardId,
        );
      }
      expect(next.levels[fusion]).toBe(3);
      expect(getEligibleFrontUpgrades(next)).not.toContain(fusion);
    },
  );
  it("条件不足の融合・設定外・素材を再取得する改ざんを拒否", () => {
    let s = createFrontUpgradeState("pool", 1, undefined, [
      "blast-core",
      "armor-piercer",
      "afterimage-mine",
      "armor",
      "reload",
      "magazine",
    ]);
    s = select(s);
    s = grantFrontUpgradeRights(s, 119);
    expect(getEligibleFrontUpgrades(s)).not.toContain("life-drain");
    expect(
      getEligibleFrontUpgrades(s).some((id) =>
        FRONT_FUSION_IDS.includes(id as any),
      ),
    ).toBe(false);
    expect(() =>
      createFrontUpgradeState("bad", 0, undefined, ["armor"]),
    ).toThrow();
    expect(() =>
      createFrontUpgradeState("bad", 0, undefined, [
        ...FRONT_BASE_IDS,
        "fusion-collapse",
      ]),
    ).toThrow();
  });
  it("100通りの抽選を候補枯渇まで進め、状態・6枠・最大段階を保つ", () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = grantFrontUpgradeRights(
        createFrontUpgradeState(`s${seed}`, seed, undefined, FRONT_BASE_IDS),
        119,
      );
      for (let n = 0; n < 120; n++) {
        if (!s.offer) {
          const opened = openFrontUpgradeOffer(s);
          if (!opened.ok) {
            expect(getEligibleFrontUpgrades(s)).toHaveLength(0);
            break;
          }
          s = opened.state;
        }
        s = select(s, s.offer!.cardIds[(seed + n) % s.offer!.cardIds.length]);
        expect(
          Object.values(s.levels).filter((n) => n > 0).length,
        ).toBeLessThanOrEqual(6);
        for (const id of FRONT_UPGRADE_IDS)
          expect(s.levels[id]).toBeLessThanOrEqual(
            FRONT_UPGRADE_CATALOG[id].maxLevel,
          );
      }
    }
  });
  it("持込武器の全性能を維持し、育成の繰返しで乗算しない", () => {
    const equipment = [
      makeWeapon(
        "r",
        "rocket",
        3,
        { power: 20, reload: 10, range: 20, rate: 10 },
        false,
        0,
        "chain",
      ),
      makeWeapon(
        "s",
        "shotgun",
        2,
        { power: 10, reload: 0, range: 20, rate: 0 },
        false,
        1,
        "repel",
      ),
    ];
    const original = structuredClone(equipment);
    const r = createFrontRun({
      runId: "gun",
      seed: 1,
      fusion: true,
      players: [{ id: "p", equipment }],
    });
    const o = r.upgrades.p.offer!;
    expect(
      chooseFrontUpgrade(r, "p", {
        runId: "gun",
        offerId: o.id,
        revision: 0,
        requestId: "one",
        cardId: o.defaultCardId,
      }),
    ).toBe(true);
    for (let i = 0; i < 2; i++) {
      const actual = stats(r.world.players[0].weapons[i]),
        expected = stats(equipment[i]);
      for (const key of [
        "damage",
        "mag",
        "reload",
        "range",
        "interval",
      ] as const)
        expect(actual[key]).toBeCloseTo(expected[key]);
    }
    expect(equipment).toEqual(original);
    expect(() =>
      createFrontRun({
        runId: "bad-gun",
        seed: 1,
        fusion: true,
        players: [{ id: "p", equipment: [STARTERS[0], STARTERS[0]] }],
      }),
    ).toThrow();
  });
  it("共有経験値で4人同時に選択し、個人候補・期限・9分以降の生存を維持", () => {
    const pools = [
      [
        "blast-core",
        "armor-piercer",
        "afterimage-mine",
        "armor",
        "reload",
        "magazine",
      ],
      [
        "fuse",
        "ricochet",
        "interceptor",
        "magnet",
        "blast-radius",
        "opening-shot",
      ],
    ] as FrontUpgradeId[][];
    const r = createFrontRun({
      runId: "coop",
      seed: 44,
      fusion: true,
      players: Array.from({ length: 4 }, (_, i) => ({
        id: `p${i}`,
        pool: pools[i % 2],
        initialCards: pools[i % 2].slice(0, 3),
      })),
    });
    stepFrontRun(r, {}, 0.05, 16);
    expect(r.phase).toBe("combat");
    r.world.front!.xp = 44;
    stepFrontRun(r, {}, 0.05, 17);
    expect(r.phase).toBe("selection");
    for (let i = 0; i < 4; i++) {
      expect(r.upgrades[`p${i}`].rightsGranted).toBe(2);
      expect(
        r.upgrades[`p${i}`].offer!.cardIds.every((id) =>
          pools[i % 2].includes(id),
        ),
      ).toBe(true);
    }
    const restored = JSON.parse(JSON.stringify(r));
    stepFrontRun(restored, {}, 0.05, 33);
    expect(restored.phase).toBe("combat");
    restored.world.time = 540;
    stepFrontRun(restored, {}, 0.05, 34);
    expect(restored.phase).toBe("combat");
    expect(restored.world.time).toBeGreaterThan(540);
    expect(returnFrontRun(restored)).toBe(false);
  });
  it("新規回復・弾薬返却と融合火力が実戦処理へ反映される", () => {
    const r = createFrontRun({
      runId: "effects",
      seed: 1,
      fusion: true,
      players: [{ id: "p" }],
    });
    const p = r.world.players[0],
      combat = r.world.front!.players.p;
    combat.levels = frontEffectiveLevels({
      ...r.upgrades.p.levels,
      "fusion-overdrive": 2,
      "life-drain": 2,
    });
    p.hp = 100;
    p.ammo[0] = 0;
    const e = spawn(r.world, "crawler", 25, 25, "crown", 0)!;
    recordFrontKill(r.world, e, "p", true);
    expect(p.hp).toBe(102);
    expect(p.ammo[0]).toBe(0);
    frontManualHit(r.world, e, 9999, "p", 1);
    expect(p.ammo[0]).toBe(5);
    expect(beginFrontShot(r.world, p).damageFactor).toBe(1.5);
    expect(getFrontRunView(r, "p").growthVersion).toBe(3);
  });
  it("帰還はソロ生存の1分以降だけ成立し、終了後は二重処理しない", () => {
    const r = createFrontRun({
      runId: "return",
      seed: 1,
      fusion: true,
      players: [{ id: "p" }],
    });
    expect(returnFrontRun(r)).toBe(false);
    r.phase = "combat";
    r.world.time = 59;
    expect(returnFrontRun(r)).toBe(false);
    r.world.time = 60;
    expect(returnFrontRun(r)).toBe(true);
    expect(r.world.phase).toBe("victory");
    expect(returnFrontRun(r)).toBe(false);
  });
});
