import { afterEach, expect, it, vi } from "vitest";
import { FrontNetwork } from "../src/client/front-network";
import { Network } from "../src/client/network";
import { roomAccessInfo } from "../src/client/room-access";

class Socket {
  static last: Socket;
  readyState = 1;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  constructor(_url: string) {
    Socket.last = this;
  }
  send(_message: string) {}
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const networks: (Network | FrontNetwork)[] = [];
afterEach(() => {
  networks.splice(0).forEach((network) => network.close());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([Network, FrontNetwork])(
  "新旧の画面で募集方式を受信し、旧サーバーでは不明と扱う",
  (NetworkClass) => {
    vi.useFakeTimers();
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("WebSocket", Socket);
    const network = new NetworkClass("http://127.0.0.1:8798");
    networks.push(network);
    for (const value of [true, false, undefined, "true"] as const) {
      network.connect("a".repeat(32));
      expect(network.roomListed).toBeUndefined();
      const socket = Socket.last;
      socket.onopen?.();
      socket.receive({
        type: "welcome",
        id: "p",
        token: "test",
        ruleset: "front-v1",
        frontOpening: 2,
        listed: value,
      });
      expect(network.roomListed).toBe(
        typeof value === "boolean" ? value : undefined,
      );
    }
  },
);

it("募集方式が不明なとき公開・非公開を推測しない", () => {
  expect(roomAccessInfo(true).label).toBe("フリーマッチング");
  expect(roomAccessInfo(false).label).toBe("パスワード付き");
  expect(roomAccessInfo(undefined).state).toBe("unknown");
});
