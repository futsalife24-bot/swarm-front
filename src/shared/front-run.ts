import { frontAutomaticRequestId } from "./front-request-id";
import * as legacy from "./front-legacy-run";
/** 改装版の権威状態。候補・乱数・要求履歴は World に載せない。 */
import {
  STARTERS,
  WEAPONS,
  stats,
  validBattleWeapon,
  ENEMIES,
  type Weapon,
} from "./defs";
import {
  addPlayer,
  blocked,
  createWorld,
  event,
  finish,
  spawn,
  start,
  step,
  type World,
  type Input,
  type Enemy,
} from "./game";
import { mapFor } from "./stages";
import { supportHeight } from "./terrain";
import {
  createFrontBattleState,
  addFrontCombatPlayer,
  collectFrontXp,
  FRONT_BALANCE,
} from "./front-combat";
import {
  createFrontUpgradeState,
  grantFrontUpgradeRights,
  openFrontUpgradeOffer,
  selectFrontUpgrade,
  rerollFrontUpgrade,
  canRerollFrontUpgrade,
  getEligibleFrontUpgrades,
  FRONT_INITIAL_CARDS,
  FRONT_MAX_PICKS,
  FRONT_BASE_IDS,
  frontPickLimit,
  frontEffectiveLevels,
  type FrontUpgradeState,
  type FrontUpgradeId,
  type FrontUpgradeSelection,
  type FrontUpgradeRequest,
} from "./front-upgrades";

