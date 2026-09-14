import { newStats, type NewWeapon } from './progression';
export const EVADE_DURATION = 0.32;
export const WEAPON_SWITCH_DURATION = 0.5;
export const WEAPON_SWITCH_RESUME = 0.08;
export const HEAVY_HIT_DURATION = 1.2;
export type Kind = "rifle" | "shotgun" | "rocket";
export type Effect =
  "none" | "pierce" | "quick" | "reserve" | "repel" | "chain";
// One flat pool per kind; legacy quick and shotgun pierce remain loadable.
export const EFFECT_POOLS: Record<Kind, readonly Effect[]> = {
  rifle: ["reserve", "pierce"],
  shotgun: ["reserve", "repel"],
  rocket: ["reserve", "chain"],
};
// Every figure a weapon shows is rolled, not just damage. With one rolled stat
// a single best weapon dominated its whole family and the other seven slots
// were dead; with five that trade against each other, "better" stops being a
// single ordering.
export type Roll = "power" | "mag" | "reload" | "range" | "rate";
export const ROLLS: Roll[] = ["power", "mag", "reload", "range", "rate"];
// Reload is the one where a smaller number is the better outcome.
export const LOWER_IS_BETTER: Roll[] = ["reload"];
export interface Weapon {
  id: string;
  kind: Kind;
  rarity: 0 | 1 | 2 | 3 | 4;
  power: number;
  effect: Effect;
  // Absent on weapons saved before rolls existed; those read as base values.
  rolls?: Partial<Record<Roll, number>>;
}
export const WEAPONS = {
  rifle: {
    name: "AR-9 リーフ",
    damage: 24,
    interval: 0.13,
    mag: 32,
    reload: 1.65,
    range: 65,
    pellets: 1,
    spread: 0.008,
    radius: 0,
  },
  shotgun: {
    name: "SG-4 ブレイカー",
    damage: 19,
    interval: 0.8,
    mag: 7,
    reload: 2.1,
    range: 23,
    pellets: 8,
    spread: 0.1,
    radius: 0,
  },
  rocket: {
    name: "RL-2 コメット",
    damage: 170,
    interval: 1.15,
    mag: 2,
    reload: 2.7,
    range: 75,
    pellets: 1,
    spread: 0,
    radius: 6.5,
  },
} as const;
// `aim` is the body centre used by bullets and aim assist, measured from the unit's
// own base. `cruise` is how high that base floats; ground units keep it at 0, so
// their hit boxes are unchanged.
export const ENEMIES = {
  ant: { hp: 85, speed: 4.1, radius: 1.25, damage: 8, aim: 1.2, cruise: 0 },
  spider: { hp: 95, speed: 4.8, radius: 1.5, damage: 15, aim: 1, cruise: 0 },
  crawler: {
    hp: 75,
    speed: 3.5,
    radius: 1.25,
    damage: 10,
    aim: 1.4,
    cruise: 0,
  },
  spitter: {
    hp: 100,
    speed: 2.1,
    radius: 1.45,
    damage: 14,
    aim: 1.4,
    cruise: 0,
  },
  boss: { hp: 4200, speed: 1.4, radius: 4, damage: 40, aim: 3, cruise: 0 },
  // The only thing in the game faster than a walking player (7 m/s), so that
  // retreating while firing has a cost instead of being a free win.
  hornet: { hp: 60, speed: 8.2, radius: 1.15, damage: 12, aim: 1, cruise: 6.5 },
} as const;
// Short enough to sit beside a weapon name without pushing the row wider.
// LR is not drawn: it is what an SSR becomes when it also rolls an effect and
// lands in the top of its power band. See promote() in game.ts.
export const RARITIES = ["R", "SR", "SSR", "LR"];
export const POWER = {
  scale: 1000,
  min: 1000,
  // LR shares the SSR ceiling on purpose: it is recognition, not extra damage.
  max: [1120, 1240, 1360, 1360],
} as const;
// Each figure rolls in this band, in thousandths. It reaches below 1 on purpose:
// upside-only rolls just move the ceiling and rebuild the single best weapon.
export const ROLL = { scale: 1000, min: 800, max: 1250 } as const;
// Overall quality, 0..1, averaged over the five rolls. Reload is inverted so
// that 1 always means "the good end" whichever direction that is.
export function quality(w: Weapon) {
  const span = ROLL.max - ROLL.min;
  return (
    ROLLS.reduce((sum, key) => {
      const milli = Math.round((w.rolls?.[key] ?? 1) * ROLL.scale);
      const at = (milli - ROLL.min) / span;
      return sum + (LOWER_IS_BETTER.includes(key) ? 1 - at : at);
    }, 0) / ROLLS.length
  );
}
export function validRoll(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  const milli = Math.round(value * ROLL.scale);
  return value === milli / ROLL.scale && milli >= ROLL.min && milli <= ROLL.max;
}
// A drop is promoted to LR only if it also carries an effect.
export const LR_QUALITY = 0.83;
// Quality thresholds for the tiers below it.
export const TIER_QUALITY = [0, 0.55, 0.7] as const;
// The numbers a weapon actually fights with. Every consumer goes through here so
// the armoury and the combat code can never disagree about what a weapon is.
export function stats(w: Weapon) {
  if ((w as NewWeapon).format === 2) return newStats(w as NewWeapon);
  const d = WEAPONS[w.kind];
  const roll = (key: Roll) => w.rolls?.[key] ?? 1;
  return {
    ...d,
    damage: d.damage * w.power,
    // A rocket holds two rounds, so a percentage would round it to ruin; every
    // magazine keeps at least one and moves in whole rounds.
    mag: Math.max(1, Math.round(d.mag * roll("mag"))),
    reload: d.reload * roll("reload") * (w.effect === "quick" ? 0.8 : 1),
    range: d.range * roll("range"),
    interval: d.interval / roll("rate"),
  };
}
// Read ammunition at reload start. Ammo stays unchanged until completion,
// allowing the HUD and authoritative simulation to share this duration.
export function reloadDuration(w: Weapon, ammo: number) {
  const d = stats(w);
  const remaining = Math.max(0, Math.min(d.mag, ammo));
  return (
    d.reload * (w.effect === "reserve" ? 1 - (0.5 * remaining) / d.mag : 1)
  );
}
// Damage is rolled on its own band and the tier is read from all five rolls
// afterwards, so a low tier can legitimately carry high damage and pay for it
// elsewhere. The ceiling is therefore the band's, not the tier's.
export function validPower(power: number, rarity: Weapon["rarity"]) {
  void rarity;
  const milli = Math.round(power * POWER.scale);
  return (
    Number.isFinite(power) &&
    power === milli / POWER.scale &&
    milli >= POWER.min &&
    milli <= POWER.max[POWER.max.length - 1]
  );
}
export const WAVE_QUOTAS = [0, 45, 55, 65] as const;
export const WAVE_INTERVAL = 4;
export const MOVE_SPEED = { walk: 7, dodge: 17 } as const;
export const EFFECTS = {
  none: "標準仕様",
  pierce: "貫通：最大3体",
  quick: "高速装填：20%短縮",
  reserve: "残弾装填",
  repel: "撃退散弾",
  chain: "誘爆弾頭",
};
export function effectLabel(w: Weapon) {
  return isSpecialEffect(w.effect, w.kind) ? EFFECTS[w.effect] : "ー";
}
// Legacy quick remains part of the displayed reload stat, never a special effect.
export function isSpecialEffect(effect: Effect, kind: Kind) {
  return (
    effect !== "none" &&
    effect !== "quick" &&
    !(kind === "shotgun" && effect === "pierce")
  );
}
export const STARTERS: Weapon[] = (
  ["rifle", "shotgun", "rocket"] as Kind[]
).map((kind) => ({
  id: `starter-${kind}`,
  kind,
  rarity: 0,
  power: 1,
  effect: "none",
}));
export const LIMITS = {
  players: 4,
  enemies: 40,
  inventory: 80,
  // Per weapon family. A single 80-slot pile made "pick one to drop" a choice
  // between eighty things; eight of one family is a comparison you can make.
  perKind: 8,
  inputHz: 20,
  snapshotHz: 10,
  messageBytes: 2048,
  reconnectMs: 30000,
  roomMs: 3600000,
  idleMs: 180000,
};
export { BLOCKS, type Block } from "./map-blocks";
export function validWeapon(w: unknown): w is Weapon {
  if (!w || typeof w !== "object") return false;
  const v = w as Weapon;
  return (
    !('format' in v) &&
    typeof v.id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(v.id) &&
    Object.hasOwn(WEAPONS, v.kind) &&
    [0, 1, 2, 3].includes(v.rarity) &&
    validPower(v.power, v.rarity) &&
    (v.rolls === undefined ||
      (typeof v.rolls === "object" &&
        v.rolls !== null &&
        Object.entries(v.rolls).every(
          ([key, value]) => ROLLS.includes(key as Roll) && validRoll(value),
        ))) &&
    Object.hasOwn(EFFECTS, v.effect) &&
    (v.effect === "none" || v.rarity > 0) &&
    (v.effect !== "pierce" || v.kind !== "rocket") &&
    (v.effect !== "repel" || v.kind === "shotgun") &&
    (v.effect !== "chain" || v.kind === "rocket")
  );
}
