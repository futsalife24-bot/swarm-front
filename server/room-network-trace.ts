/** Optional, connection-local server trace. Times are event markers, not CPU time. */
export const ROOM_TRACE_LIMIT = 128;
export const ROOM_TRACE_HISTORY_BYTES = 8192;

export const RoomTraceEvent = {
  tick: 1,
  step: 2,
  broadcast: 3,
  encodeStart: 4,
  encodeEnd: 5,
  sendStart: 6,
  sendEnd: 7,
  ack: 8,
  persistStart: 9,
  persistEnd: 10,
} as const;

export type RoomTraceEventCode =
  (typeof RoomTraceEvent)[keyof typeof RoomTraceEvent];
export type RoomTraceEntry = [
  sequence: number,
  code: RoomTraceEventCode,
  tick: number,
  at: number,
  value: number,
];

export class RoomNetworkTrace {
  readonly epoch = Date.now();
  private entries: RoomTraceEntry[] = [];
  private sequence = 0;
  private lastHistoryAt = -Infinity;
  private lastHistorySequence = 0;
  private lastSendAt = 0;
  private lastDroppedMs = 0;
  sendCalls = 0;
  encodes = 0;
  acknowledgements = 0;
  persistWrites = 0;

  record(code: RoomTraceEventCode, tick: number, value = 0, at = Date.now()) {
    this.entries.push([++this.sequence, code, tick, at, value]);
    if (this.entries.length > ROOM_TRACE_LIMIT) this.entries.shift();
    if (code === RoomTraceEvent.encodeEnd) this.encodes++;
    else if (code === RoomTraceEvent.sendEnd && (value === 1 || value === 2)) {
      this.sendCalls++;
      if (value === 1) this.lastSendAt = at;
    } else if (code === RoomTraceEvent.ack) this.acknowledgements++;
    else if (code === RoomTraceEvent.persistStart) this.persistWrites++;
  }

  /** Carry history only after a long send gap or a suspended room clock. */
  snapshot(tick: number, droppedMs: number, pendingWrites: number, at: number) {
    const includeHistory =
      this.sequence > this.lastHistorySequence &&
      at - this.lastHistoryAt >= 1000 &&
      ((this.lastSendAt > 0 && at - this.lastSendAt >= 400) ||
        droppedMs > this.lastDroppedMs);
    let history: RoomTraceEntry[] | undefined;
    if (includeHistory) {
      const newestFirst: RoomTraceEntry[] = [];
      let remaining = ROOM_TRACE_HISTORY_BYTES - 2; // JSON array brackets.
      for (let i = this.entries.length - 1; i >= 0; i--) {
        const entry = this.entries[i];
        const size =
          JSON.stringify(entry).length + (newestFirst.length ? 1 : 0);
        if (size > remaining) break;
        newestFirst.push([...entry]);
        remaining -= size;
      }
      history = newestFirst.reverse();
    }
    return {
      version: 1,
      epoch: this.epoch,
      tick,
      sequence: this.sequence,
      encodes: this.encodes,
      sendCalls: this.sendCalls,
      acknowledgements: this.acknowledgements,
      persistWrites: this.persistWrites,
      pendingWrites,
      droppedMs,
      ...(history ? { history } : {}),
    };
  }

  sentHistory(sequence: number, at: number, droppedMs: number) {
    this.lastHistorySequence = Math.max(this.lastHistorySequence, sequence);
    this.lastHistoryAt = at;
    this.lastDroppedMs = droppedMs;
  }
}
