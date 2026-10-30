import { afterEach, expect, it, vi } from "vitest";
import { StateReceipt } from "../src/client/state-receipt";
import { FrontNetwork } from "../src/client/front-network";
import { Network } from "../src/client/network";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function receipt() {
  vi.useFakeTimers();
  const messages: any[] = [];
  const ack = new StateReceipt(() =>
    messages.push(ack.attach({ type: "stateAck" })),
  );
  return { ack, messages };
}

it("旧サーバーへの新しい通知は交渉が成立するまで送らない", () => {
  const { ack, messages } = receipt();
  ack.receive(1);
  vi.advanceTimersByTime(1000);
  const command = { type: "ping" };
  expect(ack.attach(command)).toBe(command);
  expect(messages).toEqual([]);
});

it("受信した最新番号を通常入力へ同梱し、元の入力と送信頻度を変えない", () => {
  const { ack, messages } = receipt();
  ack.configure(true);
  ack.receive(1);
  ack.receive(2);
  const command = { type: "input", input: { seq: 7, fire: true } };
  expect(ack.attach(command)).toEqual({ ...command, stateAck: 2 });
  expect(command).not.toHaveProperty("stateAck");
  vi.advanceTimersByTime(1000);
  expect(messages).toEqual([]);
  expect(ack.attach(command)).toBe(command);
});

it("大量の受信でも無入力時の通知は10Hz以内で、重複・不正番号を無視する", () => {
  const { ack, messages } = receipt();
  ack.configure(true);
  for (let id = 1; id <= 1000; id++) {
    ack.receive(id);
    vi.advanceTimersByTime(1);
  }
  expect(messages).toHaveLength(10);
  expect(messages.at(-1)).toEqual({ type: "stateAck", stateAck: 1000 });
  for (const id of [
    0,
    -1,
    NaN,
    Infinity,
    0.5,
    "1001",
    Number.MAX_SAFE_INTEGER + 1,
    1000,
    2,
  ])
    ack.receive(id);
  vi.advanceTimersByTime(1000);
  expect(messages).toHaveLength(10);
});

it("切断時に待ち通知を消し、新接続では小さい番号も受け取る", () => {
  const { ack, messages } = receipt();
  ack.configure(true);
  ack.receive(10000);
  ack.configure(false);
  vi.advanceTimersByTime(1000);
  expect(messages).toEqual([]);
  ack.configure(true);
  ack.receive(1);
  vi.advanceTimersByTime(100);
  expect(messages).toEqual([{ type: "stateAck", stateAck: 1 }]);
});

it("20Hzの通常入力中はACK専用メッセージを増やさない", () => {
  const { ack, messages } = receipt();
  ack.configure(true);
  const inputs: unknown[] = [];
  for (let time = 0; time < 1000; time += 50) {
    if (time % 100 === 0) ack.receive(time + 1);
    inputs.push(ack.attach({ type: "input", input: { seq: time } }));
    vi.advanceTimersByTime(50);
  }
  expect(inputs).toHaveLength(20);
  expect(messages).toEqual([]);
});

class Socket {
  static latest: Socket;
  readyState = 1;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor(_url: string) {
    Socket.latest = this;
  }
  send(value: string) {
    this.sent.push(JSON.parse(value));
  }
  receive(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
}

it.each(["front", "legacy"])(
  "%s接続は検証済みstateだけを通知し、退出時にtimerを残さない",
  (mode) => {
    vi.useFakeTimers();
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("WebSocket", Socket);
    const net =
      mode === "front"
        ? new FrontNetwork("http://localhost:8793")
        : new Network("http://localhost:8793");
    try {
      net.connect("local-test");
      const socket = Socket.latest;
      socket.onopen?.();
      expect(socket.sent[0].stateFlow).toBe(1);
      socket.receive({
        type: "welcome",
        id: "p",
        token: "local",
        stateFlow: true,
        ...(mode === "front" ? { ruleset: "front-v1", frontOpening: 2 } : {}),
      });
      socket.receive({ type: "state", stateId: 1 }); // Invalid world: not accepted.
      vi.advanceTimersByTime(100);
      expect(socket.sent.some((m) => m.type === "stateAck")).toBe(false);
      socket.receive({
        type: "state",
        stateId: 2,
        members: [],
        preparationGeneration: 0,
        world: { run: 1, phase: "battle", players: [], enemies: [] },
      });
      vi.advanceTimersByTime(100);
      expect(socket.sent.at(-1)).toEqual({ type: "stateAck", stateAck: 2 });
      socket.receive({
        type: "state",
        stateId: 3,
        members: [],
        preparationGeneration: 0,
        world: { run: 1, phase: "battle", players: [], enemies: [] },
      });
      const count = socket.sent.length;
      net.close();
      vi.advanceTimersByTime(500);
      expect(socket.sent).toHaveLength(count);
    } finally {
      net.close();
    }
  },
);
