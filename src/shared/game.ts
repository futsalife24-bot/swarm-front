import { enemySize, enemySpeedFactor, spawnSize } from "./enemy-size";
import { settings, rollWeapon, type NewWeapon } from './progression';
import { maxHp, recoveryWait, switchTime, soloBeginWave, soloSpawnAndProgress, soloDrop, collectSolo, endSoloTick, type SoloProgression } from './solo-progression';
import { groundHeight, supportHeight, terrainProps, terrainBlocked, terrainRay, WALK_STEP } from "./terrain";
import { ARENA_X, ARENA_Z, MAP_SCALE } from "./arena";
import { MAX_PITCH } from "./aim";
import {
  queueFoundrySpawn,
  cutPendingFoundrySpawn,
  flushFoundrySpawns,
  pendingFoundryCount,
  type FoundrySpawnBatch,
} from "./foundry-spawning";
import { STRUCTURE_TIMING } from "./structure-timing";
import {
  initWorm,
  moveWorm,
  wormNodes,
  WORM_BODY_COUNT,
  placeWormOnGround,
  type WormNode,
} from "./worm";
import { CAVE_BLOCKS, CAVE_NODES, caveBlocked, caveRay } from "./cave";
import {
  mapFor,
  stageFor,
  validStage,
  troopAt,
  troopCount,
  type BossForm,
} from "./stages";
import { pursuitDirection, specialMotion } from "./enemy-motion";
import {
  selectStructureTarget,
  clusterPoint,
  foundryPhase,
} from "./structure-ai";
import {
  BLOCKS,
  ENEMIES,
  LIMITS,
  STARTERS,
  WEAPONS,
  POWER,
  ROLL,
  ROLLS,
  LOWER_IS_BETTER,
  LR_QUALITY,
  TIER_QUALITY,
  quality,
  stats,
  EFFECT_POOLS,
  reloadDuration,
  WAVE_INTERVAL,
  MOVE_SPEED,
  EVADE_DURATION,
  WEAPON_SWITCH_DURATION,
  WEAPON_SWITCH_RESUME,
  HEAVY_HIT_DURATION,
  type Weapon,
} from "./defs";
export interface Input {
  mx: number;
  mz: number;
  yaw: number;
  pitch: number;
  fire: boolean;
  reload: boolean;
  dodge: boolean;
  swap: boolean;
  revive: boolean;
  seq: number;
  // New clients send camera angles; omitted on older clients/direct simulation inputs.
  cameraAim?: boolean;
}
export const neutral = (): Input => ({
  mx: 0,
  mz: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  reload: false,
  dodge: false,
  swap: false,
  revive: false,
  seq: 0,
});
export interface Player {
  reloadSlots?: number[];
  y?: number; // Authoritative feet altitude; absent legacy snapshots mean zero.
  id: string;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  down: number;
  revive: number;
  weapons: Weapon[];
  slot: number;
  ammo: number[];
  reload: number;
  cool: number;
  evade: number;
  evadeCd: number;
  swapCd: number;
  /** Solo progression only; animation maps this duration onto the existing clip. */
  swapDuration?: number;
  swapResume?: number;
  heavyHit?: number;
  kills: number;
  connected: boolean;
  ack: number;
  hurt: number;
  safe: number;
}
export interface Enemy extends WormNode {
  size?: number; // Fixed at spawn and replicated in authoritative snapshots.
  foundryTriggered?: boolean;
  foundrySource?: number;
  targetId?: string;
  navigation?: { until: number; point: { x: number; z: number } };
  lunge?: number;
  lungeWait?: number;
  phase?: 1 | 2 | 3;
  fabrication?: number;
  fractured?: boolean;
  active?: boolean;
  steerUntil?: number;
  steerAngle?: number;
  wallCooldown?: number;
  wallYaw?: number;
  perch?: number;
  jump?: number;
  jumpFrom?: number;
  jumpWait?: number;
  flightUntil?: number;
  flightHeight?: number;
  segments?: WormNode[];
  id: number;
  kind: keyof typeof ENEMIES;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  cool: number;
  wind: number;
  tx: number;
  ty?: number;
  tz: number;
  hurt: number;
}
export interface Projectile {
  style?: "stake" | "laser";
  id: number;
  x: number;
  z: number;
  y: number;
  dx: number;
  dz: number;
  dy: number;
  life: number;
  owner: string;
  damage: number;
  rocket: boolean;
  // Captured when fired, so switching weapons cannot change an airborne rocket.
  chain?: boolean;
  gravity?: number;
}
export interface Event {
  id: number;
  type: "shot" | "hit" | "burst" | "kill" | "down" | "revive" | "acid";
  // Damage dealt, on hit and kill events, for the floating numbers.
  amount?: number;
  radius?: number;
  weapon?: "rifle" | "shotgun" | "rocket";
  // Preserve hit material even when the target dies before the next snapshot.
  enemyKind?: Enemy["kind"];
  x: number;
  z: number;
  y: number;
  tx?: number;
  tz?: number;
  ty?: number;
  owner?: string;
}
export interface Drop {
  type?: 'weapon'|'heal';
  born?: number;
  fromX?: number;
  fromZ?: number;
  id: string;
  x: number;
  z: number;
  owner: string;
  weapon: Weapon;
}
export interface World {
  training?: boolean;
  solo?: SoloProgression;
  foundrySpawns?: FoundrySpawnBatch[];
  foundrySpawned?: number;
  stage?: number;
  run: string;
  seed: number;
  time: number;
  phase: "lobby" | "battle" | "victory" | "defeat";
  players: Player[];
  enemies: Enemy[];
  projectiles: Projectile[];
  events: Event[];
  drops: Drop[];
  pending: Record<string, Weapon[]>;
  rewards: Record<string, Weapon[]>;
  wave: number;
  spawned: number;
  waveKills: number;
  nextSpawn: number;
  waveAt: number;
  waveClearAt: number | null;
  serial: number;
  eventSerial: number;
  enemyOrdinal?: number;
  totalKills: number;
  scale: number;
  reason: string;
}
export function createWorld(run: string, seed = 123, stage = 1): World {
  return {
    stage: validStage(stage) ? stage : 1,
    run,
    seed,
    time: 0,
    phase: "lobby",
    players: [],
    enemies: [],
    projectiles: [],
    events: [],
    drops: [],
    pending: {},
    rewards: {},
    wave: 0,
    spawned: 0,
    waveKills: 0,
    nextSpawn: 0,
    waveAt: 0,
    waveClearAt: null,
    serial: 0,
    eventSerial: 0,
    totalKills: 0,
    scale: 1,
    reason: "",
  };
}
export function addPlayer(
  w: World,
  id: string,
  weapons: Weapon[] = STARTERS.slice(0, 2),
) {
  const p: Player = {
    id,
    x: w.players.length * 2 - 1,
    z: mapFor(w).blocks === CAVE_BLOCKS ? 36 * MAP_SCALE : 17 * MAP_SCALE,
    yaw: 0,
    pitch: 0,
    hp: 160,
    down: 0,
    revive: 0,
    weapons: structuredClone(weapons),
    slot: 0,
    ammo: weapons.map((a) => stats(a).mag),
    reload: 0,
    cool: 0,
    evade: 0,
    evadeCd: 0,
    swapCd: 0,
    kills: 0,
    connected: true,
    ack: 0,
    hurt: 0,
    safe: 0,
  };
  p.y = supportHeight(p.x, p.z, mapFor(w).blocks);
  w.players.push(p);
  w.pending[id] = [];
  return p;
}
export function start(w: World) {
  w.phase = "battle";
  w.scale = 1 + 0.55 * (w.players.length - 1);
  w.wave = 1;
  w.waveAt = 0;
  beginWave(w);
}
export function random(w: World) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
export function loot(w: World): Weapon {
  if(w.solo)return rollWeapon(`${w.run}-${++w.serial}`,w.solo.stage,w.solo.difficulty,w.solo.test,w.solo.acquired++,()=>random(w));
  const kind = (["rifle", "shotgun", "rocket"] as const)[
    Math.floor(random(w) * 3)
  ];
  // Roll the five figures first; the tier is then a reading of how they landed
  // rather than a bag that was drawn before anything was known.
  const rolls: Partial<Record<(typeof ROLLS)[number], number>> = {};
  let score = 0;
  for (const key of ROLLS) {
    const percentile = random(w) ** stageFor(w).lootExponent;
    const good = LOWER_IS_BETTER.includes(key) ? 1 - percentile : percentile;
    const milli =
      ROLL.min +
      Math.min(
        ROLL.max - ROLL.min,
        Math.floor(good * (ROLL.max - ROLL.min + 1)),
      );
    rolls[key] = milli / ROLL.scale;
    const at = (milli - ROLL.min) / (ROLL.max - ROLL.min);
    score += LOWER_IS_BETTER.includes(key) ? 1 - at : at;
  }
  const grade = score / ROLLS.length;
  const rarity =
    grade >= TIER_QUALITY[2] ? 2 : grade >= TIER_QUALITY[1] ? 1 : 0;
  const pool = EFFECT_POOLS[kind];
  const effectRoll = rarity ? random(w) : 1;
  // Keep the established RNG draw count: rocket previously had no second roll.
  // Conditional on effectRoll < 0.6, effectRoll / 0.6 is uniform in [0, 1).
  const effect: Weapon["effect"] =
    effectRoll < 0.6
      ? pool[
          Math.floor(
            (kind === "rocket" ? effectRoll / 0.6 : random(w)) * pool.length,
          )
        ]
      : "none";
  return {
    id: `${w.run}-${++w.serial}`,
    kind,
    // LR is never drawn: it is what a top-grade roll becomes when it also
    // carries an effect, so the tier means "this one landed everything".
    rarity: grade >= LR_QUALITY && effect !== "none" ? 3 : rarity,
    // Damage keeps its own scale so old saves and the power cap still line up.
    power:
      (POWER.min +
        Math.round(
          ((POWER.max[2] - POWER.min) *
            (rolls.power! - ROLL.min / ROLL.scale)) /
            ((ROLL.max - ROLL.min) / ROLL.scale),
        )) /
      POWER.scale,
    effect,
    rolls,
  };
}
// Roof height over a point, or 0 in the open. Fliers use it to know how high
// they must climb to cross something instead of going through it.
export function roofHeight(x: number, z: number, r = 0.55, blocks = BLOCKS) {
  let best = supportHeight(x, z, blocks, Infinity, r);
  for (const b of blocks)
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)
      best = Math.max(best, b.h);
  return best;
}
// `y` is how high the mover is: a building only stops what is below its roof.
export function blocked(
  x: number,
  z: number,
  r = 0.55,
  y = 0,
  blocks = BLOCKS,
) {
  if (terrainBlocked(x, z, r, y, blocks)) return true;
  if (blocks === CAVE_BLOCKS) return caveBlocked(x, z, r, y);
  return (
    Math.abs(x) > ARENA_X - r ||
    Math.abs(z) > ARENA_Z - r ||
    blocks.some(
      (b) =>
        b.h > y &&
        Math.abs(x - b.x) < b.w / 2 + r &&
        Math.abs(z - b.z) < b.d / 2 + r,
    )
  );
}
export function move(
  p: { x: number; z: number; y?: number },
  dx: number,
  dz: number,
  r = 0.55,
  blocks = BLOCKS,
  airborne = false,
) {
  // Substeps prevent dodge/knockback from tunnelling through narrow props.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
  let y = p.y ?? supportHeight(p.x, p.z, blocks);
  const grounded = !airborne && y <= supportHeight(p.x, p.z, blocks, y, r) + WALK_STEP;
  for(let i=0;i<steps;i++) for(const axis of ["x", "z"] as const) {
    const nx=p.x+(axis==="x"?dx/steps:0), nz=p.z+(axis==="z"?dz/steps:0);
    const floor=supportHeight(nx,nz,blocks,y,r);
    const nextY=grounded?floor:y;
    if(nextY + 1e-6 >= groundHeight(nx,nz,blocks) && (!grounded || floor-y<=WALK_STEP) && !blocked(nx,nz,r,nextY,blocks)) {
      p.x=nx;p.z=nz;y=nextY;
    }
  }
  p.y=y;
}
// Segment/AABB slab intersection; shared by bullets, explosions, aim assist and camera.
export function wallDistance(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
  blocks = BLOCKS,
) {
  let best = terrainRay(x,y,z,dx,dy,dz,max,blocks);
  if (blocks === CAVE_BLOCKS) best = Math.min(best,caveRay(x,y,z,dx,dy,dz,max));
  for (const b of [...blocks, ...terrainProps(blocks)]) {
    let lo = 0,
      hi = best;
    for (const [o, d, min, maxv] of [
      [x, dx, b.x - b.w / 2, b.x + b.w / 2],
      [y, dy, "base" in b ? Number(b.base) : 0, b.h + ("base" in b ? Number(b.base) : 0)],
      [z, dz, b.z - b.d / 2, b.z + b.d / 2],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < min || o > maxv) {
          hi = -1;
          break;
        }
      } else {
        const a = (min - o) / d,
          c = (maxv - o) / d;
        lo = Math.max(lo, Math.min(a, c));
        hi = Math.min(hi, Math.max(a, c));
      }
    }
    if (lo <= hi && hi >= 0) best = Math.min(best, lo);
  }
  return best;
}
export function rayVisible(
  e: Enemy,
  p: { x: number; z: number; y?: number },
  blocks = BLOCKS,
) {
  const height = eye(e);
  const length = Math.hypot(p.x - e.x, (p.y ?? 0) + 1.2 - height, p.z - e.z);
  return (
    length < 1e-8 ||
    wallDistance(
      e.x,
      height,
      e.z,
      (p.x - e.x) / length,
      ((p.y ?? 0) + 1.2 - height) / length,
      (p.z - e.z) / length,
      length,
      blocks,
    ) >=
      length - 0.01
  );
}
export function visible(
  a: { x: number; z: number; y?: number },
  b: { x: number; z: number; y?: number },
  blocks = BLOCKS,
) {
  const dy=(b.y ?? 0)-(a.y ?? 0);
  const d = Math.hypot(b.x - a.x, dy, b.z - a.z);
  if(d<1e-8)return true;
  return (
    wallDistance(
      a.x,
      (a.y ?? 0) + 1.2,
      a.z,
      (b.x - a.x) / d,
      dy/d,
      (b.z - a.z) / d,
      d,
      blocks,
    ) >=
    d - 0.01
  );
}
export function event(w: World, e: Omit<Event, "id">) {
  w.events.push({ ...e, id: ++w.eventSerial });
  if (w.events.length > 80) w.events.shift();
}
export function spawn(
  w: World,
  kind: Enemy["kind"],
  x?: number,
  z?: number,
  form: BossForm = "crown",
  sizeSlot?: number,
) {
  if (w.enemies.length >= (w.solo?settings(w.solo.stage,w.solo.difficulty).enemyCap:LIMITS.enemies)) return;
  const ordinal = w.enemyOrdinal ?? 0;
  const size = spawnSize(kind, form === "worm", sizeSlot ?? ordinal);
  const a = random(w) * Math.PI * 2;
  let ex = x ?? Math.sin(a) * 10,
    ez = z ?? (random(w) < 0.5 ? -46 : 46) * MAP_SCALE;
  if (
    blocked(
      ex,
      ez,
      ENEMIES[kind].radius,
      ENEMIES[kind].cruise,
      mapFor(w).blocks,
    )
  ) {
    ex = 0;
    ez = -43 * MAP_SCALE;
  }
  if (mapFor(w).blocks === CAVE_BLOCKS) {
    const candidates = CAVE_NODES.filter(
      (p) => !caveBlocked(p.x, p.z, ENEMIES[kind].radius, ENEMIES[kind].cruise),
    );
    const point =
      x !== undefined && z !== undefined
        ? candidates.reduce((a, b) =>
            Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b,
          )
        : candidates[Math.floor(random(w) * candidates.length)];
    ex = point.x;
    ez = point.z;
  }
  const hp = ENEMIES[kind].hp * w.scale * stageFor(w).hp * size;
  const enemy: Enemy = {
    id: ++w.serial,
    size,
    kind,
    x: ex,
    y: Math.min(supportHeight(ex,ez,mapFor(w).blocks) + ENEMIES[kind].cruise, mapFor(w).blocks === CAVE_BLOCKS && kind === "hornet" ? 5 : Infinity),
    z: ez,
    hp,
    maxHp: hp,
    cool: 1 + random(w),
    wind: 0,
    tx: 0,
    tz: 0,
    hurt: 0,
    ...(kind === "boss" && form === "worm"
      ? {
          segments: Array.from({ length: WORM_BODY_COUNT }, (_, i) => ({
            x: ex,
            y: 0,
            z:
              mapFor(w).blocks === CAVE_BLOCKS
                ? ez
                : Math.max(
                    -49 * MAP_SCALE,
                    Math.min(49 * MAP_SCALE, ez - (i + 1) * 2),
                  ),
          })),
        }
      : {}),
  };
  if (enemy.segments) placeWormOnGround(w, enemy);
  w.enemyOrdinal = ordinal + 1;
  w.enemies.push(enemy);
  return enemy;
}
// Authored slots do not shift when players cause different reinforcement counts.
function waveSizeSlot(w: World, offset: number) {
  return stageFor(w).waves.slice(0, w.wave - 1).reduce((sum, wave) => sum + troopCount(wave) + wave.bosses.length, 0) + offset;
}
// Separated boss entries and immediate escorts, all counted in this wave.
function beginWave(w: World) {
  if(w.solo){soloBeginWave(w);return;}
  const wave = stageFor(w).waves[w.wave - 1];
  w.spawned = 0;
  w.nextSpawn = w.time + wave.interval;
  wave.bosses.forEach((form, i) => {
    spawn(w, "boss", 0, [-35, 35, 0][i] * MAP_SCALE, form, waveSizeSlot(w, i));
    const boss = w.enemies[w.enemies.length - 1];
    // More simultaneous threats, without multiplying the bullet-sponge duration.
    boss.hp = boss.maxHp = boss.maxHp / Math.sqrt(wave.bosses.length);
    boss.cool += i * 1.2;
  });
  for (let i = 0; i < Math.min(wave.guards, troopCount(wave)); i++) {
    spawn(
      w,
      troopAt(wave, i),
      (i % 2 ? 1 : -1) * 6 * MAP_SCALE,
      (-38 + Math.floor(i / 2) * 22) * MAP_SCALE,
      "crown", waveSizeSlot(w, wave.bosses.length + i),
    );
    w.enemies[w.enemies.length - 1].active = false;
    w.spawned++;
  }
}
function hurtPlayer(w: World, p: Player, damage: number, heavy = false) {
  if (p.hp <= 0 || p.evade > 0 || (w.solo?.invincible??0)>0) return;
  p.hp = Math.max(0, p.hp - damage * stageFor(w).damage);
  if (heavy) p.heavyHit = HEAVY_HIT_DURATION;
  p.hurt = 0.2;
  p.safe = 0;
  if (!p.hp) {
    p.down = 25;
    event(w, { type: "down", x: p.x, z: p.z, y: (p.y ?? 0) + 1 });
  }
}
// A 60m/s pulse can cross a player's entire collider between simulation ticks.
// Sweep its remaining travel against walls, ground and the nearest live player.
function advanceFoundryLaser(
  w: World,
  q: Projectile,
  living: Player[],
  dt: number,
) {
  const speed = Math.hypot(q.dx, q.dy, q.dz);
  if (q.life <= 0 || speed <= 0) {
    q.life = -1;
    return;
  }
  const travel = speed * Math.min(dt, q.life);
  const dx = q.dx / speed,
    dy = q.dy / speed,
    dz = q.dz / speed;
  let distance = wallDistance(
    q.x,
    q.y,
    q.z,
    dx,
    dy,
    dz,
    travel,
    mapFor(w).blocks,
  );
  if (dy < 0) distance = Math.min(distance, Math.max(0, -q.y / dy));
  let target: Player | undefined;
  for (const p of living) {
    const x = p.x - q.x,
      y = (p.y ?? 0) + 1.2 - q.y,
      z = p.z - q.z;
    const along = x * dx + y * dy + z * dz;
    const squared = 1 - (x * x + y * y + z * z - along * along);
    if (squared < 0 || along + Math.sqrt(squared) < 0) continue;
    const near = Math.max(0, along - Math.sqrt(squared));
    if (near < distance) {
      distance = near;
      target = p;
    }
  }
  q.x += dx * distance;
  q.y += dy * distance;
  q.z += dz * distance;
  q.life -= dt;
  if (target) hurtPlayer(w, target, q.damage);
  if (target || distance < travel || q.life <= 0) {
    event(w, { type: "acid", x: q.x, y: Math.max(0, q.y), z: q.z });
    q.life = -1;
  }
}
export function hurtEnemy(
  w: World,
  e: Enemy,
  damage: number,
  owner: string,
  part = 0,
  weapon?: Event["weapon"],
) {
  if (e.hp <= 0) return;
  e.active = true;
  let impact = { x: e.x, y: eye(e), z: e.z };
  if (e.segments) {
    initWorm(e);
    const node = wormNodes(e)[part];
    if (!node || !node.partHp || node.partHp <= 0) return;
    damage = Math.min(damage, node.partHp);
    if (part === 0 && damage >= node.partHp) queueFoundrySpawn(w, e);
    node.partHp -= damage;
    impact = { x: node.x, y: node.y + (part === 0 ? 3 : 2), z: node.z };
    if (node.partHp <= 0) {
      if (part > 0) {
        e.fractured = true;
        cutPendingFoundrySpawn(w, e, part);
      }
      event(w, { type: "burst", radius: 2.2, ...impact, owner });
      const next = wormNodes(e)[part + 1];
      if (next) {
        next.route = undefined;
      }
    }
    e.hp = wormNodes(e).reduce((sum, n) => sum + Math.max(0, n.partHp ?? 0), 0);
  } else e.hp -= damage;
  e.hurt = 0.15;
  event(w, {
    type: "hit",
    enemyKind: e.kind,
    weapon,
    ...impact,
    owner,
    amount: Math.round(damage),
  });
  if (e.hp <= 0) {
    if(w.solo&&e.foundrySource===undefined)w.solo.plannedKills++;
    w.totalKills++;
    w.waveKills++;
    const p = w.players.find((p) => p.id === owner);
    if (p) p.kills++;
    event(w, { type: "kill", ...impact, owner });
    if(w.solo)soloDrop(w,e);
    else if (random(w) < stageFor(w).dropRate && w.drops.length < 24)
      for (const p of w.players) {
        if (w.drops.length >= 24) break;
        const weapon = loot(w);
        w.drops.push({
          id: weapon.id,
          x: impact.x,
          z: impact.z,
          owner: p.id,
          weapon,
        });
      }
  }
}
export function finish(w: World, win: boolean, reason = "") {
  if (w.phase !== "battle") return;
  w.phase = win ? "victory" : "defeat";
  w.reason = reason;
  if (win)
    for (const p of w.players) {
      w.rewards[p.id] = [...w.pending[p.id], loot(w), loot(w)];
    }
  else {
    w.pending = Object.fromEntries(w.players.map((p) => [p.id, []]));
  }
  w.projectiles = [];
}
// Where a shot has to pass to hit: the unit's own centre, lifted by how high it floats.
export const eye = (e: Enemy) => e.y + ENEMIES[e.kind].aim * enemySize(e);
export const enemyBodies = (e: Enemy) =>
  [
    {
      x: e.x,
      y: eye(e),
      z: e.z,
      radius: ENEMIES[e.kind].radius * enemySize(e),
      part: 0,
      partHp: e.partHp,
    },
    ...(e.segments ?? []).map((s, i) => ({
      ...s,
      y: s.y + 2 * enemySize(e),
      radius: 2.2 * enemySize(e),
      part: i + 1,
    })),
  ].filter((b) => b.partHp === undefined || b.partHp > 0);
