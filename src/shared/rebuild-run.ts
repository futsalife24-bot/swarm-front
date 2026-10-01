/** Isolated, replayable solo P1a. Never import this into legacy save/reward flows. */
import { STARTERS, stats, LIMITS, ENEMIES, type Weapon } from "./defs";
import {
  addPlayer,
  blocked,
  createWorld,
  event,
  finish,
  neutral,
  spawn,
  start,
  step,
  type Input,
  type World,
  type Enemy,
} from "./game";
import { mapFor } from "./stages";
import { supportHeight } from "./terrain";
import {
  cleanRebuildEnemyStatus,
  collectRebuildXp,
  createRebuildCombatState,
} from "./rebuild-combat";
import {
  createRebuildUpgradeState,
  grantRebuildUpgradeRights,
  openRebuildUpgradeOffer,
  selectRebuildUpgrade,
  rerollRebuildUpgrade,
  type RebuildUpgradeState,
  type RebuildUpgradeId,
} from "./rebuild-upgrades";

/** Provisional playtest numbers, not product balance. HP does not scale with picks. */
export const REBUILD_RUN_CONFIG = {
  version: "p1a-20261001",
  stage: 1,
  selectionBoundaries: [30, 75, 120, 165, 210, 255, 345] as readonly number[],
  xpThresholds: [12, 36, 66, 100, 144, 192] as readonly number[],
  finalResupply: 345,
  combatTarget: 420,
  hardTimeout: 540,
  timeoutWarning: 480,
  enemyCap: 24,
  bossHp: 7200,
  spawnWarning: 1.5,
  minSpawnDistance: 16,
} as const;
export type RebuildRunPhase =
  "selection" | "combat" | "boss" | "victory" | "defeat";
