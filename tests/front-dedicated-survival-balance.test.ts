import { expect, it } from "vitest";
import {
  createFrontRun,
  chooseFrontUpgrade,
  frontDedicatedSurvivalThreshold,
  stepFrontRun,
} from "../src/shared/front-run";
import {
  FRONT_BASE_IDS,
  FRONT_UPGRADE_CATALOG,
  createFrontUpgradeState,
  frontCandidateCombinations,
  grantFrontUpgradeRights,
  isValidFrontUpgradeState,
  openFrontUpgradeOffer,
  rerollFrontUpgrade,
  selectFrontUpgrade,
} from "../src/shared/front-upgrades";
import { frontDedicatedSurvivalScale } from "../src/shared/front-survival";
import { hurtEnemy, spawn } from "../src/shared/game";
import { collectFrontXp } from "../src/shared/front-combat";

const pool = FRONT_BASE_IDS.slice(0, 8);
const make = (clearedStage: number, rerolls?: number, dedicated = true) =>
  createFrontRun({
    runId: "new-survival-balance",
    seed: 47,
    fusion: true,
    clearedStage,
    ...(dedicated ? { survivalBuildVersion: 1 as const } : {}),
    players: [
      { id: "p0", pool, ...(rerolls === undefined ? {} : { rerolls }) },
    ],
  });

it("新生存の敵圧は進撃クリアから独立し、5分以降は緩やかに伸びる", () => {
  const low = make(0);
  const high = make(20);
  expect(low.world.campaignPlan!.damage).toBe(high.world.campaignPlan!.damage);
  expect(low.world.front!.enemyCap).toBe(48);
  expect(make(0, undefined, false).world.front!.enemyCap).toBe(96);
  for (const run of [low, high]) {
    const offer = run.upgrades.p0.offer!;
    expect(
      chooseFrontUpgrade(run, "p0", {
        runId: run.world.run,
        offerId: offer.id,
        revision: offer.revision,
        requestId: "opening",
        cardId: offer.defaultCardId,
      }),
    ).toBe(true);
    run.world.time = 180;
    stepFrontRun(run, {}, 0.05, 180);
  }
  expect(low.world.campaignPlan!.damage).toBe(high.world.campaignPlan!.damage);
  expect(low.nextSpawnAt).toBe(high.nextSpawnAt);
  expect(low.pendingSpawns).toEqual(high.pendingSpawns);
  expect(frontDedicatedSurvivalScale(0)).toMatchObject({
    hp: 1.05,
    damage: 0.85,
    spawn: 0.85,
  });
  const atFive = frontDedicatedSurvivalScale(300);
  const atTen = frontDedicatedSurvivalScale(600);
  expect(atFive.hp).toBeCloseTo(1.6);
  expect(atTen.hp - atFive.hp).toBeCloseTo(0.3);
});

it("新生存だけ半径10mでXPを拾い、旧生存は5mと磁石の上積みを維持する", () => {
  const dedicated = make(0);
  const old = make(0, undefined, false);
  for (const run of [dedicated, old]) {
    const p = run.world.players[0];
    run.world.front!.orbs = [{ id: 99, x: p.x + 8, y: 0, z: p.z, value: 2 }];
    collectFrontXp(run.world);
  }
  expect(dedicated.world.front!.xp).toBe(2);
  expect(old.world.front!.xp).toBe(0);
  expect(old.world.front!.orbs).toHaveLength(1);
  const p = dedicated.world.players[0];
  dedicated.world.front!.orbs = [
    { id: 100, x: p.x + 12, y: 0, z: p.z, value: 2 },
  ];
  collectFrontXp(dedicated.world);
  expect(dedicated.world.front!.xp).toBe(2);
  dedicated.world.front!.players[p.id].levels.magnet = 1;
  collectFrontXp(dedicated.world);
  expect(dedicated.world.front!.xp).toBe(4);
});

