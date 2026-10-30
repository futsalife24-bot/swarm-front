/** Bounded input credit; actual receipt time excludes snapshot and downstream waits. */
export class InputWindow {
  private enabled = false;
  private size = 4;
  private sentAt = new Map<number, number>();
  private minimumLag: number | undefined;
  private delayed = 0;
  private healthy = 0;

  get limit() {
    return this.size;
  }
  configure(stateFlow: boolean) {
    this.enabled = stateFlow;
    this.size = stateFlow ? 16 : 4;
    this.sentAt.clear();
    this.minimumLag = undefined;
    this.delayed = this.healthy = 0;
  }
  sent(seq: number, now = Date.now()) {
    if (this.enabled && this.sentAt.size < 16) this.sentAt.set(seq, now);
  }
  acknowledge(seq: number, inputReceivedAt: unknown) {
    const at = this.sentAt.get(seq);
    for (const key of this.sentAt.keys())
      if (key <= seq) this.sentAt.delete(key);
    if (!this.enabled || at === undefined) return;
    if (
      typeof inputReceivedAt !== "number" ||
      !Number.isFinite(inputReceivedAt)
    ) {
      // Older flow-capable servers do not report individual input receipt time.
      this.size = 4;
      this.delayed = this.healthy = 0;
      return;
    }
    // Client/server clock offset cancels against the connection's minimum.
    // Includes upstream and message scheduling, but not waiting for a snapshot.
    const lag = inputReceivedAt * 1000 - at;
    this.minimumLag = Math.min(this.minimumLag ?? lag, lag);
    const excess = lag - this.minimumLag;
    if (excess > 150) {
      this.healthy = 0;
      if (++this.delayed >= 2) this.size = 4;
    } else if (excess <= 75) {
      this.delayed = 0;
      if (++this.healthy >= 3) this.size = 16;
    } else this.delayed = this.healthy = 0;
  }
}
