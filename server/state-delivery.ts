/** Connection-local snapshot credit. This never changes authoritative World data. */
export interface StateDeliveryAttachment {
  pending: number[];
  lastSent: number;
  dirty: boolean;
  eventRun: string;
  sentEvent: number;
}
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export class StateDelivery {
  private pending: number[] = [];
  lastSent = 0;
  dirty = false;
  eventRun = "";
  sentEvent = 0;
  constructor(
    readonly enabled: boolean,
    attachment?: unknown,
  ) {
    if (!attachment || typeof attachment !== "object") return;
    const value = attachment as Partial<StateDeliveryAttachment>;
    if (
      !Array.isArray(value.pending) ||
      value.pending.length > 2 ||
      value.pending.some(
        (id, i) =>
          !integer(id) || id === 0 || (i > 0 && id <= value.pending![i - 1]),
      ) ||
      !integer(value.lastSent) ||
      value.pending.some((id) => id > value.lastSent!) ||
      typeof value.dirty !== "boolean" ||
      typeof value.eventRun !== "string" ||
      value.eventRun.length > 128 ||
      !integer(value.sentEvent)
    )
      return;
    this.pending = enabled ? [...value.pending] : [];
    this.lastSent = value.lastSent;
    this.dirty = enabled && value.dirty;
    this.eventRun = value.eventRun;
    this.sentEvent = value.sentEvent;
  }
  get inFlight(): readonly number[] {
    return [...this.pending];
  }
  get full() {
    return this.enabled && this.pending.length >= 2;
  }
  /** New run resets event IDs, while old snapshot ACKs still release their credits. */
  resetEvents(run: string) {
    if (this.eventRun === run) return;
    this.eventRun = run;
    this.sentEvent = 0;
  }
  begin() {
    if (this.full) {
      this.dirty = true;
      return false;
    }
    // Clear before sending: a later change must be able to mark this peer dirty again.
    this.dirty = false;
    return true;
  }
  acknowledge(value: unknown) {
    if (!this.enabled || !integer(value) || value === 0) return false;
    const index = this.pending.indexOf(value);
    if (index < 0) return false;
    this.pending.splice(0, index + 1);
    return true;
  }
  sent(stateId: number, eventSerial: number) {
    if (
      !integer(stateId) ||
      stateId <= this.lastSent ||
      !integer(eventSerial) ||
      this.full
    )
      throw new Error("invalid snapshot delivery transition");
    this.lastSent = stateId;
    this.sentEvent = eventSerial;
    if (this.enabled) this.pending.push(stateId);
  }
  snapshot(): StateDeliveryAttachment {
    return {
      pending: [...this.pending],
      lastSent: this.lastSent,
      dirty: this.dirty,
      eventRun: this.eventRun,
      sentEvent: this.sentEvent,
    };
  }
}

/** Prepared/encoded at most once after credit is granted; partial sends earn no credit. */
export function deliverState(
  delivery: StateDelivery,
  stateId: number,
  eventSerial: number,
  build: () => readonly string[],
  send: (payload: string) => boolean,
): "deferred" | "sent" | "failed" | "superseded" {
  // A failed peer can trigger a nested broadcast while another recipient from
  // the outer broadcast is still pending. Never send that older snapshot next.
  if (stateId <= delivery.lastSent) return "superseded";
  if (!delivery.begin()) return "deferred";
  const frames = build();
  if (!frames.length || !frames.every(send)) {
    if (delivery.enabled) delivery.dirty = true;
    return "failed";
  }
  delivery.sent(stateId, eventSerial);
  return "sent";
}

/** Includes legacy peers; a blocked peer retains its bounded undelivered effects. */
export function minimumSentEvent(
  deliveries: Iterable<StateDelivery>,
  fallback: number,
) {
  let minimum = fallback;
  for (const delivery of deliveries)
    minimum = Math.min(minimum, delivery.sentEvent);
  return minimum;
}
