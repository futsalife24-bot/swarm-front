import { ARENA_X, ARENA_Z, MAP_SCALE } from "./arena";
import { STRUCTURE_TIMING } from "./structure-timing";
import { initWorm, moveWorm, wormNodes, type WormNode } from "./worm";
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
  swapResume?: number;
  heavyHit?: number;
  kills: number;
  connected: boolean;
  ack: number;
  hurt: number;
  safe: number;
}
export interface Enemy extends WormNode {
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
  tz: number;
  hurt: number;
}
export interface Projectile {
  style?: "stake";
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
  x: number;
  z: number;
  y: number;
  tx?: number;
  tz?: number;
  ty?: number;
  owner?: string;
}
export interface Drop {
  id: string;
  x: number;
  z: number;
  owner: string;
  weapon: Weapon;
}
export interface World {
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
  if (blocks === CAVE_BLOCKS) return 0;
  let best = 0;
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
) {
  const y = p.y ?? 0;
  if (!blocked(p.x + dx, p.z, r, y, blocks)) p.x += dx;
  if (!blocked(p.x, p.z + dz, r, y, blocks)) p.z += dz;
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
  if (blocks === CAVE_BLOCKS) return caveRay(x, y, z, dx, dy, dz, max);
  let best = max;
  for (const b of blocks) {
    let lo = 0,
      hi = best;
    for (const [o, d, min, maxv] of [
      [x, dx, b.x - b.w / 2, b.x + b.w / 2],
      [y, dy, 0, b.h],
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
  p: { x: number; z: number },
  blocks = BLOCKS,
) {
  const height = eye(e);
  const length = Math.hypot(p.x - e.x, 1.2 - height, p.z - e.z);
  return (
    length < 1e-8 ||
    wallDistance(
      e.x,
      height,
      e.z,
      (p.x - e.x) / length,
      (1.2 - height) / length,
      (p.z - e.z) / length,
      length,
      blocks,
    ) >=
      length - 0.01
  );
}
export function visible(
  a: { x: number; z: number },
  b: { x: number; z: number },
  blocks = BLOCKS,
) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  return (
    wallDistance(
      a.x,
      1.2,
      a.z,
      (b.x - a.x) / d,
      0,
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
) {
  if (w.enemies.length >= LIMITS.enemies) return;
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
  const hp = ENEMIES[kind].hp * w.scale * stageFor(w).hp;
  w.enemies.push({
    id: ++w.serial,
    kind,
    x: ex,
    y: ENEMIES[kind].cruise,
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
          segments: Array.from({ length: 7 }, (_, i) => ({
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
  });
}
// Separated boss entries and immediate escorts, all counted in this wave.
function beginWave(w: World) {
  const wave = stageFor(w).waves[w.wave - 1];
  w.spawned = 0;
  w.nextSpawn = w.time + wave.interval;
  wave.bosses.forEach((form, i) => {
    spawn(w, "boss", 0, [-35, 35, 0][i] * MAP_SCALE, form);
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
    );
    w.enemies[w.enemies.length - 1].active = false;
    w.spawned++;
  }
}
function hurtPlayer(w: World, p: Player, damage: number, heavy = false) {
  if (p.hp <= 0 || p.evade > 0) return;
  p.hp = Math.max(0, p.hp - damage * stageFor(w).damage);
  if (heavy) p.heavyHit = HEAVY_HIT_DURATION;
  p.hurt = 0.2;
  p.safe = 0;
  if (!p.hp) {
    p.down = 25;
    event(w, { type: "down", x: p.x, z: p.z, y: 1 });
  }
}
export function hurtEnemy(
  w: World,
  e: Enemy,
  damage: number,
  owner: string,
  part = 0,
) {
  if (e.hp <= 0) return;
  e.active = true;
  let impact = { x: e.x, y: eye(e), z: e.z };
  if (e.segments) {
    initWorm(e);
    const node = wormNodes(e)[part];
    if (!node || !node.partHp || node.partHp <= 0) return;
    damage = Math.min(damage, node.partHp);
    node.partHp -= damage;
    impact = { x: node.x, y: node.y + (part === 0 ? 3 : 2), z: node.z };
    if (node.partHp <= 0) {
      e.fractured = true;
      event(w, { type: "burst", radius: 2.2, ...impact, owner });
      const next = wormNodes(e)[part + 1];
      if (next) {
        next.route = undefined;
        next.heading = undefined;
      }
    }
    e.hp = wormNodes(e).reduce((sum, n) => sum + Math.max(0, n.partHp ?? 0), 0);
  } else e.hp -= damage;
  e.hurt = 0.15;
  event(w, {
    type: "hit",
    ...impact,
    owner,
    amount: Math.round(damage),
  });
  if (e.hp <= 0) {
    w.totalKills++;
    w.waveKills++;
    const p = w.players.find((p) => p.id === owner);
    if (p) p.kills++;
    event(w, { type: "kill", ...impact, owner });
    if (random(w) < stageFor(w).dropRate && w.drops.length < 24)
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
export const eye = (e: Enemy) => e.y + ENEMIES[e.kind].aim;
export const enemyBodies = (e: Enemy) =>
  [
    {
      x: e.x,
      y: eye(e),
      z: e.z,
      radius: ENEMIES[e.kind].radius,
      part: 0,
      partHp: e.partHp,
    },
    ...(e.segments ?? []).map((s, i) => ({
      ...s,
      y: s.y + 2,
      radius: 2.2,
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
export function fire(w: World, p: Player, i: Input) {
  const weapon = p.weapons[p.slot],
    def = stats(weapon);
  if (p.reload > 0 || p.cool > 0 || p.swapCd > 0 || p.ammo[p.slot] <= 0) return;
  p.ammo[p.slot]--;
  p.cool = def.interval;
  let yaw = i.yaw,
    pitch = i.pitch;
  // A small cone only bends an explicitly fired shot toward a visible enemy.
  const candidates = w.enemies
    .filter((e) => e.hp > 0 && e.partHp !== 0)
    .map((e) => ({
      e,
      a: Math.atan2(e.x - p.x, -(e.z - p.z)),
      d: Math.hypot(e.x - p.x, e.z - p.z),
    }))
    .filter(
      (t) =>
        Math.abs(angle(t.a - yaw)) < 0.065 &&
        t.d < def.range &&
        Math.abs(pitch) < 0.18 &&
        // Only nudge towards something roughly at the shooter's own level. Without
        // this the cone snaps a level shot up onto a flier, and altitude stops
        // being something the player has to answer for.
        Math.abs(eye(t.e) - 1.5) < 2 &&
        visible(p, t.e, mapFor(w).blocks),
    )
    .sort((a, b) => a.d - b.d);
  if (candidates[0]) {
    yaw = candidates[0].a;
    pitch = Math.atan2(eye(candidates[0].e) - 1.5, candidates[0].d);
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
          y: 1.5,
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
        y: 1.5,
        z: p.z,
        tx: p.x + dx * 2,
        tz: p.z + dz * 2,
        ty: 1.5 + dy * 2,
        owner: p.id,
      });
      continue;
    }
    let range = wallDistance(
      p.x,
      1.5,
      p.z,
      dx,
      dy,
      dz,
      def.range,
      mapFor(w).blocks,
    );
    const hits = w.enemies
      .filter((e) => e.hp > 0)
      .map((e) => {
        const candidates = enemyBodies(e).map((body) => {
          const ey = body.y,
            along = (body.x - p.x) * dx + (body.z - p.z) * dz + (ey - 1.5) * dy;
          const distance = Math.hypot(
            body.x - p.x - dx * along,
            body.z - p.z - dz * along,
            ey - 1.5 - dy * along,
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
      );
      if (
        weapon.kind === "shotgun" &&
        weapon.effect === "repel" &&
        h.e.kind !== "boss" &&
        Math.hypot(h.e.x - p.x, eye(h.e) - 1.5, h.e.z - p.z) <= 8
      )
        repelled.add(h.e);
    }
    if (hits.length) range = hits[hits.length - 1].along;
    event(w, {
      type: "shot",
      weapon: weapon.kind,
      x: p.x,
      z: p.z,
      y: 1.5,
      tx: p.x + dx * range,
      tz: p.z + dz * range,
      ty: 1.5 + dy * range,
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
    if (p.safe > 5) p.hp = Math.min(160, p.hp + dt * 3);
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) p.ammo[p.slot] = stats(p.weapons[p.slot]).mag;
    }
    if (i.swap && p.swapCd <= 0) {
      p.slot = 1 - p.slot;
      p.reload = 0;
      p.swapCd = WEAPON_SWITCH_DURATION;
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
      speed = p.evade > 0 ? MOVE_SPEED.dodge : MOVE_SPEED.walk;
    move(
      p,
      ((i.mx * Math.cos(i.yaw) + i.mz * Math.sin(i.yaw)) / norm) * speed * dt,
      ((i.mx * Math.sin(i.yaw) - i.mz * Math.cos(i.yaw)) / norm) * speed * dt,
      0.55,
      mapFor(w).blocks,
    );
    if (i.fire) fire(w, p, i);
    for (const d of w.drops.filter(
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
      event(w, { type: "revive", x: p.x, z: p.z, y: 1 });
    }
  }
  const living = w.players.filter((p) => p.hp > 0 && p.connected);
  if (!living.length) {
    finish(w, false, "部隊が全員ダウンしました");
    return;
  }
  const plan = stageFor(w);
  const wave = plan.waves[w.wave - 1];
  if (!wave) return;
  if (
    w.spawned < troopCount(wave) &&
    w.enemies.length < LIMITS.enemies &&
    w.time >= w.nextSpawn
  ) {
    const kind = troopAt(wave, w.spawned);
    const factory = w.enemies.find(
      (e) => e.kind === "boss" && e.hp > 0 && foundryPhase(e) >= 2,
    );
    // Existing wave budget only: fabrication relocates the scheduled unit.
    if (factory && kind === "spitter") {
      spawn(w, kind, factory.x + 5, factory.z);
      factory.fabrication = 0.8;
    } else spawn(w, kind);
    w.spawned++;
    w.nextSpawn = w.time + wave.interval;
  }
  if (w.spawned >= troopCount(wave) && w.enemies.every((e) => e.hp <= 0)) {
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
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    const t = selectStructureTarget(e, living, (p) =>
      visible(e, p, mapFor(w).blocks),
    )!;
    if (e.wind <= 0) e.targetId = t.id;
    if (e.kind === "boss") {
      e.phase = foundryPhase(e);
      e.fabrication = Math.max(0, (e.fabrication ?? 0) - dt);
    }
    const d = Math.hypot(t.x - e.x, t.z - e.z),
      def = ENEMIES[e.kind];
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
          event(w, { type: "burst", radius: 7, x: e.tx, z: e.tz, y: 0.1 });
          for (const p of living)
            if (
              Math.hypot(p.x - e.tx, p.z - e.tz) < 7 &&
              visible(e, p, mapFor(w).blocks)
            )
              hurtPlayer(w, p, def.damage, true);
          e.cool = 3;
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
            const length = Math.max(1e-8, Math.hypot(dist, 1.2 - height));
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
                    ? ((1.2 - height) / length) * speed
                    : gravity
                      ? (1.2 - height) / flight + 0.5 * gravity * flight
                      : ((1.2 - height) / Math.max(1, dist)) * speed,
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
              pd < 2.5 &&
              (px * ax + pz * az) / (Math.max(0.001, pd) * length) >= 0.5 &&
              visible(e, p, mapFor(w).blocks)
            )
              hurtPlayer(w, p, def.damage);
          }
          e.cool = 1.2;
        } else {
          if (d < 2.5 && e.y < 2) hurtPlayer(w, t, def.damage);
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
    let hit = wall < dist || q.y <= 0 || q.life <= 0;
    q.y = Math.max(0, q.y);
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
          x: q.x,
          z: q.z,
          y: q.y,
          owner: q.owner,
        });
        for (const e of w.enemies) {
          for (const b of enemyBodies(e)) {
            const d = Math.hypot(
              b.x - q.x,
              b.z - q.z,
              e.segments ? b.y - q.y : 0,
            );
            const clear = e.segments
              ? d < 0.01 ||
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
                  d - 0.01
              : visible(q, b, mapFor(w).blocks);
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
        if (!hit && Math.hypot(p.x - q.x, p.z - q.z, 1.2 - q.y) < 1) {
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
  if (w.time > 600) finish(w, false, "作戦時間の上限（10分）に達しました");
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
    Math.abs(i.pitch) <= 0.8 &&
    Number.isSafeInteger(i.seq) &&
    i.seq >= 0 &&
    ["fire", "reload", "dodge", "swap", "revive"].every(
      (k) => typeof i[k as keyof Input] === "boolean",
    )
  );
}
