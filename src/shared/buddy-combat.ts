import {
  event,
  eye,
  hurtEnemy,
  visible,
  type Player,
  type World,
} from "./game";
import { mapFor } from "./stages";
import { maxHp } from "./solo-progression";
import { buddyGrowthFactor, type BuddyId } from "./buddy-progression";
import { isBuddyId } from "./buddy-progression";

export interface BuddyEquipment {
  id: BuddyId;
  level: number;
}
/** 所持の証明ではなく既存のローカル装備送信と同じ信頼境界での型/範囲検証。 */
export function validBuddyEquipment(value: unknown): value is BuddyEquipment {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<BuddyEquipment>;
  return (
    isBuddyId(v.id) &&
    Number.isSafeInteger(v.level) &&
    v.level! >= 1 &&
    v.level! <= 40
  );
}

/** 育成は攻撃威力だけに反映。回復量・軽減率・移動倍率は初期承認値を維持。 */
export const BUDDY_COMBAT = {
  chargeThreshold: 0.2,
  chargeDuration: 1.5,
  castDuration: { tatara: 0.65, yosuga: 0.35, tobari: 0.35, oriha: 0.35 },
  recoveryDuration: 0.2,
  attackDamage: 12,
  attackInterval: 1.2,
  attackRange: 10,
  blastDamage: 60,
  blastRadius: 4,
  supportRadius: 5,
  supportDuration: 6,
  healDuration: 5,
  healFraction: 0.25,
  guardReduction: 0.3,
  moveMultiplier: 1.2,
  evadeCooldownMultiplier: 0.8,
  cooldown: { tatara: 20, yosuga: 25, tobari: 25, oriha: 25 },
} as const;

export interface BuddyPosition {
  x: number;
  y: number;
  z: number;
}
export interface BuddyCombatEntry extends BuddyPosition {
  buddyId: BuddyId;
  level: number;
  attackReadyAt: number;
  skillReadyAt: number;
  skillHeld: boolean;
  /** Optional for snapshots from an already running pre-charge room. */
  chargeStartedAt?: number;
  skillStartedAt?: number;
  skillImpactAt?: number;
  skillCharge?: number;
  skillPending?: boolean;
  skillOrigin?: BuddyPosition;
  displayUntil: number;
  lastAttackAt: number;
  lastSkillAt: number;
  healUntil: number;
  healRate: number;
  visible: boolean;
}
export interface BuddyBattleState {
  run: string;
  entries: Record<string, BuddyCombatEntry>;
  buffs: Record<string, { guardUntil: number; boostUntil: number }>;
}
export function createBuddyBattleState(w: World): BuddyBattleState {
  return { run: w.run, entries: {}, buffs: {} };
}
export function buddyMode(w: World) {
  return !w.front && !w.rebuild && !w.defense && !w.training;
}
export function equipBattleBuddy(
  state: BuddyBattleState,
  owner: Player,
  buddyId: BuddyId,
  level = 1,
) {
  // 出撃準備でだけ呼ぶ。再接続では既存stateを保持してCDをリセットしない。
  state.entries[owner.id] = {
    buddyId,
    level,
    x: owner.x,
    y: owner.y ?? 0,
    z: owner.z,
    attackReadyAt: 0,
    skillReadyAt: 0,
    skillHeld: false,
    chargeStartedAt: -1,
    skillStartedAt: -1,
    skillImpactAt: -1,
    skillCharge: 0,
    skillPending: false,
    displayUntil: 0,
    lastAttackAt: -1,
    lastSkillAt: -1,
    healUntil: 0,
    healRate: 0,
    visible: true,
  };
}
const active = (w: World, state: BuddyBattleState) =>
  state.run === w.run && buddyMode(w) && w.phase === "battle";
const alive = (p: Player) => p.connected && p.hp > 0;
const distance = (a: BuddyPosition, b: BuddyPosition) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const feet = (p: Player): BuddyPosition => ({ x: p.x, y: p.y ?? 0, z: p.z });

