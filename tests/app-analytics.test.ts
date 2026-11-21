import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { appAnalytics, expireAppAnalytics } from "../server/app-analytics";
import {
  countSwarmAnalytics,
  elapsedBucketTotals,
  isSwarmAnalyticsKind,
  jstDate,
  summary,
  readEvent,
  subtractElapsedBuckets,
  SWARM_ELAPSED_BUCKETS,
  SWARM_M2_KINDS,
  type Day,
} from "../server/app-analytics";
import {
  elapsedBucketFromSeconds,
  isElapsedBucket,
} from "../src/shared/analytics-kinds";
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
      const adminEvent = (visitor: string, admin: boolean) =>
        new Request("https://internal/app-analytics-event", {
          method: "POST",
          body: JSON.stringify({ visitor, admin }),
        });
      const excludedRead = () =>
        new Request("https://internal/app-analytics-read?excludeAdmin=1", {
          headers: { "X-Developer-Verified": "1" },
        });
      const b = "b".repeat(32);
      await appAnalytics(adminEvent(b, true), storage, now + 86400000);
      await appAnalytics(adminEvent(b, true), storage, now + 86400000);
      let filtered = (await (
        await appAnalytics(excludedRead(), storage, now + 86400000)
      ).json()) as { days: Day[] };
      expect(filtered.days[1]).toEqual(day("2026-09-18", 1, 1));
      const all = (await (
        await appAnalytics(read(), storage, now + 86400000)
      ).json()) as { days: Day[] };
      expect(all.days[1]).toEqual(day("2026-09-18", 3, 2));
      // Unregistering during the day adds a public view and visitor without double counting total visitors.
      await appAnalytics(adminEvent(b, false), storage, now + 86400000);
      await appAnalytics(
        adminEvent("a".repeat(32), true),
        storage,
        now + 86400000,
      );
      filtered = (await (
        await appAnalytics(excludedRead(), storage, now + 86400000)
      ).json()) as { days: Day[] };
      expect(filtered.days[1]).toEqual(day("2026-09-18", 2, 2));
      // A legacy visitor who later registers keeps their pre-registration visit in public counts.
      expect(filtered.days[0]).toEqual(day("2026-09-17", 3, 1));
      expect(JSON.stringify(filtered)).not.toContain(b);
      expect(
        (
          await appAnalytics(
            new Request("https://internal/app-analytics-read?excludeAdmin=1"),
            storage,
            now,
          )
        ).status,
      ).toBe(401);
      await expireAppAnalytics(storage, now + 366 * 86400000);
      expect(db.prepare("SELECT * FROM app_days").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM app_visitors").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM app_admin_days").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM app_admin_only").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
  it("changes dates at Japanese midnight", () => {
    expect(jstDate(Date.parse("2026-09-16T14:59:59Z"))).toBe("2026-09-16");
    expect(jstDate(Date.parse("2026-09-16T15:00:00Z"))).toBe("2026-09-17");
  });
  it("keeps legacy days readable and counts each first-journey event", () => {
    const legacy: Day = {
      date: "2026-09-16",
      views: 3,
      visitors: 2,
      sorties: 5,
      clears: 1,
    };
    for (const kind of [
      "ftue_start",
      "first_sortie",
      "first_clear",
      "first_supply10",
      "return",
    ] as const)
      countSwarmAnalytics(legacy, kind);
    expect(legacy).toEqual({
      ...legacy,
      ftueStarts: 1,
      firstSorties: 1,
      firstClears: 1,
      firstSupply10s: 1,
      returns: 1,
    });
    expect(legacy.views).toBe(3);
    expect(legacy.sorties).toBe(5);
    expect(legacy.clears).toBe(1);
    expect(isSwarmAnalyticsKind("first_supply10")).toBe(true);
    expect(isSwarmAnalyticsKind("unexpected")).toBe(false);
    const totals = summary([legacy], 1, Date.parse("2026-09-16T01:00Z")).totals;
    expect(totals).toMatchObject({
      views: 3,
      sorties: 5,
      clears: 1,
      ftueStarts: 1,
      firstSorties: 1,
      firstClears: 1,
      firstSupply10s: 1,
      returns: 1,
    });
  });
  it("counts all eight extended milestones without changing legacy counters", () => {
    const day: Day = {
      date: "2026-09-16",
      views: 7,
      visitors: 2,
      sorties: 4,
      clears: 1,
      ftueStarts: 1,
    };
    const counters = {
      operation_achieved: "operationAchievements",
      training_started: "trainingStarts",
      training_completed: "trainingCompletions",
      first_buddy: "firstBuddies",
      first_supply_opened: "firstSupplyOpeneds",
      second_sortie: "secondSorties",
      first_box_claim: "firstBoxClaims",
      first_defeat: "firstDefeats",
    } as const;
    expect(SWARM_M2_KINDS).toEqual(Object.keys(counters));
    for (const kind of SWARM_M2_KINDS) {
      expect(isSwarmAnalyticsKind(kind)).toBe(true);
      countSwarmAnalytics(day, kind);
    }
    expect(isSwarmAnalyticsKind("mystery_milestone")).toBe(false);
    expect(day).toMatchObject({
      views: 7,
      visitors: 2,
      sorties: 4,
      clears: 1,
      ftueStarts: 1,
      operationAchievements: 1,
      trainingStarts: 1,
      trainingCompletions: 1,
      firstBuddies: 1,
      firstSupplyOpeneds: 1,
      secondSorties: 1,
      firstBoxClaims: 1,
      firstDefeats: 1,
    });
    expect(day.elapsedBuckets).toBeUndefined();
    const totals = summary([day], 1, Date.parse("2026-09-16T01:00Z")).totals;
    for (const key of Object.values(counters)) expect(totals[key]).toBe(1);
    expect(totals.views).toBe(7);
    expect(totals.ftueStarts).toBe(1);
  });
  it("stores and aggregates elapsed time only as validated buckets", async () => {
    expect(elapsedBucketFromSeconds(179)).toBe("under_3m");
    expect(elapsedBucketFromSeconds(180)).toBe("from_3m");
    expect(elapsedBucketFromSeconds(300)).toBe("from_5m");
    expect(elapsedBucketFromSeconds(600)).toBe("from_10m");
    expect(elapsedBucketFromSeconds(1200)).toBe("from_20m");
    for (const bucket of SWARM_ELAPSED_BUCKETS)
      expect(isElapsedBucket(bucket)).toBe(true);
    expect(isElapsedBucket("under_2m")).toBe(false);
    expect(isElapsedBucket(180)).toBe(false);

    const bucketDay: Day = day("2026-09-17", 1);
    countSwarmAnalytics(bucketDay, "ftue_start");
    countSwarmAnalytics(bucketDay, "first_buddy", "from_3m");
    countSwarmAnalytics(bucketDay, "first_buddy", "under_3m");
    countSwarmAnalytics(bucketDay, "first_defeat", "another_launch");
    expect(bucketDay.elapsedBuckets).toEqual({
      first_buddy: { from_3m: 1, under_3m: 1 },
      first_defeat: { another_launch: 1 },
    });
    const result = summary([bucketDay], 1, Date.parse("2026-09-17T01:00Z"));
    expect(result.totals.firstBuddies).toBe(2);
    expect(result.elapsedBuckets.first_buddy).toEqual({
      under_3m: 1,
      from_3m: 1,
      from_5m: 0,
      from_10m: 0,
      from_20m: 0,
      another_launch: 0,
    });
    expect(elapsedBucketTotals([bucketDay]).first_defeat.another_launch).toBe(1);
    expect(
      subtractElapsedBuckets(bucketDay.elapsedBuckets, {
        first_buddy: { under_3m: 1 },
      }),
    ).toEqual({
      first_buddy: { from_3m: 1 },
      first_defeat: { another_launch: 1 },
    });

    const request = (body: string) =>
      new Request("https://test", { method: "POST", body });
    const visitor = "a".repeat(32);
    expect(
      await readEvent(
        request(JSON.stringify({ visitor, elapsed_bucket: "from_3m" })),
      ),
    ).toEqual({ visitor, elapsedBucket: "from_3m" });
    await expect(
      readEvent(request(JSON.stringify({ visitor, elapsed_bucket: "soon" }))),
    ).rejects.toThrow("elapsed_bucket");
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
      JSON.stringify({ visitor: "a".repeat(32), admin: "true" }),
    ])
      await expect(readEvent(request(body))).rejects.toThrow();
  });
});
