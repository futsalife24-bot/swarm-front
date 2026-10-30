import { expect, it } from "vitest";
import { RoomClock } from "../server/room-clock";

it("keeps thirty seconds of combat within one tick despite callback and work latency", () => {
  const clock = new RoomClock();
  let now = 0;
  let delay = clock.start(now);
  let steps = 0;
  while (now + delay + 13 <= 30_000) {
    // A consistently late timer plus 2 ms of work reproduced cumulative slowdown.
    now += delay + 13;
    steps++;
    now += 2;
    delay = clock.nextDelay(now);
  }
  expect(steps * 0.05).toBeCloseTo(29.95, 5);
  expect(clock.droppedMs).toBe(0);
});

it("uses separate fixed ticks to recover a short stall and bounds a long suspension", () => {
  const clock = new RoomClock();
  clock.start(0);
  expect(clock.nextDelay(180)).toBe(0);
  expect(clock.nextDelay(185)).toBe(0);
  expect(clock.nextDelay(190)).toBe(10);
  expect(clock.nextDelay(200)).toBe(50);
  expect(clock.droppedMs).toBe(0);
  expect(clock.nextDelay(10_000)).toBe(50);
  expect(clock.droppedMs).toBeGreaterThan(9000);
  expect(clock.nextDelay(10_050)).toBe(50);
});

it("drops old debt on resume and handles a backwards system clock", () => {
  const clock = new RoomClock();
  clock.start(1000);
  clock.nextDelay(1100);
  expect(clock.start(20_000)).toBe(50);
  expect(clock.nextDelay(20_050)).toBe(50);
  expect(clock.nextDelay(15_000)).toBe(50);
  expect(clock.nextDelay(15_050)).toBe(50);
});
