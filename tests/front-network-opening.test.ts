import { afterEach, expect, it, vi } from "vitest";
import {
  FrontNetwork,
  FRONT_NETWORK_SESSION_KEY,
} from "../src/client/front-network";

// welcome判定だけの単体。旧/新画面の実通信はfront-network.integration.tsで別途検証する。
class Socket {
  static last: Socket;
  readyState = 1;
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
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
for (const modern of [false, true])
  it(`開幕世代welcome：${modern ? "新Workerへ接続" : "旧Workerへequipを送らずトークン保持"}`, () => {
    vi.useFakeTimers();
    const data = new Map<string, string>();
    const storage = {
      setItem: (k: string, v: string) => data.set(k, v),
      getItem: (k: string) => data.get(k) ?? null,
      removeItem: (k: string) => data.delete(k),
    };
    vi.stubGlobal("WebSocket", Socket);
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("localStorage", storage);
    const net = new FrontNetwork("http://localhost:8789"),
      status = vi.fn(),
      ready = vi.fn();
    net.onStatus = status;
    net.ready = ready;
    net.connect("ABC123");
    const socket = Socket.last;
    socket.onopen?.();
    expect(socket.sent[0]).toMatchObject({ type: "hello", frontOpening: 2 });
    socket.receive({
      type: "welcome",
      ruleset: "front-v1",
      id: "player",
      token: "resume-token",
      expiresAt: Date.now() + 60000,
      ...(modern ? { frontOpening: 2 } : {}),
    });
    expect(JSON.parse(data.get(FRONT_NETWORK_SESSION_KEY)!).token).toBe(
      "resume-token",
    );
    expect(socket.sent.some((m) => m.type === "equip")).toBe(modern);
    expect(ready).toHaveBeenCalledTimes(modern ? 1 : 0);
    if (!modern) {
      expect(net.closed).toBe(true);
      expect(socket.readyState).toBe(3);
      expect(status).toHaveBeenLastCalledWith(
        expect.stringContaining("再読み込み"),
        true,
      );
      const before = status.mock.calls.length;
      socket.receive({ type: "notice", reason: "late-message" });
      vi.advanceTimersByTime(15000);
      expect(status).toHaveBeenCalledTimes(before);
    }
    net.close();
  });
