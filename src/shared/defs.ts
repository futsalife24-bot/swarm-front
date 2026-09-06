export type Kind = "rifle" | "shotgun" | "rocket";
export type Effect = "none" | "pierce" | "quick";
export interface Weapon {
  id: string;
  kind: Kind;
  rarity: 0 | 1 | 2;
  power: number;
  effect: Effect;
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
export const ENEMIES = {
  crawler: { hp: 75, speed: 3.5, radius: 1.25, damage: 10 },
  spitter: { hp: 100, speed: 2.1, radius: 1.45, damage: 14 },
  boss: { hp: 4200, speed: 1.4, radius: 4, damage: 40 },
} as const;
export const RARITIES = ["STANDARD", "REFINED", "RELIC"];
export const POWER = {
  scale: 1000,
  min: 1000,
  max: [1120, 1240, 1360],
} as const;
export function validPower(power: number, rarity: Weapon["rarity"]) {
  const milli = Math.round(power * POWER.scale);
  return (
    Number.isFinite(power) &&
    power === milli / POWER.scale &&
    milli >= POWER.min &&
    milli <= POWER.max[rarity]
  );
}
export const WAVE_QUOTAS = [0, 45, 55, 65] as const;
export const WAVE_INTERVAL = 4;
export const MOVE_SPEED = { walk: 7, dodge: 17 } as const;
export const EFFECTS = {
  none: "標準仕様",
  pierce: "貫通：最大3体",
  quick: "高速装填：20%短縮",
};
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
  inputHz: 20,
  snapshotHz: 10,
  messageBytes: 2048,
  reconnectMs: 30000,
  roomMs: 3600000,
  idleMs: 180000,
};
export interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}
export const BLOCKS: Block[] = [];
for (const x of [-31, -17, 17, 31])
  for (const z of [-35, -17, 4, 24, 40])
    BLOCKS.push({
      x,
      z,
      w: 8,
      d: z === 4 ? 9 : 11,
      h: 8 + ((x * x + z * z) % 14),
    });
export function validWeapon(w: unknown): w is Weapon {
  if (!w || typeof w !== "object") return false;
  const v = w as Weapon;
  return (
    typeof v.id === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(v.id) &&
    Object.hasOwn(WEAPONS, v.kind) &&
    [0, 1, 2].includes(v.rarity) &&
    validPower(v.power, v.rarity) &&
    Object.hasOwn(EFFECTS, v.effect) &&
    (v.effect === "none" || v.rarity > 0) &&
    (v.effect !== "pierce" || v.kind !== "rocket")
  );
}
