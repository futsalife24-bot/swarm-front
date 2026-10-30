/** Acknowledge accepted snapshots on ordinary traffic, or at most 10 Hz when idle. */
export class StateReceipt {
  private enabled = false;
  private latest = 0;
  private pending: number | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly flush: () => void) {}

  configure(enabled: boolean) {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
    this.latest = 0;
    this.enabled = enabled;
  }

  receive(id: unknown) {
    if (
      !this.enabled ||
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id <= this.latest
    )
      return;
    this.latest = id;
    this.pending = id;
    if (this.timer === undefined)
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (this.pending !== undefined) this.flush();
      }, 100);
  }

  /** Call only when the connection can actually send. Never mutate the command. */
  attach(command: unknown): unknown {
    if (
      !this.enabled ||
      this.pending === undefined ||
      !command ||
      typeof command !== "object"
    )
      return command;
    const stateAck = this.pending;
    this.pending = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    return { ...command, stateAck };
  }
}
