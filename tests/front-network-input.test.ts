import { afterEach, expect, it, vi } from "vitest";
import { FrontNetwork } from "../src/client/front-network";
import { neutral } from "../src/shared/game";

class Socket {
  static last: Socket;
  readyState = 1;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor(_url: string) {
    Socket.last = this;
  }
  send(message: string) {
    this.sent.push(JSON.parse(message));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  inputs() {
    return this.sent.filter((m) => m.type === "input").map((m) => m.input);
  }
}
const networks: FrontNetwork[] = [];
afterEach(() => {
  networks.splice(0).forEach((net) => net.close());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(ack = false) {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  };
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("WebSocket", Socket);
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const net = new FrontNetwork("http://localhost:8789");
  networks.push(net);
  net.connect("ABC123");
  const ws = Socket.last;
  ws.onopen?.();
  ws.receive({
    type: "welcome",
    ruleset: "front-v1",
    id: "p",
    token: "test",
    frontOpening: 2,
    inputAck: ack,
    expiresAt: Date.now() + 60000,
  });
  return {
    net,
    ws,
    advance: (ms = 60) => {
      now += ms;
    },
  };
}
it("通常の混雑では短押しを保持し、移動は最新値で送る", () => {
  const { net, ws } = setup();
  ws.bufferedAmount = 5000;
  net.input({
    ...neutral(),
    seq: 1,
    dodge: true,
    reload: true,
    swap: true,
    jump: true,
    mx: 1,
  });
  ws.bufferedAmount = 0;
  net.input({ ...neutral(), seq: 2, mx: -1 });
  expect(ws.inputs()).toEqual([
    expect.objectContaining({
      seq: 2,
      dodge: true,
      reload: true,
      swap: true,
      jump: true,
      mx: -1,
    }),
  ]);
});
it("中断すると未送信タップを破棄し、再開後の新しいタップは送る", () => {
  const { net, ws, advance } = setup();
  ws.bufferedAmount = 5000;
  net.input({
    ...neutral(),
    seq: 1,
    dodge: true,
    reload: true,
    swap: true,
    jump: true,
  });
  net.discardPendingInput();
  ws.bufferedAmount = 0;
  net.input({ ...neutral(), seq: 2 });
  expect(ws.inputs()[0]).toMatchObject({
    dodge: false,
    reload: false,
    swap: false,
    jump: false,
  });
  advance();
  net.input({ ...neutral(), seq: 3, dodge: true });
  expect(ws.inputs()[1].dodge).toBe(true);
});
it("中断しても送信間隔と4件のack待ち上限をリセットしない", () => {
  const { net, ws, advance } = setup(true);
  net.input({ ...neutral(), seq: 1 });
  net.discardPendingInput();
  net.input({ ...neutral(), seq: 2, dodge: true });
  expect(ws.inputs()).toHaveLength(1);
  net.discardPendingInput();
  for (let seq = 3; seq <= 5; seq++) {
    advance();
    net.input({ ...neutral(), seq });
  }
  expect(ws.inputs()).toHaveLength(4);
  net.discardPendingInput();
  advance();
  net.input({ ...neutral(), seq: 6 });
  expect(ws.inputs()).toHaveLength(4);
  expect(ws.inputs().every((i) => !i.dodge)).toBe(true);
});
