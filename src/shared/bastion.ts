import {
  move,
  visible,
  wallDistance,
  type Enemy,
  type Player,
  type World,
} from "./game";
import { mapFor } from "./stages";
import { pursuitDirection } from "./enemy-motion";
import { enemyStatSize } from "./enemy-size";
import type { Block } from "./map-blocks";

/**
 * BASTION（仮称）: 短い間隔で撃たれ続けるほど装甲が硬化する浮遊装甲球。
 * 仮調整値。根拠と一覧は docs/BASTION.md。
 */
export const BASTION = {
  /** 支持面からコア中心までの高さ（ENEMIES.bastion.aim と一致）。 */
  hover: 1.7,
  speed: 2,
  preferred: 11,
  /** 直前の有効被弾からこの秒数以内の被弾だけを「連続」とみなす。 */
  chainWindow: 0.35,
  /** 個体全体で硬化が増える最短間隔。散弾・多段・協力の集中射撃も共通。 */
  gainInterval: 0.1,
  gain: 8,
  max: 100,
  /** 段階の下限値。0..24 / 25..49 / 50..74 / 75..100。 */
  tiers: [25, 50, 75],
  reduction: [0, 0.2, 0.4, 0.6],
  speedFactor: [1, 0.85, 0.65, 0.45],
  decayDelay: 1.2,
  decayRate: 40,
  /** 反撃: 予備動作（身体）→赤い予告→発射→装甲開放。 */
  counterAt: 75,
  brace: 0.8,
  warn: 0.8,
  open: 2.2,
  counterCooldown: 6,
  volley: { low: 6, full: 12 },
  bulletSpeed: 9,
  bulletRange: 18,
  bulletDamage: 12,
  /** 通常時の単発照準弾。PRISMより遅く、反撃より弱い。 */
  aimWind: 1.2,
  aimCooldown: 4.5,
  aimRange: 26,
  aimSpeed: 11,
  aimDamage: 10,
  /** トゲ展開分の当たり判定の拡張（半径m、最大）。最大0.5m突出するトゲの太い根元側。 */
  spikePad: 0.25,
  muzzle: 1.05,
  /**
   * 実弾（銃弾）への耐性。発射時に当たりが決まる弾（AR・SMG・散弾・スラッグ・
   * スナイパーなど）の直撃だけに掛ける。爆発・レーザー・副次効果には掛けない。
   * 硬化の軽減とは別に、硬化より先に掛かる。
   */
  bulletResist: 0.4,
  /**
   * 生存戦での出現（仮値）。出撃からこの秒数以降、前回の出現予告からこの間隔をあけ、
   * 同時は1体から `moreAt` の各時刻で1体ずつ増やす。体力は通常敵の半減を受けない。
   */
  survival: { from: 60, every: 30, preload: 30, moreAt: [180, 420] },
} as const;

/** 実弾の直撃に掛ける倍率。BASTION 以外・レーザーは 1。 */
export function bastionShotFactor(e: { bastion?: unknown }, weapon: string) {
  return e.bastion && weapon !== "laser" ? BASTION.bulletResist : 1;
}

/** 生存戦でこの戦闘時刻に同時に出せる BASTION の数。 */
export function bastionSurvivalCap(time: number) {
  return 1 + BASTION.survival.moreAt.filter((at) => time >= at).length;
}

export type BastionPhase = "guard" | "brace" | "warn" | "open";
export interface BastionState {
  armor: number;
  phase: BastionPhase;
  phaseAt: number;
  /** 最後に0より大きいダメージを受けた時刻。 */
  hitAt?: number;
  gainAt?: number;
  /**
   * 同じtickの被弾は1回の被弾として扱う。軽減率と「連続かどうか」は、
   * そのtickの最初の有効被弾の時点（それより前の被弾）で決めて固定する。
   */
  tickAt?: number;
  tickReduction?: number;
  tickChained?: boolean;
  readyAt: number;
  counters: number;
  /**
   * 赤い予告の開始時に確定し、発射まで変えない。
   * `turn` は配信で丸められない名前。予告と実弾の向きを全員で一致させる。
   */
  volley?: { count: number; turn: number; x: number; y: number; z: number };
  aim?: {
    started: number;
    committed?: {
      x: number;
      y: number;
      z: number;
      tx: number;
      ty: number;
      tz: number;
    };
  };
  aimReadyAt: number;
}

