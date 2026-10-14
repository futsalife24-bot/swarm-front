import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/shared/defs";
import {
  FRONT_RUN_CONFIG,
  chooseFrontUpgrade,
  createFrontRun,
  stepFrontRun,
} from "../src/shared/front-run";
import { frontSurvivalDifficulty } from "../src/shared/front-survival";
import {
  addPlayer,
  createWorld,
  hurtPlayer,
  neutral,
  spawn,
  start,
  step,
  type Enemy,
  type World,
} from "../src/shared/game";
import { stageFor } from "../src/shared/stages";

const partySizes = [1, 2, 3, 4] as const;

function worldWithPlayers(count: number) {
  const world = createWorld(`party-health-${count}`, 9234);
  for (let index = 0; index < count; index++) addPlayer(world, `p${index}`);
  start(world);
  return world;
}

function baseEnemyHp(world: World, enemy: Enemy) {
  return ENEMIES[enemy.kind].hp * stageFor(world).hp * enemy.size;
}

function scheduledFusionEnemy(count: number, clearedStage: number) {
  const run = createFrontRun({
    runId: `party-survival-${count}-${clearedStage}`,
    seed: 1234,
    fusion: true,
    mode: "survival",
    clearedStage,
    players: Array.from({ length: count }, (_, index) => ({ id: `p${index}` })),
  });
  for (const player of run.world.players) {
    const offer = run.upgrades[player.id].offer!;
    expect(
      chooseFrontUpgrade(
        run,
        player.id,
        {
          runId: run.world.run,
          offerId: offer.id,
          revision: offer.revision,
          requestId: `first-${player.id}`,
          cardId: offer.defaultCardId,
        },
        0,
      ),
    ).toBe(true);
  }
  expect(run.phase).toBe("combat");
  stepFrontRun(run, {}, 0.05, 1);
  expect(run.pendingSpawns).toHaveLength(1);
  run.world.time = run.pendingSpawns[0].at;
  stepFrontRun(run, {}, 0.05, 2);
  const enemy = run.world.enemies.find(
    (candidate) => candidate.kind === "crawler",
  );
  expect(enemy).toBeDefined();
  return { world: run.world, enemy: enemy! };
}

describe("party enemy health", () => {
  it("applies the sortie party scale once to spawned HP, without scaling incoming damage or player HP", () => {
    const samples = partySizes.map((count) => {
      const world = worldWithPlayers(count);
      const enemy = spawn(world, "crawler", 0, -20)!;
      const player = world.players[0];
      const startingHp = player.hp;
      hurtPlayer(world, player, ENEMIES.crawler.damage);
      expect(enemy.maxHp).toBeCloseTo(baseEnemyHp(world, enemy) * world.scale);
      expect(enemy.hp).toBe(enemy.maxHp);
      return {
        scale: world.scale,
        enemyRatio: enemy.maxHp / baseEnemyHp(world, enemy),
        startingHp,
        damageTaken: startingHp - player.hp,
      };
    });
    expect(samples.map((sample) => sample.scale)).toEqual([1, 1.75, 2.5, 3.25]);
    // 全員が均等に攻撃した場合の一人当たりの担当HPをソロ比で確認する。
    samples.forEach((sample, index) => {
      const perPlayerWorkload = sample.enemyRatio / partySizes[index];
      expect(perPlayerWorkload).toBeGreaterThanOrEqual(0.8);
      expect(perPlayerWorkload).toBeLessThanOrEqual(1);
    });
    for (const sample of samples) {
      expect(sample.enemyRatio).toBeCloseTo(sample.scale);
      expect(sample.startingHp).toBe(samples[0].startingHp);
      expect(sample.damageTaken).toBe(samples[0].damageTaken);
    }
    const frontMaxHp = partySizes.map((count) => {
      const run = createFrontRun({
        runId: `party-max-hp-${count}`,
        seed: 9234,
        fusion: true,
        mode: "survival",
        players: Array.from({ length: count }, (_, index) => ({
          id: `p${index}`,
        })),
      });
      return run.world.players.map(
        (player) => run.world.front!.players[player.id].maxHp,
      );
    });
    for (const values of frontMaxHp)
      expect(values).toEqual(Array(values.length).fill(frontMaxHp[0][0]));
  });

  it("keeps the launch scale and already damaged HP when party members disconnect or fall", () => {
    const world = worldWithPlayers(4);
    const initialScale = world.scale;
    const enemy = spawn(world, "crawler", 0, -20)!;
    enemy.hp -= 17;
    const damagedHp = enemy.hp;
    world.players[1].connected = false;
    world.players[2].hp = 0;
    step(
      world,
      Object.fromEntries(world.players.map((player) => [player.id, neutral()])),
    );
    expect(world.scale).toBe(initialScale);
    expect(enemy.maxHp).toBeCloseTo(baseEnemyHp(world, enemy) * initialScale);
    expect(enemy.hp).toBe(damagedHp);
    const laterEnemy = spawn(world, "crawler", 4, -20)!;
    expect(laterEnemy.maxHp).toBeCloseTo(
      baseEnemyHp(world, laterEnemy) * initialScale,
    );
  });

  it("does not rewrite the scale already stored in an active world", () => {
    const world = worldWithPlayers(4);
    const previousPartyScale = 2.65;
    world.scale = previousPartyScale;
    step(
      world,
      Object.fromEntries(world.players.map((player) => [player.id, neutral()])),
    );
    expect(world.scale).toBe(previousPartyScale);
    const enemy = spawn(world, "crawler", 4, -20)!;
    expect(enemy.maxHp / baseEnemyHp(world, enemy)).toBeCloseTo(
      previousPartyScale,
    );
  });

  it("combines party and cleared-stage health exactly once in the real survival spawn schedule", () => {
    for (const count of partySizes) {
      const baseline = scheduledFusionEnemy(count, 0);
      const baselineRatio =
        baseline.enemy.maxHp / baseEnemyHp(baseline.world, baseline.enemy);
      expect(baselineRatio).toBeCloseTo(
        baseline.world.scale * FRONT_RUN_CONFIG.normalHpMultiplier,
      );
      for (const clearedStage of [10, 25]) {
        const sample = scheduledFusionEnemy(count, clearedStage);
        const ratio =
          sample.enemy.maxHp / baseEnemyHp(sample.world, sample.enemy);
        expect(sample.world.scale).toBe(baseline.world.scale);
        expect(ratio / baselineRatio).toBeCloseTo(
          frontSurvivalDifficulty(clearedStage).hpScale,
        );
      }
    }
    for (const clearedStage of [0, 10, 25]) {
      const solo = scheduledFusionEnemy(1, clearedStage);
      const soloRatio = solo.enemy.maxHp / baseEnemyHp(solo.world, solo.enemy);
      for (const count of [2, 3, 4]) {
        const party = scheduledFusionEnemy(count, clearedStage);
        const partyRatio =
          party.enemy.maxHp / baseEnemyHp(party.world, party.enemy);
        expect(partyRatio / soloRatio).toBeCloseTo(party.world.scale);
      }
    }
  });
});
