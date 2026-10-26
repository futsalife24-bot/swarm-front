import type { Enemy, World, Player } from "./game";

const turnView = new DataView(new ArrayBuffer(8));

/** 確定斉射の角度を、精度を失わず整数2個として送る。 */
function turnBits(turn: number): [number, number] {
  turnView.setFloat64(0, turn);
  return [turnView.getUint32(0), turnView.getUint32(4)];
}

/** 不正な表現は無視し、従来の角度をそのまま使う。 */
export function restoreTurn(bits: unknown): number | undefined {
  if (
    !Array.isArray(bits) ||
    bits.length !== 2 ||
    bits.some(
      (part) => !Number.isInteger(part) || part < 0 || part > 0xffffffff,
    )
  )
    return undefined;
  turnView.setUint32(0, bits[0]);
  turnView.setUint32(4, bits[1]);
  const turn = turnView.getFloat64(0);
  return Number.isFinite(turn) ? turn : undefined;
}

/** 描画に必要な情報だけを送る。権威側の敵データは変更しない。 */
function wireEnemy(e: Enemy) {
  return {
    id: e.id,
    kind: e.kind,
    x: e.x,
    y: e.y,
    z: e.z,
    hp: e.hp,
    maxHp: e.maxHp,
    cool: e.cool,
    wind: e.wind,
    tx: e.tx,
    ty: e.ty,
    tz: e.tz,
    hurt: e.hurt,
    size: e.size,
    active: e.active,
    heading: e.heading,
    targetId: e.targetId,
    wallYaw: e.wallYaw,
    perch: e.perch,
    jump: e.jump,
    lunge: e.lunge,
    phase: e.phase,
    fabrication: e.fabrication,
    fractured: e.fractured,
    partHp: e.partHp,
    pulseAim: e.pulseAim,
    acidAt: e.acidAt,
    harrow: e.harrow && {
      kind: e.harrow.kind,
      started: e.harrow.started,
      yaw: e.harrow.yaw,
      from: e.harrow.from,
      to: e.harrow.to,
      flapSeed: e.harrow.flapSeed,
      travelProgress: e.harrow.travelProgress,
    },
    harrowAirborne: e.harrowAirborne,
    calyx: e.calyx,
    bastion: e.bastion && {
      armor: e.bastion.armor,
      phase: e.bastion.phase,
      phaseAt: e.bastion.phaseAt,
      volley: e.bastion.volley && {
        ...e.bastion.volley,
        // 壁際を含め予告と実弾の方向を揃える。
        turnBits: turnBits(e.bastion.volley.turn),
      },
      aim: e.bastion.aim,
    },
    pleat: e.pleat,
    segments: e.segments?.map((n) => ({
      x: n.x,
      y: n.y,
      z: n.z,
      partHp: n.partHp,
      heading: n.heading,
      acidAt: n.acidAt,
      pulseAim: n.pulseAim,
    })),
  };
}

/** 武器能力は端数も含めて維持し、その他の小数は小数点以下2桁にする。 */
export function encodeState(data: unknown): string {
  return encodeStateWithLegacyTurn(data);
}

/** 旧画面の確定斉射だけは、承認された例外として元の精度を保つ。 */
function encodeStateWithLegacyTurn(
  data: unknown,
  exactVolley?: object,
): string {
  const weapons = new WeakSet<object>();
  return JSON.stringify(data, function (key, value) {
    // Replicate solved PLEAT contacts/pose, not server-only ray search and springs.
    // Persisted World still retains the complete controller state.
    if (key === "pleat" && value)
      return {
        body: value.body,
        up: value.up,
        forward: value.forward,
        poseForward: value.poseForward,
        scale: value.scale,
        feet: value.feet.map(
          (f: { point: unknown; normal: unknown; planted: boolean }) => ({
            point: f.point,
            normal: f.normal,
            planted: f.planted,
          }),
        ),
      };
    const inWeapon = weapons.has(this);
    if (value && typeof value === "object") {
      if (
        inWeapon ||
        ("kind" in value && "rarity" in value && "power" in value)
      )
        weapons.add(value);
      return value;
    }
    if (this === exactVolley && key === "turn") return value;
    if (
      !inWeapon &&
      typeof value === "number" &&
      !Number.isInteger(value) &&
      Math.abs(value) < Number.MAX_VALUE / 100
    ) {
      const rounded = Math.round(value * 100) / 100;
      // 微小な正のHPが0になると、生存中の敵や部位が撃破扱いになる。
      return (key === "hp" || key === "partHp") && value > 0 && rounded === 0
        ? 0.01
        : rounded;
    }
    return value;
  });
}

