import { newStats, validNewWeapon, type NewWeapon } from "./progression";
export const EVADE_DURATION = 0.32;
export const WEAPON_SWITCH_DURATION = 0.5;
export const WEAPON_SWITCH_RESUME = 0.08;
export const HEAVY_HIT_DURATION = 1.2;
// A family is what a weapon *is* mechanically; a kind is one weapon in it. The
// three original kinds keep their own names as kind strings so every save made
// before families existed still loads and fights identically.
export const FAMILIES = [
  "rifle",
  "shotgun",
  "rocket",
  "sniper",
  "grenade",
  "special",
] as const;
export type Family = (typeof FAMILIES)[number];
export const FAMILY_NAMES: Record<Family, string> = {
  rifle: "ライフル",
  shotgun: "ショットガン",
  rocket: "ロケット",
  sniper: "スナイパー",
  grenade: "グレネード",
  // Deliberately a slot, not a mechanic: it holds whatever does not belong to
  // one of the five shooting families, and it can hold more than two.
  special: "特殊",
};
export type Kind =
  | "rifle"
  | "smg"
  | "shotgun"
  | "slug"
  | "rocket"
  | "heavy"
  | "sniper"
  | "grenade"
  | "sticky"
  | "laser"
  | "kick"
  | "medic";
export type Effect =
  "none" | "pierce" | "quick" | "reserve" | "repel" | "chain";
