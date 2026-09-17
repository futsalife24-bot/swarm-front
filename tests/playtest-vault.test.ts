import { describe, expect, it } from "vitest";
import {
  playerVault,
  cloudAdmission,
  cloudRateLimit,
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
    for (let i = 0; i < 60; i++)
      expect(
        (await cloudRateLimit(f.request("save"), f.storage, now)).status,
      ).toBe(200);
    expect(
      (await cloudRateLimit(f.request("save"), f.storage, now)).status,
    ).toBe(429);
    expect(
      (await cloudRateLimit(f.request("save"), f.storage, now + 60000)).status,
    ).toBe(200);
  });
});
