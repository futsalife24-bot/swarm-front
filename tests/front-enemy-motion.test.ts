import { expect, it } from "vitest";
import { FrontEnemyMotion } from "../src/client/front-enemy-motion";
import { createWorld, spawn } from "../src/shared/game";

function setup() {
  const world = createWorld("buffer", 42);
  world.phase = "battle";
  const enemy = spawn(world, "crawler", 0, 0)!;
  const motion = new FrontEnemyMotion();
  const receive = (time: number, receiptMs = time * 1000) => {
    world.time = time;
    enemy.x = time * 5;
    motion.receive(world, receiptMs);
  };
  const sample = (now: number) => {
    motion.beginFrame(now);
    return motion.sample(enemy);
  };
  return { world, enemy, motion, receive, sample };
}

it("100ms配信を150ms遅延でフレーム間補間し、権威状態は変更しない", () => {
  const { world, enemy, receive, sample } = setup();
  receive(0);
  receive(0.1);
  receive(0.2);
  receive(0.3);
  const before = JSON.stringify(world);
  expect(sample(300).x).toBeCloseTo(0.75);
  expect(sample(316).x).toBeCloseTo(0.83);
  expect(sample(332).x).toBeCloseTo(0.91);
  expect(sample(332)).not.toBe(enemy);
  expect(JSON.stringify(world)).toBe(before);
});

it("70～286ms相当の往復遅延変動でも一定速度の敵が停止と追いつきを繰り返さない", () => {
  const { enemy, receive, sample } = setup();
  const arrivals = Array.from({ length: 30 }, (_, i) => ({
    time: i / 10,
    at: i * 100 + [35, 75, 143, 70, 35][i % 5],
  }));
  let index = 0;
  const positions: number[] = [];
  let legacy = 0;
  const oldPositions: number[] = [];
  for (let ms = 0; ms <= 2900; ms += 10) {
    while (index < arrivals.length && arrivals[index].at <= ms) {
      const a = arrivals[index++];
      receive(a.time, a.at);
    }
    const value = sample(ms).x;
    legacy += (enemy.x - legacy) * (1 - Math.exp(-0.01 * 12));
    if (ms >= 500) {
      positions.push(value);
      oldPositions.push(legacy);
    }
  }
  const variation = (xs: number[]) => {
    const speeds = xs.slice(1).map((x, i) => (x - xs[i]) / 0.01);
    return Math.max(...speeds) - Math.min(...speeds);
  };
  expect(variation(positions)).toBeLessThan(0.001);
  expect(variation(oldPositions)).toBeGreaterThan(5);
});

it("受信途絶時は100msだけ外挿して停止し、長い途絶とrun変更では履歴を捨てる", () => {
  const { world, receive, sample } = setup();
  receive(0);
  receive(0.1);
  expect(sample(450).x).toBeCloseTo(1);
  expect(sample(900).x).toBeCloseTo(1);
  receive(2, 2000);
  expect(sample(2000).x).toBe(10);
  world.run = "next";
  receive(0, 2100);
  expect(sample(2100).x).toBe(0);
});

it("壁時計やRTT補正に依存せず、重複時刻と到着遅れで表示時計を巻き戻さない", () => {
  const { receive, sample } = setup();
  receive(0, 10000);
  receive(0.1, 10100);
  const x = sample(10200).x;
  receive(0.1, 10200);
  expect(sample(10200).x).toBe(x);
  receive(0.2, 10286);
  expect(sample(10286).x).toBeGreaterThanOrEqual(x);
});

it("新規個体・テレポート・リセットは古い位置を再利用しない", () => {
  const { world, enemy, receive, sample, motion } = setup();
  receive(0);
  receive(0.1);
  enemy.x = 100;
  world.time = 0.2;
  motion.receive(world, 200);
  expect(sample(300).x).toBe(100);
  const fresh = { ...enemy, id: 999, x: 25 };
  expect(motion.sample(fresh)).toBe(fresh);
  motion.reset();
  expect(motion.enabled).toBe(false);
  expect(motion.sample(enemy)).toBe(enemy);
});

it("節の位置と角度は補間し、被弾・切断・消滅の状態は最新を維持する", () => {
  const { world, enemy, receive, sample, motion } = setup();
  enemy.segments = [{ x: 0, y: 0, z: 0, heading: Math.PI - 0.1, partHp: 100 }];
  receive(0);
  enemy.segments[0].x = 1;
  enemy.segments[0].heading = -Math.PI + 0.1;
  receive(0.1);
  enemy.hp = 10;
  enemy.hurt = 1;
  const shown = sample(200);
  expect(shown.segments![0].x).toBeCloseTo(0.5);
  expect(shown.segments![0].heading).toBeCloseTo(Math.PI);
  expect(shown.hp).toBe(10);
  expect(shown.hurt).toBe(1);
  enemy.segments[0].partHp = 0;
  expect(sample(201).segments![0].partHp).toBe(0);
  // A split changes topology immediately instead of replaying old body nodes.
  enemy.segments = [];
  expect(sample(202)).toBe(enemy);
  world.enemies = [];
  world.time = 0.2;
  motion.receive(world, 200);
  expect(world.enemies).toEqual([]);
});
