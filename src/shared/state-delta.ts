import { STATE_SNAPSHOT_BYTES } from "./state-chunks";
import { STATE_TUPLE_ENCODING } from "./state-tuples";

export const STATE_DELTA_VERSION = 1;
type ObjectValue = Record<string, any>;
type Snapshot = { id: number; json: string; safe: boolean; tuples: boolean };
type SendSnapshot = Snapshot & { value: ObjectValue; size: number };
type ObjectPatch = [ObjectValue, string[]] | null;
// Player rows reuse old indices, send [row] for new IDs, or update properties
// with [oldIndex, set, removed]. This shape is only sent in negotiated v2.
type PlayerPatch = (number | any[])[] | null;
// An unchanged row is its old index; a full row is [row]; otherwise
// [oldIndex, fieldIndex, value, ...] updates a tuple with the same mask and ID.
type RowPatch = (number | any[])[] | null;
type Patch = [
  ObjectPatch,
  ObjectPatch,
  ObjectPatch,
  RowPatch,
  RowPatch,
  RowPatch,
];
type PatchV2 = [...Patch, PlayerPatch];
const encoder = new TextEncoder();
const bytes = (value: string) => encoder.encode(value).length;
const record = (value: unknown): value is ObjectValue =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unsafe = (key: string) =>
  key === "__proto__" || key === "prototype" || key === "constructor";
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let n = 0; n < a.length; n++) if (!same(a[n], b[n])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys)
    if (
      !Object.hasOwn(b, key) ||
      !same((a as ObjectValue)[key], (b as ObjectValue)[key])
    )
      return false;
  return true;
}
function invalid(): never {
  throw new Error("invalid state delta");
}
function bounded(value: unknown) {
  let left = 50000;
  function walk(item: unknown, depth: number) {
    if (--left < 0 || depth > 20) invalid();
    if (item === null || typeof item === "boolean" || typeof item === "string")
      return;
    if (typeof item === "number" && Number.isFinite(item)) return;
    if (Array.isArray(item)) {
      if (item.length > 4096) invalid();
      for (const child of item) walk(child, depth + 1);
      return;
    }
    if (!record(item)) invalid();
    const keys = Object.keys(item);
    if (keys.length > 128) invalid();
    for (const key of keys) {
      if (key.length > 128 || unsafe(key)) invalid();
      walk(item[key], depth + 1);
    }
  }
  walk(value, 0);
}
function snapshot(
  json: string,
  id: number,
  parsed?: ObjectValue,
): SendSnapshot {
  if (json.length > STATE_SNAPSHOT_BYTES) invalid();
  const size = bytes(json);
  if (size > STATE_SNAPSHOT_BYTES) invalid();
  const value = parsed ?? JSON.parse(json);
  if (
    !record(value) ||
    value.type !== "state" ||
    value.stateId !== id ||
    !integer(id)
  )
    invalid();
  let safe = false;
  try {
    bounded(value);
    safe = true;
  } catch {
    // Full snapshots do not depend on the optional delta work budget.
  }
  return { id, json, value, size, safe, tuples: safe && tupleState(value) };
}
function tupleRows(rows: unknown): rows is any[][] {
  return (
    Array.isArray(rows) &&
    rows.every(
      (row) =>
        Array.isArray(row) &&
        integer(row[0]) &&
        integer(row[1]) &&
        row[0] % 2 === 1,
    ) &&
    new Set(rows.map((row) => row[1])).size === rows.length
  );
}
function tupleState(value: ObjectValue) {
  return (
    value.stateEncoding === STATE_TUPLE_ENCODING &&
    record(value.world) &&
    [value.world.enemies, value.world.projectiles].every(tupleRows)
  );
}
function playerRows(rows: unknown): rows is ObjectValue[] {
  return (
    Array.isArray(rows) &&
    rows.length <= 4 &&
    rows.every(
      (row) =>
        record(row) &&
        Object.hasOwn(row, "id") &&
        typeof row.id === "string" &&
        row.id.length > 0 &&
        row.id.length <= 128,
    ) &&
    new Set(rows.map((row) => row.id)).size === rows.length
  );
}
function objectPatch(
  base: ObjectValue,
  next: ObjectValue,
  skip: string[],
): ObjectPatch {
  const set: ObjectValue = {};
  const removed: string[] = [];
  for (const key of Object.keys(next))
    if (
      !skip.includes(key) &&
      (!Object.hasOwn(base, key) || !same(base[key], next[key]))
    )
      set[key] = next[key];
  for (const key of Object.keys(base))
    if (!skip.includes(key) && !Object.hasOwn(next, key)) removed.push(key);
  return Object.keys(set).length || removed.length ? [set, removed] : null;
}
function rowPatch(base: any[][], next: any[][]): RowPatch {
  let changed = base.length !== next.length;
  let indices: Map<number, number> | undefined;
  const rows = next.map((row, position) => {
    let index: number | undefined = position;
    if (base[position]?.[1] !== row[1]) {
      indices ??= new Map(base.map((old, at) => [old[1], at]));
      index = indices.get(row[1]);
    }
    if (index !== position) changed = true;
    if (index === undefined) return [row];
    const old = base[index];
    if (old[0] !== row[0] || old.length !== row.length) {
      changed = true;
      return [row];
    }
    const fields: any[] = [index];
    for (let field = 2; field < row.length; field++)
      if (!same(old[field], row[field])) fields.push(field, row[field]);
    if (fields.length === 1) return index;
    changed = true;
    // Count the sparse indices/values instead of serializing every row twice.
    // The final packet still uses the exact UTF-8 comparison against full.
    return fields.length < row.length + 1 ? fields : [row];
  });
  return changed ? rows : null;
}
function playerPatch(base: ObjectValue[], next: ObjectValue[]): PlayerPatch {
  let changed = base.length !== next.length;
  let indices: Map<string, number> | undefined;
  const rows = next.map((player, position) => {
    let index: number | undefined = position;
    if (base[position]?.id !== player.id) {
      indices ??= new Map(base.map((old, at) => [old.id, at]));
      index = indices.get(player.id);
    }
    if (index !== position) changed = true;
    if (index === undefined) return [player];
    const changes = objectPatch(base[index], player, ["id"]);
    if (changes === null) return index;
    changed = true;
    const partial = [index, ...changes];
    return bytes(JSON.stringify(partial)) < bytes(JSON.stringify([player]))
      ? partial
      : [player];
  });
  return changed ? rows : null;
}
function makePatch(
  base: ObjectValue,
  next: ObjectValue,
  version: 1 | 2,
): Patch | PatchV2 {
  const front = record(base.world.front) && record(next.world.front);
  const orbs =
    front &&
    tupleRows(base.world.front.orbs) &&
    tupleRows(next.world.front.orbs);
  const patch: Patch = [
    objectPatch(base, next, ["world", "stateId"]),
    objectPatch(base.world, next.world, [
      "enemies",
      "projectiles",
      ...(version === 2 ? ["players"] : []),
      ...(front ? ["front"] : []),
    ]),
    front
      ? objectPatch(base.world.front, next.world.front, orbs ? ["orbs"] : [])
      : null,
    rowPatch(base.world.enemies, next.world.enemies),
    rowPatch(base.world.projectiles, next.world.projectiles),
    orbs ? rowPatch(base.world.front.orbs, next.world.front.orbs) : null,
  ];
  return version === 2
    ? [...patch, playerPatch(base.world.players, next.world.players)]
    : patch;
}
function applyObject(target: ObjectValue, patch: unknown, skip: string[]) {
  if (patch === null) return;
  if (
    !record(target) ||
    !Array.isArray(patch) ||
    patch.length !== 2 ||
    !record(patch[0]) ||
    !Array.isArray(patch[1])
  )
    invalid();
  const [set, removed] = patch;
  if (
    removed.some(
      (key) => typeof key !== "string" || unsafe(key) || skip.includes(key),
    ) ||
    new Set(removed).size !== removed.length ||
    Object.keys(set).some(
      (key) => unsafe(key) || skip.includes(key) || removed.includes(key),
    )
  )
    invalid();
  for (const key of removed) {
    if (!Object.hasOwn(target, key)) invalid();
    delete target[key];
  }
  for (const [key, value] of Object.entries(set)) target[key] = value;
}
function applyRows(base: unknown, patch: unknown): any[][] {
  if (!Array.isArray(base)) invalid();
  if (patch === null) return base;
  if (!Array.isArray(patch) || patch.length > 4096) invalid();
  const rows = patch.map((entry) => {
    if (integer(entry)) {
      if (!Array.isArray(base[entry])) invalid();
      return base[entry];
    }
    if (!Array.isArray(entry)) invalid();
    if (entry.length === 1 && Array.isArray(entry[0])) return entry[0];
    if (
      entry.length < 3 ||
      entry.length % 2 !== 1 ||
      !integer(entry[0]) ||
      !Array.isArray(base[entry[0]])
    )
      invalid();
    const row = [...base[entry[0]]];
    let previous = 1;
    for (let n = 1; n < entry.length; n += 2) {
      const field = entry[n];
      if (!integer(field) || field <= previous || field >= row.length)
        invalid();
      previous = field;
      row[field] = entry[n + 1];
    }
    return row;
  });
  if (
    rows.some(
      (row) =>
        !Array.isArray(row) ||
        !integer(row[0]) ||
        row[0] % 2 !== 1 ||
        !integer(row[1]),
    ) ||
    new Set(rows.map((row) => row[1])).size !== rows.length
  )
    invalid();
  return rows;
}
function applyPlayers(base: unknown, patch: unknown): ObjectValue[] {
  if (!playerRows(base)) invalid();
  if (patch === null) return base;
  if (!Array.isArray(patch) || patch.length > 4) invalid();
  const rows = patch.map((entry) => {
    if (integer(entry)) {
      if (!base[entry]) invalid();
      return base[entry];
    }
    if (!Array.isArray(entry)) invalid();
    if (entry.length === 1 && record(entry[0])) return entry[0];
    if (entry.length !== 3 || !integer(entry[0]) || !base[entry[0]]) invalid();
    const row = { ...base[entry[0]] };
    applyObject(row, [entry[1], entry[2]], ["id"]);
    return row;
  });
  if (!playerRows(rows)) invalid();
  return rows;
}

