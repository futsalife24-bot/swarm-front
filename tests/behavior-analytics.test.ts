import { describe, it, expect } from "vitest";
import {
  createBehaviorAnalytics,
  behaviorKey,
} from "../src/client/behavior-analytics";
function fixture() {
  let now = Date.parse("2026-09-27T14:59:00Z"),
    counter = 0;
  const values = new Map<string, string>(),
    sent: any[] = [];
  let chain = Promise.resolve();
  const deps = {
    storage: () => ({
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        values.set(k, v);
      },
    }),
    lock: <T>(work: () => T): Promise<T> => {
      const task = chain.then(work);
      chain = task.then(
        () => {},
        () => {},
      );
      return task;
    },
    now: () => now,
    token: () => (++counter).toString(16).padStart(32, "0"),
    send: async (body: string) => {
      sent.push(JSON.parse(body));
      return { ok: true, status: 200 };
    },
  };
  return {
    values,
    sent,
    deps,
    client: createBehaviorAnalytics(deps),
    advance: (n: number) => {
      now += n;
    },
  };
}
describe("daily behavior payload", () => {
  it("counts four actions once, across back/reload/shared tabs; never includes save data", async () => {
    const f = fixture();
    await Promise.all([
      f.client.record("visit"),
      createBehaviorAnalytics(f.deps).record("visit"),
    ]);
    await f.client.record("sortie");
    await f.client.record("victory");
    await createBehaviorAnalytics(f.deps).record("sortie");
    await f.client.record("visit");
    expect(f.sent.map((p) => p.event)).toEqual([
      "visit",
      "sortie_start",
      "first_victory",
      "sortie_again",
    ]);
    for (const p of f.sent)
      expect(Object.keys(p).sort()).toEqual([
        "admin",
        "day",
        "event",
        "token",
        "version",
      ]);
    expect(new Set(f.sent.map((p) => p.token)).size).toBe(1);
  });
  it("rotates identity and victory gate at JST midnight; a second sortie without victory is not again", async () => {
    const f = fixture();
    await f.client.record("sortie");
    await f.client.record("sortie");
    expect(f.sent.length).toBe(1);
    await f.client.record("victory");
    const token = f.sent[0].token;
    f.advance(60000);
    await f.client.record("sortie");
    expect(f.sent.at(-1).event).toBe("sortie_start");
    expect(f.sent.at(-1).token).not.toBe(token);
    expect(f.sent.some((p) => p.event === "sortie_again")).toBe(false);
  });
  for (const status of [400, 403, 409, 429, 503, 0])
    it(`never rejects; limits attempts for ${status}`, async () => {
      const f = fixture();
      f.deps.send = async (body) => {
        f.sent.push(JSON.parse(body));
        if (!status) throw Error("offline");
        return { ok: false, status };
      };
      await f.client.record("visit");
      await createBehaviorAnalytics(f.deps).record("visit");
      expect(f.sent.length).toBe([400, 403, 409].includes(status) ? 1 : 2);
      expect(
        f.sent.every((p) => JSON.stringify(p) === JSON.stringify(f.sent[0])),
      ).toBe(true);
    });
  it("does not send with broken storage, malformed state or denied locks", async () => {
    const f = fixture();
    f.values.set(behaviorKey, '{"bad":true}');
    // malformed state cannot create a fallback identifier
    f.values.set(
      behaviorKey,
      JSON.stringify({
        day: "2026-09-27",
        token: "bad",
        won: false,
        pending: {},
      }),
    );
    await f.client.record("visit");
    expect(f.sent).toEqual([]);
    f.deps.storage = () => {
      throw Error("denied");
    };
    await f.client.record("visit");
    expect(f.sent).toEqual([]);
    f.deps.lock = async () => {
      throw Error("unavailable");
    };
    await f.client.record("sortie");
    expect(f.sent).toEqual([]);
  });
  it("captures the existing admin flag and retains the same payload for retry", async () => {
    const f = fixture();
    f.values.set("app-analytics-admin", "1");
    f.deps.send = async (body) => {
      f.sent.push(JSON.parse(body));
      f.values.set("app-analytics-admin", "0");
      return { ok: false, status: 503 };
    };
    await f.client.record("visit");
    expect(f.sent.map((p) => p.admin)).toEqual([true, true]);
  });
});
