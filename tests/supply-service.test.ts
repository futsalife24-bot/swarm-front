import { describe, expect, it } from "vitest";
import { createSupplyService } from "../src/client/supply-service";
import { memoryLocal, supplyWorld } from "./supply-harness";

async function setup() {
  const world = supplyWorld();
  const code = await world.createVault();
  const local = memoryLocal();
  let calls = 0;
  let lose = "";
  const request = (async (url: string, init: RequestInit) => {
    calls++;
    const response = await world.request(url, init);
    if (lose && String(url).endsWith(lose)) {
      lose = "";
      throw Error("応答だけを喪失");
    }
    return response;
  }) as typeof fetch;
  return {
    world,
    code,
    local,
    request,
    service: createSupplyService(local, request, () => code),
    restart: (cloud: string | null = code) =>
      createSupplyService(local, request, () => cloud),
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
    const p = await setup();
    p.lose("initialize");
    await expect(p.service.status()).rejects.toThrow("応答");
    expect((await p.restart().status()).tickets).toBe(10);
  });

  it("抽選確定後の応答喪失でも同じ要求ID・同じ残高へ戻る", async () => {
    const p = await setup();
    await p.service.status();
    p.lose("draw");
    await expect(p.service.draw(10)).rejects.toThrow("応答");
    const id = p.service.pendingRequest()!.requestId;
    const restarted = p.restart();
    const recovered = await restarted.status();
    expect(recovered.pending!.requestId).toBe(id);
    expect(recovered.tickets).toBe(0);
    expect((await restarted.draw(10)).pending).toEqual(recovered.pending);
    await expect(restarted.draw(1)).rejects.toThrow("前回");
  });

  it("受領確認の応答だけを失っても新しい抽選として再消費しない", async () => {
    const p = await setup();
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
    const p = await setup();
    const service = createSupplyService(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("保存失敗");
        },
        removeItem: () => {},
      },
      p.request,
      () => p.code,
    );
    await expect(service.status()).rejects.toThrow("保存失敗");
    expect(p.calls).toBe(0);
  });

  it("クラウド保存がなければ口座を作らず作成を案内する", async () => {
    const p = await setup();
    const service = p.restart(null);
    await expect(service.status()).rejects.toMatchObject({
      cloudRequired: true,
    });
    expect(service.pendingRequest()).toBeUndefined();
    expect(p.calls).toBe(0);
  });
});

describe("初回10枚はクラウド保存1つにつき1回（F-17 H-1）", () => {
  it("補給の接続情報だけを消して作り直しても初回付与が入らない", async () => {
    const p = await setup();
    expect((await p.service.status()).tickets).toBe(10);
    const ten = await p.service.draw(10);
    await p.service.acknowledge(ten.pending!.requestId);
    // 端末側の補給接続情報をすべて消し、旧方式の新しい口座も偽造して作り直す。
    p.local.values.clear();
    const hex = () => crypto.randomUUID().replaceAll("-", "");
    p.local.setItem(
      "swarm-front-supply-link-v1",
      JSON.stringify({ id: hex(), token: hex() + hex() }),
    );
    const again = await p.restart().status();
    expect(again.tickets).toBe(0);
    expect(p.local.getItem("swarm-front-supply-link-v1")).toBeNull();
    // 別の端末・空の端末から同じクラウド保存へ接続しても同じ残高。
    const other = createSupplyService(memoryLocal(), p.request, () => p.code);
    expect((await other.status()).tickets).toBe(0);
    await expect(other.draw(10)).rejects.toThrow("足りません");
    expect(p.world.vaultRow(p.code)!.supplyGrant).toBe("cloud");
  });

  it("旧方式の口座はサーバーで新規作成できない", async () => {
    const world = supplyWorld();
    const hex = () => crypto.randomUUID().replaceAll("-", "");
    const res = await world.request(`/api/supply/${hex()}/initialize`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + hex() + hex(),
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ retired: true });
  });

  it("保管庫の資格がない補給口座は作れない", async () => {
    const world = supplyWorld();
    const code = await world.createVault();
    const [, id] = code.split("-");
    const hex = () => crypto.randomUUID().replaceAll("-", "");
    for (const target of [id, hex()]) {
      const res = await world.request(
        `/api/supply/cloud/${target}/initialize`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + hex() + hex(),
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      expect(res.status).toBe(401);
    }
    expect(world.vaultRow(code)!.supplyGrant).toBeUndefined();
  });

  it("既存口座は残高を保ったまま1回だけ移行し、二重に初回付与しない", async () => {
    const world = supplyWorld();
    const legacy = await world.legacyAccount(7, "2026-11-10");
    const local = memoryLocal();
    local.setItem("swarm-front-supply-link-v1", JSON.stringify(legacy));
    // クラウド保存の作成前は旧口座のまま使える（日次配布は廃止）。
    let code: string | null = null;
    const service = createSupplyService(local, world.request, () => code);
    expect((await service.status()).tickets).toBe(7);
    code = await world.createVault();
    expect((await service.status()).tickets).toBe(7);
    expect(local.getItem("swarm-front-supply-link-v1")).toBeNull();
    expect(world.vaultRow(code)!.supplyGrant).toBe(`legacy:${legacy.id}`);
    // 旧口座は凍結され、再送しても残高は増えない。
    local.setItem("swarm-front-supply-link-v1", JSON.stringify(legacy));
    expect((await service.status()).tickets).toBe(7);
    local.values.clear();
    expect((await service.status()).tickets).toBe(7);
    const old = await world.request(`/api/supply/${legacy.id}/draw`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + legacy.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        count: 1,
      }),
    });
    expect(old.status).toBe(409);
  });

  it("旧口座の未受領の補給は受領してから移行する", async () => {
    const world = supplyWorld();
    const legacy = await world.legacyAccount(10);
    const local = memoryLocal();
    local.setItem("swarm-front-supply-link-v1", JSON.stringify(legacy));
    let code: string | null = null;
    const service = createSupplyService(local, world.request, () => code);
    await service.status();
    const draw = await service.draw(1);
    code = await world.createVault();
    const waiting = await service.status();
    expect(waiting.pending!.requestId).toBe(draw.pending!.requestId);
    expect(local.getItem("swarm-front-supply-link-v1")).not.toBeNull();
    await service.acknowledge(draw.pending!.requestId);
    expect((await service.status()).tickets).toBe(9);
    expect(local.getItem("swarm-front-supply-link-v1")).toBeNull();
  });

  it("対象外: クラウド保存自体を削除して作り直すと新しい保管庫として付与される", async () => {
    // 本人決定（2026-11-17）で許容した範囲。クラウドセーブも失うため防がない。
    const p = await setup();
    await p.service.status();
    await p.world.deleteVault(p.code);
    const next = await p.world.createVault();
    expect((await p.restart(next).status()).tickets).toBe(10);
  });
});

it("旧口座を移行した保管庫でも過去達成を一度だけ集計しcreditedを渡す", async () => {
  const world = supplyWorld();
  const { freshProgress } = await import("../src/client/progression-save");
  const save = freshProgress("normal");
  save.missions = { "1:normal": [true, true, true] };
  const code = await world.createVault(save);
  const legacy = await world.legacyAccount(7);
  const local = memoryLocal();
  local.setItem("swarm-front-supply-link-v1", JSON.stringify(legacy));
  const service = createSupplyService(local, world.request, () => code);
  expect(await service.status()).toMatchObject({
    tickets: 14,
    credited: { past: 7, recent: 0 },
  });
  expect(await service.status()).toMatchObject({
    tickets: 14,
    credited: { past: 0, recent: 0 },
  });
});