/** callbackは権威側の追従位置。nullは壁/足場で表示できないため攻撃不可。 */
export function tickBuddyCombat(
  w: World,
  state: BuddyBattleState,
  inputs: Record<string, { buddySkill?: boolean; buddyCharge?: boolean }>,
  dt: number,
  resolvePosition?: (p: Player, b: BuddyCombatEntry) => BuddyPosition | null,
) {
  if (!active(w, state)) return;
  const delta = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
  if (!delta) return;
  for (const id of Object.keys(state.entries)) {
    const b = state.entries[id],
      p = w.players.find((player) => player.id === id);
    if (!p) {
      delete state.entries[id];
      delete state.buffs[id];
      continue;
    }
    if (!alive(p)) {
      b.visible = false;
      b.healUntil = 0;
      b.healRate = 0;
      // 切断中の要求を再接続時の押下として使わない。
      b.skillHeld = inputs[id]?.buddySkill === true;
      b.chargeStartedAt = -1;
      b.skillPending = false;
      b.skillStartedAt = -1;
      b.skillImpactAt = -1;
      delete state.buffs[id];
      continue;
    }
    // Cast stays at the release point instead of sliding after its owner.
    const casting =
      (b.skillStartedAt ?? -1) >= 0 &&
      w.time <= (b.skillImpactAt ?? -1) + BUDDY_COMBAT.recoveryDuration;
    const position = casting
      ? { x: b.x, y: b.y, z: b.z }
      : resolvePosition
        ? resolvePosition(p, b)
        : feet(p);
    b.visible = position !== null;
    if (position) Object.assign(b, position);
    const healTime = Math.max(
      0,
      Math.min(w.time, b.healUntil) - (w.time - delta),
    );
    if (healTime > 0 && b.healRate > 0)
      p.hp = Math.min(maxHp(w), p.hp + b.healRate * healTime);
    const pressed = inputs[id]?.buddySkill === true;
    const held = inputs[id]?.buddyCharge === true;
    if (pressed && !b.skillHeld) {
      const started = b.chargeStartedAt ?? -1;
      const charge = started >= 0 ? buddyChargeFraction(w.time - started) : 0;
      activateBuddySkill(w, state, id, charge);
      b.chargeStartedAt = -1;
    } else if (
      held &&
      b.visible &&
      w.time >= b.skillReadyAt &&
      !b.skillPending
    ) {
      if ((b.chargeStartedAt ?? -1) < 0) b.chargeStartedAt = w.time;
    } else if (!held || !b.visible) {
      // Releasing without the explicit action is cancellation, never a cast.
      b.chargeStartedAt = -1;
    }
    b.skillHeld = pressed;
    if (b.skillPending && w.time + 1e-8 >= (b.skillImpactAt ?? Infinity)) {
      b.skillPending = false;
      applyBuddySkill(w, state, id);
    }
    if (
      !b.visible ||
      b.skillPending ||
      (b.chargeStartedAt ?? -1) >= 0 ||
      w.time < b.attackReadyAt
    )
      continue;
    const origin = { x: b.x, y: b.y, z: b.z };
    const target = w.enemies
      .filter((e) => e.hp > 0)
      .filter(
        (e) =>
          distance(origin, { x: e.x, y: eye(e), z: e.z }) <=
          BUDDY_COMBAT.attackRange,
      )
      .filter((e) =>
        visible(origin, { x: e.x, y: eye(e) - 1.2, z: e.z }, mapFor(w).blocks),
      )
      .sort(
        (a, c) => distance(origin, a) - distance(origin, c) || a.id - c.id,
      )[0];
    if (!target) continue;
    b.attackReadyAt = w.time + BUDDY_COMBAT.attackInterval;
    b.lastAttackAt = w.time;
    b.displayUntil = Math.max(b.displayUntil, w.time + 0.3);
    event(w, {
      type: "shot",
      buddyEffect: "attack",
      silent: true,
      owner: id,
      x: b.x,
      y: b.y + 0.5,
      z: b.z,
      tx: target.x,
      ty: eye(target),
      tz: target.z,
    });
    hurtEnemy(
      w,
      target,
      BUDDY_COMBAT.attackDamage * buddyGrowthFactor(b.level),
      id,
    );
  }
  for (const id of Object.keys(state.buffs)) {
    const buff = state.buffs[id];
    if (
      !w.players.some((p) => p.id === id && alive(p)) ||
      (buff.guardUntil <= w.time && buff.boostUntil <= w.time)
    )
      delete state.buffs[id];
  }
}

