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
  inputs: Record<string, { buddySkill?: boolean }>,
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
      delete state.buffs[id];
      continue;
    }
    const position = resolvePosition ? resolvePosition(p, b) : feet(p);
    b.visible = position !== null;
    if (position) Object.assign(b, position);
    const healTime = Math.max(
      0,
      Math.min(w.time, b.healUntil) - (w.time - delta),
    );
    if (healTime > 0 && b.healRate > 0)
      p.hp = Math.min(maxHp(w), p.hp + b.healRate * healTime);
    const pressed = inputs[id]?.buddySkill === true;
    if (pressed && !b.skillHeld) activateBuddySkill(w, state, id);
    b.skillHeld = pressed;
    if (!b.visible || w.time < b.attackReadyAt) continue;
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

export function activateBuddySkill(
  w: World,
  state: BuddyBattleState,
  ownerId: string,
) {
  const b = state.entries[ownerId],
    p = w.players.find((player) => player.id === ownerId);
  if (
    !active(w, state) ||
    !b ||
    !p ||
    !alive(p) ||
    !b.visible ||
    w.time < b.skillReadyAt
  )
    return false;
  if (b.buddyId === "yosuga") {
    // 満タンでは消費しない。回復は本人のみ、ダウンを蘇生しない。
    if (p.hp >= maxHp(w)) return false;
    b.healUntil = w.time + BUDDY_COMBAT.healDuration;
    b.healRate =
      (maxHp(w) * BUDDY_COMBAT.healFraction) / BUDDY_COMBAT.healDuration;
    event(w, {
      type: "heal",
      buddyEffect: "wind",
      silent: true,
      owner: ownerId,
      ...feet(p),
      duration: 5,
    });
  } else if (b.buddyId === "tatara") {
    const origin = { x: b.x, y: b.y, z: b.z };
    for (const enemy of w.enemies) {
      if (
        enemy.hp > 0 &&
        distance(origin, enemy) <= BUDDY_COMBAT.blastRadius &&
        visible(
          origin,
          { x: enemy.x, y: eye(enemy) - 1.2, z: enemy.z },
          mapFor(w).blocks,
        )
      )
        hurtEnemy(
          w,
          enemy,
          BUDDY_COMBAT.blastDamage * buddyGrowthFactor(b.level),
          ownerId,
        );
    }
    event(w, {
      type: "burst",
      buddyEffect: "fire",
      silent: true,
      owner: ownerId,
      ...origin,
      radius: BUDDY_COMBAT.blastRadius,
    });
  } else {
    for (const ally of w.players) {
      if (
        !alive(ally) ||
        distance(feet(p), feet(ally)) > BUDDY_COMBAT.supportRadius
      )
        continue;
      const buff = (state.buffs[ally.id] ??= { guardUntil: 0, boostUntil: 0 });
      const key = b.buddyId === "tobari" ? "guardUntil" : "boostUntil";
      // 同種の支援は倍率を重ねず、有効期限だけ更新する。
      buff[key] = Math.max(buff[key], w.time + BUDDY_COMBAT.supportDuration);
    }
    event(w, {
      type: "burst",
      buddyEffect: b.buddyId === "tobari" ? "ice" : "lightning",
      silent: true,
      owner: ownerId,
      ...feet(p),
      radius: BUDDY_COMBAT.supportRadius,
    });
  }
  b.skillReadyAt = w.time + BUDDY_COMBAT.cooldown[b.buddyId];
  b.lastSkillAt = w.time;
  b.displayUntil = w.time + 1;
  return true;
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
