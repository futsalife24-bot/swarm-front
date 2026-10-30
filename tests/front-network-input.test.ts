import { afterEach, expect, it, vi } from "vitest";
import { FrontNetwork } from "../src/client/front-network";
import { Network } from "../src/client/network";
import { InputWindow } from "../src/client/input-window";
import { neutral } from "../src/shared/game";

it("上り滞留の連続悪化だけを抑え、時計差と下り到着待ちを判定に混ぜない", () => {
  const window = new InputWindow();
  window.configure(true);
  let seq = 0;
  const ack = (lag: number) => {
    const at = 100000 + ++seq * 1000;
    window.sent(seq, at);
    window.acknowledge(seq, (at + 3600000 + lag) / 1000);
  };
  ack(75);
  ack(300); // One server scheduling spike must not shrink the window.
  expect(window.limit).toBe(16);
  ack(90);
  ack(300);
  ack(500);
  expect(window.limit).toBe(4);
  for (let i = 0; i < 10; i++) ack(500);
  expect(window.limit).toBe(4); // Congested baseline must not drift upward.
  ack(90);
  ack(90);
  expect(window.limit).toBe(4);
  ack(90);
  expect(window.limit).toBe(16);
});

it("入力受信時刻が不明なら4件へ戻し、新接続では新しい時計差を学習する", () => {
  const window = new InputWindow();
  window.configure(true);
  window.sent(1, 1000);
  window.acknowledge(1, undefined);
  expect(window.limit).toBe(4);
  window.configure(true);
  for (let seq = 1; seq <= 3; seq++) {
    window.sent(seq, 1000 * seq);
    window.acknowledge(seq, 1000 + seq + 0.08);
  }
  expect(window.limit).toBe(16);
  window.configure(false);
  window.sent(4, 4000);
  window.acknowledge(4, 99999);
  expect(window.limit).toBe(4);
});

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
const networks: (FrontNetwork | Network)[] = [];
afterEach(() => {
  networks.splice(0).forEach((net) => net.close());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(ack = false, stateFlow = false, legacy = false) {
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
  const net = legacy
    ? new Network("http://localhost:8789")
    : new FrontNetwork("http://localhost:8789");
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
    stateFlow,
    expiresAt: Date.now() + 60000,
  });
  return {
    net,
    ws,
    now: () => now,
    advance: (ms = 60) => {
      now += ms;
      vi.setSystemTime(Date.now() + ms);
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
  (net as FrontNetwork).discardPendingInput();
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
  (net as FrontNetwork).discardPendingInput();
  net.input({ ...neutral(), seq: 2, dodge: true });
  expect(ws.inputs()).toHaveLength(1);
  (net as FrontNetwork).discardPendingInput();
  for (let seq = 3; seq <= 5; seq++) {
    advance();
    net.input({ ...neutral(), seq });
  }
  expect(ws.inputs()).toHaveLength(4);
  (net as FrontNetwork).discardPendingInput();
  advance();
  net.input({ ...neutral(), seq: 6 });
  expect(ws.inputs()).toHaveLength(4);
  expect(ws.inputs().every((i) => !i.dodge)).toBe(true);
});

it.each([false, true])(
  "遅い下り応答900msでも操作送信を250ms以上空けない（legacy=%s）",
  (legacy) => {
    const { net, ws, advance, now } = setup(true, true, legacy);
    const sent: { seq: number; at: number }[] = [];
    let delivered = 0;
    for (let seq = 1; seq <= 120; seq++) {
      const accepted = sent.filter((p) => p.at + 900 <= now()).at(-1);
      if (accepted && accepted.seq > delivered) {
        delivered = accepted.seq;
        ws.receive({
          type: "state",
          stateId: seq,
          inputAck: delivered,
          // Snapshot creation can be delayed without delaying input arrival.
          serverNow: Date.now() / 1000,
          inputReceivedAt: (Date.now() - (now() - accepted.at) + 75) / 1000,
          members: [],
          preparationGeneration: 0,
          world: {
            run: "slow-downlink",
            phase: "battle",
            players: [],
            enemies: [],
          },
        });
      }
      const before = ws.inputs().length;
      net.input({ ...neutral(), seq, mx: 1, fire: true });
      if (ws.inputs().length > before) sent.push({ seq, at: now() });
      advance(50);
    }
    const gaps = sent.slice(1).map((p, i) => p.at - sent[i].at);
    expect(sent.length).toBeGreaterThan(90);
    expect(Math.max(...gaps)).toBeLessThan(250);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(50);
  },
);

it.each([false, true])(
  "ACKが途絶えれば16件で停止し、受信後は最新移動と保持した短押しだけ送る（legacy=%s）",
  (legacy) => {
    const { net, ws, advance } = setup(true, true, legacy);
    for (let seq = 1; seq <= 40; seq++) {
      net.input({ ...neutral(), seq, mx: 1, fire: true, dodge: seq === 17 });
      advance(50);
    }
    expect(ws.inputs()).toHaveLength(16);
    ws.receive({
      type: "state",
      stateId: 1,
      inputAck: 16,
      members: [],
      preparationGeneration: 0,
      world: {
        run: "slow-downlink",
        phase: "battle",
        players: [],
        enemies: [],
      },
    });
    net.input({ ...neutral(), seq: 41, mx: -1 });
    expect(ws.inputs()).toHaveLength(17);
    expect(ws.inputs().at(-1)).toMatchObject({
      seq: 41,
      mx: -1,
      fire: false,
      dodge: true,
    });
    // Reconnect renegotiates the old bounded window until a new welcome arrives.
    net.connect("ABC123");
    const next = Socket.last;
    next.onopen?.();
    next.receive({
      type: "welcome",
      ruleset: "front-v1",
      frontOpening: 2,
      id: "p",
      token: "test",
      inputAck: true,
    });
    for (let seq = 1; seq <= 8; seq++) {
      advance(50);
      net.input({ ...neutral(), seq });
    }
    expect(next.inputs()).toHaveLength(4);
  },
);
