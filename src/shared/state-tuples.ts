import { isPleatPoseTuple, restorePleatPose } from "./pleat-pose-wire";

/** Lossless layout change for already-rounded state JSON. Bump for schema changes. */
export const STATE_TUPLE_ENCODING = "tuples-v1";

const PROJECTILE = [
  "id",
  "x",
  "y",
  "z",
  "dx",
  "dy",
  "dz",
  "life",
  "owner",
  "damage",
  "rocket",
  "chain",
  "gravity",
  "radius",
  "family",
  "style",
  "frontShot",
  "frontSlot",
] as const;
const ENEMY = [
  "id",
  "kind",
  "x",
  "y",
  "z",
  "hp",
  "maxHp",
  "cool",
  "wind",
  "tx",
  "ty",
  "tz",
  "hurt",
  "size",
  "active",
  "heading",
  "targetId",
  "wallYaw",
  "perch",
  "jump",
  "lunge",
  "phase",
  "fabrication",
  "fractured",
  "partHp",
  "pulseAim",
  "acidAt",
  "harrow",
  "harrowAirborne",
  "calyx",
  "bastion",
  "pleat",
  "segments",
] as const;
const ORB = ["id", "x", "y", "z", "value"] as const;
const PLEAT = [
  "body",
  "up",
  "forward",
  "poseForward",
  "scale",
  "feet",
] as const;
const SEGMENT = [
  "x",
  "y",
  "z",
  "partHp",
  "heading",
  "acidAt",
  "pulseAim",
] as const;
const VECTOR = ["x", "y", "z"] as const;
type RecordValue = Record<string, unknown>;
type Transform = (key: string, value: unknown) => unknown;
const identity: Transform = (_key, value) => value;
const booleanKeys = new Set([
  "rocket",
  "chain",
  "active",
  "fractured",
  "harrowAirborne",
]);
const stringKeys = new Set(["owner", "kind", "family", "style", "targetId"]);
const complexKeys = new Set([
  "harrow",
  "calyx",
  "bastion",
  "pulseAim",
  "pleat",
  "segments",
  "body",
  "up",
  "forward",
  "poseForward",
  "feet",
]);

function record(value: unknown): value is RecordValue {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function invalid(): never {
  throw new Error("invalid state tuple");
}
function pack(
  value: unknown,
  keys: readonly string[],
  transform = identity,
): unknown[] {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)))
    invalid();
  let mask = 0;
  const values: unknown[] = [];
  keys.forEach((key, index) => {
    if (Object.hasOwn(value, key)) {
      mask += 2 ** index;
      values.push(transform(key, value[key]));
    }
  });
  return [mask, ...values];
}
function vector(value: unknown) {
  if (
    !record(value) ||
    Object.keys(value).length !== 3 ||
    VECTOR.some(
      (key) => typeof value[key] !== "number" || !Number.isFinite(value[key]),
    )
  )
    invalid();
  return VECTOR.map((key) => value[key]);
}
function packPleat(key: string, value: unknown): unknown {
  if (["body", "up", "forward", "poseForward"].includes(key))
    return vector(value);
  if (key === "feet") {
    if (!Array.isArray(value) || value.length > 16) invalid();
    return value.map((foot) => {
      if (
        !record(foot) ||
        Object.keys(foot).length !== 3 ||
        typeof foot.planted !== "boolean"
      )
        invalid();
      return [vector(foot.point), vector(foot.normal), foot.planted];
    });
  }
  return value;
}
function packEnemyField(key: string, value: unknown): unknown {
  if (key === "pleat") {
    if (Array.isArray(value)) {
      if (!isPleatPoseTuple(value)) invalid();
      return value;
    }
    return pack(value, PLEAT, packPleat);
  }
  if (key === "pulseAim") return pack(value, VECTOR);
  if (key === "segments") {
    if (!Array.isArray(value) || value.length > 64) invalid();
    return value.map((segment) =>
      pack(segment, SEGMENT, (name, item) =>
        name === "pulseAim" ? pack(item, VECTOR) : item,
      ),
    );
  }
  return value;
}
function ownerReference(value: unknown, owners: readonly string[]) {
  const index = owners.indexOf(value as string);
  return index >= 0 ? index : value;
}
export const packEnemyTuple = (
  value: unknown,
  owners: readonly string[] = [],
) =>
  pack(value, ENEMY, (key, item) =>
    key === "targetId"
      ? ownerReference(item, owners)
      : packEnemyField(key, item),
  );
