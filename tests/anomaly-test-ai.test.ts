import { describe, expect, it } from "vitest";
import {
  anomalyTestActiveSkill,
  anomalyTestDesiredSkill,
  anomalyTestMovement,
  anomalyTestMoveTarget,
  anomalyTestStance,
  resetAnomalyTestAi,
} from "../src/shared/anomaly-test-ai";
import {
  createAnomalyTestWorld,
  neutral,
  requestAnomalyTestUpdate,
  start,
  step,
} from "../src/shared/game";

const advance = (world: ReturnType<typeof createAnomalyTestWorld>, ticks = 1) => {
  for (let i = 0; i < ticks; i++) step(world, { solo: neutral() });
};

describe("ANOMALYテスト AIフック", () => {
  it("順番はメニュー順に周回し、完了まで次の技へ進まない", () => {
    const world = createAnomalyTestWorld(1, {
      enemies: {
        crawler: { count: 1, action: "sequence" },
      },
    });
    start(world);
    advance(world);
    const crawler = world.enemies[0];
    expect(anomalyTestDesiredSkill(world, crawler)).toBe("pleat-strike");
    world.time += 10;
    expect(anomalyTestDesiredSkill(world, crawler)).toBe("pleat-strike");
    world.anomalyTest!.ai[crawler.id]!.activeSkill = "pleat-strike";
    expect(anomalyTestDesiredSkill(world, crawler)).toBe("pleat-strike");
    resetAnomalyTestAi(world, crawler);
    world.anomalyTest!.enemies.crawler.cursor = 1;
    expect(anomalyTestDesiredSkill(world, crawler)).toBe("pleat-strike");
  });

  it("HARROWの姿勢で技候補を絞り、移動のみでは目標を周回させる", () => {
    const world = createAnomalyTestWorld(2, {
      enemies: { harrow: { count: 1, action: "repeat", skill: "harrow-spin" } },
    });
    start(world);
    advance(world);
    const harrow = world.enemies[0];
    expect(anomalyTestStance(world, harrow)).toBeUndefined();
    requestAnomalyTestUpdate(world, "harrow", 1, {
      action: "orbit",
      stance: "air",
    });
    advance(world);
    expect(anomalyTestMovement(world, harrow)).toBe("orbit");
    expect(anomalyTestStance(world, harrow)).toBe("air");
    const target = world.players[0];
    const moved = anomalyTestMoveTarget(world, harrow, target);
    expect(Math.hypot(moved.x - target.x, moved.z - target.z)).toBeGreaterThan(0);
  });

  it("行動変更は古い予兆と実行中技をリセットする", () => {
    const world = createAnomalyTestWorld(3, {
      enemies: { crawler: { count: 1, action: "repeat", skill: "pleat-strike" } },
    });
    start(world);
    advance(world);
    const crawler = world.enemies[0];
    expect(anomalyTestDesiredSkill(world, crawler)).toBe("pleat-strike");
    crawler.wind = 0.5;
    crawler.pleat!.strike = {
      from: { x: crawler.x, y: crawler.y, z: crawler.z },
      dx: 0,
      dz: 1,
      remaining: 1,
      travel: 0,
      hit: [],
    };
    requestAnomalyTestUpdate(world, "crawler", 1, "wait");
    advance(world);
    expect(crawler.wind).toBe(0);
    expect(crawler.pleat!.strike).toBeUndefined();
    expect(anomalyTestActiveSkill(world, crawler)).toBeUndefined();
  });
});
