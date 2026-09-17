import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { appAnalytics, expireAppAnalytics } from "../server/app-analytics";
import { jstDate, summary, readEvent, type Day } from "../server/app-analytics";
const day = (date: string, views: number, visitors = 1): Day => ({
  date,
  views,
  visitors,
  sorties: 0,
  clears: 0,
});
describe("app analytics", () => {
  it("counts per-day unique browsers with real SQLite and expires inactive data", async () => {
    const db = new DatabaseSync(":memory:");
    let alarm: number | null = null;
    const storage = {
      sql: {
        exec: (sql: string, ...bindings: (string | number)[]) => ({
          toArray: () => db.prepare(sql).all(...bindings),
        }),
      },
      transactionSync: (fn: () => void) => {
        db.exec("BEGIN");
        try {
          fn();
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      getAlarm: async () => alarm,
      setAlarm: async (time: number) => {
        alarm = time;
      },
    } as unknown as DurableObjectStorage;
    // Execute immediately as DurableObject SQL cursors do.
    storage.sql.exec = ((sql: string, ...bindings: (string | number)[]) => {
      const rows = db.prepare(sql).all(...bindings);
      return { toArray: () => rows };
    }) as typeof storage.sql.exec;
    const now = Date.parse("2026-09-17T01:00Z");
    const event = (visitor: string | null) =>
      new Request("https://internal/app-analytics-event", {
        method: "POST",
        body: JSON.stringify({ visitor }),
      });
    const read = () =>
      new Request("https://internal/app-analytics-read", {
        headers: { "X-Developer-Verified": "1" },
      });
    try {
      const empty = (await (
        await appAnalytics(read(), storage, now)
      ).json()) as { days: Day[] };
      expect(empty.days).toEqual([]);
      await appAnalytics(event("a".repeat(32)), storage, now);
      await appAnalytics(event("a".repeat(32)), storage, now);
      await appAnalytics(event(null), storage, now);
      const data = (await (
        await appAnalytics(read(), storage, now)
      ).json()) as { days: Day[] };
      expect(data.days).toEqual([day("2026-09-17", 3, 1)]);
      expect(JSON.stringify(data)).not.toContain("a".repeat(32));
      expect(alarm).toBe(now + 86400000);
      await appAnalytics(event("a".repeat(32)), storage, now + 86400000);
      const next = (await (
        await appAnalytics(read(), storage, now + 86400000)
      ).json()) as { days: Day[] };
      expect(next.days[1].visitors).toBe(1);
      await expireAppAnalytics(storage, now + 366 * 86400000);
      expect(db.prepare("SELECT * FROM app_days").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM app_visitors").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
  it("changes dates at Japanese midnight", () => {
    expect(jstDate(Date.parse("2026-09-16T14:59:59Z"))).toBe("2026-09-16");
    expect(jstDate(Date.parse("2026-09-16T15:00:00Z"))).toBe("2026-09-17");
  });
  it("includes zero days and excludes data outside the requested period", () => {
    const s = summary(
      [
        day("2026-09-09", 100),
        day("2026-09-11", 3),
        day("2026-09-16", 4, 2),
        day("2026-09-17", 6, 3),
        day("2026-09-18", 100),
      ],
      7,
      Date.parse("2026-09-17T02:00Z"),
    );
    expect(s.days).toHaveLength(7);
    expect(s.days[0].date).toBe("2026-09-11");
    expect(s.totals.views).toBe(13);
    expect(s.totals.visitors).toBe(6);
    expect(s.change).toBe(50);
  });
  it("handles month/year boundaries, today only and no yesterday denominator", () => {
    const now = Date.parse("2026-01-01T01:00Z");
    expect(
      summary([day("2025-12-31", 4), day("2026-01-01", 2)], 1, now).totals
        .views,
    ).toBe(2);
    const empty = summary([], 30, now);
    expect(empty.days[0].date).toBe("2025-12-03");
    expect(empty.change).toBeNull();
    expect(empty.totals.views).toBe(0);
  });
  it("validates and bounds streamed bodies, including missing identity", async () => {
    const request = (body: string) =>
      new Request("https://test", { method: "POST", body });
    expect(await readEvent(request('{"visitor":null}'))).toEqual({
      visitor: null,
    });
    expect(
      await readEvent(request(JSON.stringify({ visitor: "a".repeat(32) }))),
    ).toEqual({ visitor: "a".repeat(32) });
    for (const body of [
      "{}",
      "null",
      "[]",
      '{"visitor":"anonymous"}',
      "x".repeat(513),
    ])
      await expect(readEvent(request(body))).rejects.toThrow();
  });
});
