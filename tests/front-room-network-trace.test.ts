import { describe, expect, it } from "vitest";
import {
  ROOM_TRACE_HISTORY_BYTES,
  ROOM_TRACE_LIMIT,
  RoomNetworkTrace,
  RoomTraceEvent,
} from "../server/room-network-trace";

describe("optional room network trace", () => {
  it("bounds event history and exposes only numeric markers", () => {
    const trace = new RoomNetworkTrace();
    trace.record(RoomTraceEvent.sendStart, 1, 100, 1000);
    trace.record(RoomTraceEvent.sendEnd, 1, 1, 1000);
    for (let n = 0; n < ROOM_TRACE_LIMIT + 20; n++)
      trace.record(RoomTraceEvent.tick, n + 2, 50, 1100 + n * 50);
    const snapshot = trace.snapshot(150, 0, 0, 8000);
    expect(snapshot.sendCalls).toBe(1);
    expect(snapshot.history).toHaveLength(ROOM_TRACE_LIMIT);
    expect(snapshot.history?.[0]?.[0]).toBe(23);
    expect(snapshot.history?.at(-1)?.[0]).toBe(ROOM_TRACE_LIMIT + 22);
    expect(
      snapshot.history?.every((entry) => entry.every(Number.isFinite)),
    ).toBe(true);
    expect(JSON.stringify(snapshot.history).length).toBeLessThanOrEqual(
      ROOM_TRACE_HISTORY_BYTES,
    );
  });

  it("sends the finite history after a gap, then only concise counters", () => {
    const trace = new RoomNetworkTrace();
    trace.record(RoomTraceEvent.encodeEnd, 3, 1, 1000);
    trace.record(RoomTraceEvent.sendEnd, 3, 1, 1000);
    trace.record(RoomTraceEvent.ack, 4, 1234, 1100);
    trace.record(RoomTraceEvent.persistStart, 4, 1, 1200);
    trace.record(RoomTraceEvent.persistEnd, 4, 0, 1300);
    expect(trace.snapshot(4, 0, 0, 1300).history).toBeUndefined();
    const delayed = trace.snapshot(5, 0, 0, 1400);
    expect(delayed).toMatchObject({
      encodes: 1,
      sendCalls: 1,
      acknowledgements: 1,
      persistWrites: 1,
      pendingWrites: 0,
    });
    expect(delayed.history?.map((entry) => entry[1])).toEqual([
      RoomTraceEvent.encodeEnd,
      RoomTraceEvent.sendEnd,
      RoomTraceEvent.ack,
      RoomTraceEvent.persistStart,
      RoomTraceEvent.persistEnd,
    ]);
    trace.sentHistory(delayed.sequence, 1400, delayed.droppedMs);
    expect(trace.snapshot(5, 0, 0, 1500).history).toBeUndefined();
    trace.record(RoomTraceEvent.tick, 6, 50, 2500);
    expect(trace.snapshot(6, 100, 0, 2500).history).toHaveLength(6);
  });
});

it("small responses cannot hide a snapshot send gap", () => {
  const trace = new RoomNetworkTrace();
  trace.record(RoomTraceEvent.sendEnd, 1, 1, 1000);
  for (let t = 1100; t <= 1800; t += 100)
    trace.record(RoomTraceEvent.sendEnd, 2, 2, t);
  const snapshot = trace.snapshot(3, 0, 0, 1800);
  expect(snapshot.sendCalls).toBe(9);
  expect(snapshot.history?.length).toBe(9);
});