/** Common state is encoded once per broadcast, private loot stays per recipient. */
export function prepareState(w: World, sentEvent: number, metadata: object) {
  const { pending, rewards, drops, front, ...rest } = w;
  const common = {
    ...rest,
    seed: 0,
    enemies: w.enemies.map(wireEnemy),
    events: w.events.filter((e) => e.id > sentEvent),
  };
  // 二分探索のたびにPLEAT等の全個体を再JSON化しない。
  const {
    enemies: commonEnemies,
    events: commonEvents,
    players: commonPlayers,
    ...commonRest
  } = common;
  const commonPrefix = encodeState(commonRest).slice(0, -1);
  const playerWire = encodeState(commonPlayers);
  const cachedPlayerWire = encodeState(
    commonPlayers.map(({ weapons, ...p }) => p),
  );
  const enemyWires = new Map(
    commonEnemies.map((enemy) => [enemy.id, encodeState(enemy)]),
  );
  const allEnemiesWire = commonEnemies
    .map((enemy) => enemyWires.get(enemy.id)!)
    .join(",");
  const modernEnemySet = { byId: enemyWires, all: allEnemiesWire };
  let legacyEnemySet: typeof modernEnemySet | undefined;
  const getLegacyEnemySet = () => {
    if (legacyEnemySet) return legacyEnemySet;
    let byId: Map<number, string> | undefined;
    for (const enemy of commonEnemies) {
      const volley = enemy.bastion?.volley;
      if (!volley) continue;
      const { turnBits: _turnBits, ...legacyVolley } = volley;
      const projected = {
        ...enemy,
        bastion: { ...enemy.bastion!, volley: legacyVolley },
      };
      byId ??= new Map(enemyWires);
      byId.set(enemy.id, encodeStateWithLegacyTurn(projected, legacyVolley));
    }
    return (legacyEnemySet = byId
      ? {
          byId,
          all: commonEnemies.map((enemy) => byId!.get(enemy.id)!).join(","),
        }
      : modernEnemySet);
  };
  const eventWires = commonEvents.map((event) => encodeState(event));
  const full = new Map<number, string>();
  const cached = new Map<number, string>();
  const legacyFull = new Map<number, string>();
  const legacyCached = new Map<number, string>();
  const tail = encodeState(metadata).slice(1, -1);
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
      partialSupported = true,
    ) {
      // 受信者別の戦況・時刻も含め、実際に送る最終データで容量を判定する。
      const recipientTail = recipientMetadata
        ? encodeState({ ...metadata, ...recipientMetadata }).slice(1, -1)
        : tail;
      const personalData = {
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
      };
      const personal = encodeState(personalData).slice(1, -1);
      const packetWith = (
        count: number,
        enemies?: ReturnType<typeof wireEnemy>[],
        orbs?: NonNullable<World["front"]>["orbs"],
        omitted?: { enemies: number[]; orbs: number[] },
      ) => {
        const cache = partialSupported
          ? equipmentCached
            ? cached
            : full
          : equipmentCached
            ? legacyCached
            : legacyFull;
        const enemySet = partialSupported
          ? modernEnemySet
          : getLegacyEnemySet();
        let encoded = enemies ? undefined : cache.get(count);
        if (encoded === undefined) {
          const enemyWire = enemies
            ? enemies.map((enemy) => enemySet.byId.get(enemy.id)!).join(",")
            : enemySet.all;
          const eventWire = count ? eventWires.slice(-count).join(",") : "";
          encoded = `${commonPrefix},"players":${equipmentCached ? cachedPlayerWire : playerWire},"enemies":[${enemyWire}],"events":[${eventWire}]`;
          if (!enemies) cache.set(count, encoded);
        }
        const own =
          orbs && personalData.front
            ? encodeState({
                ...personalData,
                front: { ...personalData.front, orbs },
              }).slice(1, -1)
            : personal;
        return `{"type":"state","equipmentCached":${equipmentCached},"inputAck":${inputAck},"world":${encoded},${own}}${recipientTail ? `,${recipientTail}` : ""}${omitted ? `,"omitted":${JSON.stringify(omitted)}` : ""}}`;
      };
      const packet = packetWith(common.events.length);
      if (!front || new TextEncoder().encode(packet).length <= 65536)
        return packet;
      // まず古い演出から省略し、可能な限り新しい演出を残す。
      let low = 0,
        high = common.events.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (new TextEncoder().encode(packetWith(middle)).length <= 65536)
          low = middle;
        else high = middle - 1;
      }
      const withoutEvents = packetWith(low);
      if (
        new TextEncoder().encode(withoutEvents).length <= 65536 ||
        !partialSupported
      )
        return withoutEvents;

      // 省略IDを添えることで、受信側は省略と撃破・取得を区別できる。
      const player = w.players.find((p) => p.id === id);
      const distance = (p: { x: number; y: number; z: number }) =>
        (p.x - (player?.x ?? 0)) ** 2 +
        (p.y - (player?.y ?? 0)) ** 2 +
        (p.z - (player?.z ?? 0)) ** 2;
      const nearestOrbs = [...front.orbs].sort(
        (a, b) => distance(a) - distance(b) || a.id - b.id,
      );
      const nearestEnemies = [...common.enemies].sort(
        (a, b) => distance(a) - distance(b) || a.id - b.id,
      );
      const partial = (orbCount: number, enemyCount: number) =>
        packetWith(
          0,
          enemyCount === nearestEnemies.length
            ? undefined
            : nearestEnemies.slice(0, enemyCount),
          orbCount === nearestOrbs.length
            ? undefined
            : nearestOrbs.slice(0, orbCount),
          {
            enemies: nearestEnemies.slice(enemyCount).map((e) => e.id),
            orbs: nearestOrbs.slice(orbCount).map((o) => o.id),
          },
        );
      const maxFit = (total: number, build: (count: number) => string) => {
        if (new TextEncoder().encode(build(0)).length > 65536) return -1;
        let min = 0,
          max = total;
        while (min < max) {
          const middle = Math.ceil((min + max) / 2);
          if (new TextEncoder().encode(build(middle)).length <= 65536)
            min = middle;
          else max = middle - 1;
        }
        return min;
      };
      const orbCount = maxFit(nearestOrbs.length, (n) =>
        partial(n, nearestEnemies.length),
      );
      if (orbCount >= 0) return partial(orbCount, nearestEnemies.length);
      const enemyCount = maxFit(nearestEnemies.length, (n) => partial(0, n));
      return partial(0, Math.max(0, enemyCount));
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
