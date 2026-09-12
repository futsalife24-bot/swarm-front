import { CAVE_BLOCKS } from "./cave";
import { MAP_SCALE } from "./arena";
import { BLOCKS, type Block } from "./defs";

export interface ArenaMap {
  name: string;
  color: number;
  sky: number;
  ground: number;
  biome: "city" | "grass" | "snow" | "cave";
  blocks: Block[];
}
export const MAPS: ArenaMap[] = [
  {
    name: "灰明の街区",
    biome: "city",
    ground: 0x36464c,
    color: 0x526770,
    sky: 0x829ba5,
    blocks: BLOCKS,
  },
  {
    name: "薄暮の倉庫地区",
    biome: "city",
    ground: 0x49433c,
    color: 0x75614f,
    sky: 0xb49b86,
    blocks: [-29, -16, 16, 29].flatMap((x) =>
      [-32, -8, 32].map((z) => ({ x, z, w: 9, d: 14, h: 6 })),
    ),
  },
  {
    name: "蒼鉄の工業区",
    biome: "city",
    ground: 0x36464c,
    color: 0x435b69,
    sky: 0x607889,
    blocks: [-30, -17, 17, 30].flatMap((x) =>
      [-34, -14, 7, 34].map((z, i) => ({
        x,
        z,
        w: 8,
        d: 10,
        h: i % 2 ? 17 : 9,
      })),
    ),
  },
  {
    name: "風渡る草原",
    biome: "grass",
    ground: 0x638348,
    color: 0x777e65,
    sky: 0xb0d8dd,
    blocks: [
      { x: -24, z: -26, w: 9, d: 7, h: 3 },
      { x: 25, z: -12, w: 10, d: 8, h: 4 },
      { x: -28, z: 16, w: 8, d: 11, h: 3 },
      { x: 22, z: 31, w: 7, d: 8, h: 2.5 },
    ],
  },
  {
    name: "白嶺の雪峡",
    biome: "snow",
    ground: 0xd6e5e8,
    color: 0x8198aa,
    sky: 0xb5cddf,
    blocks: [-1, 1].flatMap((side) => [
      { x: side * 35, z: -34, w: 22, d: 22, h: 23 },
      { x: side * 29, z: -5, w: 20, d: 16, h: 15 },
      { x: side * 37, z: 26, w: 18, d: 26, h: 28 },
    ]),
  },
  {
    name: "晶脈の地底巣",
    biome: "cave",
    ground: 0x514337,
    color: 0x595665,
    sky: 0x211a16,
    blocks: CAVE_BLOCKS,
  },
];

for (const map of MAPS) {
  if (map.biome !== "cave")
    map.blocks = map.blocks.map((b) => ({
      ...b,
      x: b.x * MAP_SCALE,
      z: b.z * MAP_SCALE,
      w: b.w * MAP_SCALE,
      d: b.d * MAP_SCALE,
    }));
}