export interface RebuildRunMetrics {
  thresholdReachedAt: (number | null)[];
  selectedAt: { cardId: RebuildUpgradeId; combatTime: number }[];
  evolutionAt: number | null;
  endedAt: number | null;
  firstEffectAt: number | null;
  initialSelectionTime: number;
  selectionTime: number;
  evolvedCombatTime: number;
  xpAtFinalResupply: number | null;
  picksAtFinalResupply: number | null;
  maxEnemies: number;
  kills: number;
  xpShortfall: number;
}
interface PendingSpawn {
  x: number;
  z: number;
  at: number;
  kinds: Enemy["kind"][];
}
export interface RebuildRun {
  world: World;
  /** Solo-local selection state. Do not spread into World / shared snapshots. */
  upgrades: RebuildUpgradeState;
  phase: RebuildRunPhase;
  status: string;
  metrics: RebuildRunMetrics;
  boundaryIndex: number;
  finalResupplyDone: boolean;
  bossId: number | null;
  nextSpawnAt: number;
  spawnIndex: number;
  pendingSpawns: PendingSpawn[];
  requestSerial: number;
}
export function createRebuildRun(
  options: { runId?: string; seed?: number; playerId?: string } = {},
): RebuildRun {
  const runId = options.runId ?? `p1a-${Date.now()}`;
  const seed = options.seed ?? 4520;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError("P1a requires a uint32 seed");
  const world = createWorld(runId, seed, REBUILD_RUN_CONFIG.stage);
  world.rebuild = createRebuildCombatState();
  const weapons: Weapon[] = [0, 1].map((slot) => ({
    ...STARTERS[0],
    id: `${runId}-temporary-rifle-${slot}`,
  }));
  addPlayer(world, options.playerId ?? "p1a-player", weapons);
  start(world);
  const run: RebuildRun = {
    world,
    upgrades: createRebuildUpgradeState(runId, (seed ^ 0x51f15e) >>> 0),
    phase: "selection",
    status: "最初の強化を選択 · 選択中は戦闘が完全停止",
    metrics: {
      thresholdReachedAt: REBUILD_RUN_CONFIG.xpThresholds.map(() => null),
      selectedAt: [],
      evolutionAt: null,
      endedAt: null,
      firstEffectAt: null,
      initialSelectionTime: 0,
      selectionTime: 0,
      evolvedCombatTime: 0,
      xpAtFinalResupply: null,
      picksAtFinalResupply: null,
      maxEnemies: 0,
      kills: 0,
      xpShortfall: REBUILD_RUN_CONFIG.xpThresholds[5],
    },
    boundaryIndex: 0,
    finalResupplyDone: false,
    bossId: null,
    nextSpawnAt: 0,
    spawnIndex: 0,
    pendingSpawns: [],
    requestSerial: 0,
  };
  return run;
}
function refreshMetrics(run: RebuildRun) {
  const r = run.world.rebuild!;
  run.metrics.firstEffectAt = r.firstEffectAt;
  run.metrics.kills = run.world.totalKills;
  run.metrics.xpShortfall = Math.max(
    0,
    REBUILD_RUN_CONFIG.xpThresholds[5] - r.xp,
  );
  run.metrics.evolvedCombatTime =
    run.metrics.evolutionAt === null
      ? 0
      : Math.max(0, run.world.time - run.metrics.evolutionAt);
  run.metrics.maxEnemies = Math.max(
    run.metrics.maxEnemies,
    run.world.enemies.length,
  );
}
function updateRights(run: RebuildRun) {
  if (run.finalResupplyDone) return;
  let rights = 0;
  REBUILD_RUN_CONFIG.xpThresholds.forEach((threshold, index) => {
    if (run.world.rebuild!.xp >= threshold) {
      rights++;
      run.metrics.thresholdReachedAt[index] ??= run.world.time;
    }
  });
  run.upgrades = grantRebuildUpgradeRights(run.upgrades, rights);
}
function applyUpgrades(run: RebuildRun) {
  const r = run.world.rebuild!,
    p = run.world.players[0];
  const previousHp = r.maxHp;
  r.levels = { ...run.upgrades.levels };
  r.evolved = run.upgrades.evolved;
  r.maxHp = 160 * (1 + 0.05 * r.levels.armor);
  p.hp = Math.min(r.maxHp, p.hp + r.maxHp - previousHp);
  // Fresh temporary objects only, baseline-derived rather than compounding ranks.
  const base = stats(STARTERS[0]);
  p.weapons = p.weapons.map((weapon) => ({
    ...weapon,
    rolls: {
      mag:
        (base.mag +
          Math.max(1, Math.ceil(base.mag * 0.1)) * r.levels.magazine) /
        base.mag,
      reload: 1 - 0.05 * r.levels.reload,
    },
  }));
  if (r.evolved) run.metrics.evolutionAt ??= run.world.time;
}
function openPendingOffer(run: RebuildRun): boolean {
  if (
    run.upgrades.picks >= 7 ||
    run.upgrades.rightsGranted <= run.upgrades.rightsSpent
  )
    return false;
  const result = openRebuildUpgradeOffer(run.upgrades);
  if (!result.ok) return false;
  run.upgrades = result.state;
  run.phase = "selection";
  run.status = run.finalResupplyDone
    ? "最終補給 · 残りの取得権を選択"
    : "補給 · 強化を選択（時間制限なし）";
  return true;
}
function spawnBoss(run: RebuildRun) {
  if (run.bossId !== null) return;
  const w = run.world;
  // The normal schedule reserves capacity; no enemy/shot is removed at a pause.
  const p = w.players[0];
  const point = [{ x: 0, z: p.z > 0 ? -36 : 36 }, ...INGRESS].find(({ x, z }) =>
    safeSpawnPoint(w, "boss", x, z),
  );
  if (!point) return;
  const boss = spawn(w, "boss", point.x, point.z, "crown", 0);
  if (!boss) return;
  boss.hp = boss.maxHp = REBUILD_RUN_CONFIG.bossHp;
  boss.active = true;
  run.bossId = boss.id;
  run.metrics.picksAtFinalResupply = run.upgrades.picks;
  event(w, { type: "burst", radius: 8, x: boss.x, y: boss.y + 2, z: boss.z });
}
function resumeCombat(run: RebuildRun) {
  if (run.finalResupplyDone) {
    spawnBoss(run);
    run.phase = "boss";
    run.status = "最終大型を撃破 · 9:00で任務失敗";
  } else {
    run.phase = "combat";
    run.status = "手動射撃を起点に群れを崩せ";
  }
}
export function chooseRebuildUpgrade(
  run: RebuildRun,
  cardId: RebuildUpgradeId,
): boolean {
  const offer = run.upgrades.offer;
  if (run.phase !== "selection" || !offer) return false;
  const result = selectRebuildUpgrade(run.upgrades, {
    runId: run.world.run,
    offerId: offer.id,
    revision: offer.revision,
    requestId: `${run.world.run}:choose:${++run.requestSerial}`,
    cardId,
  });
  if (!result.ok) return false;
  run.upgrades = result.state;
  applyUpgrades(run);
  run.metrics.selectedAt.push({ cardId, combatTime: run.world.time });
  if (!openPendingOffer(run)) resumeCombat(run);
  refreshMetrics(run);
  return true;
}
export function rerollRebuildRunOffer(run: RebuildRun): boolean {
  const offer = run.upgrades.offer;
  if (run.phase !== "selection" || !offer) return false;
  const result = rerollRebuildUpgrade(run.upgrades, {
    runId: run.world.run,
    offerId: offer.id,
    revision: offer.revision,
    requestId: `${run.world.run}:reroll:${++run.requestSerial}`,
  });
  if (!result.ok) return false;
  run.upgrades = result.state;
  return true;
}
function resupply(run: RebuildRun, at: number) {
  collectRebuildXp(run.world, true);
  updateRights(run);
  run.boundaryIndex++;
  if (at === REBUILD_RUN_CONFIG.finalResupply) {
    run.metrics.xpAtFinalResupply = run.world.rebuild!.xp;
    run.finalResupplyDone = true;
    // No combat tick, XP earning, or projectile advancement between final
    // collection/rights issuance and the boss following the last selection.
    run.pendingSpawns = [];
  }
  if (!openPendingOffer(run) && run.finalResupplyDone) resumeCombat(run);
}
const INGRESS = [
  { x: 0, z: 0 },
  { x: -22, z: 36 },
  { x: 22, z: 36 },
  { x: 0, z: 68 },
  { x: 0, z: -56 },
];
/** Match spawn's no-relocation check, then verify the supported body position. */
function safeSpawnPoint(w: World, kind: Enemy["kind"], x: number, z: number) {
  const p = w.players[0],
    blocks = mapFor(w).blocks;
  const { radius, cruise } = ENEMIES[kind];
  const y = supportHeight(x, z, blocks) + cruise;
  return (
    Math.hypot(x - p.x, z - p.z) >= REBUILD_RUN_CONFIG.minSpawnDistance &&
    // Shared spawn() tests cruise height before it derives support height. Reject
    // that fallback path rather than teleporting an enemy away from its warning.
    !blocked(x, z, radius, cruise, blocks) &&
    !blocked(x, z, radius, y, blocks)
  );
}
function scheduleEnemies(run: RebuildRun) {
  const w = run.world;
  const cap = Math.min(REBUILD_RUN_CONFIG.enemyCap, LIMITS.enemies - 1);
  run.pendingSpawns = run.pendingSpawns.filter((pending) => {
    if (pending.at > w.time) return true;
    for (
      let index = 0;
      index < pending.kinds.length && w.enemies.length < cap;
      index++
    ) {
      const x = pending.x + index * 2.7,
        z = pending.z;
      const kind = pending.kinds[index];
      if (!safeSpawnPoint(w, kind, x, z)) continue;
      const e = spawn(w, kind, x, z, "crown", run.spawnIndex++);
      if (e) {
        e.active = true;
        w.spawned++;
      }
    }
    return false;
  });
  if (
    w.time < run.nextSpawnAt ||
    w.enemies.length + run.pendingSpawns.length * 2 >= cap
  )
    return;
  run.nextSpawnAt =
    w.time +
    (run.finalResupplyDone ? 7 : w.time < 90 ? 4 : w.time < 210 ? 3.5 : 3);
  const secondary: Enemy["kind"] =
    w.time >= 120 && run.spawnIndex % 6 === 0
      ? "spitter"
      : w.time >= 210 && run.spawnIndex % 8 === 0
        ? "hornet"
        : "crawler";
  const kinds: Enemy["kind"][] = ["crawler", secondary];
  const candidates = INGRESS.filter((point) =>
    kinds.every((kind, index) =>
      safeSpawnPoint(w, kind, point.x + index * 2.7, point.z),
    ),
  );
  if (!candidates.length) return;
  const point = candidates[run.spawnIndex % candidates.length];
  run.pendingSpawns.push({
    ...point,
    at: w.time + REBUILD_RUN_CONFIG.spawnWarning,
    kinds,
  });
  for (let index = 0; index < kinds.length; index++) {
    const x = point.x + index * 2.7,
      z = point.z;
    event(w, {
      type: "burst",
      radius: 2,
      x,
      y: supportHeight(x, z, mapFor(w).blocks) + 0.1,
      z,
    });
  }
}
function conclude(run: RebuildRun, win: boolean, reason: string) {
  finish(run.world, win, reason);
  run.phase = win ? "victory" : "defeat";
  run.status = reason;
  run.metrics.endedAt = run.world.time;
  refreshMetrics(run);
}
export function stepRebuildRun(
  run: RebuildRun,
  input: Input = neutral(),
  dt = 0.05,
): RebuildRun {
  if (!Number.isFinite(dt) || dt <= 0) return run;
  if (run.phase === "victory" || run.phase === "defeat") return run;
  if (run.phase === "selection") {
    run.metrics.selectionTime += dt;
    if (run.upgrades.picks === 0) run.metrics.initialSelectionTime += dt;
    return run;
  }
  const w = run.world;
  const boundary = REBUILD_RUN_CONFIG.selectionBoundaries[run.boundaryIndex];
  if (boundary !== undefined && w.time >= boundary - 1e-8) {
    w.time = boundary;
    resupply(run, boundary);
    refreshMetrics(run);
    return run;
  }
  if (w.time >= REBUILD_RUN_CONFIG.hardTimeout - 1e-8) {
    w.time = REBUILD_RUN_CONFIG.hardTimeout;
    conclude(run, false, "作戦時間の上限（9分）に達しました");
    return run;
  }
  scheduleEnemies(run);
  const elapsed = Math.min(
    0.1,
    dt,
    (boundary ?? Infinity) - w.time,
    REBUILD_RUN_CONFIG.hardTimeout - w.time,
  );
  step(w, { [w.players[0].id]: input }, elapsed);
  collectRebuildXp(w);
  updateRights(run);
  cleanRebuildEnemyStatus(w);
  refreshMetrics(run);
  if (w.players[0].hp <= 0 || w.phase === "defeat") {
    conclude(run, false, "兵士が倒れました");
  } else if (
    run.bossId !== null &&
    !w.enemies.some((e) => e.id === run.bossId && e.hp > 0)
  ) {
    collectRebuildXp(w, true);
    conclude(run, true, "最終大型撃破 · 試作報酬なし");
  } else if (w.time >= REBUILD_RUN_CONFIG.hardTimeout - 1e-8) {
    w.time = REBUILD_RUN_CONFIG.hardTimeout;
    conclude(run, false, "作戦時間の上限（9分）に達しました");
  } else if (boundary !== undefined && w.time >= boundary - 1e-8) {
    w.time = boundary;
    resupply(run, boundary);
    refreshMetrics(run);
  } else if (w.time >= REBUILD_RUN_CONFIG.timeoutWarning) {
    run.status = `時間切れまで ${Math.ceil(REBUILD_RUN_CONFIG.hardTimeout - w.time)}秒`;
  }
  return run;
}
export function getRebuildRunView(run: RebuildRun) {
  const w = run.world,
    r = w.rebuild!,
    boss = w.enemies.find((e) => e.id === run.bossId);
  return {
    phase: run.phase,
    status: run.status,
    combatTime: w.time,
    xp: r.xp,
    nextXpThreshold: run.finalResupplyDone
      ? null
      : (REBUILD_RUN_CONFIG.xpThresholds[run.upgrades.rightsGranted] ?? null),
    rightsPending: run.upgrades.rightsGranted - run.upgrades.rightsSpent,
    picks: run.upgrades.picks,
    evolved: r.evolved,
    maxChain: r.maxChain,
    lastChain: r.lastChain,
    lastChainAt: r.lastChainAt,
    maxHp: r.maxHp,
    bossId: run.bossId,
    bossHp: boss?.hp ?? null,
    bossMaxHp: boss?.maxHp ?? null,
    timeoutRemaining: Math.max(0, REBUILD_RUN_CONFIG.hardTimeout - w.time),
    selectionTime: run.metrics.selectionTime,
    metrics: run.metrics,
  };
}
