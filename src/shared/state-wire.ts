import type { World, Player } from "./game";

const renderNumbers = new Set([
  "x",
  "y",
  "z",
  "yaw",
  "pitch",
  "tx",
  "ty",
  "tz",
  "dx",
  "dy",
  "dz",
  "fromX",
  "fromZ",
  "time",
  "hp",
  "cool",
  "reload",
  "safe",
  "hurt",
  "wind",
]);
/** Weapon stats are exact, including nested rolls/variance. */
export function encodeState(data: unknown): string {
  const weapons = new WeakSet<object>();
  return JSON.stringify(data, function (key, value) {
    const inWeapon = weapons.has(this);
    if (value && typeof value === "object") {
      if (
        inWeapon ||
        ("kind" in value && "rarity" in value && "power" in value)
      )
        weapons.add(value);
      return value;
    }
    return !inWeapon && typeof value === "number" && renderNumbers.has(key)
      ? Math.round(value * 100) / 100
      : value;
  });
}

/** Common state is encoded once per broadcast, private loot stays per recipient. */
export function prepareState(w: World, sentEvent: number, metadata: object) {
  const { pending, rewards, drops, ...rest } = w;
  const common = {
    ...rest,
    seed: 0,
    events: w.events.filter((e) => e.id > sentEvent),
  };
  let full: string | undefined;
  let cached: string | undefined;
  const tail = encodeState(metadata).slice(1);
  return {
    equipmentKey: JSON.stringify([
      w.run,
      w.players.map((p) => [p.id, p.weapons]),
    ]),
    packet(id: string, equipmentCached = false, inputAck = -1) {
      if (!equipmentCached && full === undefined)
        full = encodeState(common).slice(0, -1);
      if (equipmentCached && cached === undefined) {
        cached = encodeState({
          ...common,
          players: w.players.map(({ weapons, ...p }) => p),
        }).slice(0, -1);
      }
      const personal = encodeState({
        pending: { [id]: pending[id] ?? [] },
        rewards: { [id]: rewards[id] ?? [] },
        drops: drops.filter((d) => d.owner === id),
      }).slice(1);
      return `{"type":"state","equipmentCached":${equipmentCached},"inputAck":${inputAck},"world":${equipmentCached ? cached : full},${personal},${tail}`;
    },
  };
}

/** Cache lifetime is one ordered WebSocket connection; terminal states are full. */
export class EquipmentCache {
  private run = "";
  private weapons = new Map<string, Player["weapons"]>();
  restore(world: World, cached: boolean): boolean {
    if (
      cached &&
      (world.run !== this.run ||
        world.players.some((p) => !this.weapons.has(p.id)))
    )
      return false;
    if (!cached) {
      if (
        world.players.some(
          (p) => !Array.isArray(p.weapons) || p.weapons.length !== 2,
        )
      )
        return false;
      this.run = world.run;
      this.weapons = new Map(world.players.map((p) => [p.id, p.weapons]));
    } else {
      for (const p of world.players) p.weapons = this.weapons.get(p.id)!;
    }
    return true;
  }
}
