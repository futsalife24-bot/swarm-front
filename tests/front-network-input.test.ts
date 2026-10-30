import { afterEach, expect, it, vi } from "vitest";
import { FrontNetwork } from "../src/client/front-network";
import { Network } from "../src/client/network";
import { InputWindow } from "../src/client/input-window";
import { neutral, createWorld, addPlayer } from "../src/shared/game";
import { encodeStateChunks } from "../src/shared/state-chunks";
import { StateDelivery, deliverState } from "../server/state-delivery";

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
  static all: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor(_url: string) {
    Socket.last = this;
    Socket.all.push(this);
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
  Socket.all = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(
  ack = false,
  stateFlow = false,
  legacy = false,
  options: {
    source?: () => ReturnType<typeof neutral> | undefined;
    welcome?: boolean;
  } = {},
) {
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
  const clockStart = Date.now();
  const now = () => 1000 + Date.now() - clockStart;
  vi.spyOn(performance, "now").mockImplementation(now);
  const net = legacy
    ? new Network("http://localhost:8789")
    : new FrontNetwork("http://localhost:8789");
  networks.push(net);
  net.setInputSource(options.source);
  net.connect("ABC123");
  const ws = Socket.last;
  ws.onopen?.();
  const welcome = () =>
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
  if (options.welcome !== false) welcome();
  return {
    net,
    ws,
    now,
    welcome,
    advance: (ms = 60) => {
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

it.each([false, true])(
  "RAFなしでwelcome後だけ20Hz採取し、重複welcomeでも増殖しない（legacy=%s）",
  (legacy) => {
    let seq = 0;
    const source = vi.fn(() => ({
      ...neutral(),
      seq: ++seq,
      mx: 1,
      fire: true,
    }));
    const { ws, welcome } = setup(false, false, legacy, {
      source,
      welcome: false,
    });
    vi.advanceTimersByTime(200);
    expect(source).not.toHaveBeenCalled();
    welcome();
    welcome();
    vi.advanceTimersByTime(250);
    expect(source).toHaveBeenCalledTimes(5);
    expect(ws.inputs().map((input) => input.seq)).toEqual([1, 2, 3, 4, 5]);
  },
);

it.each([false, true])(
  "周期採取でもheld・短押し・解除を保持し、無効なsourceは保留タップを破棄する（legacy=%s）",
  (legacy) => {
    let seq = 0;
    let active = true;
    let fire = true;
    let tap = true;
    const source = () =>
      active
        ? {
            ...neutral(),
            seq: ++seq,
            fire,
            mx: fire ? 1 : -1,
            reload: tap,
            swap: tap,
            dodge: tap,
            jump: tap,
          }
        : undefined;
    const { net, ws } = setup(false, false, legacy, { source });
    ws.bufferedAmount = 5000;
    vi.advanceTimersByTime(50);
    tap = false;
    fire = false;
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(50);
    expect(ws.inputs()[0]).toMatchObject({
      seq: 2,
      mx: -1,
      fire: false,
      reload: true,
      swap: true,
      dodge: true,
      jump: true,
    });
    vi.advanceTimersByTime(50);
    expect(ws.inputs()[1]).toMatchObject({
      seq: 3,
      mx: -1,
      fire: false,
      reload: false,
      swap: false,
      dodge: false,
      jump: false,
    });
    ws.bufferedAmount = 5000;
    tap = true;
    vi.advanceTimersByTime(50);
    active = false;
    vi.advanceTimersByTime(50);
    tap = false;
    active = true;
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(50);
    expect(ws.inputs().at(-1)).toMatchObject({
      seq: 5,
      reload: false,
      swap: false,
      dodge: false,
      jump: false,
    });
    net.setInputSource(undefined);
    vi.advanceTimersByTime(200);
    expect(ws.inputs()).toHaveLength(3);
  },
);

it.each([false, true])(
  "binding解除は保留だけ消し、50ms間隔とACK窓を維持する（legacy=%s）",
  (legacy) => {
    let seq = 0;
    const source = () => ({ ...neutral(), seq: ++seq });
    const { net, ws } = setup(true, false, legacy, { source });
    vi.advanceTimersByTime(50);
    net.setInputSource(undefined);
    net.input({ ...neutral(), seq: ++seq });
    expect(ws.inputs()).toHaveLength(1);
    net.setInputSource(source);
    vi.advanceTimersByTime(150);
    expect(ws.inputs()).toHaveLength(4);
    ws.bufferedAmount = 5000;
    net.input({ ...neutral(), seq: ++seq, dodge: true });
    net.setInputSource(undefined);
    ws.bufferedAmount = 0;
    net.setInputSource(source);
    vi.advanceTimersByTime(100);
    expect(ws.inputs()).toHaveLength(4);
    ws.receive({
      type: "state",
      inputAck: 5,
      members: [],
      preparationGeneration: 0,
      world: { run: "loop-resume", phase: "battle", players: [], enemies: [] },
    });
    vi.advanceTimersByTime(50);
    expect(ws.inputs()).toHaveLength(5);
    expect(ws.inputs().at(-1).dodge).toBe(false);
  },
);

it.each([false, true])(
  "切断中は採取せず、再接続はsourceを維持しcloseはbindingを解放する（legacy=%s）",
  (legacy) => {
    let seq = 0;
    const source = vi.fn(() => ({ ...neutral(), seq: ++seq }));
    const { net, ws } = setup(false, false, legacy, { source });
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(2);
    ws.close();
    vi.advanceTimersByTime(500);
    const next = Socket.last;
    expect(next).not.toBe(ws);
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(2);
    const welcome = {
      type: "welcome",
      ruleset: "front-v1",
      frontOpening: 2,
      id: "p",
      token: "test",
    };
    ws.receive(welcome);
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(2);
    next.onopen?.();
    next.receive(welcome);
    next.receive(welcome);
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(4);
    net.close();
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(4);
    net.connect("ABC123");
    Socket.last.receive(welcome);
    vi.advanceTimersByTime(100);
    expect(source).toHaveBeenCalledTimes(4);
  },
);

it.each([false, true])(
  "致命errorは周期採取を止め、その後のwelcomeでも再開しない（legacy=%s）",
  (legacy) => {
    const source = vi.fn(() => neutral());
    const { ws } = setup(false, false, legacy, { source });
    vi.advanceTimersByTime(50);
    ws.receive({ type: "error", reason: "test fatal" });
    ws.receive({
      type: "welcome",
      ruleset: "front-v1",
      frontOpening: 2,
      id: "p",
      token: "test",
    });
    vi.advanceTimersByTime(250);
    expect(source).toHaveBeenCalledTimes(1);
  },
);

it.each([false, true])(
  "長いevent loop停止後も一回だけ採取し、callback終了から50ms空ける（legacy=%s）",
  (legacy) => {
    let seq = 0;
    let blocked = true;
    const source = vi.fn(() => {
      if (blocked) {
        blocked = false;
        // callback中に3秒経過した状態を再現。追いつきループは作らない。
        vi.setSystemTime(Date.now() + 3000);
      }
      return { ...neutral(), seq: ++seq };
    });
    const { ws } = setup(false, false, legacy, { source });
    vi.advanceTimersByTime(50);
    expect(source).toHaveBeenCalledTimes(1);
    expect(ws.inputs()).toHaveLength(1);
    vi.advanceTimersByTime(49);
    expect(source).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(source).toHaveBeenCalledTimes(2);
    expect(ws.inputs()).toHaveLength(2);
  },
);

function recoveryWelcome(ws: Socket) {
  ws.onopen?.();
  ws.receive({
    type: "welcome",
    ruleset: "front-v1",
    frontOpening: 2,
    id: "p",
    token: "test",
    stateFlow: true,
    inputAck: true,
  });
}
function recoveryState(stateId: number, large = false) {
  const world = createWorld("chunk-recovery", 1);
  addPlayer(world, "p");
  world.phase = "battle";
  return {
    type: "state",
    stateId,
    inputAck: 0,
    members: [],
    preparationGeneration: 0,
    world,
    ...(large ? { padding: "q".repeat(70000) } : {}),
  };
}
function receiveWire(ws: Socket, wire: string) {
  ws.receive(JSON.parse(wire));
}

it.each([false, true])(
  "2枠分の組立放棄はpongに隠されず、通常再接続で最新Worldへ復帰する（legacy=%s）",
  (legacy) => {
    const { net, ws } = setup(true, true, legacy);
    const worlds = vi.fn();
    net.onWorld = worlds;
    const oldDelivery = new StateDelivery(true);
    const queued: string[] = [];
    for (const id of [101, 102]) {
      expect(
        deliverState(
          oldDelivery,
          id,
          0,
          () => encodeStateChunks(JSON.stringify(recoveryState(id, true)), id)!,
          (part) => {
            queued.push(part);
            return true;
          },
        ),
      ).toBe("sent");
    }
    expect(oldDelivery.inFlight).toEqual([101, 102]);
    receiveWire(ws, queued[0]);
    vi.advanceTimersByTime(1500);
    ws.receive({ type: "pong" });
    vi.advanceTimersByTime(500);
    expect(ws.readyState).toBe(1);
    expect(worlds).not.toHaveBeenCalled();
    expect(ws.sent.some((m) => m.stateAck !== undefined)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(ws.readyState).toBe(3);
    expect(net.closed).toBe(false);
    expect(net.token).toBe("test");
    vi.advanceTimersByTime(500);
    const next = Socket.last;
    expect(next).not.toBe(ws);
    recoveryWelcome(next);
    queued.slice(1).forEach((part) => receiveWire(ws, part)); // 旧socketは現接続へ影響しない。
    const delivery = new StateDelivery(true);
    expect(
      deliverState(
        delivery,
        103,
        0,
        () => [JSON.stringify(recoveryState(103))],
        (part) => {
          receiveWire(next, part);
          return true;
        },
      ),
    ).toBe("sent");
    vi.advanceTimersByTime(100);
    const ack = next.sent.find((m) => m.type === "stateAck");
    expect(ack.stateAck).toBe(103);
    expect(delivery.acknowledge(ack.stateAck)).toBe(true);
    expect(delivery.inFlight).toEqual([]);
    expect(worlds).toHaveBeenCalledTimes(1);
    expect(net.retry).toBe(0);
  },
);

it.each([false, true])(
  "正常fragmentは期限まで待ち、旧形式・静かなロビーは切断しない（legacy=%s）",
  (legacy) => {
    const { net, ws } = setup(false, false, legacy);
    const worlds = vi.fn();
    net.onWorld = worlds;
    const parts = encodeStateChunks(JSON.stringify(recoveryState(1, true)), 1)!;
    receiveWire(ws, parts[0]);
    vi.advanceTimersByTime(1999);
    expect(ws.readyState).toBe(1);
    parts.slice(1).forEach((part) => receiveWire(ws, part));
    expect(worlds).toHaveBeenCalledTimes(1);
    ws.receive(recoveryState(2)); // 旧serverの単一messageも従来通り。
    expect(worlds).toHaveBeenCalledTimes(2);
    ws.receive({ type: "lobby", members: [], preparationGeneration: 0 });
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(5000);
      ws.receive({ type: "pong" });
    }
    expect(ws.readyState).toBe(1);
    expect(net.retry).toBe(0);
  },
);

it.each([false, true])(
  "welcomeだけでは再試行上限を戻さず、破損反復は既存5回で止まる（legacy=%s）",
  (legacy) => {
    const { net, ws } = setup(true, true, legacy);
    const statuses = vi.fn();
    net.onStatus = statuses;
    const bad = JSON.parse(
      encodeStateChunks(JSON.stringify(recoveryState(1, true)), 1)![0],
    );
    bad.version = 2;
    let current = ws;
    const waits = [500, 1000, 2000, 4000, 6000];
    for (let attempt = 0; attempt < 6; attempt++) {
      current.receive(bad);
      expect(current.readyState).toBe(3);
      if (attempt < 5) {
        vi.advanceTimersByTime(waits[attempt] - 1);
        expect(Socket.last).toBe(current);
        vi.advanceTimersByTime(1);
        current = Socket.last;
        recoveryWelcome(current);
      }
    }
    expect(Socket.all).toHaveLength(6);
    expect(net.closed).toBe(true);
    expect(net.token).toBe("test");
    vi.advanceTimersByTime(30000);
    expect(Socket.all).toHaveLength(6);
    expect(statuses).toHaveBeenLastCalledWith(
      expect.stringContaining("復帰できません"),
      true,
    );
  },
);

it.each([false, true])(
  "故意close・fatal・新connectは古い期限timerを回収する（legacy=%s）",
  (legacy) => {
    const { net, ws } = setup(true, true, legacy);
    const first = encodeStateChunks(
      JSON.stringify(recoveryState(1, true)),
      1,
    )![0];
    receiveWire(ws, first);
    net.connect("ABC123");
    const current = Socket.last;
    recoveryWelcome(current);
    vi.advanceTimersByTime(2100);
    expect(current.readyState).toBe(1);
    receiveWire(current, first);
    current.receive({ type: "error", reason: "test fatal" });
    vi.advanceTimersByTime(3000);
    expect(Socket.last).toBe(current);
    expect(net.closed).toBe(true);
    net.connect("ABC123");
    const last = Socket.last;
    recoveryWelcome(last);
    receiveWire(last, first);
    net.close();
    vi.advanceTimersByTime(5000);
    expect(Socket.last).toBe(last);
  },
);

it.each([false, true])(
  "再接続後は旧equipment cacheを使わず完全stateを待つ（legacy=%s）",
  (legacy) => {
    const { net, ws } = setup(true, true, legacy);
    const worlds = vi.fn();
    net.onWorld = worlds;
    ws.receive(recoveryState(1));
    expect(worlds).toHaveBeenCalledTimes(1);
    net.connect("ABC123");
    const next = Socket.last;
    recoveryWelcome(next);
    const cached: any = recoveryState(2);
    cached.equipmentCached = true;
    cached.world.players.forEach((p: any) => delete p.weapons);
    next.receive(cached);
    expect(next.readyState).toBe(3);
    expect(worlds).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    const full = Socket.last;
    recoveryWelcome(full);
    full.receive(recoveryState(3));
    expect(worlds).toHaveBeenCalledTimes(2);
    expect(net.retry).toBe(0);
  },
);