export function createBastion(w: World): BastionState {
  return {
    armor: 0,
    phase: "guard",
    phaseAt: w.time,
    readyAt: w.time,
    counters: 0,
    aimReadyAt: w.time + 1.5,
  };
}

export function bastionTier(armor: number) {
  return BASTION.tiers.filter((t) => armor >= t).length;
}

/** 現在の軽減率。開放中は0。 */
export function bastionReduction(s: BastionState) {
  return s.phase === "open" ? 0 : BASTION.reduction[bastionTier(s.armor)];
}

/** トゲの展開量 0..1。描画と当たり判定の拡張で共有する。 */
export function bastionSpikes(s: BastionState) {
  if (s.phase === "open") return 0;
  if (s.phase === "brace" || s.phase === "warn") return 1;
  return bastionTier(s.armor) / BASTION.tiers.length;
}

export function bastionCenter(e: Pick<Enemy, "x" | "y" | "z" | "size">) {
  return { x: e.x, y: e.y + BASTION.hover * enemyStatSize(e), z: e.z };
}

/**
 * hurtEnemy から呼ばれる唯一の入口。軽減後のダメージを返す。
 * - 同じtickの被弾（散弾の全ペレット、貫通、爆風、誘爆、前線の副次効果）は
 *   1回の被弾として扱う。軽減率も連続判定もtickの最初の有効被弾で固定し、
 *   同じtickの2発目以降が1発目と「連続」になることはない。
 * - 連続とみなすのは、前のtickまでの最後の有効被弾から chainWindow 秒以内。
 *   最初の1発（の入ったtick）は起点のみ。
 * - 加算は gainInterval 秒に1回まで。人数・発射レートに関係なく上限が同じ。
 * - 0以下のダメージは連続判定も減衰の延長もしない。
 */
export function bastionDamage(w: World, e: Enemy, damage: number) {
  const s = e.bastion;
  if (!s || !(damage > 0)) return damage;
  if (s.tickAt !== w.time) {
    s.tickAt = w.time;
    s.tickReduction = bastionReduction(s);
    s.tickChained =
      s.hitAt !== undefined && w.time - s.hitAt <= BASTION.chainWindow + 1e-9;
  }
  const canGain =
    (s.phase === "guard" || s.phase === "brace") &&
    (s.gainAt === undefined ||
      w.time - s.gainAt >= BASTION.gainInterval - 1e-9);
  if (s.tickChained && canGain) {
    s.armor = Math.min(BASTION.max, s.armor + BASTION.gain);
    s.gainAt = w.time;
  }
  s.hitAt = w.time;
  return damage * (1 - (s.tickReduction ?? 0));
}

/** 直近の被弾に適用した軽減の段階（0〜3）。被弾イベントの装甲火花に使う。 */
export function bastionGuard(s: BastionState) {
  const reduction = s.tickReduction ?? 0;
  return reduction > 0
    ? (BASTION.reduction as readonly number[]).indexOf(reduction)
    : 0;
}

function bulletOrigin(c: { x: number; y: number; z: number }, yaw: number) {
  return {
    x: c.x + Math.sin(yaw) * BASTION.muzzle,
    y: c.y,
    z: c.z + Math.cos(yaw) * BASTION.muzzle,
  };
}

/** 確定済み斉射の各レーン。赤い予告と実弾で同じ値を使う。 */
export function bastionLanes(
  volley: NonNullable<BastionState["volley"]>,
  blocks: Block[],
) {
  return Array.from({ length: volley.count }, (_, i) => {
    const yaw = volley.turn + (i * Math.PI * 2) / volley.count;
    const from = bulletOrigin(volley, yaw);
    const dx = Math.sin(yaw),
      dz = Math.cos(yaw);
    const length = wallDistance(
      from.x,
      from.y,
      from.z,
      dx,
      0,
      dz,
      BASTION.bulletRange,
      blocks,
    );
    return {
      yaw,
      from,
      to: { x: from.x + dx * length, y: from.y, z: from.z + dz * length },
      length,
    };
  });
}

