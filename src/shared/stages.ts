import { registerTerrain, terrainProps } from "./terrain";
import { CAVE_BLOCKS } from "./cave";
import { MAP_SCALE } from "./arena";
import { BLOCKS, type Block } from "./map-blocks";
import { BRANCH_15 } from "./campaign";

export interface ArenaMap {
  assetIndex?: number;
  elevated?: boolean;
  foundryAllowed?: TroopKind[];
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

export const CITY_TOWERS: Block[] = [-1, 1].flatMap((side) =>
  [-72, -40, 40, 72].map((z, i) => ({
    x: side * 83,
    z,
    w: 14,
    d: 18,
    h: 28 + ((i + (side > 0 ? 1 : 0)) % 3) * 7,
  })),
);
MAPS[0].blocks.push(...CITY_TOWERS);
MAPS.forEach((map, index) => registerTerrain(map.blocks, index));

/** Separate versions preserve stage ids, waves, rewards and existing saves. */
export const ELEVATED_MAPS: ArenaMap[] = MAPS.map((source, index) => {
  if (source.biome === "cave") return source;
  const map: ArenaMap = {
    ...source,
    name: source.name + "・高台ルート",
    assetIndex: index,
    elevated: true,
    blocks: source.blocks.map((b) => ({ ...b })),
  };
  if (source.biome === "city") {
    // Two inspection annexes on the outer service lanes, each with a roof stair.
    for (const side of [-1, 1])
      map.blocks.push({ x: side * 82, z: 0, w: 10, d: 16, h: 3.6 });
  }
  registerTerrain(map.blocks, index, true);
  if (source.biome === "city") {
    for (const side of [-1, 1]) {
      const props = terrainProps(map.blocks);
      for (let step = 1; step <= 12; step++)
        props.push({
          x: side * 74.5,
          z: 8 - step,
          w: 5,
          d: 1,
          h: step * 0.3,
          base: 0,
          style: "slab",
        });
      props.push({
        x: side * 74.5,
        z: -6,
        w: 5,
        d: 4,
        h: 3.6,
        base: 0,
        style: "slab",
      });
    }
  }
  return map;
});

export type TroopKind =
  "calyx" | "crawler" | "ant" | "spider" | "spitter" | "hornet";
export type BossForm = "crown" | "worm" | "harrow";
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
      wave({ ant: 22 }, [], 0.75),
      wave({ crawler: 8, spider: 16, calyx: 2 }, [], 0.8),
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
      wave({ ant: 16, spider: 12, spitter: 8 }, [], 0.8),
      wave({ ant: 16, hornet: 12 }, [], 0.65),
    ],
  },
  {
    name: "空域封鎖",
    map: 1,
    brief: "空中のRAYと遠距離のエネルギー弾を同時に処理。",
    waves: [
      wave({ spider: 12, hornet: 16 }, [], 0.85),
      wave({ spitter: 12, hornet: 16 }, [], 0.85),
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
      wave({ ant: 18, spider: 14, hornet: 12 }, [], 0.75),
    ],
  },
  {
    name: "双冠の門",
    map: 2,
    brief: "FOUNDRY ZERO2体が初めて同時出現。片側から崩す。",
    waves: [
      wave({ crawler: 18, ant: 16, hornet: 10 }, [], 0.7),
      wave({ ant: 14, spitter: 8 }, ["crown", "crown"], 1.2),
    ],
  },
  {
    name: "工業区奔流",
    map: 2,
    brief: "ボスなしの大群戦。短い5波で位置取りを試す。",
    waves: [
      wave({ ant: 28 }, [], 0.7),
      wave({ crawler: 10, spider: 20 }, [], 0.75),
      wave({ ant: 14, hornet: 22 }, [], 0.65),
      wave({ crawler: 16, spitter: 20 }, [], 0.65),
      wave({ crawler: 8, ant: 12, spider: 10, spitter: 8, hornet: 8 }, [], 0.7),
    ],
  },
  {
    name: "異形共闘",
    map: 4,
    brief: "通常型と連結炉型が同時出現。間に挟まれない。",
    waves: [
      wave({ spider: 20, spitter: 10, hornet: 16 }, [], 0.7),
      wave({ ant: 16, hornet: 8 }, ["crown", "worm"], 1.15),
      wave({ ant: 22, spitter: 14, hornet: 14 }, [], 0.6),
    ],
  },
  {
    name: "王の待ち伏せ",
    map: 4,
    brief: "開幕から2体と護衛。撃破後も空陸の追撃が続く。",
    waves: [
      wave({ crawler: 12, spitter: 8 }, ["crown", "worm"], 1.2),
      wave({ spider: 20, hornet: 24 }, [], 0.6),
      wave({ crawler: 14, ant: 16, spitter: 12, hornet: 10 }, [], 0.75),
    ],
  },
  {
    name: "重装迎撃線",
    map: 3,
    brief: "地上混成を突破し、連結炉を迎撃。クリアで15-Aを解放。",
    waves: [
      wave({ ant: 18, spider: 12, calyx: 2 }),
      wave({ spitter: 10, hornet: 8 }, ["worm"], 1),
    ],
  },
  {
    name: "晶脈突破",
    map: 5,
    brief: "地底の射線を確保し、連結炉と護衛を突破。",
    waves: [
      wave({ spider: 18, spitter: 12 }),
      wave({ crawler: 16, hornet: 12 }),
      wave({ spitter: 10 }, ["worm"], 1),
    ],
  },
  {
    name: "草原の双炉",
    map: 3,
    brief: "広い草原で二つの形成炉を迎撃。",
    waves: [
      wave({ ant: 20, hornet: 12, calyx: 2 }),
      wave({ crawler: 14, spitter: 8 }, ["crown", "worm"], 1.1),
    ],
  },
  {
    name: "炉心突破戦",
    map: 2,
    brief: "異なる護衛構成を突破し、最奥の形成炉へ。",
    waves: [
      wave({ ant: 22, spider: 14 }),
      wave({ spitter: 10, hornet: 10 }, [], 0.9),
      wave({ crawler: 12, calyx: 1 }, ["crown"], 1.1),
    ],
  },
  {
    name: "雪峡の封鎖線",
    map: 4,
    brief: "空陸混成の封鎖線を崩し、二つの炉を迎撃。",
    waves: [
      wave({ spider: 20, hornet: 16, calyx: 2 }),
      wave({ ant: 18, spitter: 10 }, ["worm", "crown"], 1.1),
    ],
  },
  {
    name: "異翼の来襲",
    map: 3,
    brief: "草原に現れた大型個体HARROWを迎撃。",
    waves: [
      wave({ crawler: 18, hornet: 10, calyx: 2 }),
      wave({ ant: 12, spitter: 6 }, ["harrow"], 1.1),
    ],
  },

  {
    name: "残響の街区",
    map: 0,
    brief: "分散した群れを短い三波で掃討。",
    waves: [
      wave({ crawler: 22, ant: 16 }),
      wave({ spider: 18, spitter: 14 }),
      wave({ hornet: 18, ant: 12, calyx: 3 }),
    ],
  },
  {
    name: "蒼鉄再侵攻",
    map: 2,
    brief: "護衛の増援を突破して双炉へ。",
    waves: [
      wave({ ant: 22, spitter: 12, calyx: 2 }),
      wave({ spider: 14, hornet: 10 }, ["crown", "worm"], 1.1),
    ],
  },
  {
    name: "白嶺の反攻",
    map: 4,
    brief: "空中群と地上群が交互に押し寄せる。",
    waves: [
      wave({ hornet: 22, spitter: 10 }),
      wave({ ant: 24, spider: 18, calyx: 3 }),
      wave({ crawler: 16, hornet: 12 }, ["worm"], 1),
    ],
  },
  {
    name: "最後の形成炉",
    map: 3,
    brief: "前衛を崩し、最後の双炉を突破する。",
    waves: [
      wave({ crawler: 20, spider: 16, calyx: 3 }),
      wave({ ant: 18, spitter: 12 }),
      wave({ hornet: 12, spitter: 8 }, ["worm", "crown"], 1.1),
    ],
  },
  {
    name: "異翼の決戦",
    map: 3,
    brief: "混成群の奥でHARROWとの最終戦に挑む。",
    waves: [
      wave({ ant: 20, spider: 16, calyx: 3 }),
      wave({ hornet: 16, spitter: 12 }),
      wave({ crawler: 16, spitter: 8 }, ["harrow"], 1.1),
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
  elevated: [3, 7, 8, 12, 14, 17, 18, 19, 20].includes(i + 1),
  id: i + 1,
  hp: 1 + i * 0.025,
  damage: 1 + i * 0.02,
  dropRate: 0.04 + Math.min(i, 19) * (0.09 / 19),
  lootExponent: 1.25 - Math.min(i, 19) * (0.63 / 19),
}));
export const HARROW_BRANCH = {
  ...STAGES[14],
  name: "異翼の痕跡",
  map: 3,
  elevated: false,
  brief: "草原の奥部で観測されたHARROWを調査する。",
  waves: [wave({ crawler: 12, spitter: 6 }), wave({}, ["harrow"], 1.2)],
};
// Explicit per-map permission lists, derived only from that map's existing
// normal-enemy rosters. Bosses can never recursively fabricate more bosses.
for (const [mapId, map] of MAPS.entries())
  map.foundryAllowed = [
    ...new Set(
      STAGES.filter((stage) => stage.map === mapId).flatMap((stage) =>
        stage.waves.flatMap((wave) =>
          Object.entries(wave.troops)
            .filter(([, count]) => count > 0)
            .map(([kind]) => kind as TroopKind),
        ),
      ),
    ),
  ];