// One flat pool per kind; legacy quick and shotgun pierce remain loadable.
export const EFFECT_POOLS: Record<Kind, readonly Effect[]> = {
  rifle: ["reserve", "pierce"],
  smg: ["reserve", "pierce"],
  shotgun: ["reserve", "repel"],
  slug: ["reserve", "repel"],
  rocket: ["reserve", "chain"],
  heavy: ["reserve", "chain"],
  sniper: ["reserve", "pierce"],
  grenade: ["reserve", "chain"],
  sticky: ["reserve", "chain"],
  laser: ["reserve", "pierce"],
  kick: ["reserve", "repel"],
  medic: ["reserve", "pierce"],
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
// `family` is the mechanic; `falloff` picks the distance curve; `pierce` is how
// many bodies one shot passes through before any special effect is considered.
// `speed`/`gravity` make the shot a projectile, `zoom` a scoped weapon, and
// `beam` draws the tracer as a continuous lance instead of a bullet streak.
// The three original kinds keep their exact pre-family numbers.
export const WEAPONS = {
  rifle: {
    name: "AR-9 リーフ",
    family: "rifle",
    damage: 24,
    interval: 0.13,
    mag: 32,
    reload: 1.65,
    range: 65,
    pellets: 1,
    spread: 0.008,
    radius: 0,
    falloff: "rifle",
    pierce: 1,
  },
  smg: {
    name: "SMG-3 ワスプ",
    family: "rifle",
    damage: 13,
    interval: 0.07,
    mag: 45,
    reload: 1.5,
    range: 38,
    pellets: 1,
    spread: 0.022,
    radius: 0,
    falloff: "smg",
    pierce: 1,
  },
  shotgun: {
    name: "SG-4 ブレイカー",
    family: "shotgun",
    damage: 19,
    interval: 0.8,
    mag: 7,
    reload: 2.1,
    range: 23,
    pellets: 8,
    spread: 0.1,
    radius: 0,
    falloff: "shotgun",
    pierce: 3,
  },
  slug: {
    name: "SG-7 スパイク",
    family: "shotgun",
    damage: 110,
    interval: 0.85,
    mag: 6,
    reload: 2.2,
    range: 45,
    pellets: 1,
    spread: 0.012,
    radius: 0,
    falloff: "rifle",
    pierce: 3,
  },
  rocket: {
    name: "RL-2 コメット",
    family: "rocket",
    damage: 170,
    interval: 1.15,
    mag: 2,
    reload: 2.7,
    range: 75,
    pellets: 1,
    spread: 0,
    radius: 6.5,
    falloff: "none",
    pierce: 1,
    speed: 28,
  },
  heavy: {
    name: "RL-9 メテオ",
    family: "rocket",
    damage: 430,
    interval: 1.7,
    mag: 1,
    reload: 4,
    range: 80,
    pellets: 1,
    spread: 0,
    radius: 11,
    falloff: "none",
    pierce: 1,
    speed: 20,
  },
  sniper: {
    name: "SR-1 ソーン",
    family: "sniper",
    damage: 165,
    interval: 1.05,
    mag: 6,
    reload: 2.4,
    range: 140,
    pellets: 1,
    spread: 0,
    radius: 0,
    falloff: "none",
    pierce: 1,
    zoom: 2.4,
  },
  grenade: {
    name: "GL-6 ホロウ",
    family: "grenade",
    damage: 90,
    interval: 0.6,
    mag: 5,
    reload: 2.6,
    range: 55,
    pellets: 1,
    spread: 0.006,
    radius: 5,
    falloff: "none",
    pierce: 1,
    speed: 24,
    gravity: 14,
  },
  sticky: {
    name: "ST-3 リンバー",
    family: "grenade",
    damage: 135,
    interval: 0.8,
    mag: 4,
    reload: 2.9,
    range: 50,
    pellets: 1,
    spread: 0.006,
    radius: 4.2,
    falloff: "none",
    pierce: 1,
    speed: 22,
    gravity: 16,
  },
  // The other way to hold a long lane: no magnification and a fraction of the
  // damage per tick, but it pierces three bodies and never stops firing, so a
  // line of advancing enemies is cleared rather than picked off one at a time.
  laser: {
    name: "LZ-2 グリム",
    family: "sniper",
    damage: 8,
    interval: 0.045,
    mag: 120,
    reload: 3,
    range: 95,
    pellets: 1,
    spread: 0,
    radius: 0,
    falloff: "none",
    pierce: 3,
    beam: true,
    zoom: 1.6,
  },
  // Fires backwards as much as forwards: the shot is the escape. `recoil` is
  // how far it throws the shooter, applied through the same stepped move() the
  // shotgun's repel uses, so it cannot push anyone through a wall.
  kick: {
    name: "KB-6 ケストレル",
    family: "special",
    damage: 34,
    interval: 0.9,
    mag: 3,
    reload: 2.4,
    range: 14,
    pellets: 5,
    spread: 0.09,
    radius: 0,
    falloff: "shotgun",
    pierce: 1,
    recoil: 9,
  },
  // `heal` retargets the shot at teammates. The figure in `damage` is the
  // amount restored per pellet, so grade and variance scale healing exactly as
  // they scale damage and nothing in the progression system needs a second path.
  // It is a spread rather than a single ray on purpose: hitting a moving
  // teammate with one thin line, on a phone, is not a thing anyone can do.
  // The cone is kept moderate deliberately -- widening it past the size of a
  // teammate makes the weapon worse at range, not better, because the shot
  // then spreads around them. Forgiveness comes from the cone giving partial
  // credit for imperfect aim, and from HEAL_RADIUS below.
  medic: {
    name: "MD-4 ブルーム",
    family: "special",
    damage: 9,
    interval: 1.1,
    mag: 5,
    reload: 2.6,
    range: 45,
    pellets: 7,
    spread: 0.05,
    radius: 0,
    falloff: "none",
    pierce: 1,
    heal: true,
  },
} as const;
export const familyOf = (kind: Kind): Family => WEAPONS[kind].family;
// Support fire is checked against a deliberately generous cylinder. A teammate
// is a moving, friendly target that the player is trying to help, so the cost
// of being slightly off should be a smaller heal, never a wasted round.
export const HEAL_RADIUS = 1.8;
// Only scoped weapons carry a magnification; everything else keeps the 2x the
// scope button has always given.
export const zoomOf = (kind: Kind): number =>
  "zoom" in WEAPONS[kind] ? (WEAPONS[kind] as { zoom: number }).zoom : 2;
export const KINDS = Object.keys(WEAPONS) as Kind[];
// Drop rolls pick a family first and the weapon inside it second, so adding a
// family never halves how often any existing one is seen.
export const FAMILY_KINDS: Record<Family, readonly Kind[]> = FAMILIES.reduce(
  (all, family) => ({
    ...all,
    [family]: KINDS.filter((kind) => WEAPONS[kind].family === family),
  }),
  {} as Record<Family, readonly Kind[]>,
);
// `aim` is the body centre used by bullets and aim assist, measured from the unit's
// own base. `cruise` is how high that base floats; ground units keep it at 0, so
// their hit boxes are unchanged.
export const ENEMIES = {
  calyx: { hp: 360, speed: 0.65, radius: 0.9, damage: 24, aim: 1.4, cruise: 0 },
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
    // Pierce is not a special effect on a weapon that already pierces as standard.
    !(effect === "pierce" && WEAPONS[kind].pierce > 1)
  );
}
// Deliberately still the three originals. New families are found, not issued.
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
    !("format" in v) &&
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
    // Pierce stays family-gated so legacy shotgun-pierce saves still load;
    // repel and chain are simply whatever that weapon can actually roll.
    (v.effect !== "pierce" ||
      !["rocket", "grenade"].includes(WEAPONS[v.kind].family)) &&
    (v.effect !== "repel" || EFFECT_POOLS[v.kind].includes("repel")) &&
    (v.effect !== "chain" || EFFECT_POOLS[v.kind].includes("chain"))
  );
}

// Cooperative battles accept normal inventory items in either saved format.
// Admin/test items never cross the authoritative multiplayer boundary.
export function validBattleWeapon(w: unknown): w is Weapon {
  if (!w || typeof w !== "object" || ("testData" in w && w.testData !== false))
    return false;
  return "format" in w ? validNewWeapon(w) && !w.testData : validWeapon(w);
}
