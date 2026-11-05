import { afterEach, expect, it, vi } from "vitest";
import { Network } from "../src/client/network";
import { STARTERS } from "../src/shared/defs";
import { neutral } from "../src/shared/game";
class Socket {
  static last: Socket;
  readyState = 1;
  bufferedAmount = 0;
  sent: any[] = [];
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number }) => void;
  constructor(_url: string) {
    Socket.last = this;
  }
  send(v: string) {
    this.sent.push(JSON.parse(v));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  welcome() {
    this.onmessage?.({
      data: JSON.stringify({ type: "welcome", id: "p", token: "test" }),
    });
  }
}
const instances: Network[] = [];
afterEach(() => {
  instances.splice(0).forEach((n) => n.close());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const storage = {
    setItem() {},
    getItem() {
      return null;
    },
    removeItem() {},
  };
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("localStorage", storage);
  const net = new Network("http://localhost:8821");
  instances.push(net);
  net.equipment(STARTERS.slice(0, 2), { id: "oriha", level: 12 });
  net.connect("BUDDY1");
  Socket.last.onopen?.();
  Socket.last.welcome();
  return net;
}
it("バディ選択を武器変更と再接続で保持し、明示nullだけで外す", async () => {
  const net = setup();
  expect(Socket.last.sent.find((m) => m.type === "equip").buddy).toEqual({
    id: "oriha",
    level: 12,
  });
  net.equipment(STARTERS.slice(1, 3));
  expect(Socket.last.sent.findLast((m) => m.type === "equip").buddy.id).toBe(
    "oriha",
  );
  Socket.last.close();
  await vi.advanceTimersByTimeAsync(500);
  Socket.last.onopen?.();
  Socket.last.welcome();
  expect(Socket.last.sent.find((m) => m.type === "equip").buddy).toEqual({
    id: "oriha",
    level: 12,
  });
  net.equipment(STARTERS.slice(0, 2), null);
  expect(Socket.last.sent.findLast((m) => m.type === "equip").buddy).toBeNull();
});
it("送信が詰まった間の短い固有スキル入力を保持し、無効levelを送信しない", () => {
  const net = setup(),
    socket = Socket.last;
  socket.bufferedAmount = 100000;
  net.input({ ...neutral(), seq: 1, buddySkill: true });
  net.input({ ...neutral(), seq: 2 });
  socket.bufferedAmount = 0;
  net.input({ ...neutral(), seq: 3 });
  expect(socket.sent.findLast((m) => m.type === "input").input.buddySkill).toBe(
    true,
  );
  const count = socket.sent.length;
  expect(() =>
    net.equipment(STARTERS.slice(0, 2), { id: "oriha", level: 41 }),
  ).toThrow();
  expect(socket.sent).toHaveLength(count);
});
