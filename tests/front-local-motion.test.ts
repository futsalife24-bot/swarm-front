import { afterEach, expect, it, vi } from "vitest";
import { FrontLocalMotion } from "../src/client/front-local-motion";
import { addPlayer, createWorld, neutral } from "../src/shared/game";
import { createFrontBattleState } from "../src/shared/front-combat";
import type { Block } from "../src/shared/defs";
import * as stages from "../src/shared/stages";

afterEach(() => vi.restoreAllMocks());
const moving = { mx: 1, mz: 0, yaw: 0 };
const stopped = { mx: 0, mz: 0, yaw: 0 };
function setup(blocks: Block[] = [], x = 0, y = 0) {
  vi.spyOn(stages, "mapFor").mockReturnValue({ ...stages.MAPS[0], blocks });
  const world = createWorld("local-motion", 42);
  const p = addPlayer(world, "p");
  Object.assign(p, { x, z: 0, y, hp: 160, connected: true });
  world.front = createFrontBattleState();
  world.phase = "battle";
  const motion = new FrontLocalMotion();
  motion.receive(world, "p", 0);
  return { world, p, motion };
}

it("最初の入力から7m/sで表示だけ動き、斜めとdtを制限する", () => {
  const { motion } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  expect(motion.update(moving, 0.05, true, 50)?.x).toBeCloseTo(0.35);
  const diagonal = motion.update({ mx: 1, mz: 1, yaw: 0 }, 0.08, true, 130)!;
  expect(Math.hypot(diagonal.x - 0.35, diagonal.z)).toBeCloseTo(0.35);
});

it("同じseqやsnapshotを再受信しても移動を再演せず、同じ時刻も二重積分しない", () => {
  const { motion, world, p } = setup();
  const input = { ...neutral(), seq: 1, mx: 1 };
  motion.sample(input);
  expect(motion.update(moving, 0.05, true, 50)?.x).toBeCloseTo(0.35);
  for (let n = 0; n < 5; n++) {
    motion.sample(input);
    motion.receive(world, "p", 50);
  }
  expect(motion.update(moving, 0.05, true, 50)?.x).toBeCloseTo(0.35);
  p.ack = 1;
  p.x = 0.7; // 同じseqを権威が複数tick適用した状態も、sample回数へ変換しない。
  motion.receive(world, "p", 100);
  expect(motion.update(moving, 0.05, true, 100)?.x).toBeCloseTo(0.7);
});

it("停止時は古いsnapshotへ戻さず、解除入力の適用ACK後に有限時間で補正する", () => {
  const { motion, world, p } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  motion.update(moving, 0.05, true, 50);
  expect(motion.update(moving, 0.05, true, 100)?.x).toBeCloseTo(0.7);
  motion.sample({ ...neutral(), seq: 2 });
  expect(motion.update(stopped, 0.05, true, 150)?.x).toBeCloseTo(0.7);
  p.ack = 1;
  p.x = 0.2;
  motion.receive(world, "p", 200);
  expect(motion.update(stopped, 0.05, true, 200)?.x).toBeCloseTo(0.7);
  p.ack = 2;
  p.x = 0.4;
  motion.receive(world, "p", 250);
  expect(motion.update(stopped, 0.05, true, 250)?.x).toBeCloseTo(0.4);
});

it("停止ACKが来なくても600ms後に補正し、古い表示を永久保持しない", () => {
  const { motion, world } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  motion.update(moving, 0.05, true, 50);
  motion.update(moving, 0.05, true, 100);
  motion.sample({ ...neutral(), seq: 2 });
  motion.update(stopped, 0.05, true, 150);
  for (let at = 200; at < 750; at += 50) {
    motion.receive(world, "p", at);
    expect(motion.update(stopped, 0.05, true, at)?.x).toBeCloseTo(0.7);
  }
  motion.receive(world, "p", 750);
  expect(motion.update(stopped, 0.05, true, 750)?.x).toBeCloseTo(0.35);
  motion.receive(world, "p", 800);
  expect(motion.update(stopped, 0.05, true, 800)?.x).toBeCloseTo(0);
});

it("入力が遅れても先行は3.15m以内、snapshotが500ms途絶えれば解除する", () => {
  const { motion, world } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  for (let at = 50; at <= 1000; at += 50) {
    if (at % 100 === 0) motion.receive(world, "p", at);
    expect(motion.update(moving, 0.05, true, at)!.x).toBeLessThanOrEqual(
      3.15 + 1e-6,
    );
  }
  for (let at = 1050; at <= 1500; at += 50)
    motion.update(moving, 0.05, true, at);
  expect(motion.update(moving, 0.05, true, 1550)).toBeUndefined();
});

it("壁では止まり、壁を挟んだ権威補正を横断表示しない", () => {
  const { motion, world, p } = setup([{ x: 1, z: 0, w: 0.2, d: 10, h: 3 }]);
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  for (let at = 50; at <= 250; at += 50) {
    const point = motion.update(moving, 0.05, true, at)!;
    expect(point.x).toBeLessThanOrEqual(0.35 + 1e-6);
  }
  p.x = 2;
  motion.receive(world, "p", 300);
  expect(motion.update(moving, 0.05, true, 300)).toBeUndefined();
});