/** Shared authoritative timing; clients send held/release, never a power number. */
export function buddyChargeFraction(seconds: number) {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (seconds - BUDDY_COMBAT.chargeThreshold) / BUDDY_COMBAT.chargeDuration,
    ),
  );
}
export function activateBuddySkill(
  w: World,
  state: BuddyBattleState,
  ownerId: string,
  charge = 0,
) {
  const b = state.entries[ownerId],
    p = w.players.find((player) => player.id === ownerId);
  if (
    !active(w, state) ||
    !b ||
    !p ||
    !alive(p) ||
    !b.visible ||
    b.skillPending ||
    w.time < b.skillReadyAt ||
    (b.buddyId === "yosuga" && p.hp >= maxHp(w))
  )
    return false;
  b.skillCharge = Number.isFinite(charge)
    ? Math.max(0, Math.min(1, charge))
    : 0;
  b.skillStartedAt = w.time;
  b.skillImpactAt = w.time + BUDDY_COMBAT.castDuration[b.buddyId];
  b.skillPending = true;
  b.skillOrigin = b.buddyId === "tatara" ? { x: b.x, y: b.y, z: b.z } : feet(p);
  b.skillReadyAt = w.time + BUDDY_COMBAT.cooldown[b.buddyId];
  b.displayUntil = b.skillImpactAt + BUDDY_COMBAT.recoveryDuration;
  return true;
}
function applyBuddySkill(w: World, state: BuddyBattleState, ownerId: string) {
  const b = state.entries[ownerId],
    p = w.players.find((player) => player.id === ownerId);
  if (!b || !p || !alive(p) || !b.visible) return;
  const charge = b.skillCharge ?? 0;
  const power = 1 + charge * 0.5;
  const center = b.skillOrigin ?? feet(p);
  if (b.buddyId === "yosuga") {
    // 満タンでは消費しない。回復は本人のみ、ダウンを蘇生しない。
    if (p.hp >= maxHp(w)) return false;
    b.healUntil = w.time + BUDDY_COMBAT.healDuration;
    b.healRate =
      (maxHp(w) * BUDDY_COMBAT.healFraction * power) /
      BUDDY_COMBAT.healDuration;
    event(w, {
      type: "heal",
      buddyEffect: "wind",
      silent: true,
      owner: ownerId,
      ...center,
      duration: 5,
    });
  } else if (b.buddyId === "tatara") {
    const origin = center;
    const radius = BUDDY_COMBAT.blastRadius * (1 + charge * 0.25);
    for (const enemy of w.enemies) {
      if (
        enemy.hp > 0 &&
        distance(origin, enemy) <= radius &&
        visible(
          origin,
          { x: enemy.x, y: eye(enemy) - 1.2, z: enemy.z },
          mapFor(w).blocks,
        )
      )
        hurtEnemy(
          w,
          enemy,
          BUDDY_COMBAT.blastDamage * buddyGrowthFactor(b.level) * power,
          ownerId,
        );
    }
    event(w, {
      type: "burst",
      buddyEffect: "fire",
      silent: true,
      owner: ownerId,
      ...origin,
      radius,
    });
  } else {
    for (const ally of w.players) {
      if (
        !alive(ally) ||
        distance(center, feet(ally)) > BUDDY_COMBAT.supportRadius
      )
        continue;
      const buff = (state.buffs[ally.id] ??= { guardUntil: 0, boostUntil: 0 });
      const key = b.buddyId === "tobari" ? "guardUntil" : "boostUntil";
      // 同種の支援は倍率を重ねず、有効期限だけ更新する。
      buff[key] = Math.max(
        buff[key],
        w.time + BUDDY_COMBAT.supportDuration * power,
      );
    }
    event(w, {
      type: "burst",
      buddyEffect: b.buddyId === "tobari" ? "ice" : "lightning",
      silent: true,
      owner: ownerId,
      ...center,
      radius: BUDDY_COMBAT.supportRadius,
    });
  }
  b.lastSkillAt = w.time;
}

function buffActive(
  w: World,
  state: BuddyBattleState | undefined,
  id: string,
  key: "guardUntil" | "boostUntil",
) {
  return (
    !!state &&
    active(w, state) &&
    w.players.some((p) => p.id === id && alive(p)) &&
    (state.buffs[id]?.[key] ?? 0) > w.time
  );
}
export function buddyDamageMultiplier(
  w: World,
  state: BuddyBattleState | undefined,
  id: string,
) {
  return buffActive(w, state, id, "guardUntil")
    ? 1 - BUDDY_COMBAT.guardReduction
    : 1;
}
export function buddyMoveMultiplier(
  w: World,
  state: BuddyBattleState | undefined,
  id: string,
) {
  return buffActive(w, state, id, "boostUntil")
    ? BUDDY_COMBAT.moveMultiplier
    : 1;
}
export function buddyEvadeCooldownMultiplier(
  w: World,
  state: BuddyBattleState | undefined,
  id: string,
) {
  return buffActive(w, state, id, "boostUntil")
    ? BUDDY_COMBAT.evadeCooldownMultiplier
    : 1;
}
