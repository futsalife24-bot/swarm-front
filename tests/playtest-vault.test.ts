import { describe, expect, it } from "vitest";
import {
  playerVault,
  cloudAdmission,
  cloudRateCount,
  clientAddress,
  authenticatedResponse,
  vaultSupplyGrant,
  AUTHENTICATED_DAILY_CAP,
} from "../server/player-vault";
import { freshProgress } from "../src/client/progression-save";
import { collectDefense, settleDefense } from "../src/shared/daily-rewards";
import { rollWeapon } from "../src/shared/progression";
const token = "a".repeat(64),
  now = Date.parse("2026-09-17T00:00:00Z");
function fixture() {
  const values = new Map<string, unknown>();
  const storage = {
    get: async (k: string) => structuredClone(values.get(k)),
    put: async (k: string, v: unknown) => {
      values.set(k, structuredClone(v));
    },
    deleteAll: async () => {
      values.clear();
    },
  } as unknown as DurableObjectStorage;
  const request = (action: string, body?: unknown, key = token) =>
    new Request("https://internal/cloud/" + action, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "test-client",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const initialize = (save = freshProgress("normal")) =>
    playerVault(request("initialize", { save }), storage, true, now);
  return { values, storage, request, initialize };
}
describe("player vault", () => {
  it("preserves claimed rewards when a cloud backup is deleted and recreated", async () => {
    const f = fixture(),
      save = freshProgress("normal");
    save.receipts = ["win-1", "win-2", "win-3"];
    save.weeklyPending = [...save.receipts];
    await f.initialize(save);
    const claimed = (await (
      await playerVault(
        f.request("weekly", { id: "campaign-3", version: 1 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    await playerVault(f.request("delete", {}), f.storage, false, now);
    const recreated = (await (await f.initialize(claimed.save)).json()) as any;
    expect(recreated.save.weekly).toEqual(claimed.save.weekly);
    const repeated = (await (
      await playerVault(
        f.request("weekly", { id: "campaign-3", version: 1 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(repeated.save.coins).toBe(save.coins + 150);
    expect(repeated.save.weekly.claimed).toEqual(["campaign-3"]);
  });
  it("retains partial same-week progress and merges queued wins without duplication", async () => {
    const f = fixture(),
      save = freshProgress("normal");
    save.weekly = {
      week: "2026-09-14",
      campaign: ["win-1", "win-2"],
      defense: ["defense-1"],
      claimed: [],
    };
    const partial = (await (await f.initialize(save)).json()) as any;
    expect(partial.save.weekly).toEqual(save.weekly);
    await playerVault(f.request("delete", {}), f.storage, false, now);
    save.receipts = ["win-2", "win-3"];
    save.weeklyPending = [...save.receipts];
    const merged = (await (await f.initialize(save)).json()) as any;
    expect(merged.save.weekly.campaign).toEqual(["win-1", "win-2", "win-3"]);
    expect(merged.save.weekly.defense).toEqual(["defense-1"]);
    expect(merged.save.weeklyPending).toEqual([]);
  });
  it("expires past weeks and rejects future or malformed weekly records on creation", async () => {
    const save = freshProgress("normal");
    save.weekly = {
      week: "2026-09-07",
      campaign: ["old-1"],
      defense: [],
      claimed: ["campaign-3"],
    };
    save.receipts = ["new-1"];
    save.weeklyPending = ["new-1"];
    const past = (await (await fixture().initialize(save)).json()) as any;
    expect(past.save.weekly).toEqual({
      week: "2026-09-14",
      campaign: ["new-1"],
      defense: [],
      claimed: [],
    });
    save.weekly.week = "2026-09-21";
    expect((await fixture().initialize(save)).status).toBe(400);
    save.weekly = {
      week: "2026-09-14",
      campaign: null,
      defense: [],
      claimed: [],
    } as any;
    expect((await fixture().initialize(save)).status).toBe(400);
  });
  it("does not acknowledge a lost save response across a later server reward", async () => {
    const f = fixture();
    await f.initialize();
    const body = {
      save: freshProgress("normal"),
      version: 1,
      basisVersion: 1,
      mutation: crypto.randomUUID(),
    };
    expect(
      (await playerVault(f.request("save", body), f.storage, false, now))
        .status,
    ).toBe(200);
    await playerVault(
      f.request("daily", {
        day: "2026-09-17",
        run: "lost-response-daily-001",
        version: 2,
      }),
      f.storage,
      false,
      now,
    );
    expect(
      (await playerVault(f.request("save", body), f.storage, false, now))
        .status,
    ).toBe(409);
    const remote = (await (
      await playerVault(f.request("save"), f.storage, false, now)
    ).json()) as any;
    expect(remote.save.inventory.length).toBe(4);
  });
  it("credits pre-cloud wins at initialization and never credits them twice", async () => {
    const f = fixture(),
      save = freshProgress("normal");
    save.receipts = ["offline-1", "offline-2", "offline-3"];
    save.weeklyPending = [...save.receipts];
    const created = (await (await f.initialize(save)).json()) as any;
    expect(created.save.weekly.campaign).toEqual(save.receipts);
    expect(created.save.weeklyPending).toEqual([]);
    const synced = (await (
      await playerVault(
        f.request("save", {
          save,
          version: 1,
          basisVersion: 1,
          mutation: crypto.randomUUID(),
        }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(synced.save.weekly.campaign).toEqual(save.receipts);
    const claimed = (await (
      await playerVault(
        f.request("weekly", { id: "campaign-3", version: 2 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(claimed.save.coins).toBe(save.coins + 150);
    // A stale device explicitly adopts local progress against the inspected version.
    const rejected = await playerVault(
      f.request("save", {
        save,
        version: claimed.version,
        basisVersion: 2,
        mutation: crypto.randomUUID(),
      }),
      f.storage,
      false,
      now,
    );
    expect(rejected.status).toBe(409);
    const remote = (await (
      await playerVault(f.request("save"), f.storage, false, now)
    ).json()) as any;
    expect(remote.save.coins).toBe(save.coins + 150);
    expect(remote.save.weekly.claimed).toEqual(["campaign-3"]);
    // Spending after receipt is legal and must not recreate the coins.
    remote.save.coins -= 100;
    const spent = await playerVault(
      f.request("save", {
        save: remote.save,
        version: remote.version,
        basisVersion: remote.version,
        mutation: crypto.randomUUID(),
      }),
      f.storage,
      false,
      now,
    );
    expect(spent.status).toBe(200);
    expect(((await spent.json()) as any).save.coins).toBe(save.coins + 50);
  });
  it("rejects rollback across daily guarantee, collected drops and settlement", async () => {
    const f = fixture(),
      before = freshProgress("normal");
    await f.initialize(before);
    const run = "daily-vault-protected-001";
    const admitted = (await (
      await playerVault(
        f.request("daily", { run, day: "2026-09-17", version: 1 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    for (const basisVersion of [undefined, 1]) {
      const rejected = await playerVault(
        f.request("save", {
          save: before,
          version: 2,
          basisVersion,
          mutation: crypto.randomUUID(),
        }),
        f.storage,
        false,
        now,
      );
      expect(rejected.status).toBe(409);
    }
    const dropped = collectDefense(admitted.save, run, [
      rollWeapon(
        run + "-drop-1",
        1,
        "normal",
        false,
        admitted.save.serial,
        () => 0.1,
      ),
    ]);
    const collected = (await (
      await playerVault(
        f.request("save", {
          save: dropped,
          version: 2,
          basisVersion: 2,
          mutation: crypto.randomUUID(),
        }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(collected.save.inventory.length).toBe(before.inventory.length + 2);
    const rollback = await playerVault(
      f.request("save", {
        save: admitted.save,
        version: 3,
        basisVersion: 2,
        mutation: crypto.randomUUID(),
      }),
      f.storage,
      false,
      now,
    );
    expect(rollback.status).toBe(409);
    const settled = settleDefense(
      collected.save,
      run,
      "defeat",
      0,
      2000,
      () => 0.1,
    );
    const result = (await (
      await playerVault(
        f.request("save", {
          save: settled,
          version: 3,
          basisVersion: 3,
          mutation: crypto.randomUUID(),
        }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(result.save.powder).toBe(5);
    expect(
      (
        await playerVault(
          f.request("save", {
            save: collected.save,
            version: 4,
            basisVersion: 3,
            mutation: crypto.randomUUID(),
          }),
          f.storage,
          false,
          now,
        )
      ).status,
    ).toBe(409);
    const remote = (await (
      await playerVault(f.request("save"), f.storage, false, now)
    ).json()) as any;
    expect(remote.save).toEqual(result.save);
    expect(remote.daily.run).toBe(run);
  });
  it("stores only a digest of the key and rejects incorrect credentials", async () => {
    const f = fixture();
    await f.initialize();
    expect(JSON.stringify([...f.values.values()])).not.toContain(token);
    expect(
      (
        await playerVault(
          f.request("save", undefined, "b".repeat(64)),
          f.storage,
        )
      ).status,
    ).toBe(401);
    const read = await playerVault(f.request("save"), f.storage);
    expect(read.headers.get("Cache-Control")).toBe("no-store");
    expect(((await read.json()) as any).version).toBe(1);
  });
  it("keeps the newest save behind the same key and rejects stale device writes", async () => {
    const f = fixture();
    await f.initialize();
    const save = freshProgress("normal");
    save.coins = 200;
    const body = { save, version: 1, mutation: crypto.randomUUID() };
    expect((await playerVault(f.request("save", body), f.storage)).status).toBe(
      200,
    );
    expect((await playerVault(f.request("save", body), f.storage)).status).toBe(
      200,
    );
    const stale = await playerVault(
      f.request("save", { ...body, mutation: crypto.randomUUID() }),
      f.storage,
    );
    expect(stale.status).toBe(409);
    const data = (await (
      await playerVault(f.request("save"), f.storage)
    ).json()) as any;
    expect(data.version).toBe(2);
    expect(data.save.coins).toBe(200);
  });
  it("consumes exactly one admission and atomically stores its guarantee", async () => {
    const f = fixture();
    await f.initialize();
    const body = { day: "2026-09-17", run: "daily-vault-run-0001", version: 1 };
    const data = (await (
      await playerVault(f.request("daily", body), f.storage, false, now)
    ).json()) as any;
    expect(data.version).toBe(2);
    expect(data.save.inventory.length).toBe(4);
    expect(data.save.weekly.defense).toEqual([body.run]);
    const repeated = (await (
      await playerVault(f.request("daily", body), f.storage, false, now)
    ).json()) as any;
    expect(repeated.save.inventory).toEqual(data.save.inventory);
    expect(
      (
        await playerVault(
          f.request("daily", { ...body, run: "daily-vault-run-0002" }),
          f.storage,
          false,
          now,
        )
      ).status,
    ).toBe(409);
    // A response lost across midnight is a retry of the old admission, not a new day.
    const midnight = Date.parse("2026-09-17T15:00:00Z");
    const late = (await (
      await playerVault(f.request("daily", body), f.storage, false, midnight)
    ).json()) as any;
    expect(late.daily.day).toBe("2026-09-17");
    expect(
      (
        await playerVault(
          f.request("daily", {
            ...body,
            day: "2026-09-18",
            run: "daily-vault-run-0002",
            version: 2,
          }),
          f.storage,
          false,
          midnight,
        )
      ).status,
    ).toBe(200);
  });
  it("rejects client-selected dates and deletes cloud data without requiring local deletion", async () => {
    const f = fixture();
    await f.initialize();
    expect(
      (
        await playerVault(
          f.request("daily", {
            day: "2099-01-01",
            run: "daily-vault-run-0001",
            version: 1,
          }),
          f.storage,
          false,
          now,
        )
      ).status,
    ).toBe(409);
    expect((await playerVault(f.request("delete", {}), f.storage)).status).toBe(
      200,
    );
    expect((await playerVault(f.request("save"), f.storage)).status).toBe(401);
  });
  it("credits queued offline wins on server time and claims rewards once", async () => {
    const f = fixture();
    await f.initialize();
    const save = freshProgress("normal");
    save.receipts = ["one", "two", "three"];
    save.weeklyPending = [...save.receipts];
    await playerVault(
      f.request("save", { save, version: 1, mutation: crypto.randomUUID() }),
      f.storage,
      false,
      now,
    );
    const first = (await (
      await playerVault(
        f.request("weekly", { id: "campaign-3", version: 2 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(first.save.coins).toBe(save.coins + 150);
    const again = (await (
      await playerVault(
        f.request("weekly", { id: "campaign-3", version: 3 }),
        f.storage,
        false,
        now,
      )
    ).json()) as any;
    expect(again.save.coins).toBe(first.save.coins);
  });
  it("bounds account creation and read/write requests", async () => {
    const f = fixture();
    for (let i = 0; i < 5; i++)
      expect(
        (await cloudAdmission(f.request("create"), f.storage, now)).status,
      ).toBe(200);
    expect(
      (await cloudAdmission(f.request("create"), f.storage, now)).status,
    ).toBe(429);
  });
  it("認証済みの要求だけを数え、上限到達後は新規作成だけを止める", async () => {
    const f = fixture();
    f.values.set("cloud-rate", {
      day: "2026-09-17",
      total: AUTHENTICATED_DAILY_CAP - 1,
    });
    const first = (await (await cloudRateCount(f.storage, now)).json()) as any;
    expect(first).toEqual({ total: AUTHENTICATED_DAILY_CAP, saturated: true });
    // 到達後も数え続けて拒否しない（書込みも増やさない）。
    expect((await cloudRateCount(f.storage, now)).status).toBe(200);
    expect((f.values.get("cloud-rate") as any).total).toBe(
      AUTHENTICATED_DAILY_CAP,
    );
    expect(
      (await cloudAdmission(f.request("create"), f.storage, now)).status,
    ).toBe(429);
    // 翌日（JST）は新規作成も再開する。
    expect(
      (await cloudAdmission(f.request("create"), f.storage, now + 86400000))
        .status,
    ).toBe(200);
    expect([200, 400, 404, 409].every(authenticatedResponse)).toBe(true);
    expect([401, 429, 500].some(authenticatedResponse)).toBe(false);
  });
  it("IPv6 は /64 単位、IPv4 はアドレス単位で同じ上限キーにまとめる", () => {
    expect(clientAddress("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(clientAddress("2001:0db8:0001:0002:ffff:1:2:3")).toBe(
      "2001:db8:1:2::/64",
    );
    expect(clientAddress("2001:db8::")).toBe("2001:db8:0:0::/64");
    expect(clientAddress("::1")).toBe("0:0:0:0::/64");
    expect(clientAddress("2001:db8:1:3::1")).not.toBe(
      clientAddress("2001:db8:1:2::1"),
    );
    expect(clientAddress("203.0.113.5")).toBe("203.0.113.5");
  });
  it("保管庫の資格を確認して初回補給を1回だけ割り当てる", async () => {
    const f = fixture();
    await f.initialize();
    const grant = (claim: string, key = token) =>
      vaultSupplyGrant(
        new Request("https://internal/cloud-supply-grant", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ claim }),
        }),
        f.storage as any,
      );
    expect((await grant("cloud", "b".repeat(64))).status).toBe(401);
    expect((await grant("other")).status).toBe(400);
    expect(await (await grant("cloud")).json()).toEqual({ grant: true });
    // 書込み失敗後の再試行と同じ扱い。別口座の移行では付与しない。
    expect(await (await grant("cloud")).json()).toEqual({ grant: true });
    expect(await (await grant(`legacy:${"c".repeat(32)}`)).json()).toEqual({
      grant: false,
    });
    // セーブを更新しても付与記録は保管庫に残る。
    const save = freshProgress("normal");
    await playerVault(
      f.request("save", { save, version: 1, mutation: crypto.randomUUID() }),
      f.storage,
      false,
      now,
    );
    expect((f.values.get("vault") as any).supplyGrant).toBe("cloud");
  });
});
