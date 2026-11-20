import { describe, expect, it, vi } from "vitest";
import { addPlayer, createWorld, spawn, start } from "../src/shared/game";
import { Network } from "../src/client/network";

describe("省略送信中の敵表示", () => {
  it("受信済みの敵は省略フレームでも残り、確定消滅時だけ除かれる", () => {
    class Socket {
      readyState = 1;
      send = vi.fn();
      close = vi.fn();
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      message(value: unknown) {
        this.onmessage?.({ data: JSON.stringify(value) });
      }
    }
    vi.stubGlobal("WebSocket", Socket);
    const net = new Network("http://127.0.0.1");
    try {
      const seen: number[][] = [];
      net.onWorld = (world) => seen.push(world.enemies.map(({ id }) => id));
      net.connect("test");
      const socket = net.ws as unknown as Socket;
      socket.onopen?.();
      socket.message({ type: "welcome", id: "p", token: "test" });
      const world = createWorld("omission-regression", 42);
      addPlayer(world, "p");
      start(world);
      const enemy = spawn(world, "ant", 0, -4)!;
      world.enemies = [enemy];
      const first = structuredClone(world);
      const short = structuredClone(world);
      short.enemies = [];
      const state = (snapshot: typeof world, omitted?: object) =>
        socket.message({
          type: "state",
          world: snapshot,
          members: [],
          preparationGeneration: 0,
          omitted,
        });
      state(first);
      state(short, { enemies: [enemy.id], orbs: [] });
      state(short);
      expect(seen).toEqual([[enemy.id], [enemy.id], []]);
    } finally {
      clearInterval(net.timer);
      vi.unstubAllGlobals();
    }
  });
});
