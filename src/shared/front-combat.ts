import * as legacy from "./front-legacy-combat";
/** 改装版だけの戦闘効果。旧版の所持品・報酬・保存には接続しない。 */
import {
  blocked,
  event,
  eye,
  hurtEnemy,
  visible,
  type Enemy,
  type Event,
  type Player,
  type World,
} from "./game";
import { stats } from "./defs";
import { mapFor } from "./stages";
import { groundHeight } from "./terrain";
import {
  FRONT_UPGRADE_IDS,
  frontEvolvedFamilies,
  type FrontUpgradeId,
  type FrontFamily,
} from "./front-upgrades";

export interface FrontPlayerCombat {
  levels: Record<FrontUpgradeId, number>;
  evolved: FrontFamily[];
  maxHp: number;
  charge: number;
  counterReady: boolean;
  pierceReady: boolean;
  tacticalReady: boolean;
  openingSlots: number[];
  armorUntil: number;
  recoveryAt?: number;
  statuses: Record<number, { marked: boolean; hits: number; lastShot: number }>;
  manualHits: number;
  effects: number;
  secondaryKills: number;
  firstEffectAt: number | null;
  maxChain: number;
}
export interface FrontMine {
  id: number;
  owner: string;
  x: number;
  y: number;
  z: number;
  expires: number;
}
export interface FrontBattleState {
  version: "front-v1";
  growthVersion?: 2 | 3;
  catalogVersion?: 2;
  /** 公開前から続く部隊は旧描画容量に合わせた24体を維持する。 */
  enemyCap?: number;
  players: Record<string, FrontPlayerCombat>;
  xp: number;
  orbs: { id: number; x: number; y: number; z: number; value: number }[];
  mines: FrontMine[];
  shotSerial: number;
  effectsThisTick: number;
  budgetExhaustions: number;
}
export const FRONT_BALANCE = {
  enemyCap: 96,
  coreDamage: 42,
  fuseDamage: 34,
  radius: 5.5,
  compressedRadius: 7.5,
  mineDamage: 65,
  mineRadius: 5,
  interceptDamage: 35,
  ricochetDamage: 32,
  pierceBonus: 1.35,
  tacticalReload: 0.65,
  effectBudget: 120,
} as const;
export function createFrontBattleState(): FrontBattleState {
  return {
    version: "front-v1",
    growthVersion: 2,
    enemyCap: FRONT_BALANCE.enemyCap,
    players: {},
    xp: 0,
    orbs: [],
    mines: [],
    shotSerial: 0,
    effectsThisTick: 0,
    budgetExhaustions: 0,
  };
}
export function addFrontCombatPlayer(w: World, id: string): FrontPlayerCombat {
  return (w.front!.players[id] = {
    levels: Object.fromEntries(
      FRONT_UPGRADE_IDS.map((key) => [key, 0]),
    ) as Record<FrontUpgradeId, number>,
    evolved: [],
    maxHp: 160,
    charge: 0,
    counterReady: false,
    pierceReady: false,
    tacticalReady: false,
    openingSlots: [],
    armorUntil: 0,
    statuses: {},
    manualHits: 0,
    effects: 0,
    secondaryKills: 0,
    firstEffectAt: null,
    maxChain: 0,
  });
}
interface ShotLedger {
  owner: string;
  targets: Set<number>;
  effected: Set<string>;
  kills: number;
  refund: boolean;
  pierce: boolean;
}
const ledgers = new WeakMap<FrontBattleState, Map<number, ShotLedger>>();
function ledger(w: World, id: number, owner: string): ShotLedger {
  const r = w.front!;
  let shots = ledgers.get(r);
  if (!shots) {
    shots = new Map();
    ledgers.set(r, shots);
  }
  let shot = shots.get(id);
  if (!shot) {
    shot = {
      owner,
      targets: new Set(),
      effected: new Set(),
      kills: 0,
      refund: false,
      pierce: false,
    };
    shots.set(id, shot);
    if (shots.size > 128) shots.delete(shots.keys().next().value!);
  }
  return shot;
}
function spend(w: World) {
  if (w.front!.effectsThisTick >= FRONT_BALANCE.effectBudget) {
    w.front!.budgetExhaustions++;
    return false;
  }
  w.front!.effectsThisTick++;
  return true;
}
function stateFor(w: World, e: Enemy, owner: string) {
  return (w.front!.players[owner].statuses[e.id] ??= {
    marked: false,
    hits: 0,
    lastShot: -1,
  });
}
export function recordFrontKill(
  w: World,
  e: Enemy,
  owner: string,
  secondary = false,
) {
  if (!w.front?.growthVersion)
    return legacy.recordFrontKill(w, e, owner, secondary);
  const r = w.front!;
  // 砲撃型を精鋭報酬対象にする。条件成立前の撃破は貯金しない。
  if (
    r.growthVersion !== 3 &&
    (e.kind === "spitter" || e.kind === "boss" || e.kind === "harrow")
  ) {
    for (const combat of Object.values(r.players))
      combat.evolved = [
        ...new Set([...combat.evolved, ...frontEvolvedFamilies(combat)]),
      ];
  }
  if (r.growthVersion === 3 && r.players[owner]) {
    const player = w.players.find((p) => p.id === owner),
      levels = r.players[owner].levels;
    if (player && player.hp > 0) {
      player.hp = Math.min(
        r.players[owner].maxHp,
        player.hp + (levels["life-drain"] || 0),
      );
    }
  }
  if (secondary && r.players[owner]) r.players[owner].secondaryKills++;
  const value =
    e.kind === "boss" || e.kind === "harrow"
      ? 20
      : e.kind === "spitter"
        ? 3
        : 2;
  if (r.orbs.length >= 160) r.orbs[0].value += value;
  else {
    const blocks = mapFor(w).blocks;
    const points = [{ x: e.x, z: e.z }];
    // 空中・屋上で倒しても、建物の外側の歩ける地面へ落とす。
    for (const b of blocks) {
      const x = Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, e.x));
      const z = Math.max(b.z - b.d / 2, Math.min(b.z + b.d / 2, e.z));
      points.push(
        { x: b.x - b.w / 2 - 0.8, z },
        { x: b.x + b.w / 2 + 0.8, z },
        { x, z: b.z - b.d / 2 - 0.8 },
        { x, z: b.z + b.d / 2 + 0.8 },
      );
    }
    points.push(...w.players.filter((p) => p.connected && p.hp > 0));
    const point = points
      .map((p) => ({ x: p.x, z: p.z, y: groundHeight(p.x, p.z, blocks) }))
      .filter((p) => !blocked(p.x, p.z, 0.55, p.y + 0.01, blocks))
      .sort(
        (a, b) =>
          Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
      )[0];
    if (point) r.orbs.push({ id: ++w.serial, ...point, value });
    else r.xp += value;
  }
}
export function collectFrontXp(w: World, all = false) {
  if (!w.front?.growthVersion) return legacy.collectFrontXp(w, all);
  const r = w.front!,
    living = w.players.filter((p) => p.connected && p.hp > 0);
  let collected = 0;
  r.orbs = r.orbs.filter((orb) => {
    const collector = all
      ? undefined
      : living
          .filter(
            (p) =>
              Math.hypot(p.x - orb.x, p.z - orb.z) <=
              5 + 3 * (r.players[p.id]?.levels.magnet ?? 0),
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - orb.x, a.z - orb.z) -
                Math.hypot(b.x - orb.x, b.z - orb.z) || (a.id < b.id ? -1 : 1),
          )[0];
    if (!all && !collector) return true;
    if (collector) {
      const combat = r.players[collector.id],
        rank = combat?.levels["recovery-pack"] || 0;
      if (
        rank > 0 &&
        collector.hp < combat.maxHp &&
        w.time >= (combat.recoveryAt ?? 0)
      ) {
        const amount = Math.min(rank, combat.maxHp - collector.hp);
        collector.hp += amount;
        combat.recoveryAt =
          w.time +
          Math.max(1.5, 3 - 0.5 * (combat.levels["fusion-collector"] || 0));
        event(w, {
          type: "heal",
          x: collector.x,
          y: (collector.y ?? 0) + 1,
          z: collector.z,
          owner: collector.id,
          amount,
        });
      }
    }
    collected += orb.value;
    return false;
  });
  r.xp += collected;
  return collected;
}
function markEffect(w: World, owner: string) {
  const p = w.front!.players[owner];
  p.effects++;
  p.firstEffectAt ??= w.time;
}
function secondaryHit(
  w: World,
  target: Enemy,
  damage: number,
  owner: string,
  origin: number,
  key: string,
  source: "ricochet" | "interceptor" | "mine" | "blast",
  from?: { x: number; y?: number; z: number },
) {
  const s = ledger(w, origin, owner),
    tag = `${key}:${target.id}`;
  if (target.hp <= 0 || s.effected.has(tag) || !spend(w)) return false;
  s.effected.add(tag);
  const player = w.players.find((p) => p.id === owner);
  hurtEnemy(w, target, damage, owner);
  if (target.hp <= 0) {
    w.front!.players[owner].secondaryKills++;
    s.kills++;
    w.front!.players[owner].maxChain = Math.max(
      w.front!.players[owner].maxChain,
      s.kills,
    );
    if (
      source === "ricochet" &&
      w.front!.players[owner].evolved.includes("piercing")
    )
      w.front!.players[owner].pierceReady = true;
  }
  if (player && (source === "ricochet" || source === "interceptor"))
    event(w, {
      type: "shot",
      weapon: "rifle",
      frontEffect: source === "ricochet" ? "ricochet" : "interceptor",
      owner,
      x: from?.x ?? player.x,
      y: from?.y ?? (player.y ?? 0) + 1.5,
      z: from?.z ?? player.z,
      tx: target.x,
      ty: eye(target),
      tz: target.z,
    });
  return true;
}
function blast(
  w: World,
  x: number,
  y: number,
  z: number,
  damage: number,
  radius: number,
  owner: string,
  origin: number,
  key: string,
  depth = 0,
) {
  if (depth > 2 || !spend(w)) return;
  const r = w.front!.players[owner],
    blocks = mapFor(w).blocks;
  markEffect(w, owner);
  if (depth === 0) radius *= 1 + 0.2 * r.levels["blast-radius"];
  const cell = 1 + Math.min(0.48, 0.08 * (r.levels["burst-cell"] || 0));
  event(w, {
    type: "burst",
    x,
    y,
    z,
    radius,
    owner,
    frontEffect: key.startsWith("mine-") ? "mine" : "blast",
  });
  for (const target of [...w.enemies]) {
    if (
      target.hp <= 0 ||
      Math.hypot(target.x - x, target.z - z) > radius ||
      !visible({ x, y, z }, target, blocks)
    )
      continue;
    const status = stateFor(w, target, owner);
    const chain =
      key === "fuse" &&
      status.marked &&
      r.evolved.includes("explosion") &&
      depth < 2;
    if (chain) status.marked = false;
    const applied = secondaryHit(
      w,
      target,
      damage * cell,
      owner,
      origin,
      key,
      "blast",
    );
    if (!applied) continue;
    if (key === "core" && r.levels.fuse > 0 && target.hp > 0)
      status.marked = true;
    if (chain)
      blast(
        w,
        target.x,
        eye(target),
        target.z,
        FRONT_BALANCE.fuseDamage * (1 + 0.3 * (r.levels.fuse - 1)),
        radius,
        owner,
        origin,
        "fuse",
        depth + 1,
      );
  }
}
export function beginFrontShot(w: World, p: Player) {
  if (!w.front?.growthVersion) return legacy.beginFrontShot(w, p);
  const id = ++w.front!.shotSerial;
  const shot = ledger(w, id, p.id),
    r = w.front!.players[p.id];
  shot.pierce = r.pierceReady;
  r.pierceReady = false;
  const opening = r.openingSlots.includes(p.slot);
  r.openingSlots = r.openingSlots.filter((slot) => slot !== p.slot);
  return {
    id,
    extraPierce:
      r.levels["armor-piercer"] + r.levels["line-shot"] + (shot.pierce ? 1 : 0),
    damageFactor:
      (1 + 0.1 * (r.levels["power-cell"] || 0)) *
      (shot.pierce ? FRONT_BALANCE.pierceBonus : 1) *
      (opening ? 1 + 0.25 * r.levels["opening-shot"] : 1),
  };
}
export function frontManualHit(
  w: World,
  e: Enemy,
  damage: number,
  owner: string,
  origin: number,
  part = 0,
  weapon: Event["weapon"] = "rifle",
  sourceSlot?: number,
) {
  if (!w.front?.growthVersion)
    return legacy.frontManualHit(w, e, damage, owner, origin, part, weapon);
  if (!w.front?.players[owner] || e.hp <= 0) return;
  const r = w.front.players[owner],
    s = ledger(w, origin, owner),
    status = stateFor(w, e, owner);
  const fresh = !s.targets.has(e.id),
    detonate = fresh && r.levels.fuse > 0 && status.marked;
  const counter = fresh && r.counterReady && r.evolved.includes("interception");
  if (fresh) {
    s.targets.add(e.id);
    status.lastShot = origin;
    status.hits++;
    r.manualHits++;
    if (r.levels.interceptor > 0) r.charge = 1;
    status.marked = r.levels.fuse > 0 && !detonate;
    if (counter) r.counterReady = false;
  }
  hurtEnemy(w, e, damage, owner, part, weapon);
  if (w.front.growthVersion === 3 && e.hp <= 0) {
    const p = w.players.find((p) => p.id === owner),
      slot = sourceSlot ?? p?.slot;
    if (p && p.hp > 0 && slot !== undefined && p.weapons[slot])
      p.ammo[slot] = Math.min(
        stats(p.weapons[slot]).mag,
        p.ammo[slot] + (r.levels["reserve-rounds"] || 0),
      );
  }
  const compressed =
    fresh &&
    r.levels["compressed-charge"] > 0 &&
    status.hits % (r.levels["compressed-charge"] >= 3 ? 2 : 3) === 0;
  const core = e.hp <= 0 && r.levels["blast-core"] > 0;
  if (
    (core || detonate || compressed) &&
    !s.effected.has(`initial-blast:${e.id}`)
  ) {
    s.effected.add(`initial-blast:${e.id}`);
    blast(
      w,
      e.x,
      eye(e),
      e.z,
      (detonate ? FRONT_BALANCE.fuseDamage : FRONT_BALANCE.coreDamage) *
        (1 +
          0.3 *
            ((detonate
              ? r.levels.fuse
              : core
                ? r.levels["blast-core"]
                : r.levels["compressed-charge"]) -
              1)),
      compressed ? FRONT_BALANCE.compressedRadius : FRONT_BALANCE.radius,
      owner,
      origin,
      detonate ? "fuse" : core ? "core" : "compression",
    );
  }
  if (compressed && (r.levels["fusion-reactor"] || 0) > 0)
    secondaryHit(
      w,
      e,
      20 * r.levels["fusion-reactor"],
      owner,
      origin,
      "reactor-center",
      "blast",
    );
  if (fresh && r.levels.ricochet > 0 && status.hits % 3 === 0) {
    const target = [...w.enemies]
      .filter(
        (t) =>
          t.id !== e.id &&
          t.hp > 0 &&
          Math.hypot(t.x - e.x, t.z - e.z) <= 12 &&
          visible(e, t, mapFor(w).blocks),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z) ||
          a.id - b.id,
      )[0];
    if (
      target &&
      secondaryHit(
        w,
        target,
        FRONT_BALANCE.ricochetDamage * (1 + 0.4 * (r.levels.ricochet - 1)),
        owner,
        origin,
        "ricochet",
        "ricochet",
        { x: e.x, y: eye(e), z: e.z },
      )
    )
      markEffect(w, owner);
  }
  if (
    counter &&
    e.hp > 0 &&
    secondaryHit(
      w,
      e,
      FRONT_BALANCE.interceptDamage * (1 + 0.4 * (r.levels.interceptor - 1)),
      owner,
      origin,
      "counter",
      "interceptor",
    )
  )
    markEffect(w, owner);
  const p = w.players.find((p) => p.id === owner);
  if (p && r.levels["line-shot"] > 0 && s.targets.size >= 3 && !s.refund) {
    s.refund = true;
    const slot = sourceSlot ?? p.slot;
    p.ammo[slot] = Math.min(
      stats(p.weapons[slot]).mag,
      p.ammo[slot] + r.levels["line-shot"],
    );
    markEffect(w, owner);
  }
}
export function frontDodgeEnded(w: World, p: Player) {
  if (!w.front?.growthVersion) return legacy.frontDodgeEnded(w, p);
  const r = w.front?.players[p.id];
  if (!r) return;
  if (r.levels["tactical-reload"] > 0) r.tacticalReady = true;
  if (r.levels["emergency-armor"] > 0)
    r.armorUntil = w.time + 2 + 0.5 * (r.levels["fusion-aegis"] || 0);
  if (r.levels["afterimage-mine"] > 0) {
    const owned = w.front!.mines.filter((mine) => mine.owner === p.id);
    if (owned.length >= 2 + r.levels["afterimage-mine"])
      w.front!.mines = w.front!.mines.filter((mine) => mine.id !== owned[0].id);
    w.front!.mines.push({
      id: ++w.serial,
      owner: p.id,
      x: p.x,
      y: p.y ?? 0,
      z: p.z,
      expires: w.time + 90,
    });
    markEffect(w, p.id);
    event(w, {
      type: "burst",
      x: p.x,
      y: (p.y ?? 0) + 0.1,
      z: p.z,
      radius: 0.8,
      frontEffect: "mine-set",
      owner: p.id,
    });
  }
}
export function frontReloadStarted(w: World, p: Player): number {
  if (!w.front?.growthVersion) return legacy.frontReloadStarted(w, p);
  const r = w.front?.players[p.id];
  if (!r) return 1;
  const factor = r.tacticalReady
    ? FRONT_BALANCE.tacticalReload - 0.1 * (r.levels["tactical-reload"] - 1)
    : 1;
  r.tacticalReady = false;
  if (
    r.levels.interceptor > 0 &&
    r.charge > 0 &&
    p.ammo[p.slot] < stats(p.weapons[p.slot]).mag
  ) {
    r.charge = 0;
    const target = [...w.enemies]
      .filter(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - p.x, e.z - p.z) <= 28 &&
          visible(p, e, mapFor(w).blocks),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z) ||
          a.id - b.id,
      )[0];
    if (target) {
      secondaryHit(
        w,
        target,
        FRONT_BALANCE.interceptDamage * (1 + 0.4 * (r.levels.interceptor - 1)),
        p.id,
        ++w.front!.shotSerial,
        "reload",
        "interceptor",
      );
      markEffect(w, p.id);
    }
  }
  return factor;
}
export function tickFrontEffects(w: World) {
  if (!w.front?.growthVersion) return legacy.tickFrontEffects(w);
  const r = w.front!;
  r.effectsThisTick = 0;
  for (const p of Object.values(r.players))
    for (const id of Object.keys(p.statuses))
      if (!w.enemies.some((e) => e.id === Number(id) && e.hp > 0))
        delete p.statuses[Number(id)];
  r.mines = r.mines.filter((mine) => {
    if (mine.expires <= w.time) return false;
    if (
      !w.enemies.some(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - mine.x, e.z - mine.z) < 2 &&
          visible(mine, e, mapFor(w).blocks),
      )
    )
      return true;
    const owner = r.players[mine.owner];
    if (!owner) return false;
    const origin = ++r.shotSerial;
    blast(
      w,
      mine.x,
      mine.y + 0.3,
      mine.z,
      FRONT_BALANCE.mineDamage *
        (1 + 0.3 * (owner.levels["afterimage-mine"] - 1)),
      FRONT_BALANCE.mineRadius,
      mine.owner,
      origin,
      `mine-${mine.id}`,
    );
    if (owner.levels.interceptor > 0) owner.charge = 1;
    if (owner.evolved.includes("interception")) owner.counterReady = true;
    return false;
  });
}
