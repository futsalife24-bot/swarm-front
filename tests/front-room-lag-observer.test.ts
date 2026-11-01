import { describe, expect, it } from "vitest";
import {
  ROOM_LAG_MAX_LOGS,
  RoomLagObserver,
  RoomLagReason,
  type RoomLagContext,
  type RoomLagLog,
} from "../server/room-lag-observer";

const context = (tick = 1, pendingWrites = 0): RoomLagContext => ({
  tick,
  pendingWrites,
  droppedMs: 0,
  phase: 1,
});

describe("anonymous Room lag observer", () => {
  it("does not log normal state delivery or 50ms ticks", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    const peer = {};
    observer.start(0);
    for (let n = 1; n <= 60; n++) {
      const now = n * 50;
      observer.tick(now, context(n));
      observer.input(peer, now);
      if (n % 2 === 0) {
        observer.sent(peer, n, now);
        observer.ack(peer, n, now + 40, context(n));
      }
      observer.hold(peer, now, context(n));
    }
    observer.persist(399, 3100, context());
    expect(rows).toEqual([]);
  });

  it("shows continuing input while two state credits await ACK", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    const peer = {};
    observer.start(0);
    observer.input(peer, 80);
    observer.sent(peer, 1_234_567, 100);
    observer.sent(peer, 1_234_568, 200);
    observer.input(peer, 300);
    observer.input(peer, 400);
    observer.input(peer, 500);
    observer.hold(peer, 501, context(10));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reason: RoomLagReason.hold,
      slot: 1,
      tick: 10,
      inFlight: 2,
      oldestAgeMs: 401,
      inputAgeMs: 1,
      sendAgeMs: 301,
      inputsSinceOldest: 3,
    });
    expect(Object.values(rows[0]).every(Number.isFinite)).toBe(true);
    expect(JSON.stringify(rows[0])).not.toContain("1234567");
  });

  it("distinguishes absent input from a stale ACK", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    const peer = {};
    observer.start(0);
    observer.input(peer, 50);
    observer.sent(peer, 1, 100);
    observer.sent(peer, 2, 200);
    observer.hold(peer, 501, context());
    expect(rows[0]).toMatchObject({
      reason: RoomLagReason.hold,
      inputAgeMs: 451,
      ackAgeMs: -1,
      inputsSinceOldest: 0,
    });
  });

  it("reports a delayed ACK even when no full-credit hold was sampled", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    const peer = {};
    observer.start(0);
    observer.sent(peer, 10, 100);
    observer.sent(peer, 11, 200);
    observer.ack(peer, 11, 600, context(12));
    expect(rows[0]).toMatchObject({
      reason: RoomLagReason.lateAck,
      oldestAgeMs: 500,
      inFlight: 2,
    });
    observer.hold(peer, 20_000, context());
    expect(rows).toHaveLength(1);
  });

  it("finds a tick gap but excludes deliberate stop and restart", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    observer.start(0);
    observer.tick(50, context(1));
    observer.tick(301, context(2));
    expect(rows[0]).toMatchObject({
      reason: RoomLagReason.tickGap,
      tickGapMs: 251,
      slot: 0,
    });
    observer.stop();
    observer.tick(5_000, context(3));
    observer.start(12_000);
    observer.tick(12_050, context(4));
    observer.tick(12_301, context(5));
    expect(rows).toHaveLength(2);
    expect(rows[1].tickGapMs).toBe(251);
  });

  it("logs slow storage completion with current pending-write count", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    observer.start(0);
    observer.persist(399, 500, context(8, 1));
    expect(rows).toEqual([]);
    observer.persist(400, 600, context(8, 0));
    expect(rows[0]).toMatchObject({
      reason: RoomLagReason.persist,
      persistMs: 400,
      pendingWrites: 0,
      tick: 8,
    });
  });

  it("limits output per Room and isolates logger failures", () => {
    const rows: RoomLagLog[] = [];
    const observer = new RoomLagObserver((row) => rows.push(row));
    observer.start(0);
    for (let n = 0; n < ROOM_LAG_MAX_LOGS + 20; n++)
      observer.persist(500, n * 10_000, context(n));
    expect(rows).toHaveLength(ROOM_LAG_MAX_LOGS);
    expect(rows.every((row) => Object.values(row).every(Number.isFinite))).toBe(
      true,
    );
    const throwing = new RoomLagObserver(() => {
      throw Error("logger failed");
    });
    throwing.start(0);
    expect(() => throwing.persist(500, 1000, context())).not.toThrow();
  });
});
