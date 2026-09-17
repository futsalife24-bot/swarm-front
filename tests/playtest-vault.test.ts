import { describe, expect, it } from "vitest";
import {
  playerVault,
  cloudAdmission,
  cloudRateLimit,
} from "../server/player-vault";
import { freshProgress } from "../src/client/progression-save";
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
  const initialize = () =>
    playerVault(
      request("initialize", { save: freshProgress("normal") }),
      storage,
      true,
      now,
    );
  return { values, storage, request, initialize };
}
describe("player vault", () => {
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
