import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));

describe("C-6 M2 swarm worker analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores snake_case elapsed buckets only on allowlisted milestones", async () => {
    vi.resetModules();
    const days: Record<string, unknown>[] = [];
    const ctx = {
      storage: {
        get: async () => days,
        put: async (_key: string, value: Record<string, unknown>[]) => {
          days.splice(0, days.length, ...value);
        },
      },
    };
    const { Gate } = await import("../server/worker");
    const gate = new (Gate as any)(ctx, {});
    const event = (body: unknown) =>
      new Request("https://internal/analytics-event", {
        method: "POST",
        body: JSON.stringify(body),
      });
    const send = (body: unknown) =>
      gate.analytics(event(body), "/analytics-event") as Promise<Response>;

    expect(
      (
        await send({
          kind: "first_buddy",
          visitor: "a".repeat(32),
          elapsed_bucket: "from_3m",
        })
      ).status,
    ).toBe(200);
    expect(days[0].firstBuddies).toBe(1);
    expect(days[0].elapsedBuckets).toEqual({
      first_buddy: { from_3m: 1 },
    });
    expect(
      (
        await send({
          kind: "view",
          visitor: "b".repeat(32),
          elapsed_bucket: "from_3m",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send({
          kind: "first_buddy",
          visitor: "c".repeat(32),
          elapsed_bucket: "soon",
        })
      ).status,
    ).toBe(400);
    expect(days[0].firstBuddies).toBe(1);
  });
});