it("段差へ乗る表示は予測せず、空中や回避中も権威表示へ戻す", () => {
  const { motion, world, p } = setup([{ x: 1, z: 0, w: 1, d: 10, h: 0.2 }], -1);
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  let last;
  for (let at = 50; at <= 250; at += 50) {
    last = motion.update(moving, 0.05, true, at);
    if (last === undefined) break;
    expect(last.y).toBe(0);
  }
  expect(last).toBeUndefined();
  p.x = -1;
  p.y = 0.4;
  p.verticalSpeed = 1;
  motion.receive(world, "p", 300);
  expect(motion.update(moving, 0.05, true, 300)).toBeUndefined();
  p.y = 0;
  p.verticalSpeed = 0;
  p.evade = 0.3;
  motion.receive(world, "p", 350);
  expect(motion.update(moving, 0.05, true, 350)).toBeUndefined();
});

it.each(["dodge", "jump"] as const)(
  "%s採取後は古いsnapshotで再開せず、適用と接地確認を待つ",
  (action) => {
    const { motion, world, p } = setup();
    motion.sample({ ...neutral(), seq: 1, mx: 1, [action]: true });
    expect(motion.update(moving, 0.05, true, 50)).toBeUndefined();
    motion.sample({ ...neutral(), seq: 2, mx: 1 });
    motion.receive(world, "p", 100);
    expect(motion.update(moving, 0.05, true, 100)).toBeUndefined();
    p.ack = 2;
    motion.receive(world, "p", 150);
    expect(motion.update(moving, 0.05, true, 150)).toBeUndefined();
    expect(motion.update(moving, 0.05, true, 200)?.x).toBeCloseTo(0.35);
  },
);

it("KB-6発射を予測せず、9mの権威変位をゆっくり横断補正しない", () => {
  const { motion, world, p } = setup();
  p.weapons[0] = { ...p.weapons[0], kind: "kick" };
  motion.receive(world, "p", 0);
  motion.sample({ ...neutral(), seq: 1, mx: 1, fire: true });
  expect(motion.update(moving, 0.05, true, 50)).toBeUndefined();
  motion.sample({ ...neutral(), seq: 2, mx: 1 });
  p.x = -9;
  p.ack = 2;
  motion.receive(world, "p", 100);
  expect(motion.update(moving, 0.05, true, 100)).toBeUndefined();
  expect(motion.update(moving, 0.05, true, 150)?.x).toBeCloseTo(-8.65);
});

it.each([
  "run",
  "inactive",
  "disconnect",
  "death",
  "phase",
  "long-frame",
  "frame-gap",
])("%sで過去の予測を破棄する", (reason) => {
  const { motion, world, p } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  motion.update(moving, 0.05, true, 50);
  if (reason === "inactive")
    expect(motion.update(moving, 0.05, false, 100)).toBeUndefined();
  else if (reason === "long-frame")
    expect(motion.update(moving, 0.101, true, 100)).toBeUndefined();
  else if (reason === "frame-gap")
    expect(motion.update(moving, 0.05, true, 200)).toBeUndefined();
  else {
    if (reason === "run") world.run = "next-run";
    if (reason === "disconnect") p.connected = false;
    if (reason === "death") p.hp = 0;
    if (reason === "phase") world.phase = "victory";
    motion.receive(world, "p", 100);
    const point = motion.update(stopped, 0.05, true, 100);
    expect(point?.x ?? p.x).toBe(p.x);
  }
  motion.update(stopped, 0.05, true, 150);
  motion.update(stopped, 0.05, true, 200);
  p.connected = true;
  p.hp = 90;
  world.phase = "battle";
  motion.receive(world, "p", 250);
  const point = motion.update(stopped, 0.05, true, 250);
  expect(point?.x ?? p.x).toBe(p.x);
  motion.sample({ ...neutral(), seq: 2, mx: 1 });
  expect(motion.update(moving, 0.05, true, 300)?.x).toBeCloseTo(0.35);
});

it("大きな権威変位は先行表示を破棄する", () => {
  const { motion, world, p } = setup();
  motion.sample({ ...neutral(), seq: 1, mx: 1 });
  motion.update(moving, 0.05, true, 50);
  p.x = 4;
  motion.receive(world, "p", 100);
  expect(motion.update(moving, 0.05, true, 100)).toBeUndefined();
});

it("snapshotと入力を変更せず、返したPointも内部状態を共有しない", () => {
  const { motion, world } = setup();
  const before = JSON.stringify(world);
  const input = { ...neutral(), seq: 1, mx: 1 };
  const original = { ...input };
  motion.sample(input);
  const point = motion.update(moving, 0.05, true, 50)!;
  point.x = 999;
  motion.receive(world, "p", 50);
  expect(motion.update(moving, 0.05, true, 100)!.x).toBeCloseTo(0.7);
  expect(JSON.stringify(world)).toBe(before);
  expect(input).toEqual(original);
});

it("まだ予測歩行をしていない間の権威変位を保持しない", () => {
  const { motion, world, p } = setup();
  p.x = 0.25;
  motion.receive(world, "p", 100);
  expect(motion.update(stopped, 0.05, true, 100)?.x).toBeCloseTo(0.25);
});