it("再抽選は新生存で0〜5回を個人設定し、旧作戦は2回のまま", () => {
  expect(make(0).upgrades.p0.rerollsRemaining).toBe(1);
  expect(make(0, 0).upgrades.p0.rerollsRemaining).toBe(0);
  expect(make(0, 5).upgrades.p0.rerollsRemaining).toBe(5);
  expect(make(0, 5, false).upgrades.p0.rerollsRemaining).toBe(2);
  for (const invalid of [-1, 1.5, 6, NaN])
    expect(() => make(0, invalid)).toThrow(RangeError);
  const state = createFrontUpgradeState(
    "reroll-test",
    9,
    undefined,
    pool,
    5,
    true,
  );
  const opening = state.offer!;
  const chosen = selectFrontUpgrade(state, {
    runId: state.runId,
    offerId: opening.id,
    revision: opening.revision,
    requestId: "initial",
    cardId: opening.defaultCardId,
  });
  expect(chosen.ok).toBe(true);
  if (!chosen.ok) return;
  const owed = openFrontUpgradeOffer(grantFrontUpgradeRights(chosen.state, 1));
  expect(owed.ok).toBe(true);
  if (!owed.ok) return;
  let current = owed.state;
  const first = current.offer!;
  for (let index = 1; index <= 5; index++) {
    const offer = current.offer!;
    const result = rerollFrontUpgrade(current, {
      runId: state.runId,
      offerId: offer.id,
      revision: offer.revision,
      requestId: `reroll-${index}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    current = result.state;
    expect(current.rerollsRemaining).toBe(5 - index);
    expect(isValidFrontUpgradeState(current)).toBe(true);
  }
  const duplicate = rerollFrontUpgrade(current, {
    runId: state.runId,
    offerId: first.id,
    revision: first.revision,
    requestId: "reroll-1",
  });
  expect(duplicate.ok).toBe(false);
  if (!duplicate.ok) expect(duplicate.reason).toBe("duplicate-request");
  const exhausted = rerollFrontUpgrade(current, {
    runId: state.runId,
    offerId: current.offer!.id,
    revision: current.offer!.revision,
    requestId: "reroll-6",
  });
  expect(exhausted.ok).toBe(false);
  if (!exhausted.ok) expect(exhausted.reason).toBe("reroll-limit");
});

it("新生存の追加3択は所持強化と新規を残し、融合成立時は融合も残す", () => {
  const state = createFrontUpgradeState(
    "choice-test",
    7,
    undefined,
    FRONT_BASE_IDS,
    1,
    true,
  );
  const initialCardId = state.offer!.defaultCardId;
  const levels = { ...state.levels, [initialCardId]: 1 };
  const ordinary = frontCandidateCombinations({
    levels,
    initialCardId,
    fusion: true,
    pool: FRONT_BASE_IDS,
    buildChoices: true,
  });
  expect(ordinary.length).toBeGreaterThan(0);
  expect(ordinary.every((ids) => ids.includes(initialCardId))).toBe(true);
  expect(ordinary.every((ids) => ids.some((id) => levels[id] === 0))).toBe(
    true,
  );
  const fusedLevels = {
    ...levels,
    fuse: FRONT_UPGRADE_CATALOG.fuse.maxLevel,
    "blast-radius": FRONT_UPGRADE_CATALOG["blast-radius"].maxLevel,
    armor: 1,
  };
  const combinations = frontCandidateCombinations({
    levels: fusedLevels,
    initialCardId,
    fusion: true,
    pool: FRONT_BASE_IDS,
    buildChoices: true,
  });
  expect(combinations.length).toBeGreaterThan(0);
  expect(combinations.every((ids) => ids.includes("fusion-collapse"))).toBe(
    true,
  );
  expect(
    combinations.every((ids) => ids.some((id) => fusedLevels[id] > 0)),
  ).toBe(true);
  expect(
    combinations.every((ids) =>
      ids.some((id) => !fusedLevels[id] && id !== "fusion-collapse"),
    ),
  ).toBe(true);
});

it("既存経験値量による限定計測では3分で融合必要分の6権利、5分で7権利に届く", () => {
  // 通常敵を平均1.5秒に1体倒し、BASTIONを各分1体倒す想定。
  // 実戦の命中率・生存率は含めない。ここでは既存報酬値2/6の閾値だけ測る。
  const run = make(0);
  const crawler = spawn(run.world, "crawler", 0, 0)!;
  hurtEnemy(run.world, crawler, crawler.hp + 1, "p0");
  const crawlerXp = run.world.front!.orbs.at(-1)!.value;
  const bastion = spawn(run.world, "bastion", 0, 0)!;
  hurtEnemy(run.world, bastion, bastion.hp + 1, "p0");
  const bastionXp = run.world.front!.orbs.at(-1)!.value;
  expect([crawlerXp, bastionXp]).toEqual([2, 6]);
  const rightsAt = (seconds: number) => {
    const normalKills = Math.floor(seconds / 1.5);
    const bastions = Math.floor(seconds / 60);
    const xp = normalKills * crawlerXp + bastions * bastionXp;
    return Array.from({ length: 119 }, (_, n) =>
      frontDedicatedSurvivalThreshold(n),
    ).filter((threshold) => xp >= threshold).length;
  };
  expect(rightsAt(180)).toBeGreaterThanOrEqual(6);
  expect(rightsAt(300)).toBeGreaterThanOrEqual(7);
});
