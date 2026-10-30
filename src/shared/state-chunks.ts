/** Versioned framing for negotiated state snapshots; ordinary packets stay intact. */
export const STATE_CHUNK_VERSION = 1;
export const STATE_MESSAGE_BYTES = 65536;
export const STATE_SNAPSHOT_BYTES = 262144;
export const STATE_CHUNK_COUNT = 16;
export const STATE_CHUNK_TIMEOUT_MS = 2000;
const encoder = new TextEncoder();
const bytes = (value: string) => encoder.encode(value).length;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;
function unicode(value: string) {
  for (let n = 0; n < value.length; n++) {
    const code = value.charCodeAt(n);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++n);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function checksum(value: string) {
  let hash = 2166136261;
  for (const byte of encoder.encode(value))
    hash = Math.imul(hash ^ byte, 16777619);
  return hash >>> 0;
}
function frame(
  snapshot: number,
  index: number,
  total: number,
  size: number,
  check: number,
  data: string,
) {
  return JSON.stringify({
    type: "stateChunk",
    version: STATE_CHUNK_VERSION,
    snapshot,
    index,
    total,
    bytes: size,
    checksum: check,
    data,
  });
}

/** Undefined leaves the caller's existing oversized-state rejection in charge. */
export function encodeStateChunks(
  payload: string,
  snapshot: number,
): string[] | undefined {
  if (
    typeof payload !== "string" ||
    !integer(snapshot, 0, Number.MAX_SAFE_INTEGER) ||
    payload.length > STATE_SNAPSHOT_BYTES
  )
    return undefined;
  const size = bytes(payload);
  if (size > STATE_SNAPSHOT_BYTES) return undefined;
  // Product JSON is already valid Unicode. Keep the common one-message path
  // free of an extra full Unicode/checksum walk.
  if (size <= STATE_MESSAGE_BYTES) return [payload];
  if (!unicode(payload)) return undefined;
  const check = checksum(payload);
  const parts: string[] = [];
  let start = 0;
  while (start < payload.length) {
    if (parts.length >= STATE_CHUNK_COUNT) return undefined;
    let end = Math.min(payload.length, start + 16384);
    let part: string;
    for (;;) {
      const previous = payload.charCodeAt(end - 1),
        next = payload.charCodeAt(end);
      if (
        previous >= 0xd800 &&
        previous <= 0xdbff &&
        next >= 0xdc00 &&
        next <= 0xdfff
      )
        end--;
      if (end <= start) return undefined;
      part = payload.slice(start, end);
      // Fixed slices are <=~49KiB for normal JSON. Only an exceptional escape
      // expansion shrinks a slice, instead of searching and encoding 16 times.
      if (
        bytes(
          frame(snapshot, parts.length, STATE_CHUNK_COUNT, size, check, part),
        ) <= STATE_MESSAGE_BYTES
      )
        break;
      end = start + Math.floor((end - start) / 2);
    }
    parts.push(part);
    start = end;
  }
  return parts.map((data, index) =>
    frame(snapshot, index, parts.length, size, check, data),
  );
}
interface Pending {
  snapshot: number;
  total: number;
  size: number;
  received: number;
  checksum: number;
  started: number;
  data: string[];
}
/** One instance per WebSocket connection. No partial World escapes this class. */
export class StateChunkAssembler {
  private pending: Pending | undefined;
  private highest = -1;
  private failedRead = false;
  get failed() {
    return this.failedRead;
  }
  get deadline() {
    return this.pending
      ? this.pending.started + STATE_CHUNK_TIMEOUT_MS
      : undefined;
  }
  expire(now = performance.now()) {
    if (
      this.pending &&
      (!Number.isFinite(now) ||
        now < this.pending.started ||
        now - this.pending.started > STATE_CHUNK_TIMEOUT_MS)
    ) {
      this.reject();
      return true;
    }
    return false;
  }
  read(input: unknown, now = performance.now()): unknown | undefined {
    this.failedRead = false;
    try {
      if (!Number.isFinite(now)) return this.reject();
      if (this.expire(now)) return undefined;
      if (
        typeof input !== "string" ||
        input.length > STATE_MESSAGE_BYTES ||
        !unicode(input) ||
        bytes(input) > STATE_MESSAGE_BYTES
      )
        return this.reject();
      const message: unknown = JSON.parse(input);
      if (!record(message) || message.type !== "stateChunk") {
        // A newer ordinary state supersedes an unfinished large state.
        if (record(message) && message.type === "state")
          this.pending = undefined;
        return message;
      }
      if (
        Object.keys(message).length !== 8 ||
        message.version !== STATE_CHUNK_VERSION ||
        !integer(message.snapshot, 0, Number.MAX_SAFE_INTEGER) ||
        !integer(message.total, 2, STATE_CHUNK_COUNT) ||
        !integer(message.index, 0, message.total - 1) ||
        !integer(
          message.bytes,
          STATE_MESSAGE_BYTES + 1,
          STATE_SNAPSHOT_BYTES,
        ) ||
        !integer(message.checksum, 0, 0xffffffff) ||
        typeof message.data !== "string" ||
        !message.data.length ||
        !unicode(message.data)
      )
        return this.reject();
      if (message.index === 0) {
        if (message.snapshot <= this.highest) return this.reject();
        this.highest = message.snapshot;
        this.pending = {
          snapshot: message.snapshot,
          total: message.total,
          size: message.bytes,
          received: 0,
          checksum: message.checksum,
          started: now,
          data: [],
        };
      }
      const pending = this.pending;
      if (
        !pending ||
        message.snapshot !== pending.snapshot ||
        message.total !== pending.total ||
        message.bytes !== pending.size ||
        message.checksum !== pending.checksum ||
        message.index !== pending.data.length
      )
        return this.reject();
      pending.received += bytes(message.data);
      if (
        pending.received > pending.size ||
        pending.received > STATE_SNAPSHOT_BYTES
      )
        return this.reject();
      pending.data.push(message.data);
      if (pending.data.length !== pending.total) return undefined;
      this.pending = undefined;
      if (pending.received !== pending.size) return this.reject();
      const complete = pending.data.join("");
      if (checksum(complete) !== pending.checksum) return this.reject();
      const snapshot: unknown = JSON.parse(complete);
      return record(snapshot) && snapshot.type === "state"
        ? snapshot
        : this.reject();
    } catch {
      return this.reject();
    }
  }
  private reject(): undefined {
    this.failedRead = true;
    this.pending = undefined;
    return undefined;
  }
}