ELEVATED_MAPS.forEach((map, index) => {
  map.foundryAllowed = MAPS[index].foundryAllowed;
});
export function validStage(id: unknown): id is number {
  return (
    typeof id === "number" &&
    Number.isInteger(id) &&
    id >= 1 &&
    id <= STAGES.length
  );
}
export function stageFor(w: {
  stage?: number;
  solo?: { stage: number; difficulty: "normal" | "medium" };
}) {
  const base =
    w.solo?.stage === BRANCH_15
      ? HARROW_BRANCH
      : STAGES[validStage(w.stage) ? w.stage - 1 : 0];
  if (!w.solo) return base;
  return {
    ...base,
    name: w.solo.stage === 21 ? "街区奥部の調査" : base.name,
    hp: base.hp * (w.solo.difficulty === "medium" ? 1.25 : 1),
    damage: base.damage * (w.solo.difficulty === "medium" ? 1.15 : 1),
    dropRate: 0.05,
  };
}
export function mapFor(w: {
  stage?: number;
  training?: boolean;
  defense?: unknown;
}) {
  return w.defense
    ? DEFENSE_MAPS[stageFor(w).map]
    : w.training
      ? TRAINING_MAP
      : (stageFor(w).elevated ? ELEVATED_MAPS : MAPS)[stageFor(w).map];
}

/** Flat dedicated range, intentionally outside the campaign and terrain generation. */
export const TRAINING_MAP: ArenaMap = {
  name: "訓練射撃場",
  biome: "city",
  ground: 0x35464b,
  color: 0x53676a,
  sky: 0x9bbbc5,
  blocks: [
    { x: -24, z: -12, w: 2, d: 74, h: 5 },
    { x: 24, z: -12, w: 2, d: 74, h: 5 },
    { x: 0, z: -48, w: 50, d: 2, h: 6 },
    { x: 0, z: 24, w: 50, d: 2, h: 3 },
  ],
};

/** Dedicated flat defense yard; campaign terrain and collisions remain unchanged. */
export const DEFENSE_MAPS: ArenaMap[] = MAPS.map((source) => ({
  name: "武器庫防衛拠点",
  biome: source.biome,
  ground: source.ground,
  color: source.color,
  sky: source.sky,
  blocks: [
    { x: -48, z: 0, w: 2, d: 98, h: 4 },
    { x: 48, z: 0, w: 2, d: 98, h: 4 },
    { x: 0, z: -48, w: 94, d: 2, h: 4 },
    { x: 0, z: 48, w: 94, d: 2, h: 4 },
  ],
}));