export type FrontWeaponKind = "rifle" | "shotgun" | "smg";
export type FrontMode = "survival" | "defense" | "daily";
export const FRONT_RUN_CONFIG = {
  selectionBoundaries: [345] as readonly number[],
  xpThresholds: [
    12, 36, 80, 150, 240, 360, 510, 690, 900, 1140, 1410,
  ] as readonly number[],
  finalResupply: 345,
  hardTimeout: 540,
  timeoutWarning: 480,
  enemyCap: FRONT_BALANCE.enemyCap,
  spawnMultiplier: 4,
  normalHpMultiplier: 1 / 2,
  bossHp: 7200,
  spawnWarning: 1.5,
  minSpawnDistance: 16,
  selectionSeconds: 15,
  resumeSeconds: 0.2,
} as const;
export interface FrontRunOptions {
  runId: string;
  seed: number;
  mode?: FrontMode;
  day?: string;
  fusion?: boolean;
  /** 協力部屋の掃除より前に帰還するサーバー時刻（秒）。 */
  returnAt?: number;
  players: {
    id: string;
    weapons?: readonly FrontWeaponKind[];
    initialCards?: readonly FrontUpgradeId[];
    pool?: readonly FrontUpgradeId[];
    equipment?: readonly Weapon[];
  }[];
}
export interface FrontRun {
  world: World;
  fusion?: true;
  returnAt?: number;
  originalEquipment?: Record<string, Weapon[]>;
  upgrades: Record<string, FrontUpgradeState>;
  phase: "selection" | "combat" | "boss" | "victory" | "defeat";
  mode: FrontMode;
  day: string;
  boundaryIndex: number;
  finalResupplyDone: boolean;
  bossId: number | null;
  selectionDeadline: number | null;
  resumeUntil: number;
  nextSpawnAt: number;
  spawnIndex: number;
  pendingSpawns: { x: number; z: number; at: number; kinds: Enemy["kind"][] }[];
  pendingBoss: { x: number; z: number; at: number } | null;
  metrics: {
    thresholdReachedAt: (number | null)[];
    selectedAt: {
      playerId: string;
      cardId: FrontUpgradeId;
      combatTime: number;
      automatic: boolean;
    }[];
    endedAt: number | null;
    maxEnemies: number;
    xpAtFinalResupply: number | null;
  };
}
export function frontDailySeed(day: string): number {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(day).toISOString().slice(0, 10) !== day
  )
    throw new RangeError("日付が不正です");
  return [...day].reduce(
    (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
}
export function frontTemporaryWeapons(
  runId: string,
  owner: string,
  kinds: readonly FrontWeaponKind[] = ["rifle", "shotgun"],
): Weapon[] {
  if (
    kinds.length !== 2 ||
    kinds.some((kind) => !["rifle", "shotgun", "smg"].includes(kind)) ||
    kinds[0] === kinds[1]
  )
    throw new RangeError("異なる支給武器を2つ選んでください");
  return kinds.map((kind, slot) => ({
    ...STARTERS[0],
    kind,
    id: `${runId}-${owner}-${slot}`,
    rolls: undefined,
  }));
}
export function createFrontRun(options: FrontRunOptions, now = 0): FrontRun {
  if (
    !Number.isFinite(now) ||
    !Number.isInteger(options.seed) ||
    options.seed < 0 ||
    options.seed > 0xffffffff ||
    options.players.length < 1 ||
    options.players.length > 4 ||
    new Set(options.players.map((p) => p.id)).size !== options.players.length ||
    (options.fusion &&
      options.players.some(
        (p) =>
          p.equipment &&
          (p.equipment.length !== 2 ||
            !p.equipment.every(validBattleWeapon) ||
            p.equipment[0].id === p.equipment[1].id),
      )) ||
    options.players.some(
      (p) =>
        !p.id ||
        p.id.length > 80 ||
        ["__proto__", "constructor", "prototype"].includes(p.id),
    )
  )
    throw new RangeError("作戦設定が不正です");
  const mode = options.mode ?? "survival",
    day = options.day ?? new Date().toISOString().slice(0, 10);
  if (!["survival", "defense", "daily"].includes(mode))
    throw new RangeError("作戦の種類が不正です");
  const seed = mode === "daily" ? frontDailySeed(day) : options.seed;
  const world = createWorld(
    options.runId,
    seed,
    mode === "daily" ? (seed % 3) + 1 : 1,
  );
  world.front = createFrontBattleState();
  if (options.fusion) world.front.growthVersion = 3;
  const upgrades: Record<string, FrontUpgradeState> = {};
  options.players.forEach((member, index) => {
    const p = addPlayer(
      world,
      member.id,
      options.fusion && member.equipment
        ? structuredClone([...member.equipment])
        : frontTemporaryWeapons(options.runId, member.id, member.weapons),
    );
    Object.assign(p, { x: (index - 1.5) * 2, z: 8, y: 0 });
    addFrontCombatPlayer(world, p.id);
    upgrades[p.id] = createFrontUpgradeState(
      options.runId,
      (seed ^ Math.imul(index + 1, 0x51f15e)) >>> 0,
      mode === "daily" && !options.fusion
        ? FRONT_INITIAL_CARDS
        : (member.initialCards ?? FRONT_INITIAL_CARDS),
      options.fusion ? (member.pool ?? FRONT_BASE_IDS) : undefined,
    );
  });
  if (mode !== "survival") {
    const holder = { ...world, players: [], pending: {}, rewards: {} };
    const armory = addPlayer(holder, "front-armory", []);
    Object.assign(armory, { x: 0, z: 0, y: 0, hp: 2000 });
    world.defense = { day, armory, maxHp: 2000, duration: 540, nextSpawn: 0 };
  }
  start(world);
  return {
    world,
    ...(options.fusion &&
    mode === "survival" &&
    Number.isFinite(options.returnAt)
      ? { returnAt: options.returnAt }
      : {}),
    ...(options.fusion
      ? {
          fusion: true as const,
          originalEquipment: Object.fromEntries(
            world.players.map((p) => [p.id, structuredClone(p.weapons)]),
          ),
        }
      : {}),
    upgrades,
    phase: "selection",
    mode,
    day,
    boundaryIndex: 0,
    finalResupplyDone: false,
    bossId: null,
    selectionDeadline: options.players.length > 1 ? now + 15 : null,
    resumeUntil: 0,
    nextSpawnAt: 0,
    spawnIndex: 0,
    pendingSpawns: [],
    pendingBoss: null,
    metrics: {
      thresholdReachedAt: FRONT_RUN_CONFIG.xpThresholds.map(() => null),
      selectedAt: [],
      endedAt: null,
      maxEnemies: 0,
      xpAtFinalResupply: null,
    },
  };
}
function applyBuild(run: FrontRun, id: string) {
  const w = run.world,
    r = w.front!.players[id],
    p = w.players.find((p) => p.id === id)!;
  const previous = r.maxHp;
  r.levels = run.fusion
    ? frontEffectiveLevels(run.upgrades[id].levels)
    : { ...run.upgrades[id].levels };
  if (run.fusion)
    r.evolved = (["explosion", "piercing", "interception"] as const).filter(
      (_, i) =>
        run.upgrades[id].levels[
          (["fusion-collapse", "fusion-skewer", "fusion-counter"] as const)[i]
        ] > 0,
    );
  // 進化は精鋭撃破時に戦闘状態へ確定する。取得だけでは発動しない。
  r.maxHp = 160 * (1 + 0.05 * r.levels.armor);
  if (p.hp > 0) p.hp = Math.min(r.maxHp, p.hp + r.maxHp - previous);
  p.weapons = (run.originalEquipment?.[id] ?? p.weapons).map((weapon) => {
    if (!run.fusion)
      return {
        ...weapon,
        rolls: {
          ...weapon.rolls,
          mag:
            (WEAPONS[weapon.kind].mag +
              Math.max(1, Math.ceil(WEAPONS[weapon.kind].mag * 0.1)) *
                r.levels.magazine) /
            WEAPONS[weapon.kind].mag,
          reload: 1 - 0.05 * r.levels.reload,
        },
      };
    const base = run.fusion ? stats(weapon) : WEAPONS[weapon.kind];
    return {
      id: weapon.id,
      kind: weapon.kind,
      rarity: weapon.rarity,
      power: base.damage / WEAPONS[weapon.kind].damage,
      effect: weapon.effect,
      rolls: {
        mag:
          (base.mag +
            Math.max(1, Math.ceil(base.mag * 0.1)) * r.levels.magazine) /
          WEAPONS[weapon.kind].mag,
        reload:
          ((base.reload / WEAPONS[weapon.kind].reload) *
            (1 - 0.05 * r.levels.reload)) /
          (weapon.effect === "quick" ? 0.8 : 1),
        range: base.range / WEAPONS[weapon.kind].range,
        rate: WEAPONS[weapon.kind].interval / base.interval,
      },
    };
  });
  p.ammo = p.ammo.map((ammo, slot) =>
    Math.min(ammo, stats(p.weapons[slot]).mag),
  );
}
function openOwed(run: FrontRun, id: string) {
  const s = run.upgrades[id];
  if (
    s.offer ||
    s.rightsSpent >= s.rightsGranted ||
    s.picks >= frontPickLimit(s)
  )
    return;
  const result = openFrontUpgradeOffer(s);
  if (result.ok) run.upgrades[id] = result.state;
}
function resume(run: FrontRun, now: number) {
  run.phase = run.finalResupplyDone ? "boss" : "combat";
  run.selectionDeadline = null;
  run.resumeUntil = now + FRONT_RUN_CONFIG.resumeSeconds;
}
export function chooseFrontUpgrade(
  run: FrontRun,
  id: string,
  request: FrontUpgradeSelection,
  now = 0,
  automatic = false,
): boolean {
  if (!run.world.front?.growthVersion)
    return legacy.chooseFrontUpgrade(
      run as unknown as legacy.FrontRun,
      id,
      request as Parameters<typeof legacy.chooseFrontUpgrade>[2],
      now,
      automatic,
    );
  if (
    run.phase !== "selection" ||
    !run.upgrades[id] ||
    !Number.isFinite(now) ||
    (!automatic &&
      run.selectionDeadline !== null &&
      now >= run.selectionDeadline)
  )
    return false;
  const result = selectFrontUpgrade(run.upgrades[id], request);
  if (!result.ok) return false;
  run.upgrades[id] = result.state;
  applyBuild(run, id);
  run.metrics.selectedAt.push({
    playerId: id,
    cardId: request.cardId,
    combatTime: run.world.time,
    automatic,
  });
  openOwed(run, id);
  if (Object.values(run.upgrades).every((s) => s.offer === null))
    resume(run, now);
  return true;
}
export function rerollFrontRunOffer(
  run: FrontRun,
  id: string,
  request: FrontUpgradeRequest,
  now = 0,
): boolean {
  if (!run.world.front?.growthVersion)
    return legacy.rerollFrontRunOffer(
      run as unknown as legacy.FrontRun,
      id,
      request,
      now,
    );
  if (
    run.phase !== "selection" ||
    !run.upgrades[id] ||
    !Number.isFinite(now) ||
    (run.selectionDeadline !== null && now >= run.selectionDeadline)
  )
    return false;
  const result = rerollFrontUpgrade(run.upgrades[id], request);
  if (!result.ok) return false;
  run.upgrades[id] = result.state;
  return true;
}
export const frontSurvivalThreshold = (n: number) => 12 + n * 24 + n * n * 8;
function updateRights(run: FrontRun) {
  let count = 0;
  (run.fusion
    ? Array.from({ length: 119 }, (_, i) => frontSurvivalThreshold(i))
    : FRONT_RUN_CONFIG.xpThresholds
  ).forEach((threshold, index) => {
    if (run.world.front!.xp >= threshold) {
      count++;
      run.metrics.thresholdReachedAt[index] ??= run.world.time;
    }
  });
  for (const id of Object.keys(run.upgrades))
    run.upgrades[id] = grantFrontUpgradeRights(run.upgrades[id], count);
}
function resupply(run: FrontRun, at: number, now: number) {
  collectFrontXp(run.world, true);
  updateRights(run);
  run.boundaryIndex++;
  if (at === 345) {
    run.metrics.xpAtFinalResupply = run.world.front!.xp;
    run.finalResupplyDone = true;
    run.pendingSpawns = [];
  }
  Object.keys(run.upgrades).forEach((id) => openOwed(run, id));
  if (Object.values(run.upgrades).some((s) => s.offer)) {
    run.phase = "selection";
    run.selectionDeadline = run.world.players.length > 1 ? now + 15 : null;
  } else if (run.finalResupplyDone) resume(run, now);
}
const INGRESS = [
  { x: -34, z: -34 },
  { x: 34, z: -34 },
  { x: -34, z: 34 },
  { x: 34, z: 34 },
  { x: 0, z: -38 },
  { x: 0, z: 38 },
];
function safePoint(w: World, kind: Enemy["kind"], x: number, z: number) {
  const blocks = mapFor(w).blocks,
    { radius, cruise } = ENEMIES[kind];
  return (
    w.players
      .filter((p) => p.hp > 0 && p.connected)
      .every((p) => Math.hypot(x - p.x, z - p.z) >= 16) &&
    !blocked(x, z, radius, cruise, blocks) &&
    !blocked(x, z, radius, supportHeight(x, z, blocks) + cruise, blocks)
  );
}
function schedule(run: FrontRun) {
  const w = run.world;
  const enemyCap = w.front!.enemyCap ?? 24;
  run.pendingSpawns = run.pendingSpawns.filter((pending) => {
    if (pending.at > w.time) return true;
    pending.kinds.forEach((kind, index) => {
      const x = pending.x + index * 2.7;
      if (w.enemies.length >= enemyCap || !safePoint(w, kind, x, pending.z))
        return;
      const e = spawn(w, kind, x, pending.z, "crown", run.spawnIndex++);
      if (e) {
        e.hp *=
          FRONT_RUN_CONFIG.normalHpMultiplier *
          (run.fusion ? 1 + Math.floor(w.time / 180) * 0.35 : 1);
        e.maxHp = e.hp;
        e.active = true;
        w.spawned++;
      }
    });
    return false;
  });
  if (
    w.time < run.nextSpawnAt ||
    w.enemies.length +
      run.pendingSpawns.reduce((sum, p) => sum + p.kinds.length, 0) >=
      enemyCap
  )
    return;
  run.nextSpawnAt =
    w.time +
    (run.finalResupplyDone ? 7 : w.time < 90 ? 4 : w.time < 210 ? 3.5 : 3) /
      FRONT_RUN_CONFIG.spawnMultiplier;
  const kinds: Enemy["kind"][] = [
    "crawler",
    w.time >= 120 && run.spawnIndex % 6 === 0
      ? "spitter"
      : w.time >= 210 && run.spawnIndex % 8 === 0
        ? "hornet"
        : "crawler",
  ];
  const ingress =
    run.mode === "daily"
      ? [INGRESS[frontDailySeed(run.day) % INGRESS.length]]
      : INGRESS;
  const candidates = ingress.filter((point) =>
    kinds.every((kind, index) =>
      safePoint(w, kind, point.x + index * 2.7, point.z),
    ),
  );
  if (!candidates.length) return;
  const point = candidates[run.spawnIndex % candidates.length];
  run.pendingSpawns.push({ ...point, at: w.time + 1.5, kinds });
  kinds.forEach((_, index) =>
    event(w, {
      type: "burst",
      radius: 2,
      x: point.x + index * 2.7,
      y: 0.1,
      z: point.z,
    }),
  );
}
function spawnBoss(run: FrontRun) {
  if (run.bossId !== null) return;
  if (!run.pendingBoss) {
    const point = INGRESS.find((p) => safePoint(run.world, "boss", p.x, p.z));
    if (!point) return;
    run.pendingBoss = { ...point, at: run.world.time + 1.5 };
    return;
  }
  if (run.world.time < run.pendingBoss.at) return;
  const point = run.pendingBoss;
  if (!safePoint(run.world, "boss", point.x, point.z)) {
    run.pendingBoss = null;
    return;
  }
  const boss = spawn(run.world, "boss", point.x, point.z, "crown", 0);
  if (!boss) return;
  boss.hp = boss.maxHp = 7200 * run.world.scale;
  boss.active = true;
  run.bossId = boss.id;
  run.pendingBoss = null;
  event(run.world, {
    type: "burst",
    radius: 8,
    x: boss.x,
    y: boss.y + 2,
    z: boss.z,
  });
}
function conclude(run: FrontRun, win: boolean, reason: string) {
  finish(run.world, win, reason);
  run.phase = win ? "victory" : "defeat";
  run.metrics.endedAt = run.world.time;
}
/** ソロの生存戦だけ、1分以降に任意帰還できる。協力戦は全滅まで継続。 */
export function returnFrontRun(run: FrontRun): boolean {
  if (
    !run.fusion ||
    run.mode !== "survival" ||
    run.world.players.length !== 1 ||
    run.world.time < 60 ||
    (run.phase !== "combat" && run.phase !== "boss")
  )
    return false;
  conclude(run, true, "生存作戦から帰還しました");
  return true;
}
/** now は単調な秒。協力では切断・停止後も同じ期限を保持する。 */
export function stepFrontRun(
  run: FrontRun,
  inputs: Record<string, Input> = {},
  dt = 0.05,
  now = 0,
): FrontRun {
  if (!run.world.front?.growthVersion)
    return legacy.stepFrontRun(
      run as unknown as legacy.FrontRun,
      inputs,
      dt,
      now,
    ) as unknown as FrontRun;
  if (
    !Number.isFinite(dt) ||
    dt <= 0 ||
    !Number.isFinite(now) ||
    run.phase === "victory" ||
    run.phase === "defeat"
  )
    return run;
  if (
    run.fusion &&
    run.mode === "survival" &&
    run.returnAt !== undefined &&
    now >= run.returnAt
  ) {
    conclude(run, true, "出撃から60分が経過したため、生存作戦から帰還しました");
    return run;
  }
  if (run.phase === "selection") {
    if (run.selectionDeadline !== null && now >= run.selectionDeadline) {
      for (const id of Object.keys(run.upgrades))
        for (let count = 0; count < frontPickLimit(run.upgrades[id]); count++) {
          const offer = run.upgrades[id].offer;
          if (!offer) break;
          chooseFrontUpgrade(
            run,
            id,
            {
              runId: run.world.run,
              offerId: offer.id,
              revision: offer.revision,
              requestId: frontAutomaticRequestId(
                run.upgrades[id].processedRequestIds,
              ),
              cardId: offer.defaultCardId,
            },
            now,
            true,
          );
        }
    }
    return run;
  }
  if (now < run.resumeUntil) return run;
  const w = run.world,
    boundary =
      run.fusion && run.mode === "survival"
        ? undefined
        : FRONT_RUN_CONFIG.selectionBoundaries[run.boundaryIndex];
  const timeout = run.fusion && run.mode === "survival" ? Infinity : 540;
  if (w.time >= timeout - 1e-8) {
    w.time = 540;
    conclude(run, false, "作戦時間の上限（9分）に達しました");
    return run;
  }
  if (boundary !== undefined && w.time >= boundary - 1e-8) {
    w.time = boundary;
    resupply(run, boundary, now);
    return run;
  }
  if (run.finalResupplyDone) spawnBoss(run);
  schedule(run);
  step(
    w,
    inputs,
    Math.min(0.1, dt, (boundary ?? Infinity) - w.time, timeout - w.time),
  );
  collectFrontXp(w);
  updateRights(run);
  run.metrics.maxEnemies = Math.max(run.metrics.maxEnemies, w.enemies.length);
  if (w.phase === "defeat" || !w.players.some((p) => p.connected && p.hp > 0))
    conclude(run, false, "部隊が全員ダウンしました");
  else if (w.defense && w.defense.armory.hp <= 0)
    conclude(run, false, "防衛拠点が破壊されました");
  else if (
    run.bossId !== null &&
    !w.enemies.some((e) => e.id === run.bossId && e.hp > 0)
  )
    conclude(run, true, "最終大型撃破");
  else if (boundary !== undefined && w.time >= boundary - 1e-8) {
    w.time = boundary;
    resupply(run, boundary, now);
  }
  if (run.phase === "combat" || run.phase === "boss") {
    Object.keys(run.upgrades).forEach((id) => openOwed(run, id));
    if (Object.values(run.upgrades).some((s) => s.offer)) {
      run.phase = "selection";
      run.selectionDeadline =
        w.players.length > 1 ? now + FRONT_RUN_CONFIG.selectionSeconds : null;
    }
  }
  return run;
}
/** 各クライアントへの情報は自身の候補だけ。内部乱数・他人の候補を渡さない。 */
export function getFrontRunView(run: FrontRun, id: string) {
  if (!run.world.front?.growthVersion) {
    const old = legacy.getFrontRunView(run as unknown as legacy.FrontRun, id);
    return {
      ...old,
      maxPicks: 7,
      growthVersion: 1,
      returnAt: null as number | null,
      levels: { ...createFrontUpgradeState("view", 0).levels, ...old.levels },
    };
  }
  const s = run.upgrades[id],
    r = run.world.front!.players[id];
  if (!s || !r) throw new RangeError("参加者が見つかりません");
  const offer = s.offer;
  return {
    phase: run.phase,
    maxPicks: frontPickLimit(s),
    growthVersion: run.fusion ? 3 : 2,
    returnAt: run.returnAt ?? null,
    mode: run.mode,
    day: run.day,
    combatTime: run.world.time,
    xp: run.world.front!.xp,
    nextXpThreshold:
      s.picks >= frontPickLimit(s) ||
      (run.fusion && !getEligibleFrontUpgrades(s).length)
        ? null
        : run.fusion
          ? frontSurvivalThreshold(s.rightsGranted)
          : (FRONT_RUN_CONFIG.xpThresholds[s.rightsGranted] ?? null),
    picks: s.picks,
    levels: { ...s.levels },
    evolved: [...r.evolved],
    maxHp: r.maxHp,
    maxChain: r.maxChain,
    rightsPending:
      run.fusion && !getEligibleFrontUpgrades(s).length
        ? 0
        : s.rightsGranted - s.rightsSpent,
    rerollsRemaining: s.rerollsRemaining,
    canReroll: canRerollFrontUpgrade(s),
    selectionDeadline: run.selectionDeadline,
    resumeUntil: run.resumeUntil,
    bossId: run.bossId,
    spawnWarnings: [
      ...run.pendingSpawns.flatMap((pending) =>
        pending.kinds.map((_, index) => ({
          x: pending.x + index * 2.7,
          z: pending.z,
          at: pending.at,
          radius: 2,
        })),
      ),
      ...(run.pendingBoss ? [{ ...run.pendingBoss, radius: 6 }] : []),
    ],
    offer: offer
      ? {
          id: offer.id,
          revision: offer.revision,
          kind: offer.kind,
          cardIds: [...offer.cardIds],
          defaultCardId: offer.defaultCardId,
        }
      : null,
  };
}
export type FrontRunView = ReturnType<typeof getFrontRunView>;