export const packProjectileTuple = (
  value: unknown,
  owners: readonly string[] = [],
) =>
  pack(value, PROJECTILE, (key, item) =>
    key === "owner" ? ownerReference(item, owners) : item,
  );
export const packOrbTuple = (value: unknown) => pack(value, ORB);
/** One bounded budget covers the whole decoded packet, including nested metadata. */
class Budget {
  left = 50000;
  take() {
    if (--this.left < 0) invalid();
  }
  json(value: unknown, depth = 0): void {
    this.take();
    if (depth > 16) invalid();
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) invalid();
      return;
    }
    if (typeof value === "string") {
      if (value.length > 1024) invalid();
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 4096) invalid();
      for (const item of value) this.json(item, depth + 1);
      return;
    }
    if (!record(value)) invalid();
    const entries = Object.entries(value);
    if (entries.length > 128) invalid();
    for (const [key, item] of entries) {
      if (
        key.length > 128 ||
        ["__proto__", "constructor", "prototype"].includes(key)
      )
        invalid();
      this.json(item, depth + 1);
    }
  }
}
function unpack(
  value: unknown,
  keys: readonly string[],
  required: readonly string[],
  budget: Budget,
  transform = identity,
): RecordValue {
  budget.take();
  if (!Array.isArray(value) || value.length > keys.length + 1) invalid();
  const mask = value[0];
  if (!Number.isSafeInteger(mask) || mask < 0 || mask >= 2 ** keys.length)
    invalid();
  const result: RecordValue = {};
  let cursor = 1;
  keys.forEach((key, index) => {
    if (Math.floor(mask / 2 ** index) % 2 === 0) return;
    if (cursor >= value.length) invalid();
    const item = transform(key, value[cursor++]);
    if (booleanKeys.has(key)) {
      if (typeof item !== "boolean") invalid();
    } else if (stringKeys.has(key)) {
      if (typeof item !== "string" || !item.length || item.length > 128)
        invalid();
    } else if (
      !complexKeys.has(key) &&
      (typeof item !== "number" || !Number.isFinite(item))
    )
      invalid();
    if (
      (key === "id" || key === "frontShot" || key === "frontSlot") &&
      (!Number.isSafeInteger(item) || (item as number) < 0)
    )
      invalid();
    result[key] = item;
  });
  if (
    cursor !== value.length ||
    required.some((key) => !Object.hasOwn(result, key))
  )
    invalid();
  return result;
}
function unpackVector(value: unknown, budget: Budget) {
  budget.take();
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((item) => typeof item !== "number" || !Number.isFinite(item))
  )
    invalid();
  return { x: value[0], y: value[1], z: value[2] };
}
function unpackPleat(value: unknown, budget: Budget, compact: boolean) {
  if (compact && isPleatPoseTuple(value)) {
    budget.take();
    return value;
  }
  return unpack(value, PLEAT, PLEAT, budget, (key, item) => {
    if (["body", "up", "forward", "poseForward"].includes(key))
      return unpackVector(item, budget);
    if (key !== "feet") return item;
    if (!Array.isArray(item) || item.length > 16) invalid();
    return item.map((foot) => {
      budget.take();
      if (
        !Array.isArray(foot) ||
        foot.length !== 3 ||
        typeof foot[2] !== "boolean"
      )
        invalid();
      return {
        point: unpackVector(foot[0], budget),
        normal: unpackVector(foot[1], budget),
        planted: foot[2],
      };
    });
  });
}
function unpackEnemy(
  value: unknown,
  budget: Budget,
  owners: readonly string[],
  compact: boolean,
) {
  return unpack(
    value,
    ENEMY,
    [
      "id",
      "kind",
      "x",
      "y",
      "z",
      "hp",
      "maxHp",
      "cool",
      "wind",
      "tx",
      "tz",
      "hurt",
    ],
    budget,
    (key, item) => {
      if (["harrow", "calyx", "bastion"].includes(key) && !record(item))
        invalid();
      if (
        key === "bastion" &&
        record(item) &&
        record(item.volley) &&
        item.volley.turnBits !== undefined
      ) {
        const bits = item.volley.turnBits;
        if (
          !Array.isArray(bits) ||
          bits.length !== 2 ||
          bits.some(
            (part) => !Number.isInteger(part) || part < 0 || part > 0xffffffff,
          )
        )
          invalid();
      }
      if (key === "targetId") return restoreOwner(item, owners);
      if (key === "pleat") return unpackPleat(item, budget, compact);
      if (key === "pulseAim") return unpack(item, VECTOR, ["x", "z"], budget);
      if (key !== "segments") return item;
      if (!Array.isArray(item) || item.length > 64) invalid();
      return item.map((segment) =>
        unpack(segment, SEGMENT, VECTOR, budget, (name, point) =>
          name === "pulseAim"
            ? unpack(point, VECTOR, ["x", "z"], budget)
            : point,
        ),
      );
    },
  );
}
function restoreOwner(value: unknown, owners: readonly string[]): unknown {
  if (typeof value === "string") return value;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) >= owners.length
  )
    invalid();
  return owners[value as number];
}
function list(
  value: unknown,
  max: number,
  decode: (item: unknown) => RecordValue,
) {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value.map(decode);
}

