/** Temporary P1a combat only. No inventory, save, loot or progression writes. */
import {
  event,
  eye,
  hurtEnemy,
  visible,
  type Enemy,
  type Event,
  type World,
} from "./game";
import { mapFor } from "./stages";
import type { RebuildUpgradeId } from "./rebuild-upgrades";

export const REBUILD_COMBAT_BALANCE = {
  coreDamage: 42,
  fuseDamage: 34,
  compressionDamage: 42,
  radius: 5.5,
  compressedRadius: 7.5,
  chainDepth: 2,
  effectBudget: 120,
  pickupRadius: 5,
  maxOrbs: 160,
} as const;

export interface RebuildAttribution {
  originId: number;
  source: "manual" | "blast-core" | "fuse" | "compressed-charge" | "chain";
  depth: number;
  targetId?: number;
}
export interface RebuildEnemyStatus {
  marked: boolean;
  manualHits: number;
  lastShot: number;
  lastExplosionShot?: number;
}
export interface RebuildXpOrb {
  id: number;
  x: number;
  y: number;
  z: number;
  value: number;
}
/** Public renderer-safe data. Offer IDs, offer seeds and offer RNG do not live here. */
export interface RebuildCombatState {
  version: "p1a";
  levels: Record<RebuildUpgradeId, number>;
  evolved: boolean;
  maxHp: number;
  xp: number;
  xpOrbs: RebuildXpOrb[];
  enemyStatus: Record<number, RebuildEnemyStatus>;
  shotSerial: number;
  maxChain: number;
  lastChain: number;
  lastChainAt: number | null;
  manualHits: number;
  explosions: number;
  secondaryKills: number;
  firstEffectAt: number | null;
  effectBudgetExhaustions: number;
}
export function createRebuildCombatState(): RebuildCombatState {
  return {
    version: "p1a",
    levels: {
      "blast-core": 0,
      fuse: 0,
      "compressed-charge": 0,
      armor: 0,
      reload: 0,
      magazine: 0,
    },
    evolved: false,
    maxHp: 160,
    xp: 0,
    xpOrbs: [],
    enemyStatus: {},
    shotSerial: 0,
    maxChain: 0,
    lastChain: 0,
    lastChainAt: null,
    manualHits: 0,
    explosions: 0,
    secondaryKills: 0,
    firstEffectAt: null,
    effectBudgetExhaustions: 0,
  };
}
export function recordRebuildKill(
  w: World,
  e: Enemy,
  origin?: RebuildAttribution,
) {
  const r = w.rebuild;
  if (!r) return;
  if (origin && origin.source !== "manual") r.secondaryKills++;
  const value =
    e.kind === "boss" || e.kind === "harrow"
      ? 20
      : e.kind === "spitter"
        ? 3
        : 2;
  // Cap visual/pickup records without throwing away earned XP.
  if (r.xpOrbs.length >= REBUILD_COMBAT_BALANCE.maxOrbs) {
    const nearest = r.xpOrbs.reduce((a, b) =>
      Math.hypot(a.x - e.x, a.z - e.z) < Math.hypot(b.x - e.x, b.z - e.z)
        ? a
        : b,
    );
    nearest.value += value;
  } else {
    r.xpOrbs.push({ id: ++w.serial, x: e.x, y: e.y, z: e.z, value });
  }
}
export function collectRebuildXp(w: World, all = false): number {
  const r = w.rebuild,
    p = w.players[0];
  if (!r || !p || p.hp <= 0) return 0;
  let collected = 0;
  r.xpOrbs = r.xpOrbs.filter((orb) => {
    if (
      !all &&
      Math.hypot(orb.x - p.x, orb.z - p.z) > REBUILD_COMBAT_BALANCE.pickupRadius
    )
      return true;
    collected += orb.value;
    return false;
  });
  r.xp += collected;
  return collected;
}
function status(w: World, e: Enemy) {
  return (w.rebuild!.enemyStatus[e.id] ??= {
    marked: false,
    manualHits: 0,
    lastShot: -1,
  });
}
/** One call per hitscan impact. A shared shot ID dedupes pellets/body parts. */
export function rebuildManualHit(
  w: World,
  e: Enemy,
  damage: number,
  owner: string,
  shotId: number,
  part = 0,
  weapon: Event["weapon"] = "rifle",
) {
  const r = w.rebuild;
  if (!r) {
    hurtEnemy(w, e, damage, owner, part, weapon);
    return;
  }
  if (e.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return;
  const ledger = originLedger(r, shotId, w.enemies);
  const s = status(w, e),
    fresh = !ledger.manualTargets.has(e.id);
  const detonate = fresh && r.levels.fuse > 0 && s.marked;
  if (fresh) {
    ledger.manualTargets.add(e.id);
    s.lastShot = shotId;
    s.manualHits++;
    r.manualHits++;
    if (r.levels.fuse > 0) s.marked = !detonate;
  }
  const compressed =
    fresh && r.levels["compressed-charge"] > 0 && s.manualHits % 3 === 0;
  hurtEnemy(w, e, damage, owner, part, weapon, {
    originId: shotId,
    source: "manual",
    depth: 0,
    targetId: e.id,
  });
  // Physical pellets still deal damage, but one trigger advances these effects once.
  const core = e.hp <= 0 && r.levels["blast-core"] > 0;
  if (s.lastExplosionShot === shotId || (!core && !detonate && !compressed))
    return;
  s.lastExplosionShot = shotId;
  const source = detonate ? "fuse" : core ? "blast-core" : "compressed-charge";
  const amount = Math.max(
    core ? REBUILD_COMBAT_BALANCE.coreDamage : 0,
    detonate ? REBUILD_COMBAT_BALANCE.fuseDamage : 0,
    compressed ? REBUILD_COMBAT_BALANCE.compressionDamage : 0,
  );
  detonateRebuildChain(
    w,
    e,
    owner,
    shotId,
    amount,
    compressed
      ? REBUILD_COMBAT_BALANCE.compressedRadius
      : REBUILD_COMBAT_BALANCE.radius,
    source,
    core,
    detonate && r.evolved,
  );
}
interface OriginLedger {
  manualTargets: Set<number>;
  eligibleMarks: Set<number>;
  damaged: Set<number>;
  detonated: Set<number>;
  budget: number;
  chain: number;
}
// Hitscan origins finish synchronously; retain a small dedupe window for repeat
// adapters without exposing runtime processing sets through shared snapshots.
const originLedgers = new WeakMap<
  RebuildCombatState,
  Map<number, OriginLedger>
>();
function originLedger(
  r: RebuildCombatState,
  id: number,
  enemies: readonly Enemy[],
): OriginLedger {
  let ledgers = originLedgers.get(r);
  if (!ledgers) {
    ledgers = new Map();
    originLedgers.set(r, ledgers);
  }
  let ledger = ledgers.get(id);
  if (!ledger) {
    ledger = {
      manualTargets: new Set(),
      eligibleMarks: new Set(
        enemies
          .filter((e) => e.hp > 0 && r.enemyStatus[e.id]?.marked)
          .map((e) => e.id),
      ),
      damaged: new Set(),
      detonated: new Set(),
      budget: REBUILD_COMBAT_BALANCE.effectBudget,
      chain: 0,
    };
    ledgers.set(id, ledger);
    if (ledgers.size > 32) ledgers.delete(ledgers.keys().next().value!);
  }
  return ledger;
}
function detonateRebuildChain(
  w: World,
  root: Enemy,
  owner: string,
  originId: number,
  damage: number,
  radius: number,
  source: RebuildAttribution["source"],
  mark: boolean,
  propagate: boolean,
) {
  const r = w.rebuild!;
  // Only marks already present at this manual origin can propagate. Core's new
  // marks await a later manual hit; an explosion can never become manual damage.
  const ledger = originLedger(r, originId, w.enemies);
  const eligible = ledger.eligibleMarks;
  const { detonated, damaged } = ledger;
  if (detonated.has(root.id)) return;
  detonated.add(root.id);
  const queue = [{ enemy: root, depth: 0 }];
  let processed = 0;
  let exhausted = false;
  for (let index = 0; index < queue.length && ledger.budget > 0; index++) {
    const { enemy: center, depth } = queue[index];
    ledger.budget--;
    ledger.chain++;
    processed++;
    r.explosions++;
    r.firstEffectAt ??= w.time;
    event(w, {
      type: "burst",
      weapon: "rifle",
      radius,
      x: center.x,
      y: eye(center),
      z: center.z,
      owner,
      rebuild: {
        originId,
        source: depth ? "chain" : source,
        depth,
        targetId: center.id,
      },
    });
    const nearby = w.enemies.filter(
      (e) =>
        e.hp > 0 &&
        Math.hypot(e.x - center.x, eye(e) - eye(center), e.z - center.z) <=
          radius &&
        visible(center, e, mapFor(w).blocks),
    );
    // Queue and consume marks before damage, so a marked enemy killed by the
    // initial burst still relays its already-authorized detonation exactly once.
    if (propagate && depth < REBUILD_COMBAT_BALANCE.chainDepth)
      for (const target of nearby) {
        if (!eligible.has(target.id) || detonated.has(target.id)) continue;
        detonated.add(target.id);
        status(w, target).marked = false;
        queue.push({ enemy: target, depth: depth + 1 });
      }
    for (const target of nearby) {
      if (mark && r.levels.fuse > 0 && !detonated.has(target.id))
        status(w, target).marked = true;
      if (damaged.has(target.id)) continue;
      if (ledger.budget <= 0) {
        exhausted = true;
        break;
      }
      ledger.budget--;
      damaged.add(target.id);
      hurtEnemy(w, target, damage, owner, 0, "rifle", {
        originId,
        source: depth ? "chain" : source,
        depth,
        targetId: target.id,
      });
    }
  }
  if (exhausted || (ledger.budget <= 0 && queue.length > processed))
    r.effectBudgetExhaustions++;
  r.lastChain = ledger.chain;
  r.lastChainAt = w.time;
  r.maxChain = Math.max(r.maxChain, ledger.chain);
}
export function cleanRebuildEnemyStatus(w: World) {
  if (!w.rebuild) return;
  const alive = new Set(w.enemies.map((e) => String(e.id)));
  for (const key of Object.keys(w.rebuild.enemyStatus))
    if (!alive.has(key)) delete w.rebuild.enemyStatus[Number(key)];
}
