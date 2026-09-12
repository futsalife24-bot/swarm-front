/** Provider outcomes are not reward grants. The caller must persist its own
 * run/benefit receipt atomically with the benefit before reporting success. */
export type AdOutcome = "success" | "cancelled" | "failed" | "unavailable";
export interface RewardedAdProvider {
  readonly kind: "development" | "production";
  show(notify: (outcome: AdOutcome) => void): void;
}

/** One active view at a time. First terminal notification wins; late callbacks
 * cannot complete a later request. No provider means no simulated success. */
export class RewardedAdSession {
  private active?: { complete: (outcome: AdOutcome) => void };

  request(provider?: RewardedAdProvider): Promise<AdOutcome> {
    if (!provider) return Promise.resolve("unavailable");
    if (this.active) return Promise.resolve("unavailable");
    return new Promise((resolve) => {
      const ticket = {
        complete: (outcome: AdOutcome) => {
          if (this.active !== ticket) return;
          this.active = undefined;
          resolve(outcome);
        },
      };
      this.active = ticket;
      try {
        provider.show(ticket.complete);
      } catch {
        ticket.complete("failed");
      }
    });
  }

  cancel() {
    this.active?.complete("cancelled");
  }
}