/** Call inside the existing JSON receive guard, before World validation/caches. */
export function restoreStateTuples(packet: unknown): boolean {
  if (!record(packet)) return false;
  if (
    packet.type === "state" &&
    packet.pleatPose !== undefined &&
    packet.pleatPose !== 1
  )
    return false;
  const compact = packet.type === "state" && packet.pleatPose === 1;
  if (packet.stateEncoding === undefined) {
    // Existing servers remain compatible, but unmarked tuple arrays are invalid.
    if (packet.stateOwners !== undefined) return false;
    if (packet.type === "state" && record(packet.world)) {
      const world = packet.world;
      for (const items of [
        world.enemies,
        world.projectiles,
        record(world.front) ? world.front.orbs : undefined,
      ])
        if (Array.isArray(items) && items.some(Array.isArray)) return false;
    }
    try {
      if (
        packet.type === "state" &&
        record(packet.world) &&
        Array.isArray(packet.world.enemies)
      ) {
        packet.world.enemies = packet.world.enemies.map((enemy) => {
          if (!record(enemy)) invalid();
          return restorePleatPose(enemy, compact);
        });
      }
      if (packet.type === "state") delete packet.pleatPose;
      return true;
    } catch {
      return false;
    }
  }
  try {
    if (
      packet.type !== "state" ||
      packet.stateEncoding !== STATE_TUPLE_ENCODING ||
      !record(packet.world)
    )
      return false;
    const budget = new Budget();
    // Bound raw nested structures before decoding; limits apply to direct callers too.
    budget.json(packet);
    const owners = packet.stateOwners;
    if (
      !Array.isArray(owners) ||
      owners.length > 64 ||
      owners.some(
        (owner) =>
          typeof owner !== "string" || !owner.length || owner.length > 128,
      ) ||
      new Set(owners).size !== owners.length
    )
      invalid();
    const world = packet.world;
    const enemies = list(world.enemies, 512, (item) =>
      restorePleatPose(unpackEnemy(item, budget, owners, compact), compact),
    );
    const projectiles = list(world.projectiles, 4096, (item) =>
      unpack(item, PROJECTILE, PROJECTILE.slice(0, 11), budget, (key, item) =>
        key === "owner" ? restoreOwner(item, owners) : item,
      ),
    );
    const front = world.front;
    let orbs: RecordValue[] | undefined;
    if (front !== undefined) {
      if (!record(front)) invalid();
      orbs = list(front.orbs, 4096, (item) => unpack(item, ORB, ORB, budget));
    }
    // Do not leave half-restored state if a later field was corrupt.
    world.enemies = enemies;
    world.projectiles = projectiles;
    if (record(front)) front.orbs = orbs;
    delete packet.stateEncoding;
    delete packet.stateOwners;
    delete packet.pleatPose;
    return true;
  } catch {
    return false;
  }
}
