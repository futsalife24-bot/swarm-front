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
  const { pending, rewards, drops, front, ...rest } = w;
  const common = {
    ...rest,
    seed: 0,
    events: w.events.filter((e) => e.id > sentEvent),
  };
  const full = new Map<number, string>();
  const cached = new Map<number, string>();
  const tail = encodeState(metadata).slice(1);
  return {
    equipmentKey: JSON.stringify([
      w.run,
      w.players.map((p) => [p.id, p.weapons]),
    ]),
    packet(
      id: string,
      equipmentCached = false,
      inputAck = -1,
      recipientMetadata?: object,
    ) {
      // 受信者別の戦況・時刻も含め、実際に送る最終データで容量を判定する。
      const recipientTail = recipientMetadata
        ? encodeState({ ...metadata, ...recipientMetadata }).slice(1)
        : tail;
      const personal = encodeState({
        ...(front
          ? {
              front: {
                ...front,
                // 描画に使う印は受信者自身の分だけ。サーバーの判定状態は維持する。
                players: Object.fromEntries(
                  Object.entries(front.players).map(([owner, p]) => [
                    owner,
                    { ...p, statuses: owner === id ? p.statuses : {} },
                  ]),
                ),
              },
            }
          : {}),
        pending: { [id]: pending[id] ?? [] },
        rewards: { [id]: rewards[id] ?? [] },
        drops: drops.filter((d) => d.owner === id),
      }).slice(1);
      const packetWith = (count: number) => {
        const cache = equipmentCached ? cached : full;
        let encoded = cache.get(count);
        if (encoded === undefined) {
          encoded = encodeState({
            ...common,
            events: count ? common.events.slice(-count) : [],
            ...(equipmentCached
              ? { players: w.players.map(({ weapons, ...p }) => p) }
              : {}),
          }).slice(0, -1);
          cache.set(count, encoded);
        }
        return `{"type":"state","equipmentCached":${equipmentCached},"inputAck":${inputAck},"world":${encoded},${personal},${recipientTail}`;
      };
      const packet = packetWith(common.events.length);
      if (!front || new TextEncoder().encode(packet).length <= 65536)
        return packet;
      // 密集時は古い演出だけを間引く。敵・弾・経験値・戦況は削らない。
      let low = 0,
        high = common.events.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (new TextEncoder().encode(packetWith(middle)).length <= 65536)
          low = middle;
        else high = middle - 1;
      }
      return packetWith(low);
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