// Every enemy is slower than a walking player, so backing away while firing was
// free. Distance now costs damage: holding ground is worth something.
export function falloff(kind: Weapon["kind"], distance: number) {
  if (kind === "shotgun") return Math.max(0.3, 1 - distance / 35);
  if (kind === "rifle")
    return Math.max(0.45, 1 - Math.max(0, distance - 22) / 55);
  return 1;
}
// The renderer and authority use the same shoulder camera and sight ray.
export function aimCamera(
  p: { x: number; z: number; y?: number },
  i: { yaw: number; pitch: number },
  blocks = BLOCKS,
) {
  const { yaw, pitch } = i;
  const pivot = { x: p.x, y: (p.y ?? 0) + 1.9, z: p.z };
  const offset = {
    x: -Math.sin(yaw) * 5.2 + Math.cos(yaw) * 0.8,
    y: Math.max(0.35, 2.9 - Math.sin(pitch) * 4) - 1.9,
    z: Math.cos(yaw) * 5.2 + Math.sin(yaw) * 0.8,
  };
  const length = Math.hypot(offset.x, offset.y, offset.z);
  const distance = Math.max(
    0.2,
    wallDistance(
      pivot.x,
      pivot.y,
      pivot.z,
      offset.x / length,
      offset.y / length,
      offset.z / length,
      length,
      blocks,
    ) - 0.25,
  );
  const camera = {
    x: pivot.x + (offset.x * distance) / length,
    y: pivot.y + (offset.y * distance) / length,
    z: pivot.z + (offset.z * distance) / length,
  };
  const ray = {
    x: p.x + Math.sin(yaw) * 30 * Math.cos(pitch) - camera.x,
    y: ((p.y ?? 0) + 1.5) + Math.sin(pitch) * 30 - camera.y,
    z: p.z - Math.cos(yaw) * 30 * Math.cos(pitch) - camera.z,
  };
  const rayLength = Math.hypot(ray.x, ray.y, ray.z);
  return {
    camera,
    direction: {
      x: ray.x / rayLength,
      y: ray.y / rayLength,
      z: ray.z / rayLength,
    },
  };
}

