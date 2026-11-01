/** Anonymous, bounded diagnostics for an active Room. No wire or save data is changed. */
export interface RoomLagContext {
  tick: number;
  pendingWrites: number;
  droppedMs: number;
  /** 0=other, 1=combat, 2=selection, 3=resume grace. */
  phase: number;
}

export const ROOM_LAG_LOG_PREFIX = "ROOM_LAG_V1";
export const ROOM_LAG_MIN_LOG_INTERVAL_MS = 10_000;
export const ROOM_LAG_MAX_LOGS = 64;

export const RoomLagReason = {
  hold: 1,
  tickGap: 2,
  persist: 4,
  lateAck: 8,
} as const;

/** All fields are finite numbers. slot exists only in this Room instance's memory. */
export interface RoomLagLog {
  at: number;
  reason: number;
  slot: number;
  phase: number;
  tick: number;
  pendingWrites: number;
  droppedMs: number;
  inFlight: number;
  inputAgeMs: number;
  ackAgeMs: number;
  sendAgeMs: number;
  oldestAgeMs: number;
  inputsSinceOldest: number;
  tickGapMs: number;
  persistMs: number;
}

interface PendingState {
  id: number;
  at: number;
  inputCount: number;
}

interface PeerState {
  slot: number;
  inputCount: number;
  lastInputAt?: number;
  lastAckAt?: number;
  lastSendAt?: number;
  pending: PendingState[];
}

const finite = (value: number) => (Number.isFinite(value) ? value : 0);
const bounded = (value: number) => Math.min(60_000, Math.max(0, finite(value)));
const age = (now: number, then?: number) =>
  then === undefined ? -1 : bounded(now - then);

export class RoomLagObserver {
  private readonly peers = new Map<object, PeerState>();
  private nextSlot = 1;
  private running = false;
  private lastTickAt?: number;
  private lastLogAt = -Infinity;
  private logs = 0;

  constructor(private readonly emit: (row: RoomLagLog) => void) {}

  private peer(key: object) {
    let state = this.peers.get(key);
    if (!state) {
      state = { slot: this.nextSlot++, inputCount: 0, pending: [] };
      this.peers.set(key, state);
    }
    return state;
  }

  input(peer: object, now: number) {
    const state = this.peer(peer);
    state.lastInputAt = now;
    state.inputCount++;
  }

  /** Call once after every chunk of a state has been passed to ws.send. */
  sent(peer: object, stateId: number, now: number) {
    const state = this.peer(peer);
    state.lastSendAt = now;
    if (state.pending.length >= 2) return; // A malformed integration must stay bounded.
    state.pending.push({ id: stateId, at: now, inputCount: state.inputCount });
  }

  /** Call only for an ACK accepted by StateDelivery. */
  ack(peer: object, stateId: number, now: number, context: RoomLagContext) {
    const state = this.peer(peer);
    const oldest = state.pending[0];
    const delayed = oldest && now - oldest.at > 400;
    if (delayed && this.running)
      this.log(RoomLagReason.lateAck, now, context, state);
    state.pending = state.pending.filter((pending) => pending.id > stateId);
    state.lastAckAt = now;
  }

  /** Call only when StateDelivery reports its two credits full. */
  hold(peer: object, now: number, context: RoomLagContext) {
    if (!this.running || context.phase === 0) return;
    const state = this.peer(peer);
    if (state.pending.length < 2 || now - state.pending[0].at <= 400) return;
    this.log(RoomLagReason.hold, now, context, state);
  }

  /** Call only for a simulation tick that passes the persisting early return. */
  tick(now: number, context: RoomLagContext) {
    if (!this.running) return;
    const previous = this.lastTickAt;
    this.lastTickAt = now;
    if (previous === undefined || context.phase === 0) return;
    const gap = now - previous;
    if (gap > 250)
      this.log(RoomLagReason.tickGap, now, context, undefined, gap);
  }

  /** Duration is wall-clock elapsed time around the storage operation. */
  persist(durationMs: number, now: number, context: RoomLagContext) {
    if (this.running && context.phase !== 0 && durationMs >= 400)
      this.log(RoomLagReason.persist, now, context, undefined, 0, durationMs);
  }

  start(now: number) {
    this.running = true;
    this.lastTickAt = now;
  }

  stop() {
    this.running = false;
    this.lastTickAt = undefined;
  }

  remove(peer: object) {
    this.peers.delete(peer);
  }

  private log(
    reason: number,
    now: number,
    context: RoomLagContext,
    state?: PeerState,
    tickGapMs = 0,
    persistMs = 0,
  ) {
    if (
      this.logs >= ROOM_LAG_MAX_LOGS ||
      now - this.lastLogAt < ROOM_LAG_MIN_LOG_INTERVAL_MS
    )
      return;
    this.lastLogAt = now;
    this.logs++;
    const oldest = state?.pending[0];
    const row: RoomLagLog = {
      at: finite(now),
      reason,
      slot: state?.slot ?? 0,
      phase: finite(context.phase),
      tick: finite(context.tick),
      pendingWrites: finite(context.pendingWrites),
      droppedMs: finite(context.droppedMs),
      inFlight: state?.pending.length ?? 0,
      inputAgeMs: age(now, state?.lastInputAt),
      ackAgeMs: age(now, state?.lastAckAt),
      sendAgeMs: age(now, state?.lastSendAt),
      oldestAgeMs: age(now, oldest?.at),
      inputsSinceOldest: oldest
        ? Math.min(65_535, state!.inputCount - oldest.inputCount)
        : 0,
      tickGapMs: bounded(tickGapMs),
      persistMs: bounded(persistMs),
    };
    try {
      this.emit(row);
    } catch {
      // Diagnostics cannot affect the game.
    }
  }
}
