import { describe, expect, it } from "vitest";
import {
  ANOMALY_TEST_LIMIT,
  anomalyTestCurrentCount,
  createAnomalyTestWorld,
  hurtPlayer,
  neutral,
  requestAnomalyTestUpdate,
  start,
  step,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";

describe("ANOMALYテスト フェーズ1", () => {
  it("初期設定のPLEAT1体が次のシミュレーション更新で武器庫防衛拠点に出る", () => {
    const world = createAnomalyTestWorld(12345);
    start(world);
    step(world, { solo: neutral() });

    expect(mapFor(world).name).toBe("武器庫防衛拠点");
    expect(anomalyTestCurrentCount(world, "crawler")).toBe(1);
    expect(world.enemies[0].kind).toBe("crawler");
    expect(world.players[0].weapons.map((weapon) => weapon.kind)).toEqual([
      "rifle",
      "shotgun",
    ]);
  });

  it("体数変更は次の更新で差分だけ追加し、既存個体を保持する", () => {
    const world = createAnomalyTestWorld(23456);
    start(world);
    step(world, { solo: neutral() });
    const first = world.enemies[0];

    requestAnomalyTestUpdate(world, "crawler", 3, "free");
    step(world, { solo: neutral() });

    expect(world.enemies).toHaveLength(3);
    expect(world.enemies[0]).toBe(first);
  });

  it("減数は撤去であり、撃破数に数えない", () => {
    const world = createAnomalyTestWorld(34567);
    start(world);
    step(world, { solo: neutral() });
    requestAnomalyTestUpdate(world, "crawler", 3, "free");
    step(world, { solo: neutral() });
    const first = world.enemies[0];

    requestAnomalyTestUpdate(world, "crawler", 1, "free");
    step(world, { solo: neutral() });

    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0]).toBe(first);
    expect(world.totalKills).toBe(0);
  });

  it("待機へ変更したPLEATは予兆と未発射攻撃を取り消して動かない", () => {
    const world = createAnomalyTestWorld(45678);
    start(world);
    step(world, { solo: neutral() });
    const enemy = world.enemies[0];
    enemy.wind = 0.2;
    const x = enemy.x,
      z = enemy.z;

    requestAnomalyTestUpdate(world, "crawler", 1, "wait");
    step(world, { solo: neutral() });

    expect(enemy.wind).toBe(0);
    expect(enemy.x).toBe(x);
    expect(enemy.z).toBe(z);
  });

  it("観察モードでは自機が倒れない", () => {
    const world = createAnomalyTestWorld(56789);
    start(world);
    step(world, { solo: neutral() });

    const initialHp = world.players[0].hp;
    hurtPlayer(world, world.players[0], 999999, true);

    expect(world.players[0].hp).toBe(initialHp);
    expect(world.players[0].down).toBe(0);
  });

  it("指定個体を倒したら観察用に補充する", () => {
    const world = createAnomalyTestWorld(67890);
    start(world);
    step(world, { solo: neutral() });
    const first = world.enemies[0];
    first.hp = 0;

    step(world, { solo: neutral() });

    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0]).not.toBe(first);
    expect(world.enemies[0].kind).toBe("crawler");
  });

  it("非常識な体数入力は保存せずエラーにする", () => {
    const world = createAnomalyTestWorld(78901);
    start(world);
    step(world, { solo: neutral() });

    expect(() =>
      requestAnomalyTestUpdate(
        world,
        "crawler",
        ANOMALY_TEST_LIMIT + 1,
        "free",
      ),
    ).toThrow("0〜40の整数");
  });
});