/** One connection: one ACKed base plus at most two unacknowledged snapshots.
 * encode reserves a slot; reset after a failed WebSocket send before retrying. */
export class StateDeltaSender {
  constructor(readonly version: 1 | 2 = STATE_DELTA_VERSION) {
    if (version !== 1 && version !== 2) invalid();
  }
  private base: SendSnapshot | undefined;
  private pending: SendSnapshot[] = [];
  private highest = -1;
  private sinceFull = 0;
  encode(payload: string, stateId: number): string {
    const next = snapshot(payload, stateId);
    if (stateId <= this.highest || this.pending.length >= 2) invalid();
    let result = payload;
    if (
      this.base?.tuples &&
      next.tuples &&
      this.sinceFull < 49 &&
      (this.version === 1 ||
        (playerRows(this.base.value.world.players) &&
          playerRows(next.value.world.players)))
    ) {
      // Structural limits apply to the optional compression path. A legal
      // full snapshot still passes through when it exceeds this work budget.
      try {
        const message = {
          type: "stateDelta",
          version: this.version,
          base: this.base.id,
          stateId,
          patch: makePatch(this.base.value, next.value, this.version),
        };
        // Wrapping changed nested values adds depth/nodes. A valid full state
        // must never become an unreadable delta at the receiver's limits.
        bounded(message);
        const delta = JSON.stringify(message);
        if (bytes(delta) < next.size) result = delta;
      } catch {
        // Keep the already size/sequence-validated full snapshot.
      }
    }
    this.sinceFull = result === payload ? 0 : this.sinceFull + 1;
    this.highest = stateId;
    this.pending.push(next);
    return result;
  }
  acknowledge(stateId: number): boolean {
    const found = this.pending.find((entry) => entry.id === stateId);
    if (!found) return false;
    this.base = found;
    this.pending = this.pending.filter((entry) => entry.id > stateId);
    return true;
  }
  reset() {
    this.base = undefined;
    this.pending = [];
    this.highest = -1;
    this.sinceFull = 0;
  }
}

