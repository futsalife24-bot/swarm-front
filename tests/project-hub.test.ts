import { describe, it, expect } from "vitest";
import {
  exportProjectAnalytics,
  forwardAnalytics,
  legacyEvent,
} from "../server/project-hub";
describe("independent project analytics", () => {
  const key = "a".repeat(64);
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
