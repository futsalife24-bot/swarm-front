import { it, expect, vi } from "vitest";
import { createWorld, addPlayer, start, neutral } from "../src/shared/game";
import {
  encodeState,
  prepareState,
  EquipmentCache,
} from "../src/shared/state-wire";
import { Network } from "../src/client/network";

it("shares encoding but isolates loot and preserves exact nested weapon values", () => {
  const w = createWorld("wire");
  addPlayer(w, "a");
  addPlayer(w, "b");
  start(w);
  w.players[0].weapons = structuredClone(w.players[0].weapons);
  w.players[0].weapons[0].power = 1.237;
  w.players[0].weapons[0].rolls = { mag: 1.109, reload: 0.987 };
  w.pending.a = [w.players[0].weapons[0]];
  w.pending.b = [w.players[1].weapons[1]];
  w.drops = [
    { id: "private", owner: "b", x: 0, z: 0, weapon: w.players[1].weapons[0] },
  ];
  const meta = { members: [], stage: 1, preparationGeneration: 1 },
    state = prepareState(w, 0, meta);
  const a = JSON.parse(state.packet("a"));
  expect(a.world.pending.b).toBeUndefined();
  expect(a.world.drops).toEqual([]);
  expect(a.world.pending.a[0].power).toBe(1.237);
  expect(a.world.pending.a[0].rolls).toEqual({ mag: 1.109, reload: 0.987 });
  const expected = JSON.parse(
    encodeState({
      ...w,
      seed: 0,
      events: w.events.filter((e) => e.id > 0),
      pending: { a: w.pending.a },
      rewards: { a: [] },
      drops: [],
    }),
  );
  expect(a.world).toEqual(expected);
  const cache = new EquipmentCache();
  expect(cache.restore(a.world, false)).toBe(true);
  const short = JSON.parse(state.packet("a", true));
  expect(short.world.players[0].weapons).toBeUndefined();
  expect(cache.restore(short.world, true)).toBe(true);
  expect(short.world.players[0].weapons[0].power).toBe(1.237);
  expect(
    new EquipmentCache().restore(
      JSON.parse(state.packet("a", true)).world,
      true,
    ),
  ).toBe(false);
  expect(cache.restore({ ...short.world, run: "new" }, true)).toBe(false);
  w.players[0].weapons[0].power = 1.238;
  expect(prepareState(w, 0, meta).equipmentKey).not.toBe(state.equipmentKey);
});

it("paces catch-up inputs without losing action taps", () => {
  const network = new Network("http://localhost");
  const send = vi.fn();
  network.ws = {
    readyState: 1,
    bufferedAmount: 0,
    send,
  } as unknown as WebSocket;
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    network.input(neutral());
    now = 5;
    network.input({ ...neutral(), reload: true });
    now = 10;
    network.input({ ...neutral(), swap: true });
    now = 49;
    network.input(neutral());
    expect(send).toHaveBeenCalledTimes(1);
    now = 50;
    network.input({ ...neutral(), seq: 4 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[1][0]).input).toMatchObject({
      reload: true,
      swap: true,
      seq: 4,
    });
    now = 100;
    network.input(neutral());
    expect(JSON.parse(send.mock.calls[2][0]).input.reload).toBe(false);
  } finally {
    clearInterval(network.timer);
    clock.mockRestore();
  }
});

it("bounds unacknowledged inputs and releases retained taps after acknowledgement", () => {
  class Socket {
    readyState = 1;
    bufferedAmount = 0;
    send = vi.fn();
    onmessage?: (e: { data: string }) => void;
    message(value: unknown) {
      this.onmessage?.({ data: JSON.stringify(value) });
    }
  }
  vi.stubGlobal("WebSocket", Socket);
  const network = new Network("http://localhost");
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    network.connect("test");
    const ws = network.ws as unknown as Socket;
    ws.message({ type: "welcome", id: "a", token: "test", inputAck: true });
    ws.send.mockClear();
    for (let seq = 0; seq < 8; seq++) {
      now = seq * 50;
      network.input({ ...neutral(), seq, dodge: seq === 5 });
    }
    expect(ws.send).toHaveBeenCalledTimes(4);
    const world = createWorld("ack");
    addPlayer(world, "a");
    start(world);
    ws.message({
      type: "state",
      world,
      members: [],
      preparationGeneration: 0,
      inputAck: 3,
    });
    now = 450;
    network.input({ ...neutral(), seq: 9 });
    expect(ws.send).toHaveBeenCalledTimes(5);
    expect(JSON.parse(ws.send.mock.calls[4][0]).input).toMatchObject({
      seq: 9,
      dodge: true,
    });
  } finally {
    clearInterval(network.timer);
    clock.mockRestore();
    vi.unstubAllGlobals();
  }
});