/** Decode before tuple restoration; stored JSON cannot be mutated by consumers. */
export class StateDeltaReceiver {
  private recent: Snapshot[] = [];
  decode(message: unknown): unknown {
    if (!record(message) || !["state", "stateDelta"].includes(message.type))
      return message;
    // Older servers and legacy test packets have no receipt sequence.
    if (message.type === "state" && message.stateId === undefined)
      return message;
    let value = message;
    if (message.type === "stateDelta") {
      bounded(message);
      if (
        Object.keys(message).length !== 5 ||
        (message.version !== 1 && message.version !== 2) ||
        !integer(message.base) ||
        !integer(message.stateId) ||
        message.base >= message.stateId ||
        !Array.isArray(message.patch) ||
        message.patch.length !== (message.version === 2 ? 7 : 6) ||
        bytes(JSON.stringify(message)) > STATE_SNAPSHOT_BYTES
      )
        invalid();
      const base = this.recent.find((entry) => entry.id === message.base);
      if (!base) invalid();
      value = JSON.parse(base.json);
      if (!base.tuples) invalid();
      const [top, world, front, enemies, projectiles, orbs, players] =
        message.patch;
      applyObject(value, top, ["world", "stateId", "type"]);
      applyObject(value.world, world, [
        "enemies",
        "projectiles",
        ...(message.version === 2 ? ["players"] : []),
      ]);
      applyObject(value.world.front, front, orbs === null ? [] : ["orbs"]);
      value.world.enemies = applyRows(value.world.enemies, enemies);
      value.world.projectiles = applyRows(value.world.projectiles, projectiles);
      if (orbs !== null) {
        if (!record(value.world.front)) invalid();
        value.world.front.orbs = applyRows(value.world.front.orbs, orbs);
      }
      if (message.version === 2)
        value.world.players = applyPlayers(value.world.players, players);
      value.stateId = message.stateId;
    }
    const stored = snapshot(JSON.stringify(value), value.stateId, value);
    if (message.type === "stateDelta" && !stored.safe) invalid();
    if (
      this.recent.length &&
      stored.id <= this.recent[this.recent.length - 1].id
    )
      invalid();
    // Never retain the consumer-owned parsed value: tuple restoration mutates it.
    this.recent.push({
      id: stored.id,
      json: stored.json,
      safe: stored.safe,
      tuples: stored.tuples,
    });
    if (this.recent.length > 3) this.recent.shift();
    return value;
  }
  reset() {
    this.recent = [];
  }
}