export function cameraShot(
  w: World,
  p: Player,
  i: { yaw: number; pitch: number },
) {
  const blocks = mapFor(w).blocks;
  const { camera, direction: d } = aimCamera(p, i, blocks);
  const max =
    stats(p.weapons[p.slot]).range +
    Math.hypot(camera.x - p.x, camera.y - ((p.y ?? 0) + 1.5), camera.z - p.z);
  let distance = wallDistance(
    camera.x,
    camera.y,
    camera.z,
    d.x,
    d.y,
    d.z,
    max,
    blocks,
  );
  if (d.y < -1e-8) distance = Math.min(distance, Math.max(0, -camera.y / d.y));
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    for (const body of enemyBodies(e)) {
      const x = body.x - camera.x,
        y = body.y - camera.y,
        z = body.z - camera.z;
      const along = x * d.x + y * d.y + z * d.z;
      const radial = x * x + y * y + z * z - along * along;
      const squared = body.radius * body.radius - radial;
      if (squared < 0 || along <= 0) continue;
      const near = along - Math.sqrt(squared);
      if (near > 0) distance = Math.min(distance, near);
    }
  }
  let target = {
    x: camera.x + d.x * distance,
    y: camera.y + d.y * distance,
    z: camera.z + d.z * distance,
  };
  let dx = target.x - p.x,
    dy = target.y - ((p.y ?? 0) + 1.5),
    dz = target.z - p.z;
  // A surface between shoulder camera and player must never turn a shot backwards.
  if (dx * d.x + dy * d.y + dz * d.z < 0.1) {
    dx = d.x;
    dy = d.y;
    dz = d.z;
    target = { x: p.x + dx, y: ((p.y ?? 0) + 1.5) + dy, z: p.z + dz };
  }
  const length = Math.hypot(dx, dy, dz);
  return {
    target,
    yaw: Math.atan2(dx, -dz),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    direction: { x: dx / length, y: dy / length, z: dz / length },
  };
}
export function fire(w: World, p: Player, i: Input) {
  const weapon = p.weapons[p.slot],
    def = stats(weapon);
  if (p.reload > 0 || p.cool > 0 || p.swapCd > 0 || p.ammo[p.slot] <= 0) return;
  p.ammo[p.slot]--;
  p.cool = def.interval;
  let yaw = i.yaw,
    pitch = i.pitch;
  if (i.cameraAim) {
    const shot = cameraShot(w, p, i);
    yaw = shot.yaw;
    pitch = shot.pitch;
  }
  // A small cone only bends an explicitly fired shot toward a visible enemy.
  const candidates = (i.cameraAim && !w.solo ? [] : w.enemies)
    .filter((e) => e.hp > 0 && e.partHp !== 0)
    .map((e) => ({
      e,
      a: Math.atan2(e.x - p.x, -(e.z - p.z)),
      d: Math.hypot(e.x - p.x, e.z - p.z),
    }))
    .filter(
      (t) =>
        Math.abs(angle(t.a - yaw)) < 0.065 * (1 + .04*(w.solo?.levels.aim??0)) &&
        t.d < def.range &&
        Math.abs(pitch) < 0.18 &&
        // Only nudge towards something roughly at the shooter's own level. Without
        // this the cone snaps a level shot up onto a flier, and altitude stops
        // being something the player has to answer for.
        Math.abs(eye(t.e) - ((p.y ?? 0) + 1.5)) < 2 &&
        visible(p, t.e, mapFor(w).blocks),
    )
    .sort((a, b) => a.d - b.d);
  if (candidates[0]) {
    yaw = candidates[0].a;
    pitch = Math.atan2(eye(candidates[0].e) - ((p.y ?? 0) + 1.5), candidates[0].d);
  }
  const repelled = new Set<Enemy>();
  for (let j = 0; j < def.pellets; j++) {
    const ya = yaw + (random(w) - 0.5) * def.spread * 2,
      pi = pitch + (random(w) - 0.5) * def.spread;
    const dx = Math.sin(ya) * Math.cos(pi),
      dz = -Math.cos(ya) * Math.cos(pi),
      dy = Math.sin(pi);
    if (weapon.kind === "rocket") {
      if (w.projectiles.length < 100)
        w.projectiles.push({
          id: ++w.serial,
          x: p.x,
          z: p.z,
          y: ((p.y ?? 0) + 1.5),
          dx: dx * 28,
          dz: dz * 28,
          dy: dy * 28,
          life: def.range / 28,
          owner: p.id,
          damage: def.damage,
          rocket: true,
          chain: weapon.effect === "chain",
        });
      event(w, {
        type: "shot",
        weapon: weapon.kind,
        x: p.x,
        y: ((p.y ?? 0) + 1.5),
        z: p.z,
        tx: p.x + dx * 2,
        tz: p.z + dz * 2,
        ty: ((p.y ?? 0) + 1.5) + dy * 2,
        owner: p.id,
      });
      continue;
    }
    let range = wallDistance(
      p.x,
      ((p.y ?? 0) + 1.5),
      p.z,
      dx,
      dy,
      dz,
      def.range,
      mapFor(w).blocks,
    );
    if (i.cameraAim && dy < -1e-8) range = Math.min(range, -((p.y ?? 0) + 1.5) / dy);
    const hits = w.enemies
      .filter((e) => e.hp > 0)
      .map((e) => {
        const candidates = enemyBodies(e).map((body) => {
          const ey = body.y,
            along = (body.x - p.x) * dx + (body.z - p.z) * dz + (ey - ((p.y ?? 0) + 1.5)) * dy;
          const distance = Math.hypot(
            body.x - p.x - dx * along,
            body.z - p.z - dz * along,
            ey - ((p.y ?? 0) + 1.5) - dy * along,
          );
          return { e, along, distance, radius: body.radius, part: body.part };
        });
        return candidates
          .filter(
            (h) => h.along > 0 && h.along < range && h.distance < h.radius,
          )
          .sort((a, b) => a.along - b.along)[0];
      })
      .filter((h): h is NonNullable<typeof h> => !!h)
      .filter((h) => h.along > 0 && h.along < range && h.distance < h.radius)
      .sort((a, b) => a.along - b.along)
      .slice(
        0,
        weapon.kind === "shotgun" || weapon.effect === "pierce" ? 3 : 1,
      );
    for (const h of hits) {
      hurtEnemy(
        w,
        h.e,
        def.damage * falloff(weapon.kind, h.along),
        p.id,
        h.part,
        weapon.kind,
      );
      if (
        weapon.kind === "shotgun" &&
        weapon.effect === "repel" &&
        h.e.kind !== "boss" &&
        Math.hypot(h.e.x - p.x, eye(h.e) - ((p.y ?? 0) + 1.5), h.e.z - p.z) <= 8
      )
        repelled.add(h.e);
    }
    if (hits.length) range = hits[hits.length - 1].along;
    event(w, {
      type: "shot",
      enemyKind: hits[0]?.e.kind,
      weapon: weapon.kind,
      x: p.x,
      z: p.z,
      y: ((p.y ?? 0) + 1.5),
      tx: p.x + dx * range,
      tz: p.z + dz * range,
      ty: ((p.y ?? 0) + 1.5) + dy * range,
      owner: p.id,
    });
  }
  // Apply after all pellets, once per enemy per shot; do not push through walls.
  for (const e of repelled) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < 0.001) continue;
    const dx = ((e.x - p.x) / d) * 0.25,
      dz = ((e.z - p.z) / d) * 0.25;
    for (let n = 0; n < 12; n++)
      move(e, dx, dz, ENEMIES[e.kind].radius * 0.65, mapFor(w).blocks);
  }
}
export function angle(n: number) {
  return Math.atan2(Math.sin(n), Math.cos(n));
}
export function step(w: World, inputs: Record<string, Input>, dt = 0.05) {
  if (w.phase !== "battle") return;
  if (!w.players.some((p) => p.connected)) return;
  dt = Math.min(0.1, Math.max(0, dt));
  w.time += dt;
  if(w.solo)w.solo.invincible=Math.max(0,w.solo.invincible-dt);
  for (const p of w.players) {
    if (!p.connected) continue;
    const i = inputs[p.id] ?? neutral();
    p.ack = i.seq;
    p.yaw = i.yaw;
    p.pitch = i.pitch;
    p.hurt = Math.max(0, p.hurt - dt);
    p.cool = Math.max(0, p.cool - dt);
    p.evadeCd = Math.max(0, p.evadeCd - dt);
    const wasEvading = p.evade > 0;
    p.evade = Math.max(0, p.evade - dt);
    p.heavyHit = Math.max(0, (p.heavyHit ?? 0) - dt);
    if (wasEvading && p.evade <= 0 && p.swapCd > 0)
      p.swapResume = WEAPON_SWITCH_RESUME;
    else if ((p.swapResume ?? 0) > 0)
      p.swapResume = Math.max(0, p.swapResume! - dt);
    else if (!wasEvading) p.swapCd = Math.max(0, p.swapCd - dt);
    if (p.hp <= 0) {
      continue;
    }
    p.safe += dt;
    if (p.safe > recoveryWait(w) && p.hp < maxHp(w)*(w.solo?.5:1)) p.hp = Math.min(maxHp(w)*(w.solo?.5:1), p.hp + dt * 3);
    if(w.solo&&p.reloadSlots)for(let slot=0;slot<2;slot++)if(slot!==p.slot&&p.reloadSlots[slot]>0){p.reloadSlots[slot]=Math.max(0,p.reloadSlots[slot]-dt);if(p.reloadSlots[slot]===0)p.ammo[slot]=stats(p.weapons[slot]).mag;}
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) p.ammo[p.slot] = stats(p.weapons[p.slot]).mag;
    }
    if (i.swap && p.swapCd <= 0) {
      if(w.solo){p.reloadSlots??=[0,0];p.reloadSlots[p.slot]=Math.max(0,p.reload);}
      p.slot = 1 - p.slot;
      p.reload = w.solo?(p.reloadSlots?.[p.slot]??0):0;
      p.swapCd = w.solo?switchTime(w):WEAPON_SWITCH_DURATION;
      if (w.solo) p.swapDuration = p.swapCd;
      p.swapResume = 0;
    }
    if (
      (i.reload || p.ammo[p.slot] === 0) &&
      p.reload <= 0 &&
      p.ammo[p.slot] < stats(p.weapons[p.slot]).mag
    )
      p.reload = reloadDuration(p.weapons[p.slot], p.ammo[p.slot]);
    if (i.dodge && p.evadeCd <= 0) {
      p.evade = EVADE_DURATION;
      p.evadeCd = 2.2;
    }
    const norm = Math.max(1, Math.hypot(i.mx, i.mz)),
      speed = p.evade > 0 ? MOVE_SPEED.dodge : MOVE_SPEED.walk*(1+.03*(w.solo?.levels.move??0));
    move(
      p,
      ((i.mx * Math.cos(i.yaw) + i.mz * Math.sin(i.yaw)) / norm) * speed * dt,
      ((i.mx * Math.sin(i.yaw) - i.mz * Math.cos(i.yaw)) / norm) * speed * dt,
      0.55,
      mapFor(w).blocks,
    );
    if (i.fire) fire(w, p, i);
    if (i.cameraAim) {
      const shot = cameraShot(w, p, i);
      p.yaw = shot.yaw;
      p.pitch = shot.pitch;
    }
    if(w.solo)collectSolo(w,p);
    else for (const d of w.drops.filter(
      (d) => d.owner === p.id && Math.hypot(d.x - p.x, d.z - p.z) < 3,
    )) {
      if (w.pending[p.id].length < 20) w.pending[p.id].push(d.weapon);
      w.drops = w.drops.filter((x) => x !== d);
    }
  }
  for (const p of w.players.filter(
    (p) => p.connected && p.hp <= 0 && p.down > 0,
  )) {
    const aid = w.players.some(
      (a) =>
        a.hp > 0 &&
        a.connected &&
        inputs[a.id]?.revive &&
        Math.hypot(a.x - p.x, a.z - p.z) < 3.5 &&
        visible(a, p, mapFor(w).blocks),
    );
    p.revive = aid ? p.revive + dt : 0;
    if (p.revive >= 2.5) {
      p.hp = 90;
      p.down = 0;
      p.revive = 0;
      event(w, { type: "revive", x: p.x, z: p.z, y: (p.y ?? 0) + 1 });
    }
  }
  const living = w.players.filter((p) => p.hp > 0 && p.connected);
  if (!living.length) {
    if(w.solo){endSoloTick(w);return;}
    finish(w, false, "部隊が全員ダウンしました");
    return;
  }
  const plan = stageFor(w);
  const wave = plan.waves[w.wave - 1];
  if (!wave) return;
  if(w.solo)soloSpawnAndProgress(w);
  else if (!w.training) {
  if (
    w.spawned < troopCount(wave) &&
    pendingFoundryCount(w) === 0 &&
    w.enemies.length < LIMITS.enemies &&
    w.time >= w.nextSpawn
  ) {
    const kind = troopAt(wave, w.spawned);
    const factory = w.enemies.find(
      (e) =>
        e.kind === "boss" && !e.segments && e.hp > 0 && foundryPhase(e) >= 2,
    );
    // Existing wave budget only: fabrication relocates the scheduled unit.
    if (factory && kind === "spitter") {
      spawn(w, kind, factory.x + 5, factory.z, "crown", waveSizeSlot(w, wave.bosses.length + w.spawned));
      factory.fabrication = 0.8;
    } else spawn(w, kind, undefined, undefined, "crown", waveSizeSlot(w, wave.bosses.length + w.spawned));
    w.spawned++;
    w.nextSpawn = w.time + wave.interval;
  }
  if (
    w.spawned >= troopCount(wave) &&
    w.enemies.every((e) => e.hp <= 0) &&
    pendingFoundryCount(w) === 0
  ) {
    if (w.wave === plan.waves.length) {
      finish(w, true);
      return;
    }
    w.waveClearAt ??= w.time;
  } else w.waveClearAt = null;
  if (w.waveClearAt !== null && w.time - w.waveClearAt >= WAVE_INTERVAL) {
    w.wave++;
    w.waveAt = w.time;
    w.waveClearAt = null;
    w.waveKills = 0;
    for (const p of living) p.hp = Math.min(160, p.hp + 45);
    beginWave(w);
  }
  }
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    if (w.training) continue;
    const t = selectStructureTarget(e, living, (p) =>
      visible(e, p, mapFor(w).blocks),
    );
    // An earlier enemy can down the last target in this same tick.
    if (!t) continue;
    if (e.wind <= 0) e.targetId = t.id;
    if (e.kind === "boss" && !e.segments) {
      e.phase = foundryPhase(e);
      e.fabrication = Math.max(0, (e.fabrication ?? 0) - dt);
    }
    const d = Math.hypot(t.x - e.x, t.z - e.z),
      def = { ...ENEMIES[e.kind], speed: ENEMIES[e.kind].speed * enemySpeedFactor(e), damage: ENEMIES[e.kind].damage * enemySize(e) };
    if (e.active === false) {
      if (
        !living.some(
          (p) =>
            Math.hypot(p.x - e.x, p.z - e.z) < 18 &&
            visible(e, p, mapFor(w).blocks),
        )
      )
        continue;
      e.active = true;
    }
    if (e.segments) {
      moveWorm(w, e, dt);
      continue;
    }
    if (e.kind === "crawler") {
      e.lungeWait = Math.max(0, (e.lungeWait ?? 0) - dt);
      e.lunge = Math.max(0, (e.lunge ?? 0) - dt);
    }
    e.cool -= dt;
    const special = specialMotion(w, e, t, dt);
    if (e.wind > 0) {
      if (e.kind === "hornet" && e.wind > 0.4) {
        const locked = living.find((p) => p.id === e.targetId);
        if (locked) {
          e.tx = locked.x;
          e.tz = locked.z;
        }
      }
      e.wind -= dt;
      if (e.kind === "crawler" && e.wind < 1e-9) e.wind = 0;
      if (e.wind <= 0) {
        if (e.kind === "boss") {
          event(w, { type: "burst", radius: 7, x: e.tx, z: e.tz, y: groundHeight(e.tx,e.tz,mapFor(w).blocks) + 0.1 });
          for (const p of living)
            if (
              Math.hypot(p.x - e.tx, p.z - e.tz) < 7 &&
              visible(e, p, mapFor(w).blocks)
            )
              hurtPlayer(w, p, def.damage, true);
          e.cool = 3 * enemySize(e);
        } else if (
          e.kind === "spitter" ||
          (e.kind === "ant" && d > 2.5) ||
          e.kind === "hornet"
        ) {
          const dist = Math.hypot(e.tx - e.x, e.tz - e.z);
          for (const spread of e.kind === "ant" ? [-0.16, 0, 0.16] : [0]) {
            const angle = Math.atan2(e.tx - e.x, e.tz - e.z) + spread;
            const speed = e.kind === "hornet" ? 19 : 13;
            const height = eye(e);
            const targetY = (e.ty ?? t.y ?? 0) + 1.2;
            const length = Math.max(1e-8, Math.hypot(dist, targetY - height));
            const flight = Math.max(0.3, dist / speed);
            const gravity = e.kind === "ant" ? 12 : 0;
            if (w.projectiles.length < 100)
              w.projectiles.push({
                id: ++w.serial,
                x: e.x,
                z: e.z,
                y: height,
                dx:
                  e.kind === "hornet"
                    ? ((e.tx - e.x) / length) * speed
                    : Math.sin(angle) * speed,
                dz:
                  e.kind === "hornet"
                    ? ((e.tz - e.z) / length) * speed
                    : Math.cos(angle) * speed,
                // Cross the player's body at the aimed position, then fall to
                // the ground beyond it if they move away. Aiming at y=0 made
                // short/medium-range volleys pass underneath a standing player.
                dy:
                  e.kind === "hornet"
                    ? ((targetY - height) / length) * speed
                    : gravity
                      ? (targetY - height) / flight + 0.5 * gravity * flight
                      : ((targetY - height) / Math.max(1, dist)) * speed,
                gravity,
                ...(e.kind === "hornet" ? { style: "stake" as const } : {}),
                life: 4,
                owner: "enemy",
                damage: def.damage,
                rocket: false,
              });
          }
          e.cool = 2.7;
        } else if (e.kind === "crawler") {
          const ax = e.tx - e.x,
            az = e.tz - e.z;
          const length = Math.max(0.001, Math.hypot(ax, az));
          event(w, {
            type: "burst",
            x: e.x + (ax / length) * 1.25,
            z: e.z + (az / length) * 1.25,
            y: 0.3,
            radius: 1.25,
          });
          for (const p of living) {
            const px = p.x - e.x,
              pz = p.z - e.z,
              pd = Math.hypot(px, pz);
            if (
              pd < 2.5 && Math.abs((p.y ?? 0)-e.y)<2.5 &&
              (px * ax + pz * az) / (Math.max(0.001, pd) * length) >= 0.5 &&
              visible(e, p, mapFor(w).blocks)
            )
              hurtPlayer(w, p, def.damage);
          }
          e.cool = 1.2;
        } else {
          if (d < 2.5 && Math.abs(e.y - (t.y ?? 0)) < 2) hurtPlayer(w, t, def.damage);
          e.cool = 1.2;
        }
      }
      continue;
    }
    const stop =
      mapFor(w).blocks === CAVE_BLOCKS && !visible(e, t, mapFor(w).blocks)
        ? 0
        : e.kind === "spitter"
          ? 17
          : e.kind === "boss"
            ? 10
            : 2;
    if ((d > stop || (e.kind === "spitter" && d < 16)) && !special) {
      const direction = pursuitDirection(w, e, t);
      if (e.kind === "spitter" && d < 16) {
        direction.x *= -1;
        direction.z *= -1;
      }
      if (e.kind === "crawler") {
        if (!e.lungeWait && d < 10 && d > 3) {
          e.lunge = 0.35;
          e.lungeWait = 2;
        }
        if ((e.lunge ?? 0) > 0) {
          direction.x *= 2.2;
          direction.z *= 2.2;
        }
      }
      if (e.kind === "hornet" && d < 9) {
        const dx = direction.x;
        direction.x = -direction.z;
        direction.z = dx;
      }
      if (def.cruise) {
        // Straight line, but only into space it has actually climbed above.
        const nx = e.x + direction.x * def.speed * dt,
          nz = e.z + direction.z * def.speed * dt;
        if (!blocked(nx, nz, def.radius, e.y, mapFor(w).blocks)) {
          e.x = nx;
          e.z = nz;
        }
      } else {
        const old = { x: e.x, z: e.z };
        move(
          e,
          direction.x * def.speed * dt,
          direction.z * def.speed * dt,
          def.radius * 0.65,
          mapFor(w).blocks,
        );
        if (Math.hypot(e.x - old.x, e.z - old.z) < 0.01)
          move(
            e,
            Math.sign(-e.x || 1) * def.speed * dt,
            0,
            def.radius * 0.65,
            mapFor(w).blocks,
          );
      }
    }
    // Choose flight height independently of target proximity.
    if (def.cruise && !special) {
      // Obstacle clearance takes priority over the chosen flight height.
      const ahead = Math.max(
        roofHeight(e.x, e.z, def.radius, mapFor(w).blocks),
        roofHeight(
          e.x + ((t.x - e.x) / Math.max(0.001, d)) * 3,
          e.z + ((t.z - e.z) / Math.max(0.001, d)) * 3,
          def.radius,
          mapFor(w).blocks,
        ),
      );
      if (w.time >= (e.flightUntil ?? 0)) {
        const cycle = Math.floor(w.time / 3.5);
        let flightSeed =
          Math.imul(e.id + 31, 374761393) ^ Math.imul(cycle + 7, 668265263);
        flightSeed = Math.imul(flightSeed ^ (flightSeed >>> 13), 1274126177);
        const choice = ((flightSeed ^ (flightSeed >>> 16)) >>> 0) / 4294967296;
        e.flightHeight = 4.5 + choice * 7;
        e.flightUntil = w.time + 3.5;
      }
      let want = Math.max(
        ahead ? ahead + 1.5 : 0,
        e.flightHeight ?? def.cruise,
      );
      if (mapFor(w).blocks === CAVE_BLOCKS) want = Math.min(want, 5);
      const step = 9 * dt;
      e.y += Math.max(-step, Math.min(step, want - e.y));
    }
    if (
      e.cool <= 0 &&
      d <
        (e.kind === "boss"
          ? 28
          : e.kind === "spitter"
            ? 33
            : e.kind === "ant"
              ? 18
              : e.kind === "hornet"
                ? 24
                : 2.6) &&
      (e.kind === "hornet"
        ? rayVisible(e, t, mapFor(w).blocks)
        : visible(e, t, mapFor(w).blocks))
    ) {
      e.wind =
        e.kind === "boss"
          ? STRUCTURE_TIMING.boss.wind
          : e.kind === "hornet"
            ? STRUCTURE_TIMING.hornet.wind
            : e.kind === "spitter" || e.kind === "ant"
              ? 0.8
              : STRUCTURE_TIMING.crawler.wind;
      e.tx = t.x;
      e.ty = t.y ?? 0;
      e.tz = t.z;
      if (e.kind === "boss") {
        const point = clusterPoint(living, 7, (p) =>
          visible(e, p, mapFor(w).blocks),
        )!;
        e.tx = point.x;
        e.tz = point.z;
      }
    }
  }
  for (const q of w.projectiles) {
    if (q.style === "laser") {
      advanceFoundryLaser(w, q, living, dt);
      continue;
    }
    const dx = q.dx * dt,
      dz = q.dz * dt,
      dy = q.dy * dt - 0.5 * (q.gravity ?? 0) * dt * dt,
      dist = Math.hypot(dx, dy, dz);
    const wall = wallDistance(
      q.x,
      q.y,
      q.z,
      dx / dist,
      dy / dist,
      dz / dist,
      dist,
      mapFor(w).blocks,
    );
    q.x += dx * Math.min(1, wall / dist);
    q.z += dz * Math.min(1, wall / dist);
    q.y += dy * Math.min(1, wall / dist);
    q.dy -= (q.gravity ?? 0) * dt;
    q.life -= dt;
    const floor = groundHeight(q.x,q.z,mapFor(w).blocks);
    let hit = wall < dist || q.y <= floor || q.life <= 0;
    q.y = Math.max(floor, q.y);
    if (q.rocket) {
      const direct = !hit
        ? w.enemies.find(
            (e) =>
              e.hp > 0 &&
              enemyBodies(e).some(
                (b) => Math.hypot(b.x - q.x, b.z - q.z, b.y - q.y) < b.radius,
              ),
          )
        : undefined;
      hit ||= !!direct;
      if (hit) {
        event(w, {
          type: "burst",
          radius: 6.5,
          weapon: "rocket",
          x: q.x,
          z: q.z,
          y: q.y,
          owner: q.owner,
        });
        for (const e of w.enemies) {
          for (const b of enemyBodies(e).sort(
            (a, b) =>
              Number(a.part === 0) - Number(b.part === 0) || a.part - b.part,
          )) {
            const d = Math.hypot(
              b.x - q.x,
              b.z - q.z,
              b.y - q.y,
            );
            const clear = d < 0.01 ||
                wallDistance(
                  q.x,
                  q.y,
                  q.z,
                  (b.x - q.x) / d,
                  (b.y - q.y) / d,
                  (b.z - q.z) / d,
                  d,
                  mapFor(w).blocks,
                ) >=
                  d - 0.01;
            if (d < 6.5 && clear)
              hurtEnemy(w, e, q.damage * (1 - d / 9), q.owner, b.part);
          }
        }
        // Only the directly hit, defeated normal enemy can trigger one burst.
        // Damage from this secondary burst never enters this trigger again.
        if (
          q.chain &&
          direct &&
          direct.hp <= 0 &&
          direct.kind !== "boss" &&
          w.phase === "battle"
        ) {
          event(w, {
            type: "burst",
            radius: 3.5,
            weapon: "rocket",
            x: direct.x,
            z: direct.z,
            y: eye(direct),
            owner: q.owner,
          });
          for (const e of w.enemies) {
            const d = Math.hypot(
              e.x - direct.x,
              e.z - direct.z,
              eye(e) - eye(direct),
            );
            if (e.hp > 0 && d < 3.5 && visible(direct, e, mapFor(w).blocks))
              hurtEnemy(w, e, q.damage * 0.5 * (1 - d / 7), q.owner);
          }
        }
      }
    } else {
      for (const p of living)
        if (!hit && Math.hypot(p.x - q.x, p.z - q.z, (p.y ?? 0) + 1.2 - q.y) < 1) {
          hurtPlayer(w, p, q.damage);
          hit = true;
        }
    }
    if (hit) {
      if (!q.rocket) event(w, { type: "acid", x: q.x, y: q.y, z: q.z });
      q.life = -1;
    }
  }
  w.projectiles = w.projectiles.filter((q) => q.life > 0);
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  flushFoundrySpawns(w);
  if(w.solo)endSoloTick(w);
  else if (!w.training && w.time > 600) finish(w, false, "作戦時間の上限（10分）に達しました");
}
export function validInput(v: unknown): v is Input {
  if (!v || typeof v !== "object") return false;
  const i = v as Input;
  return (
    ["mx", "mz", "yaw", "pitch", "seq"].every((k) =>
      Number.isFinite(i[k as keyof Input]),
    ) &&
    Math.abs(i.mx) <= 1 &&
    Math.abs(i.mz) <= 1 &&
    Math.abs(i.yaw) <= Math.PI &&
    i.pitch >= -0.8 &&
    i.pitch <= MAX_PITCH &&
    (i.cameraAim === undefined || typeof i.cameraAim === "boolean") &&
    Number.isSafeInteger(i.seq) &&
    i.seq >= 0 &&
    ["fire", "reload", "dodge", "swap", "revive"].every(
      (k) => typeof i[k as keyof Input] === "boolean",
    )
  );
}
