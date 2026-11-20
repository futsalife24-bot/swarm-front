import { describe, expect, it } from "vitest";
import {
  ANOMALY_TEST_LIMIT,
  addPlayer,
  anomalyTestBossCount,
  anomalyTestCompare,
  anomalyTestCurrentCount,
  anomalyTestMetrics,
  anomalyTestP95,
  anomalyTestSignature,
  anomalyTestTotalCount,
  createWorld,
  createAnomalyTestWorld,
  finish,
  hurtEnemy,
  hurtPlayer,
  neutral,
  requestAnomalyTestUpdate,
  requestAnomalyTestUpdates,
  restartAnomalyTestWorld,
  spawn,
  start,
  step,
} from "../src/shared/game";
import { anomalyStageInternal } from "../src/shared/anomaly-test";
import { initSolo } from "../src/shared/solo-progression";
import { stageFor } from "../src/shared/stages";

const advance = (world: ReturnType<typeof createAnomalyTestWorld>, ticks = 1) => {
  for (let i = 0; i < ticks; i++) step(world, { solo: neutral() });
};

describe("ANOMALYテスト フェーズ2", () => {
  it("合計120体とボス3体の上限を超える入力を丸めず拒否する", () => {
    const world = createAnomalyTestWorld(1, {
      enemies: { crawler: { count: 119 }, boss: { count: 0 } },
    });
    expect(ANOMALY_TEST_LIMIT).toBe(120);
    expect(() => requestAnomalyTestUpdate(world, "crawler", 121)).toThrow(
      "0〜120の整数",
    );
    const pendingCount = world.anomalyTest!.enemies.ant.pendingCount;
    expect(() => requestAnomalyTestUpdate(world, "ant", 2)).toThrow("合計は120体まで");
    expect(world.anomalyTest!.enemies.ant.pendingCount).toBe(pendingCount);

    const bosses = createAnomalyTestWorld(2, {
      enemies: { harrow: { count: 2 }, worm: { count: 0 }, boss: { count: 0 } },
    });
    expect(() => requestAnomalyTestUpdate(bosses, "worm", 2)).toThrow(
      "HARROW・CATENA・FOUNDRY ZEROは合計3体まで",
    );
  });

  it("FOUNDRY ZEROとCATENAは同じ内部種でも別IDとして数える", () => {
    const world = createAnomalyTestWorld(3, {
      enemies: { boss: { count: 1 }, worm: { count: 1 }, harrow: { count: 1 } },
    });
    start(world);
    advance(world);
    expect(anomalyTestCurrentCount(world, "boss")).toBe(1);
    expect(anomalyTestCurrentCount(world, "worm")).toBe(1);
    expect(anomalyTestCurrentCount(world, "harrow")).toBe(1);
    expect(anomalyTestBossCount(world)).toBe(3);
    expect(world.enemies.some((e) => e.kind === "boss" && e.segments)).toBe(true);
    expect(world.enemies.some((e) => e.kind === "boss" && !e.segments)).toBe(true);
  });

  it("混成する複数種の体数変更を一括検証して途中の上限をまたいでも反映する", () => {
    const world = createAnomalyTestWorld(11, {
      enemies: { crawler: { count: 120 } },
    });
    start(world);
    advance(world);
    expect(anomalyTestTotalCount(world)).toBe(120);

    requestAnomalyTestUpdates(world, [
      { id: "crawler", count: 117 },
      { id: "boss", count: 1 },
      { id: "worm", count: 1 },
      { id: "harrow", count: 1 },
    ]);
    advance(world);
    expect(anomalyTestCurrentCount(world, "crawler")).toBe(117);
    expect(anomalyTestBossCount(world)).toBe(3);
    expect(anomalyTestTotalCount(world)).toBe(120);

    expect(() =>
      requestAnomalyTestUpdates(world, [
        { id: "crawler", count: 118 },
        { id: "boss", count: 2 },
        { id: "worm", count: 1 },
        { id: "harrow", count: 1 },
      ]),
    ).toThrow("合計は120体まで");
    expect(world.anomalyTest!.enemies.crawler.pendingCount).toBeUndefined();
    expect(world.anomalyTest!.enemies.boss.pendingCount).toBeUndefined();

    const bosses = createAnomalyTestWorld(12, {
      enemies: { crawler: { count: 116 } },
    });
    expect(() =>
      requestAnomalyTestUpdates(bosses, [
        { id: "boss", count: 2 },
        { id: "worm", count: 2 },
      ]),
    ).toThrow("HARROW・CATENA・FOUNDRY ZEROは合計3体まで");
    expect(bosses.anomalyTest!.enemies.boss.pendingCount).toBe(0);
    expect(bosses.anomalyTest!.enemies.worm.pendingCount).toBe(0);
  });

  it("種を追加しても既存個体と他種は保持する", () => {
    const world = createAnomalyTestWorld(4, {
      enemies: { crawler: { count: 2 }, ant: { count: 1 } },
    });
    start(world);
    advance(world);
    const crawler = world.enemies.find((e) => e.kind === "crawler")!;
    const ant = world.enemies.find((e) => e.kind === "ant")!;
    crawler.hp = 12;
    const x = crawler.x;
    const pose = JSON.stringify(crawler.pleat);

    requestAnomalyTestUpdate(world, "crawler", 3, "wait");
    advance(world);

    expect(anomalyTestCurrentCount(world, "crawler")).toBe(3);
    expect(world.enemies.find((e) => e.kind === "crawler")).toBe(crawler);
    expect(crawler.hp).toBe(12);
    expect(crawler.x).toBe(x);
    expect(JSON.stringify(crawler.pleat)).toBe(pose);
    expect(world.enemies.find((e) => e.kind === "ant")).toBe(ant);
  });

  it("観察の防いだ相当量、実戦の被ダメージ、撃破数、経過時間を計測する", () => {
    const observe = createAnomalyTestWorld(5);
    start(observe);
    advance(observe);
    hurtPlayer(observe, observe.players[0], 10);
    for (const frame of [20, 40, 60, 80, 100])
      observe.anomalyTest!.metrics.frameMs.push(frame);
    expect(observe.anomalyTest!.metrics.blocked).toBeGreaterThan(0);
    expect(observe.anomalyTest!.metrics.damage).toBe(0);
    expect(anomalyTestP95(observe)).toBe(100);
    expect(observe.anomalyTest!.metrics.elapsed).toBeGreaterThan(0);

    const live = createAnomalyTestWorld(6, { mode: "live" });
    start(live);
    advance(live);
    hurtPlayer(live, live.players[0], 10);
    expect(live.anomalyTest!.metrics.damage).toBeGreaterThan(0);
    expect(live.anomalyTest!.metrics.blocked).toBe(0);

    const kills = createAnomalyTestWorld(7, { mode: "live" });
    start(kills);
    advance(kills);
    hurtEnemy(kills, kills.enemies[0], 999999, kills.players[0].id);
    advance(kills);
    expect(anomalyTestMetrics(kills).kills).toBe(1);
    expect(kills.phase).toBe("victory");
  });

  it("同じシードと条件なら配置と状態が再現される", () => {
    const config = { enemies: { crawler: { count: 2 }, ant: { count: 1 } } };
    const first = createAnomalyTestWorld(987654, config);
    const second = createAnomalyTestWorld(987654, config);
    start(first);
    start(second);
    advance(first, 30);
    advance(second, 30);
    const snapshot = (world: typeof first) => ({
      seed: world.seed,
      enemies: world.enemies.map((e) => ({
        kind: e.kind,
        hp: e.hp,
        x: e.x,
        z: e.z,
      })),
      player: { x: world.players[0].x, z: world.players[0].z },
    });
    expect(snapshot(first)).toEqual(snapshot(second));
  });

  it("分岐ステージとハードは本編の計算へ渡される", () => {
    const branch3 = createAnomalyTestWorld(8, { stage: "3-A" });
    const branch15 = createAnomalyTestWorld(9, { stage: "15-A", difficulty: "hard" });
    expect(stageFor(branch3).name).toBe("街区奥部の調査");
    expect(stageFor(branch15).name).toBe("異翼の痕跡");
    expect(branch15.solo!.difficulty).toBe("medium");
    expect(stageFor(branch15).hp).toBeCloseTo(1.6875, 5);
  });

  it("同じステージ・難易度・装備なら敵HPと攻撃1回の被ダメージが本編ソロと一致する", () => {
    const cases = [
      { stage: 8 as const, difficulty: "normal" as const },
      { stage: "15-A" as const, difficulty: "hard" as const },
    ];
    for (const { stage, difficulty } of cases) {
      const internal = anomalyStageInternal(stage);
      const anomaly = createAnomalyTestWorld(24680, {
        stage,
        difficulty,
        mode: "live",
        enemies: { crawler: { count: 1 } },
      });
      start(anomaly);
      advance(anomaly);

      const solo = createWorld(crypto.randomUUID(), 24680, internal.stage);
      initSolo(
        solo,
        internal.soloStage,
        difficulty === "hard" ? "medium" : "normal",
        false,
        { hp: 0, aim: 0, move: 0, swap: 0 },
      );
      addPlayer(solo, "solo");
      const soloEnemy = spawn(solo, "crawler", 0, 0, "crown", 0);
      const anomalyEnemy = anomaly.enemies[0];
      expect(soloEnemy).toBeTruthy();
      expect(anomalyEnemy.maxHp).toBe(soloEnemy!.maxHp);
      expect(stageFor(anomaly).hp).toBe(stageFor(solo).hp);
      expect(stageFor(anomaly).damage).toBe(stageFor(solo).damage);

      const anomalyHp = anomaly.players[0].hp;
      const soloHp = solo.players[0].hp;
      hurtPlayer(anomaly, anomaly.players[0], 10);
      hurtPlayer(solo, solo.players[0], 10);
      expect(anomalyHp - anomaly.players[0].hp).toBeCloseTo(
        soloHp - solo.players[0].hp,
        5,
      );
    }
  });

  it("同条件の直前試行だけ数値差を出し、条件変更時は一致判定を落とす", () => {
    const world = createAnomalyTestWorld(10, {
      enemies: { crawler: { count: 2 } },
    });
    start(world);
    advance(world, 10);
    finish(world, true, "比較用");
    const signature = anomalyTestSignature(world);
    const same = anomalyTestCompare(world);
    expect(same?.sameConditions).toBe(true);
    expect(same?.previous.signature).toBe(signature);

    world.phase = "battle";
    requestAnomalyTestUpdate(world, "crawler", 3);
    advance(world);
    expect(world.anomalyTest!.conditionsChanged).toBe(true);
    expect(anomalyTestCompare(world)?.sameConditions).toBe(false);
  });

  it("同条件でやり直すとシードと直前結果を引き継ぐ", () => {
    const world = createAnomalyTestWorld(13579, {
      stage: "3-A",
      difficulty: "hard",
      enemies: { crawler: { count: 2 }, ant: { count: 1 } },
    });
    start(world);
    advance(world, 5);
    finish(world, false, "敗北");
    const retry = restartAnomalyTestWorld(world);
    expect(retry.seed).toBe(world.anomalyTest!.baseSeed);
    expect(retry.anomalyTest!.stage).toBe("3-A");
    expect(retry.anomalyTest!.difficulty).toBe("hard");
    expect(retry.anomalyTest!.lastResult?.reason).toBe("敗北");
    expect(anomalyTestSignature(retry)).toBe(anomalyTestSignature(world));
  });
});