export type TroopKind = "crawler" | "ant" | "spider" | "spitter" | "hornet";
export type BossForm = "crown" | "worm";
export interface Wave {
  troops: Partial<Record<TroopKind, number>>;
  bosses: BossForm[];
  interval: number;
  guards: number;
}
const wave = (
  troops: Wave["troops"],
  bosses: BossForm[] = [],
  interval = 0.75,
): Wave => ({ troops, bosses, interval, guards: 3 });
const plans = [
  {
    name: "前哨掃討",
    map: 0,
    brief: "HOUNDと散射派生で移動・射撃の基本を確認。ボスなし。",
    waves: [
      wave({ crawler: 12 }, [], 0.9),
      wave({ crawler: 12, ant: 8 }, [], 0.8),
    ],
  },
  {
    name: "跳躍する影",
    map: 3,
    brief: "跳躍派生が初登場。横からの跳躍に備える。",
    waves: [
      wave({ crawler: 10, ant: 12 }, [], 0.8),
      wave({ ant: 12, spider: 10 }, [], 0.75),
    ],
  },
  {
    name: "エネルギー弾の交差点",
    map: 0,
    brief: "PRISMを優先して倒し、射線を確保。",
    waves: [
      wave({ crawler: 14, spitter: 6 }, [], 0.8),
      wave({ ant: 12, spider: 10, spitter: 8 }, [], 0.75),
      wave({ crawler: 12, ant: 12 }, [], 0.7),
    ],
  },
  {
    name: "形成炉迎撃",
    map: 3,
    brief: "初のFOUNDRY ZERO。護衛を倒して攻撃の隙を作る。",
    waves: [
      wave({ crawler: 16, ant: 12 }, [], 0.75),
      wave({ crawler: 12, ant: 8 }, ["crown"], 1.3),
    ],
  },
  {
    name: "倉庫上空",
    map: 1,
    brief: "RAYが初登場。地上と上空の狙いを切り替える。",
    waves: [
      wave({ crawler: 12, hornet: 8 }, [], 0.8),
      wave({ ant: 16, hornet: 12 }, [], 0.75),
      wave({ spider: 14, spitter: 10, hornet: 8 }, [], 0.75),
    ],
  },
  {
    name: "装甲回廊",
    map: 1,
    brief: "連結炉が初登場。長い胴体と護衛をまとめて狙う。",
    waves: [
      wave({ crawler: 18, spider: 14 }, [], 0.75),
      wave({ ant: 16, spitter: 8 }, ["worm"], 1.2),
    ],
  },
  {
    name: "物流争奪",
    map: 3,
    brief: "ボスなしの4連戦。各波で優先目標を切り替える。",
    waves: [
      wave({ ant: 26 }, [], 0.65),
      wave({ crawler: 8, spider: 20 }, [], 0.7),
      wave({ spitter: 12, hornet: 12 }, [], 0.75),
      wave({ crawler: 10, ant: 10, spider: 8, hornet: 6 }, [], 0.65),
    ],
  },
  {
    name: "開幕の王",
    map: 1,
    brief: "開始直後にFOUNDRY ZERO。撃破後にも掃討戦が続く。",
    waves: [
      wave({ crawler: 12, hornet: 8 }, ["crown"], 1.1),
      wave({ ant: 18, spider: 14, spitter: 10 }, [], 0.7),
      wave({ ant: 16, hornet: 12 }, [], 0.65),
    ],
  },
  {
    name: "空域封鎖",
    map: 1,
    brief: "空中のRAYと遠距離のエネルギー弾を同時に処理。",
    waves: [
      wave({ spider: 14, hornet: 20 }, [], 0.75),
      wave({ spitter: 16, hornet: 18 }, [], 0.75),
      wave({ ant: 18, spitter: 10, hornet: 12 }, ["crown"], 0.95),
    ],
  },
  {
    name: "地底の反攻",
    map: 5,
    brief: "中盤の連結炉を越え、最後は雑魚の増援を掃討。",
    waves: [
      wave({ ant: 22, spider: 14 }, [], 0.7),
      wave({ crawler: 16, spitter: 10 }, ["worm"], 1),
      wave({ ant: 20, spider: 16, hornet: 14 }, [], 0.65),
    ],
  },
  {
    name: "双冠の門",
    map: 2,
    brief: "FOUNDRY ZERO2体が初めて同時出現。片側から崩す。",
    waves: [
      wave({ crawler: 18, ant: 16, hornet: 10 }, [], 0.7),
      wave({ ant: 18, spitter: 10 }, ["crown", "crown"], 1.1),
    ],
  },
  {
    name: "工業区奔流",
    map: 2,
    brief: "ボスなしの大群戦。短い5波で位置取りを試す。",
    waves: [
      wave({ ant: 34 }, [], 0.55),
      wave({ crawler: 10, spider: 26 }, [], 0.6),
      wave({ ant: 14, hornet: 22 }, [], 0.65),
      wave({ crawler: 16, spitter: 20 }, [], 0.65),
      wave(
        { crawler: 10, ant: 16, spider: 12, spitter: 10, hornet: 10 },
        [],
        0.5,
      ),
    ],
  },
  {
    name: "異形共闘",
    map: 4,
    brief: "通常型と連結炉型が同時出現。間に挟まれない。",
    waves: [
      wave({ spider: 20, spitter: 10, hornet: 16 }, [], 0.7),
      wave({ ant: 20, hornet: 12 }, ["crown", "worm"], 1),
      wave({ ant: 22, spitter: 14, hornet: 14 }, [], 0.6),
    ],
  },
  {
    name: "王の待ち伏せ",
    map: 4,
    brief: "開幕から2体と護衛。撃破後も空陸の追撃が続く。",
    waves: [
      wave({ crawler: 16, spitter: 10 }, ["crown", "worm"], 1.15),
      wave({ spider: 20, hornet: 24 }, [], 0.6),
      wave({ crawler: 18, ant: 20, spitter: 16, hornet: 12 }, [], 0.55),
    ],
  },
  {
    name: "連続重装襲撃",
    map: 2,
    brief: "3波すべてにボスと護衛。回復区間を活用。",
    waves: [
      wave({ ant: 20, hornet: 12 }, ["crown"], 0.85),
      wave({ spider: 20, spitter: 12 }, ["worm"], 0.85),
      wave({ crawler: 16, hornet: 14 }, ["crown", "crown"], 0.9),
    ],
  },
  {
    name: "双頭地底戦",
    map: 5,
    brief: "連結炉2体と遠距離護衛。射線と退路を維持。",
    waves: [
      wave({ spider: 20, spitter: 14, hornet: 18 }, [], 0.6),
      wave({ spitter: 18, hornet: 16 }, ["worm", "worm"], 0.9),
      wave({ crawler: 20, ant: 24, spider: 18, hornet: 12 }, [], 0.5),
    ],
  },
  {
    name: "三冠包囲",
    map: 3,
    brief: "3体同時の包囲戦。集中攻撃でボスの数を減らす。",
    waves: [
      wave({ ant: 24, spider: 18, hornet: 14 }, [], 0.55),
      wave(
        { crawler: 18, spitter: 14, hornet: 10 },
        ["crown", "worm", "crown"],
        0.9,
      ),
    ],
  },
  {
    name: "炉心消耗戦",
    map: 2,
    brief: "5波の長期戦。重装・空陸混成・双頭を連続突破。",
    waves: [
      wave({ ant: 20, spider: 16 }, ["worm"], 0.85),
      wave({ spitter: 16, hornet: 24 }, [], 0.55),
      wave({ crawler: 16, hornet: 12 }, ["crown", "crown"], 0.85),
      wave({ ant: 28, spider: 20, spitter: 12 }, [], 0.5),
      wave({ ant: 18, hornet: 14 }, ["worm", "worm"], 0.85),
    ],
  },
  {
    name: "王群急襲",
    map: 4,
    brief: "開幕3体から再増援。ボス撃破後の大群まで油断禁物。",
    waves: [
      wave({ crawler: 16, hornet: 12 }, ["crown", "worm", "crown"], 1),
      wave({ spider: 20, spitter: 16, hornet: 12 }, ["worm", "crown"], 0.8),
      wave(
        { crawler: 20, ant: 28, spider: 20, spitter: 18, hornet: 18 },
        [],
        0.45,
      ),
    ],
  },
  {
    name: "中枢総力戦",
    map: 2,
    brief: "開幕双頭・大群・三冠・最後の混成掃討で総仕上げ。",
    waves: [
      wave({ ant: 20, hornet: 14 }, ["worm", "crown"], 0.85),
      wave(
        { crawler: 20, ant: 24, spider: 20, spitter: 16, hornet: 16 },
        [],
        0.45,
      ),
      wave(
        { spider: 18, spitter: 14, hornet: 14 },
        ["worm", "crown", "worm"],
        0.75,
      ),
      wave(
        { crawler: 22, ant: 28, spider: 22, spitter: 18, hornet: 18 },
        [],
        0.4,
      ),
    ],
  },
];
export const troopCount = (w: Wave) =>
  Object.values(w.troops).reduce((a, b) => a + b, 0);
export const waveCount = (w: Wave) => troopCount(w) + w.bosses.length;
// Interleave the roster so new species always appear and exact totals are preserved.
export function troopAt(w: Wave, index: number): TroopKind {
  if (index < 0 || index >= troopCount(w) || !Number.isInteger(index))
    throw new Error("Invalid troop index");
  const entries = Object.entries(w.troops) as [TroopKind, number][];
  for (let round = 0; ; round++)
    for (const [kind, count] of entries)
      if (round < count && index-- === 0) return kind;
}
export const STAGES = plans.map((plan, i) => ({
  ...plan,
  id: i + 1,
  hp: 1 + i * 0.025,
  damage: 1 + i * 0.02,
  dropRate: 0.04 + i * (0.09 / 19),
  lootExponent: 1.25 - i * (0.63 / 19),
}));
export function validStage(id: unknown): id is number {
  return (
    typeof id === "number" &&
    Number.isInteger(id) &&
    id >= 1 &&
    id <= STAGES.length
  );
}
export function stageFor(w: { stage?: number }) {
  return STAGES[validStage(w.stage) ? w.stage - 1 : 0];
}
export function mapFor(w: { stage?: number }) {
  return MAPS[stageFor(w).map];
}
