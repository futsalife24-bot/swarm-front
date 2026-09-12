import { describe, expect, it } from "vitest";
import {
  RewardedAdSession,
  type AdOutcome,
  type RewardedAdProvider,
} from "../src/client/rewarded-ad";

function controlled() {
  let notify!: (outcome: AdOutcome) => void;
  const provider: RewardedAdProvider = {
    kind: "development",
    show(callback) {
      notify = callback;
    },
  };
  return { provider, notify: (outcome: AdOutcome) => notify(outcome) };
}

describe("rewarded ad lifecycle (no SDK or reward grant)", () => {
  it("never grants simulated success when no SDK is connected", async () => {
    expect(await new RewardedAdSession().request()).toBe("unavailable");
  });

  it.each(["success", "cancelled", "failed"] as const)(
    "uses the first %s notification and ignores duplicates",
    async (outcome) => {
      const ad = controlled();
      const result = new RewardedAdSession().request(ad.provider);
      ad.notify(outcome);
      ad.notify("success");
      expect(await result).toBe(outcome);
    },
  );

  it("rejects concurrent views and isolates callbacks after cancellation", async () => {
    const session = new RewardedAdSession();
    const old = controlled(),
      next = controlled();
    const first = session.request(old.provider);
    expect(await session.request(next.provider)).toBe("unavailable");
    session.cancel();
    expect(await first).toBe("cancelled");
    const second = session.request(next.provider);
    old.notify("success");
    next.notify("failed");
    expect(await second).toBe("failed");
  });

  it("handles provider exceptions and releases the view slot", async () => {
    const session = new RewardedAdSession();
    expect(
      await session.request({
        kind: "production",
        show() {
          throw Error();
        },
      }),
    ).toBe("failed");
    expect(
      await session.request({
        kind: "development",
        show(done) {
          done("success");
        },
      }),
    ).toBe("success");
  });
});
