import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { appAnalytics, exportAppAnalytics } from "../server/app-analytics";
import {
  exportProjectAnalytics,
  forwardAnalytics,
  legacyEvent,
} from "../server/project-hub";
describe("independent project analytics", () => {
  const key = "a".repeat(64);
  it("migration export leaves expired visitor rows, counters and alarms unchanged", async () => {
    const db = new DatabaseSync(":memory:");
    let alarm: number | null = null;
    let readOnly = false;
    const storage = {
      sql: {
        exec: (query: string, ...args: (string | number)[]) => {
          if (readOnly) expect(query.trim().startsWith("SELECT ")).toBe(true);
          const rows = db.prepare(query).all(...args);
          return { toArray: () => rows };
        },
      },
      transactionSync: (fn: () => void) => fn(),
      getAlarm: async () => alarm,
      setAlarm: async (value: number) => {
        alarm = value;
      },
    } as unknown as DurableObjectStorage;
    try {
      await appAnalytics(
        new Request("https://internal/app-analytics-event", {
          method: "POST",
          body: JSON.stringify({ visitor: "a".repeat(32), admin: true }),
        }),
        storage,
      );
      const oldDate = new Date(Date.now() - 400 * 86400000)
        .toISOString()
        .slice(0, 10);
      db.prepare("INSERT INTO app_days VALUES (?,7,1,0)").run(oldDate);
      db.prepare("INSERT INTO app_admin_days VALUES (?,7)").run(oldDate);
      db.prepare("INSERT INTO app_visitors VALUES (?,?)").run(
        oldDate,
        "b".repeat(32),
      );
      db.prepare("INSERT INTO app_admin_only VALUES (?,?)").run(
        oldDate,
        "b".repeat(32),
      );
      const snapshot = () =>
        JSON.stringify([
          ...[
            "app_days",
            "app_admin_days",
            "app_visitors",
            "app_admin_only",
          ].map((table) =>
            db.prepare(`SELECT * FROM ${table} ORDER BY date`).all(),
          ),
          alarm,
        ]);
      const before = snapshot();
      let readCalls = 0;
      const gate = {
        idFromName: (name: string) => name,
        get: (id: string) => ({
          fetch: async (req: Request) => {
            readCalls++;
            if (id === "analytics") return Response.json({ days: [] });
            expect(new URL(req.url).pathname).toBe("/app-analytics-export");
            return exportAppAnalytics(req, storage);
          },
        }),
      } as unknown as DurableObjectNamespace;
      expect(
        (
          await exportProjectAnalytics(
            new Request("https://game/api/project-hub/export"),
            gate,
            key,
          )
        ).status,
      ).toBe(401);
      expect(readCalls).toBe(0);
      readOnly = true;
      const r = await exportProjectAnalytics(
        new Request("https://game/api/project-hub/export", {
          headers: { Authorization: "Bearer " + key },
        }),
        gate,
        key,
      );
      expect(r.status).toBe(200);
      const result = (await r.json()) as {
        apps: {
          id: string;
          all: { views: number }[];
          excluded: { views: number }[];
        }[];
      };
      for (const app of result.apps.filter((a) => a.id !== "swarm-front")) {
        expect(app.all).toHaveLength(1);
        expect(app.all[0].views).toBe(1);
        expect(app.excluded[0].views).toBe(0);
      }
      expect(JSON.stringify(result)).not.toContain("a".repeat(32));
      expect(JSON.stringify(result)).not.toContain("b".repeat(32));
      expect(snapshot()).toBe(before);
      expect(
        db
          .prepare("SELECT COUNT(*) n FROM app_visitors WHERE date=?")
          .get(oldDate)?.n,
      ).toBe(1);
    } finally {
      db.close();
    }
  });
  it("denies missing or incorrect export authorization", async () => {
    const gate = {} as DurableObjectNamespace;
    expect(
      (
        await exportProjectAnalytics(
          new Request("https://game/api/project-hub/export"),
          gate,
          key,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await exportProjectAnalytics(
          new Request("https://game/api/project-hub/export", {
            headers: { Authorization: "Bearer " + "b".repeat(64) },
          }),
          gate,
          key,
        )
      ).status,
    ).toBe(401);
  });
  it("exports only aggregate counters, excluding raw visitor and admin IDs", async () => {
    const gate = {
      idFromName: (n: string) => n,
      get: () => ({
        fetch: async () =>
          Response.json({
            days: [
              {
                date: "2026-09-19",
                views: 2,
                visitors: 1,
                sorties: 0,
                clears: 0,
                ids: ["secret-visitor"],
                admin: { onlyIds: ["secret-visitor"] },
              },
            ],
          }),
      }),
    } as unknown as DurableObjectNamespace;
    const r = await exportProjectAnalytics(
      new Request("https://game/api/project-hub/export", {
        headers: { Authorization: "Bearer " + key },
      }),
      gate,
      key,
    );
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).not.toContain("secret-visitor");
    expect(text).not.toContain("onlyIds");
    const data = JSON.parse(text);
    expect(data.apps).toHaveLength(4);
    expect(data.apps[0].all[0].views).toBe(2);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("forwards original collection origin and event without developer cookies", async () => {
    let forwarded: Request | undefined;
    const binding = {
      fetch: async (req: Request) => {
        forwarded = req;
        return Response.json({ ok: true });
      },
    } as unknown as Fetcher;
    await forwardAnalytics(
      binding,
      new Request("https://game/api/analytics/collect/lmfdb", {
        headers: {
          Origin: "https://futsalife24-bot.github.io",
          Cookie: "private=session",
          "CF-Connecting-IP": "203.0.113.1",
        },
      }),
      "lmfdb",
      { visitor: null, admin: false },
    );
    expect(forwarded!.headers.get("Origin")).toBe(
      "https://futsalife24-bot.github.io",
    );
    expect(forwarded!.headers.get("Cookie")).toBeNull();
    expect(await forwarded!.json()).toEqual({ visitor: null, admin: false });
  });
  it("bounds legacy bodies before forwarding", async () => {
    await expect(
      legacyEvent(
        new Request("https://game", { method: "POST", body: "x".repeat(513) }),
      ),
    ).rejects.toThrow("size");
  });
});
