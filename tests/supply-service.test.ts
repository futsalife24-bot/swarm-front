import { describe, expect, it } from "vitest";
import { createSupplyService } from "../src/client/supply-service";
import { supplyVault } from "../server/supply-vault";

function setup() {
  const values = new Map<string, string>();
  const local = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  let row: unknown,
    calls = 0;
  let lose = "";
  const storage = {
    async get<T>() {
      return structuredClone(row) as T | undefined;
    },
    async put(_key: string, value: unknown) {
      row = structuredClone(value);
    },
  };
  const request = (async (url: string, init: RequestInit) => {
    calls++;
    const response = await supplyVault(
      new Request(new URL(url, "https://game.example"), init),
      storage,
      Date.parse("2026-11-11T00:00:00Z"),
      () => 0.2,
    );
    if (url.endsWith(lose) && lose) {
      lose = "";
      throw Error("応答だけを喪失");
    }
    return response;
  }) as typeof fetch;
  return {
    service: createSupplyService(local, request),
    local,
    request,
    lose(action: string) {
      lose = action;
    },
    get calls() {
      return calls;
    },
  };
}

describe("補給の通信・端末保存の回復", () => {
  it("初期化応答を失っても同じ口座・10枚へ復帰する", async () => {
    const p = setup();
    p.lose("initialize");
    await expect(p.service.status()).rejects.toThrow("応答");
    const restarted = createSupplyService(p.local, p.request);
    expect((await restarted.status()).tickets).toBe(10);
  });

  it("抽選確定後の応答喪失でも同じ要求ID・同じ残高へ戻る", async () => {
    const p = setup();
    await p.service.status();
    p.lose("draw");
    await expect(p.service.draw(10)).rejects.toThrow("応答");
    const id = p.service.pendingRequest()!.requestId;
    const restarted = createSupplyService(p.local, p.request);
    const recovered = await restarted.status();
    expect(recovered.pending!.requestId).toBe(id);
    expect(recovered.tickets).toBe(0);
    expect((await restarted.draw(10)).pending).toEqual(recovered.pending);
    await expect(restarted.draw(1)).rejects.toThrow("前回");
  });

  it("受領確認の応答だけを失っても新しい抽選として再消費しない", async () => {
    const p = setup();
    await p.service.status();
    const draw = await p.service.draw(1);
    p.lose("ack");
    await expect(
      p.service.acknowledge(draw.pending!.requestId),
    ).rejects.toThrow("応答");
    expect(p.service.pendingRequest()!.phase).toBe("ack");
    const state = await p.service.status();
    expect(state.pending).toBeNull();
    expect(state.tickets).toBe(9);
    expect(p.service.pendingRequest()).toBeUndefined();
  });

  it("識別情報を保存できない端末はサーバー口座を作らない", async () => {
    const p = setup();
    const service = createSupplyService(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("保存失敗");
        },
      },
      p.request,
    );
    await expect(service.status()).rejects.toThrow("保存失敗");
    expect(p.calls).toBe(0);
  });
});
