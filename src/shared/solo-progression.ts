import {
  BRANCH_POINT,
  ACCESSORY_VALUES,
  SWAP_TIMES,
  settings,
  rollWeapon,
  type Difficulty,
  type Skill,
  type Accessory,
} from "./progression";
import { stageFor, mapFor, troopAt, troopCount } from "./stages";
import { stats, MOVE_SPEED, ENEMIES } from "./defs";
import { ARENA_X, ARENA_Z } from "./arena";
import { supportHeight } from "./terrain";
import { pendingFoundryCount } from "./foundry-spawning";
import {
  spawn,
  move,
  blocked,
  random,
  finish,
  type World,
  type Player,
  type Input,
  type Enemy,
  type Drop,
} from "./game";
export interface SoloProgression {
  stage: number;
  difficulty: Difficulty;
  test: boolean;
  levels: Record<Skill, number>;
  accessory?: Accessory;
  medkit: boolean;
  revived: boolean;
  invincible: number;
  branchReached: boolean;
  waveCompleteAt: number | null;
  bossSpawned: number;
  plannedKills: number;
  collection: number;
  acquired: number;
}
export const maxHp = (w: World) =>
  w.solo ? 160 * (1 + 0.1 * w.solo.levels.hp) : 160;
export const pickupRadius = (w: World) =>
  3 *
  (w.solo?.accessory?.kind === "pickup"
    ? ACCESSORY_VALUES.pickup[w.solo.accessory.rarity]
    : 1);
export const recoveryWait = (w: World) =>
  w.solo?.accessory?.kind === "recovery"
    ? ACCESSORY_VALUES.recovery[w.solo.accessory.rarity]
    : 5;
export const switchTime = (w: World) =>
  w.solo ? SWAP_TIMES[w.solo.levels.swap] : 0.5;
