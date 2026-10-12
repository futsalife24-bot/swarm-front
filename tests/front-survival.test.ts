import { describe, expect, it } from "vitest";
import {
  createFrontRun,
  forfeitFrontRunPlayer,
  getFrontRunView,
  returnFrontRun,
  stepFrontRun,
} from "../src/shared/front-run";
import {
  finalizeFrontSurvivalRewards,
  frontSurvivalDifficulty,
  frontSurvivalRewardCount,
  validFrontClearedStage,
} from "../src/shared/front-survival";
import { STARTERS, validBattleWeapon } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  fire,
  neutral,
  start,
} from "../src/shared/game";

function make(clearedStage = 5, players = ["host"]) {
  return createFrontRun({
    runId: "survival-test",
    seed: 1234,
    mode: "survival",
    fusion: true,
    clearedStage,
    returnAt: 3600,
    players: players.map((id) => ({ id })),
  });
}

describe("front survival rewards and difficulty", () => {
  it("bounds the campaign snapshot and scales difficulty monotonically", () => {
    expect(validFrontClearedStage(0)).toBe(true);
    expect(validFrontClearedStage(25)).toBe(true);
    for (const invalid of [-1, 26, 1.5, Infinity, NaN, "5"])
      expect(validFrontClearedStage(invalid)).toBe(false);
    expect(() => make(Infinity)).toThrow();
    expect(frontSurvivalDifficulty(10).hpScale).toBeGreaterThan(
      frontSurvivalDifficulty(5).hpScale,
    );
    expect(make(10).world.campaignPlan!.damage).toBeGreaterThan(
      make(5).world.campaignPlan!.damage,
    );
  });

  it("grants a first-minute weapon, kill bonuses, and a 30-weapon cap", () => {
    expect(frontSurvivalRewardCount(59.99, 30)).toBe(0);
    expect(frontSurvivalRewardCount(0, 100)).toBe(0);
    expect(frontSurvivalRewardCount(60, 0)).toBe(0);
    expect(frontSurvivalRewardCount(60, 1)).toBe(1);
    expect(frontSurvivalRewardCount(60, 60)).toBe(3);
    expect(frontSurvivalRewardCount(3600, 900)).toBe(30);
  });

  it("returns permanent validated weapons at the snapshotted level once", () => {
    const run = make();
    run.phase = "combat";
    run.world.time = 180;
    run.world.players[0].kills = 30;
    expect(returnFrontRun(run)).toBe(true);
    expect(run.world.rewards.host).toHaveLength(4);
    expect(run.world.rewards.host.every(validBattleWeapon)).toBe(true);
    expect(run.world.rewards.host.every((weapon) => weapon.level === 6)).toBe(
      true,
    );
    const first = structuredClone(run.world.rewards.host);
    finalizeFrontSurvivalRewards(run.world, 5, ["host"]);
    expect(run.world.rewards.host).toEqual(first);
    expect(getFrontRunView(run, "host").weaponLevel).toBe(6);
  });

  it("keeps reward identifiers valid with the longest allowed member id", () => {
    const id = "a".repeat(80);
    const run = createFrontRun({
      runId: "b".repeat(80),
      seed: 1,
      fusion: true,
      players: [{ id }],
    });
    run.phase = "combat";
    run.world.time = 60;
    run.world.players[0].kills = 1;
    expect(returnFrontRun(run)).toBe(true);
    expect(run.world.rewards[id][0].id.length).toBeLessThanOrEqual(100);
    expect(validBattleWeapon(run.world.rewards[id][0])).toBe(true);
  });

  it("forfeits explicit exits but keeps disconnected members eligible", () => {
    const run = make(3, ["host", "guest"]);
    run.phase = "combat";
    run.world.time = 120;
    run.world.players[1].kills = 1;
    run.world.players[1].connected = false;
    forfeitFrontRunPlayer(run, "host");
    run.returnAt = 100;
    stepFrontRun(run, {}, 0.05, 101);
    expect(run.phase).toBe("victory");
    expect(run.world.rewards.host).toBeUndefined();
    expect(run.world.rewards.guest).toHaveLength(2);
  });

  it("awards defeated participants after at least one minute", () => {
    const run = make();
    run.phase = "combat";
    run.world.time = 120;
    run.world.players[0].hp = 0;
    run.world.players[0].kills = 1;
    stepFrontRun(run, {}, 0.05, 120);
    expect(run.phase).toBe("defeat");
    expect(run.world.rewards.host.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the weapon's upgraded projectile speed in actual fire", () => {
    const world = createWorld("speed-test");
    const player = addPlayer(world, "p", [
      { ...STARTERS[0], kind: "rocket", mods: { speed: 2 } },
      STARTERS[1],
    ]);
    start(world);
    fire(world, player, neutral());
    const projectile = world.projectiles[0];
    expect(Math.hypot(projectile.dx, projectile.dy, projectile.dz)).toBeCloseTo(
      28 * 1.1,
    );
  });
});
