import {
  BLOCKS,
  ENEMIES,
  LIMITS,
  STARTERS,
  WEAPONS,
  POWER,
  WAVE_QUOTAS,
  WAVE_INTERVAL,
  MOVE_SPEED,
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
  kills: number;
  connected: boolean;
  ack: number;
  hurt: number;
  safe: number;
}
export interface Enemy {
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
}
export interface Event {
  id: number;
  type: "shot" | "hit" | "burst" | "kill" | "down" | "revive";
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
export function createWorld(run: string, seed = 123): World {
  return {
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
    z: 17,
    yaw: 0,
    pitch: 0,
    hp: 160,
    down: 0,
    revive: 0,
    weapons: structuredClone(weapons),
    slot: 0,
    ammo: weapons.map((a) => WEAPONS[a.kind].mag),
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
}
export function random(w: World) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
export function loot(w: World): Weapon {
  const r = random(w),
    rarity = r < 0.65 ? 0 : r < 0.93 ? 1 : 2;
  const kind = (["rifle", "shotgun", "rocket"] as const)[
    Math.floor(random(w) * 3)
  ];
  return {
    id: `${w.run}-${++w.serial}`,
    kind,
    rarity,
    power:
      (POWER.min +
        Math.floor(random(w) * (POWER.max[rarity] - POWER.min + 1))) /
      POWER.scale,
    effect:
      rarity && random(w) < 0.6
        ? kind !== "rocket" && random(w) < 0.55
          ? "pierce"
          : "quick"
        : "none",
  };
}
export function blocked(x: number, z: number, r = 0.55) {
  return (
    Math.abs(x) > 47 - r ||
    Math.abs(z) > 52 - r ||
    BLOCKS.some(
      (b) => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r,
    )
  );
}
export function move(
  p: { x: number; z: number },
  dx: number,
  dz: number,
  r = 0.55,
) {
  if (!blocked(p.x + dx, p.z, r)) p.x += dx;
  if (!blocked(p.x, p.z + dz, r)) p.z += dz;
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
) {
  let best = max;
  for (const b of BLOCKS) {
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
export function visible(
  a: { x: number; z: number },
  b: { x: number; z: number },
) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  return (
    wallDistance(a.x, 1.2, a.z, (b.x - a.x) / d, 0, (b.z - a.z) / d, d) >=
    d - 0.01
  );
}
export function event(w: World, e: Omit<Event, "id">) {
  w.events.push({ ...e, id: ++w.eventSerial });
  if (w.events.length > 80) w.events.shift();
}
export function spawn(w: World, kind: Enemy["kind"], x?: number, z?: number) {
  if (w.enemies.length >= LIMITS.enemies) return;
  const a = random(w) * Math.PI * 2;
  let ex = x ?? Math.sin(a) * 10,
    ez = z ?? (random(w) < 0.5 ? -46 : 46);
  // A flier is never trapped by a building, so it keeps its requested spot.
  if (!ENEMIES[kind].cruise && blocked(ex, ez, ENEMIES[kind].radius)) {
    ex = 0;
    ez = -43;
  }
  const hp = ENEMIES[kind].hp * w.scale;
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
  });
}
function hurtPlayer(w: World, p: Player, damage: number) {
  if (p.hp <= 0 || p.evade > 0) return;
  p.hp = Math.max(0, p.hp - damage);
  p.hurt = 0.2;
  p.safe = 0;
  if (!p.hp) {
    p.down = 25;
    event(w, { type: "down", x: p.x, z: p.z, y: 1 });
  }
}
function hurtEnemy(w: World, e: Enemy, damage: number, owner: string) {
  if (e.hp <= 0) return;
  e.hp -= damage;
  e.hurt = 0.15;
  event(w, { type: "hit", x: e.x, z: e.z, y: 1.5, owner });
  if (e.hp <= 0) {
    w.totalKills++;
    w.waveKills++;
    const p = w.players.find((p) => p.id === owner);
    if (p) p.kills++;
    event(w, { type: "kill", x: e.x, z: e.z, y: 1.2, owner });
    if (random(w) < 0.09 && w.drops.length < 24)
      for (const p of w.players) {
        if (w.drops.length >= 24) break;
        const weapon = loot(w);
        w.drops.push({ id: weapon.id, x: e.x, z: e.z, owner: p.id, weapon });
      }
    if (e.kind === "boss") finish(w, true);
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
export function fire(w: World, p: Player, i: Input) {
  const weapon = p.weapons[p.slot],
    def = WEAPONS[weapon.kind];
  if (p.reload > 0 || p.cool > 0 || p.ammo[p.slot] <= 0) return;
  p.ammo[p.slot]--;
  p.cool = def.interval;
  let yaw = i.yaw,
    pitch = i.pitch;
  // A small cone only bends an explicitly fired shot toward a visible enemy.
  const candidates = w.enemies
    .filter((e) => e.hp > 0)
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
        visible(p, t.e),
    )
    .sort((a, b) => a.d - b.d);
  if (candidates[0]) {
    yaw = candidates[0].a;
    pitch = Math.atan2(eye(candidates[0].e) - 1.5, candidates[0].d);
  }
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
          damage: def.damage * weapon.power,
          rocket: true,
        });
      event(w, {
        type: "shot",
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
    let range = wallDistance(p.x, 1.5, p.z, dx, dy, dz, def.range);
    const hits = w.enemies
      .filter((e) => e.hp > 0)
      .map((e) => {
        const ey = eye(e),
          along = (e.x - p.x) * dx + (e.z - p.z) * dz + (ey - 1.5) * dy;
        const distance = Math.hypot(
          e.x - p.x - dx * along,
          e.z - p.z - dz * along,
          ey - 1.5 - dy * along,
        );
        return { e, along, distance };
      })
      .filter(
        (h) =>
          h.along > 0 &&
          h.along < range &&
          h.distance < ENEMIES[h.e.kind].radius,
      )
      .sort((a, b) => a.along - b.along)
      .slice(0, weapon.effect === "pierce" ? 3 : 1);
    for (const h of hits)
      hurtEnemy(
        w,
        h.e,
        def.damage *
          weapon.power *
          (weapon.kind === "shotgun" ? Math.max(0.3, 1 - h.along / 35) : 1),
        p.id,
      );
    if (hits.length) range = hits[hits.length - 1].along;
    event(w, {
      type: "shot",
      x: p.x,
      z: p.z,
      y: 1.5,
      tx: p.x + dx * range,
      tz: p.z + dz * range,
      ty: 1.5 + dy * range,
      owner: p.id,
    });
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
    p.swapCd = Math.max(0, p.swapCd - dt);
    p.evade = Math.max(0, p.evade - dt);
    if (p.hp <= 0) {
      continue;
    }
    p.safe += dt;
    if (p.safe > 5) p.hp = Math.min(160, p.hp + dt * 3);
    if (p.reload > 0) {
      p.reload -= dt;
      if (p.reload <= 0) p.ammo[p.slot] = WEAPONS[p.weapons[p.slot].kind].mag;
    }
    if (i.swap && p.swapCd <= 0) {
      p.slot = 1 - p.slot;
      p.reload = 0;
      p.swapCd = 0.4;
    }
    if (
      (i.reload || p.ammo[p.slot] === 0) &&
      p.reload <= 0 &&
      p.ammo[p.slot] < WEAPONS[p.weapons[p.slot].kind].mag
    )
      p.reload =
        WEAPONS[p.weapons[p.slot].kind].reload *
        (p.weapons[p.slot].effect === "quick" ? 0.8 : 1);
    if (i.dodge && p.evadeCd <= 0) {
      p.evade = 0.32;
      p.evadeCd = 2.2;
    }
    const norm = Math.max(1, Math.hypot(i.mx, i.mz)),
      speed = p.evade > 0 ? MOVE_SPEED.dodge : MOVE_SPEED.walk;
    move(
      p,
      ((i.mx * Math.cos(i.yaw) + i.mz * Math.sin(i.yaw)) / norm) * speed * dt,
      ((i.mx * Math.sin(i.yaw) - i.mz * Math.cos(i.yaw)) / norm) * speed * dt,
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
        visible(a, p),
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
  const quota = WAVE_QUOTAS[w.wave] ?? 0;
  if (
    w.wave <= 3 &&
    w.spawned < quota &&
    w.enemies.length < LIMITS.enemies &&
    w.time >= w.nextSpawn
  ) {
    // Trial mix. Hornets stay out of wave 1 so the opening is still readable
    // before the player has any reason to look up.
    const roll = random(w);
    spawn(
      w,
      roll < 0.2 && w.wave > 1 ? "hornet" : roll < 0.45 ? "spitter" : "crawler",
    );
    w.spawned++;
    w.nextSpawn = w.time + 0.7;
  }
  if (w.wave <= 3 && w.spawned >= quota && w.enemies.every((e) => e.hp <= 0)) {
    w.waveClearAt ??= w.time;
  } else w.waveClearAt = null;
  if (w.waveClearAt !== null && w.time - w.waveClearAt >= WAVE_INTERVAL) {
    w.wave++;
    w.waveAt = w.time;
    w.waveClearAt = null;
    w.spawned = 0;
    w.waveKills = 0;
    for (const p of living) p.hp = Math.min(160, p.hp + 45);
    if (w.wave === 4) spawn(w, "boss", 0, -35);
  }
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    e.hurt = Math.max(0, e.hurt - dt);
    const t = living.reduce((a, b) =>
      Math.hypot(a.x - e.x, a.z - e.z) < Math.hypot(b.x - e.x, b.z - e.z)
        ? a
        : b,
    );
    const d = Math.hypot(t.x - e.x, t.z - e.z),
      def = ENEMIES[e.kind];
    e.cool -= dt;
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) {
        if (e.kind === "boss") {
          event(w, { type: "burst", x: e.tx, z: e.tz, y: 0.1 });
          for (const p of living)
            if (Math.hypot(p.x - e.tx, p.z - e.tz) < 7 && visible(e, p))
              hurtPlayer(w, p, def.damage);
          e.cool = 3;
        } else if (e.kind === "spitter") {
          const dist = Math.hypot(e.tx - e.x, e.tz - e.z);
          if (w.projectiles.length < 100)
            w.projectiles.push({
              id: ++w.serial,
              x: e.x,
              z: e.z,
              y: 1.1,
              dx: ((e.tx - e.x) / dist) * 13,
              dz: ((e.tz - e.z) / dist) * 13,
              dy: 0,
              life: 4,
              owner: "enemy",
              damage: def.damage,
              rocket: false,
            });
          e.cool = 2.7;
        } else {
          if (d < 2.5) hurtPlayer(w, t, def.damage);
          e.cool = 1.2;
        }
      }
      continue;
    }
    const stop = e.kind === "spitter" ? 17 : e.kind === "boss" ? 10 : 2;
    if (d > stop) {
      if (def.cruise) {
        // Nothing to walk around up there, so a flier takes the straight line.
        e.x += ((t.x - e.x) / d) * def.speed * dt;
        e.z += ((t.z - e.z) / d) * def.speed * dt;
      } else {
        const old = { x: e.x, z: e.z };
        move(
          e,
          ((t.x - e.x) / d) * def.speed * dt,
          ((t.z - e.z) / d) * def.speed * dt,
          def.radius * 0.65,
        );
        if (Math.hypot(e.x - old.x, e.z - old.z) < 0.01)
          move(e, Math.sign(-e.x || 1) * def.speed * dt, 0, def.radius * 0.65);
      }
    }
    // Dropping to strike and climbing back out is what makes altitude something
    // the player has to read, rather than a constant the map could ignore.
    if (def.cruise) {
      const want = d < 7 ? 1.2 : def.cruise,
        step = 5 * dt;
      e.y += Math.max(-step, Math.min(step, want - e.y));
    }
    if (
      e.cool <= 0 &&
      d < (e.kind === "boss" ? 28 : e.kind === "spitter" ? 33 : 2.6) &&
      visible(e, t)
    ) {
      e.wind = e.kind === "boss" ? 1.8 : e.kind === "spitter" ? 0.8 : 0.45;
      e.tx = t.x;
      e.tz = t.z;
    }
  }
  for (const q of w.projectiles) {
    const dx = q.dx * dt,
      dz = q.dz * dt,
      dy = q.dy * dt,
      dist = Math.hypot(dx, dy, dz);
    const wall = wallDistance(
      q.x,
      q.y,
      q.z,
      dx / dist,
      dy / dist,
      dz / dist,
      dist,
    );
    q.x += dx * Math.min(1, wall / dist);
    q.z += dz * Math.min(1, wall / dist);
    q.y += dy * Math.min(1, wall / dist);
    q.life -= dt;
    let hit = wall < dist || q.y < 0 || q.life <= 0;
    if (q.rocket) {
      hit ||= w.enemies.some(
        (e) =>
          e.hp > 0 &&
          Math.hypot(
            e.x - q.x,
            e.z - q.z,
            (e.kind === "boss" ? 3 : 1.4) - q.y,
          ) < ENEMIES[e.kind].radius,
      );
      if (hit) {
        event(w, { type: "burst", x: q.x, z: q.z, y: q.y, owner: q.owner });
        for (const e of w.enemies) {
          const d = Math.hypot(e.x - q.x, e.z - q.z);
          if (d < 6.5 && visible(q, e))
            hurtEnemy(w, e, q.damage * (1 - d / 9), q.owner);
        }
      }
    } else {
      for (const p of living)
        if (Math.hypot(p.x - q.x, p.z - q.z) < 1) {
          hurtPlayer(w, p, q.damage);
          hit = true;
        }
    }
    if (hit) q.life = -1;
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