/** 単発照準弾の確定済み軌道。予告と実弾で共有。 */
export function bastionAimLane(
  c: NonNullable<NonNullable<BastionState["aim"]>["committed"]>,
  blocks: Block[],
) {
  const dx = c.tx - c.x,
    dy = c.ty - c.y,
    dz = c.tz - c.z,
    d = Math.max(1e-6, Math.hypot(dx, dy, dz));
  const length = wallDistance(
    c.x,
    c.y,
    c.z,
    dx / d,
    dy / d,
    dz / d,
    BASTION.aimRange,
    blocks,
  );
  return {
    from: { x: c.x, y: c.y, z: c.z },
    to: {
      x: c.x + (dx / d) * length,
      y: c.y + (dy / d) * length,
      z: c.z + (dz / d) * length,
    },
    direction: { x: dx / d, y: dy / d, z: dz / d },
    length,
  };
}

// 個体IDと反撃回数だけで決まる。発射ごとにレーンがずれ、乱数列は消費しない。
function volleyYaw(e: Enemy, s: BastionState, count: number) {
  let n =
    Math.imul(e.id + 97, 374761393) ^ Math.imul(s.counters + 11, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((((n ^ (n >>> 16)) >>> 0) / 4294967296) * Math.PI * 2) / count;
}

function enter(w: World, s: BastionState, phase: BastionPhase) {
  s.phase = phase;
  s.phaseAt = w.time;
  // 相が変わったtickでは、その後の被弾（爆風・誘爆は敵の処理より後）に新しい相の
  // 軽減率を使う。連続判定と加算の上限はtickの最初の被弾のまま変えない。
  if (s.tickAt === w.time) s.tickReduction = bastionReduction(s);
}

/**
 * 弾の高さ bulletY のレーン上で、支持面 groundY に立つ隊員が実際に当たる片側の幅。
 * 敵弾の判定（game.ts: 胴 y+1.2 と弾の距離が 1m 未満）と同じ式。0 なら当たらない。
 */
export function bastionLaneHalfWidth(bulletY: number, groundY: number) {
  const dy = groundY + 1.2 - bulletY;
  return Math.sqrt(Math.max(0, 1 - dy * dy));
}

export function stepBastion(w: World, e: Enemy, target: Player, dt: number) {
  const s = (e.bastion ??= createBastion(w)),
    blocks = mapFor(w).blocks,
    age = w.time - s.phaseAt;
  if (s.phase === "guard") {
    // 自然解除: 最後の有効被弾から decayDelay 秒後に減衰を始める。
    if (s.armor > 0 && w.time - (s.hitAt ?? -Infinity) >= BASTION.decayDelay)
      s.armor = Math.max(0, s.armor - BASTION.decayRate * dt);
    if (s.armor >= BASTION.counterAt && w.time >= s.readyAt) {
      s.aim = undefined;
      enter(w, s, "brace");
      e.wind = BASTION.brace + BASTION.warn;
      return;
    }
  } else if (s.phase === "brace") {
    e.wind = Math.max(0, BASTION.brace + BASTION.warn - age);
    if (age + 1e-9 >= BASTION.brace) {
      const count =
        s.armor >= BASTION.max ? BASTION.volley.full : BASTION.volley.low;
      s.volley = { count, turn: volleyYaw(e, s, count), ...bastionCenter(e) };
      enter(w, s, "warn");
    }
    return;
  } else if (s.phase === "warn") {
    e.wind = Math.max(0, BASTION.warn - age);
    if (age + 1e-9 >= BASTION.warn) {
      const damage = BASTION.bulletDamage * enemyStatSize(e);
      // 予告済みの弾は既存の弾数上限で途中から切り捨てない。
      for (const lane of bastionLanes(s.volley!, blocks))
        w.projectiles.push({
          id: ++w.serial,
          ...lane.from,
          dx: Math.sin(lane.yaw) * BASTION.bulletSpeed,
          dy: 0,
          dz: Math.cos(lane.yaw) * BASTION.bulletSpeed,
          life: BASTION.bulletRange / BASTION.bulletSpeed,
          owner: "enemy",
          damage,
          rocket: false,
          style: "bastion",
        });
      s.counters++;
      s.readyAt = w.time + BASTION.counterCooldown;
      s.armor = 0;
      s.volley = undefined;
      e.wind = 0;
      enter(w, s, "open");
    }
    return;
  } else {
    if (age + 1e-9 >= BASTION.open) {
      s.hitAt = undefined;
      s.gainAt = undefined;
      s.aimReadyAt = Math.max(s.aimReadyAt, w.time + 1);
      enter(w, s, "guard");
    }
    return;
  }
  stepAim(w, e, s, target, blocks);
  if (s.aim) return;
  steer(w, e, s, target, dt, blocks);
}

function stepAim(
  w: World,
  e: Enemy,
  s: BastionState,
  target: Player,
  blocks: Block[],
) {
  const center = bastionCenter(e);
  if (!s.aim) {
    e.wind = 0;
    const d = Math.hypot(target.x - e.x, target.z - e.z);
    if (
      w.time >= s.aimReadyAt &&
      d <= BASTION.aimRange &&
      visible(e, target, blocks)
    ) {
      s.aim = { started: w.time };
      e.targetId = target.id;
      e.wind = BASTION.aimWind;
    }
    return;
  }
  const age = w.time - s.aim.started;
  e.wind = Math.max(0, BASTION.aimWind - age);
  const locked = w.players.find((p) => p.id === e.targetId) ?? target;
  // 前半は身体の予備動作で追従し、後半の赤表示開始で軌道を確定する。
  if (!s.aim.committed && age + 1e-9 >= BASTION.aimWind / 2) {
    const yaw = Math.atan2(locked.x - e.x, locked.z - e.z);
    const from = bulletOrigin(center, yaw);
    s.aim.committed = {
      ...from,
      tx: locked.x,
      ty: (locked.y ?? 0) + 1.2,
      tz: locked.z,
    };
    e.tx = locked.x;
    e.tz = locked.z;
    e.ty = locked.y ?? 0;
  }
  if (!s.aim.committed) e.heading = Math.atan2(locked.x - e.x, locked.z - e.z);
  if (age + 1e-9 >= BASTION.aimWind) {
    const lane = bastionAimLane(s.aim.committed!, blocks);
    w.projectiles.push({
      id: ++w.serial,
      ...lane.from,
      dx: lane.direction.x * BASTION.aimSpeed,
      dy: lane.direction.y * BASTION.aimSpeed,
      dz: lane.direction.z * BASTION.aimSpeed,
      life: BASTION.aimRange / BASTION.aimSpeed,
      owner: "enemy",
      damage: BASTION.aimDamage * enemyStatSize(e),
      rocket: false,
      style: "bastion",
    });
    s.aim = undefined;
    s.aimReadyAt = w.time + BASTION.aimCooldown;
    e.wind = 0;
  }
}

function steer(
  w: World,
  e: Enemy,
  s: BastionState,
  target: Player,
  dt: number,
  blocks: Block[],
) {
  const distance = Math.hypot(target.x - e.x, target.z - e.z);
  e.heading = Math.atan2(target.x - e.x, target.z - e.z);
  if (distance < 0.01) return;
  const speed = BASTION.speed * BASTION.speedFactor[bastionTier(s.armor)];
  const inward = {
    x: (target.x - e.x) / distance,
    z: (target.z - e.z) / distance,
  };
  // 推奨距離の周回。遮蔽で止まった時だけ既存の追跡方向へ切り替える。
  const correction = Math.max(
    -0.7,
    Math.min(0.9, (distance - BASTION.preferred) / 6),
  );
  const orbit = e.id % 2 ? 1 : -1;
  let dx = -inward.z * orbit + inward.x * correction,
    dz = inward.x * orbit + inward.z * correction;
  const norm = Math.hypot(dx, dz);
  dx /= norm;
  dz /= norm;
  const beforeX = e.x,
    beforeZ = e.z;
  move(e, dx * speed * dt, dz * speed * dt, 0.9, blocks);
  if (Math.hypot(e.x - beforeX, e.z - beforeZ) < speed * dt * 0.15) {
    const direction = pursuitDirection(w, e, target);
    move(e, direction.x * speed * dt, direction.z * speed * dt, 0.9, blocks);
  }
}
