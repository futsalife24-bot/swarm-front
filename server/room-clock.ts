/** Keep 50 ms simulation steps on wall-clock deadlines, without one large dt. */
export class RoomClock {
  static readonly intervalMs = 50;
  private nextAt = 0;
  private previous = 0;
  droppedMs = 0;

  start(now: number) {
    this.previous = now;
    this.nextAt = now + RoomClock.intervalMs;
    this.droppedMs = 0;
    return RoomClock.intervalMs;
  }

  /** Called after one tick. A late callback must not add its delay to every tick. */
  nextDelay(now: number) {
    if (now < this.previous) return this.start(now);
    this.previous = now;
    this.nextAt += RoomClock.intervalMs;
    // Limit catch-up after a suspended runtime. Long stalls remain measurable;
    // never advance combat in one giant step or spin through minutes of debt.
    if (now - this.nextAt > 250) {
      this.droppedMs += now - this.nextAt;
      this.nextAt = now + RoomClock.intervalMs;
    }
    return Math.max(0, this.nextAt - now);
  }
}
