import { describe, expect, it, vi } from "vitest";
import {
  StateDelivery,
  deliverState,
  minimumSentEvent,
} from "../server/state-delivery";
import { createWorld, event, retireEvents } from "../src/shared/game";
import { LIMITS } from "../src/shared/defs";
import { prepareState } from "../src/shared/state-wire";

const send = (delivery: StateDelivery, id: number, serial = 0) =>
  deliverState(
    delivery,
    id,
    serial,
    () => [String(id)],
    () => true,
  );

describe("connection-local snapshot delivery", () => {
  it("limits a negotiated connection to two actual unacknowledged snapshots", () => {
    const d = new StateDelivery(true);
    expect(send(d, 100)).toBe("sent");
    expect(send(d, 101)).toBe("sent");
    const build = vi.fn(() => ["must not encode"]);
    const write = vi.fn(() => true);
    expect(deliverState(d, 102, 9, build, write)).toBe("deferred");
    expect(build).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(d.inFlight).toEqual([100, 101]);
    expect(d.dirty).toBe(true);
    expect(d.sentEvent).toBe(0);
  });

  it("accepts only real sent IDs and cumulatively releases exactly through that ID", () => {
    const d = new StateDelivery(true);
    send(d, 10);
    send(d, 30);
    for (const bad of [
      undefined,
      null,
      -1,
      0,
      9,
      20,
      31,
      1.5,
      Infinity,
      "30",
      true,
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(d.acknowledge(bad)).toBe(false);
    expect(d.inFlight).toEqual([10, 30]);
    expect(d.acknowledge(30)).toBe(true);
    expect(d.inFlight).toEqual([]);
    expect(d.acknowledge(30)).toBe(false);
    expect(d.acknowledge(10)).toBe(false);
  });

  it("one ACK opens one slot without releasing a later in-flight snapshot", () => {
    const d = new StateDelivery(true);
    send(d, 10);
    send(d, 11);
    expect(d.acknowledge(10)).toBe(true);
    expect(send(d, 12)).toBe("sent");
    expect(d.inFlight).toEqual([11, 12]);
    expect(d.full).toBe(true);
  });

  it("coalesces many dirty ticks to the latest World for only the acknowledged peer", () => {
    const peers = [new StateDelivery(true), new StateDelivery(true)];
    const written: string[][] = [[], []];
    let world = { time: 1, phase: "battle" };
    let nextId = 0;
    const broadcast = (target?: number) =>
      peers.forEach((peer, i) => {
        if (target !== undefined && i !== target) return;
        deliverState(
          peer,
          ++nextId,
          0,
          () => [JSON.stringify(world)],
          (text) => {
            written[i].push(text);
            return true;
          },
        );
      });
    broadcast();
    broadcast();
    for (let time = 2; time <= 12; time++) {
      world = { time, phase: "battle" };
      broadcast();
    }
    expect(written.map((a) => a.length)).toEqual([2, 2]);
    expect(peers[0].acknowledge(peers[0].inFlight[0])).toBe(true);
    if (peers[0].dirty) broadcast(0);
    expect(written.map((a) => a.length)).toEqual([3, 2]);
    expect(JSON.parse(written[0][2]).time).toBe(12);
    expect(peers[0].dirty).toBe(false);
    // Duplicate/unsent ACK cannot create an ACK -> broadcast -> ACK loop.
    expect(peers[0].acknowledge(-1)).toBe(false);
    expect(written.map((a) => a.length)).toEqual([3, 2]);
  });

  it("delivers the dirty final result when ACK arrives after the tick loop stopped", () => {
    const d = new StateDelivery(true);
    send(d, 1);
    send(d, 2);
    const build = () => [
      JSON.stringify({
        type: "state",
        stateId: 3,
        world: { phase: "defeat", time: 30 },
      }),
    ];
    expect(deliverState(d, 3, 8, build, () => true)).toBe("deferred");
    const restored = new StateDelivery(true, d.snapshot());
    expect(restored.dirty).toBe(true);
    expect(restored.acknowledge(1)).toBe(true);
    const received: string[] = [];
    expect(
      deliverState(restored, 3, 8, build, (text) => {
        received.push(text);
        return true;
      }),
    ).toBe("sent");
    expect(JSON.parse(received[0]).world.phase).toBe("defeat");
    expect(restored.inFlight).toEqual([2, 3]);
    expect(restored.dirty).toBe(false);
  });

  it("partial chunk sends do not earn snapshot credits or advance events", () => {
    const d = new StateDelivery(true);
    send(d, 1, 5);
    const sent: string[] = [];
    expect(
      deliverState(
        d,
        2,
        9,
        () => ["first", "failed", "never"],
        (frame) => {
          sent.push(frame);
          return frame !== "failed";
        },
      ),
    ).toBe("failed");
    expect(sent).toEqual(["first", "failed"]);
    expect(d.inFlight).toEqual([1]);
    expect(d.lastSent).toBe(1);
    expect(d.sentEvent).toBe(5);
    expect(d.dirty).toBe(true);
  });

  it("does not send an outer snapshot superseded by a disconnect-triggered broadcast", () => {
    const d = new StateDelivery(true);
    expect(send(d, 102, 9)).toBe("sent");
    const build = vi.fn(() => ["older outer snapshot"]);
    const write = vi.fn(() => true);
    expect(deliverState(d, 101, 8, build, write)).toBe("superseded");
    expect(build).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(d.inFlight).toEqual([102]);
    expect(d.sentEvent).toBe(9);
  });

  it("keeps legacy connections unrestricted and ignores their ACK fields", () => {
    const d = new StateDelivery(false);
    for (let i = 1; i <= 20; i++) expect(send(d, i, i)).toBe("sent");
    expect(d.inFlight).toEqual([]);
    expect(d.full).toBe(false);
    expect(d.dirty).toBe(false);
    expect(d.sentEvent).toBe(20);
    expect(d.acknowledge(20)).toBe(false);
  });

  it("restores bounded same-WS credits but gives a true reconnect a fresh window", () => {
    const d = new StateDelivery(true);
    d.resetEvents("old-run");
    send(d, 100, 12);
    send(d, 101, 13);
    d.begin();
    const restored = new StateDelivery(true, d.snapshot());
    expect(restored.inFlight).toEqual([100, 101]);
    expect(restored.sentEvent).toBe(13);
    expect(restored.lastSent).toBe(101);
    expect(restored.dirty).toBe(true);
    expect(new StateDelivery(true).inFlight).toEqual([]);
  });

  it("rejects corrupt attachments and cannot manufacture credits from them", () => {
    const valid = new StateDelivery(true).snapshot();
    for (const bad of [
      null,
      { ...valid, pending: [1, 2, 3] },
      { ...valid, pending: [2, 1], lastSent: 2 },
      { ...valid, pending: [1, 1], lastSent: 1 },
      { ...valid, pending: [3], lastSent: 2 },
      { ...valid, sentEvent: -1 },
      { ...valid, eventRun: "x".repeat(129) },
    ]) {
      const d = new StateDelivery(true, bad);
      expect(d.inFlight).toEqual([]);
      expect(d.acknowledge(1)).toBe(false);
    }
  });

  it("attachment and inFlight snapshots cannot mutate the active window", () => {
    const d = new StateDelivery(true);
    send(d, 10);
    d.snapshot().pending.push(20);
    (d.inFlight as number[]).push(30);
    expect(d.inFlight).toEqual([10]);
  });

  it("resets per-run event positions without losing old snapshot ACK credits", () => {
    const d = new StateDelivery(true);
    d.resetEvents("first");
    send(d, 10, 100);
    send(d, 11, 120);
    d.resetEvents("second");
    expect(d.sentEvent).toBe(0);
    expect(d.inFlight).toEqual([10, 11]);
    expect(d.acknowledge(11)).toBe(true);
    expect(send(d, 12, 1)).toBe("sent");
    d.resetEvents("second");
    expect(d.sentEvent).toBe(1);
  });
});

describe("per-connection bounded event retirement", () => {
  it("retains undelivered events for a blocked peer and permits common duplicates", () => {
    const w = createWorld("event-run");
    const fast = new StateDelivery(true),
      slow = new StateDelivery(true);
    for (const d of [fast, slow]) {
      d.resetEvents(w.run);
      send(d, 1, 0);
      send(d, 2, 0);
    }
    for (let i = 0; i < 5; i++) event(w, { type: "hit", x: 0, y: 0, z: 0 });
    fast.acknowledge(2);
    let packet: string = "";
    deliverState(
      fast,
      3,
      w.eventSerial,
      () => [
        prepareState(
          w,
          minimumSentEvent([fast, slow], w.eventSerial),
          {},
        ).packet("p"),
      ],
      (text) => {
        packet = text;
        return true;
      },
    );
    expect(JSON.parse(packet).world.events).toHaveLength(5);
    retireEvents(w, minimumSentEvent([fast, slow], w.eventSerial));
    expect(w.events).toHaveLength(5);
    slow.begin();
    expect(slow.dirty).toBe(true);
    expect(slow.acknowledge(2)).toBe(true);
    deliverState(
      slow,
      4,
      w.eventSerial,
      () => [
        prepareState(
          w,
          minimumSentEvent([fast, slow], w.eventSerial),
          {},
        ).packet("p"),
      ],
      (text) => {
        packet = text;
        return true;
      },
    );
    expect(JSON.parse(packet).world.events).toHaveLength(5);
    retireEvents(w, minimumSentEvent([fast, slow], w.eventSerial));
    expect(w.events).toEqual([]);
  });

  it("does not make the 160-event buffer unbounded when a peer stalls forever", () => {
    const w = createWorld("bounded-events");
    const slow = new StateDelivery(true);
    for (let i = 0; i < LIMITS.events + 100; i++)
      event(w, { type: "shot", x: 0, y: 0, z: 0 });
    retireEvents(w, minimumSentEvent([slow], w.eventSerial));
    expect(w.events).toHaveLength(LIMITS.events);
    expect(w.events.at(-1)!.id).toBe(w.eventSerial);
  });

  it("legacy peers participate in retirement and disconnected peers stop retaining", () => {
    const fast = new StateDelivery(true),
      old = new StateDelivery(false);
    send(fast, 1, 10);
    send(old, 1, 4);
    expect(minimumSentEvent([fast, old], 10)).toBe(4);
    expect(minimumSentEvent([fast], 10)).toBe(10);
    expect(minimumSentEvent([], 20)).toBe(20);
  });
});