export function initSolo(
  w: World,
  stage: number,
  difficulty: Difficulty,
  test: boolean,
  levels: Record<Skill, number>,
  accessory?: Accessory,
) {
  w.solo = {
    stage,
    difficulty,
    test,
    levels: { ...levels },
    accessory: accessory ? { ...accessory } : undefined,
    medkit: true,
    revived: false,
    invincible: 0,
    branchReached: false,
    waveCompleteAt: null,
    bossSpawned: 0,
    plannedKills: 0,
    collection: 0,
    acquired: 0,
  };
}
export function soloBeginWave(w: World) {
  w.spawned = 0;
  w.solo!.bossSpawned = 0;
  w.solo!.waveCompleteAt = null;
  w.nextSpawn = w.time;
}
export function soloSpawnAndProgress(w: World) {
  const s = w.solo!,
    plan = stageFor(w),
    wave = plan.waves[w.wave - 1],
    cfg = settings(s.stage, s.difficulty);
  if (!wave) return;
  const capacity = () =>
    w.enemies.filter((e) => e.hp > 0).length < cfg.enemyCap;
  if (s.bossSpawned < wave.bosses.length && capacity()) {
    const i = s.bossSpawned,
      e = spawn(w, "boss", 0, [-70, 70, 0][i], wave.bosses[i]);
    if (e) {
      e.hp = e.maxHp = e.maxHp / Math.sqrt(wave.bosses.length);
      s.bossSpawned++;
    }
  } else if (
    w.spawned < troopCount(wave) &&
    capacity() &&
    w.time >= w.nextSpawn
  ) {
    const e = spawn(w, troopAt(wave, w.spawned));
    if (e) {
      w.spawned++;
      w.nextSpawn = w.time + wave.interval;
    }
  }
  const complete =
    s.bossSpawned === wave.bosses.length && w.spawned === troopCount(wave);
  if (complete) s.waveCompleteAt ??= w.time;
  const empty =
    w.enemies.every((e) => e.hp <= 0) && pendingFoundryCount(w) === 0;
  if (
    complete &&
    w.wave < plan.waves.length &&
    (empty || w.time - s.waveCompleteAt! >= cfg.waveWait[w.wave - 1])
  ) {
    w.wave++;
    w.waveAt = w.time;
    w.waveKills = 0;
    soloBeginWave(w);
  }
}
export function soloResolved(w: World) {
  const s = w.solo!,
    plan = stageFor(w),
    wave = plan.waves[w.wave - 1];
  return (
    w.wave === plan.waves.length &&
    w.spawned === troopCount(wave) &&
    s.bossSpawned === wave.bosses.length &&
    w.enemies.every((e) => e.hp <= 0) &&
    pendingFoundryCount(w) === 0
  );
}
export function useMedkit(w: World) {
  const p = w.players[0];
  if (
    !w.solo ||
    w.phase !== "battle" ||
    !w.solo.medkit ||
    p.hp <= 0 ||
    p.hp >= maxHp(w)
  )
    return false;
  w.solo.medkit = false;
  p.hp = maxHp(w);
  return true;
}
export function reviveSolo(w: World) {
  if (
    !w.solo ||
    !w.solo.test ||
    w.solo.revived ||
    w.phase !== "battle" ||
    w.players[0].hp > 0
  )
    return false;
  w.solo.revived = true;
  w.solo.invincible = 2;
  const p = w.players[0];
  p.hp = maxHp(w) * 0.5;
  p.down = 0;
  return true;
}
export function dropPosition(
  w: World,
  e: { x: number; z: number },
  angle: number,
) {
  const blocks = mapFor(w).blocks;
  for (const radius of [2, 1, 0, 3, 4, 6, 8])
    for (let i = 0; i < 16; i++) {
      const a = angle + (i * Math.PI) / 8,
        x = Math.max(
          -ARENA_X + 1,
          Math.min(ARENA_X - 1, e.x + Math.sin(a) * radius),
        ),
        z = Math.max(
          -ARENA_Z + 1,
          Math.min(ARENA_Z - 1, e.z + Math.cos(a) * radius),
        );
      if (!blocked(x, z, 0.5, 0, blocks)) return { x, z };
    }
  return { x: e.x, z: e.z };
}
export function soloDrop(w: World, e: Enemy) {
  const s = w.solo!,
    weaponRoll = random(w),
    healRoll = random(w);
  for (const [type, chance] of [
    ["weapon", weaponRoll < 0.05],
    ["heal", healRoll < 0.02],
  ] as const) {
    if (
      !chance ||
      w.drops.filter((d) => (d.type ?? "weapon") === type).length >= 10
    )
      continue;
    const angle = random(w) * Math.PI * 2,
      to = dropPosition(w, e, angle),
      id = `${w.run}-drop-${++w.serial}`;
    const weapon = rollWeapon(
      id,
      s.stage,
      s.difficulty,
      s.test,
      s.acquired++,
      () => random(w),
    );
    w.drops.push({
      id,
      owner: w.players[0].id,
      weapon,
      type,
      ...to,
      fromX: e.x,
      fromZ: e.z,
      born: w.time,
    });
  }
}
export function collectSolo(w: World, p: Player) {
  if (p.hp <= 0) return;
  for (const d of [...w.drops]) {
    const pos = dropAt(w, d);
    if (
      d.owner !== p.id ||
      Math.hypot(pos.x - p.x, pos.z - p.z) >= pickupRadius(w)
    )
      continue;
    if (d.type === "heal") {
      if (p.hp >= maxHp(w)) continue;
      p.hp = Math.min(
        maxHp(w),
        p.hp +
          maxHp(w) *
            (w.solo?.accessory?.kind === "healing"
              ? ACCESSORY_VALUES.healing[w.solo.accessory.rarity]
              : 0.2),
      );
    } else w.pending[p.id].push(d.weapon);
    w.drops = w.drops.filter((x) => x !== d);
  }
}
export function dropAt(w: World, d: Drop) {
  const age = w.time + (w.solo?.collection ?? 0) - (d.born ?? -100),
    t = Math.max(0, Math.min(1, age / 0.6));
  return {
    x: (d.fromX ?? d.x) * (1 - t) + d.x * t,
    z: (d.fromZ ?? d.z) * (1 - t) + d.z * t,
    jump: Math.sin(t * Math.PI) * 1.6,
  };
}
export function collectionStep(w: World, i: Input, dt: number) {
  if (!w.solo || w.phase !== "victory") return;
  const p = w.players[0];
  w.solo.collection = Math.min(10, w.solo.collection + dt);
  if (p.hp <= 0) return;
  const norm = Math.max(1, Math.hypot(i.mx, i.mz)),
    speed = MOVE_SPEED.walk * (1 + 0.03 * w.solo.levels.move);
  move(
    p,
    ((i.mx * Math.cos(i.yaw) + i.mz * Math.sin(i.yaw)) / norm) * speed * dt,
    ((i.mx * Math.sin(i.yaw) - i.mz * Math.cos(i.yaw)) / norm) * speed * dt,
    0.55,
    mapFor(w).blocks,
  );
  p.yaw = i.yaw;
  p.pitch = i.pitch;
  collectSolo(w, p);
}
export function updateBranch(w: World) {
  if (
    w.solo?.stage === 3 &&
    Math.hypot(
      w.players[0].x - BRANCH_POINT.x,
      w.players[0].z - BRANCH_POINT.z,
    ) < BRANCH_POINT.radius
  )
    w.solo.branchReached = true;
}
export function endSoloTick(w: World) {
  if (!w.solo) return;
  updateBranch(w);
  if (soloResolved(w)) finish(w, true);
}
