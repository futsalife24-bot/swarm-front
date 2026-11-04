import { expect, it } from "vitest";
import { STARTERS, stats } from "../src/shared/defs";
import {
  createFrontRun,
  chooseFrontUpgrade,
  returnFrontRun,
} from "../src/shared/front-run";
import { EquipmentCache } from "../src/shared/state-wire";
import {
  FRONT_BASE_IDS,
  FRONT_FUSION_IDS,
  getEligibleFrontUpgrades,
} from "../src/shared/front-upgrades";
import {
  createFrontSurvivalWeapon,
  isFrontSurvivalWeapon,
} from "../src/shared/front-weapon";

it("専用武器は持込装備と進撃育成に左右されず、カードでのみ強化する", () => {
  const equipment = STARTERS.slice(0, 2).map((weapon) => ({
    ...weapon,
    level: 25,
    mods: { damage: 3, mag: 3, reload: 3 },
  }));
  const before = structuredClone(equipment);
  const run = createFrontRun({
    runId: "dedicated",
    seed: 42,
    fusion: true,
    survivalBuildVersion: 1,
    clearedStage: 25,
    players: [{ id: "player", equipment }],
  });
  const player = run.world.players[0];
  expect(player.weapons).toEqual([
    createFrontSurvivalWeapon("dedicated", "player"),
  ]);
  const offer = run.upgrades.player.offer!;
  expect(
    chooseFrontUpgrade(run, "player", {
      runId: run.world.run,
      requestId: "first",
      offerId: offer.id,
      revision: offer.revision,
      cardId: offer.defaultCardId,
    }),
  ).toBe(true);
  expect(player.weapons).toHaveLength(1);
  expect(isFrontSurvivalWeapon(player.weapons[0])).toBe(true);
  expect(equipment).toEqual(before);
  expect(stats(player.weapons[0]).name).toBe("生存戦ライフル");
});

it("新規則の通常カードは進撃進度や持込候補で制限せず、融合は初期には出ない", () => {
  const narrowPool = FRONT_BASE_IDS.slice(0, 6);
  expect(FRONT_BASE_IDS).toHaveLength(22);
  for (const clearedStage of [0, 25]) {
    const run = createFrontRun({
      runId: `full-pool-${clearedStage}`,
      seed: 1,
      fusion: true,
      survivalBuildVersion: 1,
      clearedStage,
      players: [{ id: "player", pool: narrowPool }],
    });
    expect(run.upgrades.player.pool).toEqual(FRONT_BASE_IDS);
    expect(getEligibleFrontUpgrades(run.upgrades.player).sort()).toEqual(
      [...FRONT_BASE_IDS].sort(),
    );
    expect(
      getEligibleFrontUpgrades(run.upgrades.player).some((id) =>
        FRONT_FUSION_IDS.includes(id as (typeof FRONT_FUSION_IDS)[number]),
      ),
    ).toBe(false);
  }
});

it("旧生存戦と防衛戦では指定した候補を保持する", () => {
  const pool = FRONT_BASE_IDS.slice(0, 6);
  for (const mode of ["survival", "defense"] as const) {
    const run = createFrontRun({
      runId: `old-pool-${mode}`,
      seed: 1,
      mode,
      fusion: true,
      players: [{ id: "player", pool, equipment: STARTERS.slice(0, 2) }],
    });
    expect(run.upgrades.player.pool).toEqual(pool);
    expect(getEligibleFrontUpgrades(run.upgrades.player).sort()).toEqual(
      [...pool].sort(),
    );
  }
});

it("旧作戦と防衛戦は2本の装備を保持する", () => {
  for (const mode of ["survival", "defense", "daily"] as const) {
    const run = createFrontRun({
      runId: "legacy",
      seed: 1,
      day: "2026-11-04",
      mode,
      fusion: true,
      players: [{ id: "player", equipment: STARTERS.slice(0, 2) }],
    });
    expect(run.world.players[0].weapons).toEqual(STARTERS.slice(0, 2));
    expect(run.world.front?.survivalBuildVersion).toBeUndefined();
  }
  expect(() =>
    createFrontRun({
      runId: "invalid",
      seed: 1,
      mode: "defense",
      fusion: true,
      survivalBuildVersion: 1,
      players: [{ id: "player" }],
    }),
  ).toThrow();
});

it("専用武器1本を通信キャッシュで復元し、通常モードの欠損は拒否する", () => {
  const run = createFrontRun({
    runId: "cache",
    seed: 1,
    fusion: true,
    survivalBuildVersion: 1,
    players: [{ id: "player" }],
  });
  const cache = new EquipmentCache();
  expect(cache.restore(run.world, false)).toBe(true);
  const snapshot = structuredClone(run.world);
  snapshot.players[0].weapons = [];
  expect(cache.restore(snapshot, true)).toBe(true);
  expect(snapshot.players[0].weapons).toEqual(run.world.players[0].weapons);
  delete snapshot.front?.survivalBuildVersion;
  expect(new EquipmentCache().restore(snapshot, false)).toBe(false);
});

it("帰還報酬に専用武器を保存せず、既存の報酬Lvを維持する", () => {
  const run = createFrontRun({
    runId: "reward",
    seed: 1,
    fusion: true,
    survivalBuildVersion: 1,
    clearedStage: 8,
    players: [{ id: "player" }],
  });
  run.phase = "combat";
  run.world.time = 60;
  run.world.players[0].kills = 1;
  expect(returnFrontRun(run)).toBe(true);
  expect(run.world.rewards.player).toHaveLength(1);
  expect(run.world.rewards.player[0].level).toBe(9);
  expect(run.world.rewards.player.some(isFrontSurvivalWeapon)).toBe(false);
});
