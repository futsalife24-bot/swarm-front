import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

function handler() {
  const source = readFileSync("server/worker.ts", "utf8");
  const start = source.indexOf("  webSocketClose(");
  const end = source.indexOf("  webSocketError(", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const worker = runInNewContext(
    stripTypeScriptTypes(
      `class Harness {${source.slice(start, end)}}; new Harness()`,
    ),
  );
  worker.disconnected = vi.fn();
  return worker;
}

describe("切断応答と部屋の後処理", () => {
  it("相手のCloseへ応答してから接続を部屋から外す", () => {
    const worker = handler();
    const ws = { close: vi.fn() };
    worker.webSocketClose(ws, 1000, "戦況データを再取得します");
    expect(ws.close).toHaveBeenCalledWith(1000, "戦況データを再取得します");
    expect(worker.disconnected).toHaveBeenCalledExactlyOnceWith(ws);
    expect(ws.close.mock.invocationCallOrder[0]).toBeLessThan(
      worker.disconnected.mock.invocationCallOrder[0],
    );
  });
  it("異常切断でClose応答が失敗しても部屋の後処理を行う", () => {
    const worker = handler();
    const ws = {
      close: vi.fn(() => {
        throw new Error("reserved close code");
      }),
    };
    expect(() => worker.webSocketClose(ws, 1006, "")).not.toThrow();
    expect(worker.disconnected).toHaveBeenCalledExactlyOnceWith(ws);
  });
});
