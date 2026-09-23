import type { StagePlan } from "./stages";

// Frozen checkpoint-v1 roster from 402dcece262cbf265da3912e21d95ada891b9821.
// Do not rebalance: active pre-25-stage runs must finish their original waves.
const LEGACY_STAGES: StagePlan[] = [
  {
    name: "前哨掃討",
    map: 0,
    brief: "HOUNDと散射派生で移動・射撃の基本を確認。ボスなし。",
    waves: [
      {
        troops: {
          crawler: 12,
        },
        bosses: [],
        interval: 0.9,
        guards: 3,
      },
      {
        troops: {
          crawler: 12,
          ant: 8,
        },
        bosses: [],
        interval: 0.8,
        guards: 3,
      },
    ],
    elevated: false,
    id: 1,
    hp: 1,
    damage: 1,
    dropRate: 0.04,
    lootExponent: 1.25,
  },
  {
    name: "跳躍する影",
    map: 3,
    brief: "跳躍派生が初登場。横からの跳躍に備える。",
    waves: [
      {
        troops: {
          crawler: 10,
          ant: 12,
        },
        bosses: [],
        interval: 0.8,
        guards: 3,
      },
      {
        troops: {
          ant: 12,
          spider: 10,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
    ],
    elevated: false,
    id: 2,
    hp: 1.025,
    damage: 1.02,
    dropRate: 0.04473684210526316,
    lootExponent: 1.216842105263158,
  },
  {
    name: "エネルギー弾の交差点",
    map: 0,
    brief: "PRISMを優先して倒し、射線を確保。",
    waves: [
      {
        troops: {
          crawler: 14,
          spitter: 6,
        },
        bosses: [],
        interval: 0.8,
        guards: 3,
      },
      {
        troops: {
          ant: 12,
          spider: 10,
          spitter: 8,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          crawler: 12,
          ant: 12,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
    ],
    elevated: true,
    id: 3,
    hp: 1.05,
    damage: 1.04,
    dropRate: 0.049473684210526316,
    lootExponent: 1.183684210526316,
  },
  {
    name: "形成炉迎撃",
    map: 3,
    brief: "初のFOUNDRY ZERO。護衛を倒して攻撃の隙を作る。",
    waves: [
      {
        troops: {
          crawler: 16,
          ant: 12,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          crawler: 12,
          ant: 8,
        },
        bosses: ["crown"],
        interval: 1.3,
        guards: 3,
      },
    ],
    elevated: false,
    id: 4,
    hp: 1.075,
    damage: 1.06,
    dropRate: 0.05421052631578947,
    lootExponent: 1.1505263157894736,
  },
  {
    name: "倉庫上空",
    map: 1,
    brief: "RAYが初登場。地上と上空の狙いを切り替える。",
    waves: [
      {
        troops: {
          crawler: 12,
          hornet: 8,
        },
        bosses: [],
        interval: 0.8,
        guards: 3,
      },
      {
        troops: {
          ant: 16,
          hornet: 12,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          spider: 14,
          spitter: 10,
          hornet: 8,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
    ],
    elevated: false,
    id: 5,
    hp: 1.1,
    damage: 1.08,
    dropRate: 0.05894736842105263,
    lootExponent: 1.1173684210526316,
  },
  {
    name: "装甲回廊",
    map: 1,
    brief: "連結炉が初登場。長い胴体と護衛をまとめて狙う。",
    waves: [
      {
        troops: {
          crawler: 18,
          spider: 14,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          ant: 16,
          spitter: 8,
        },
        bosses: ["worm"],
        interval: 1.2,
        guards: 3,
      },
    ],
    elevated: false,
    id: 6,
    hp: 1.125,
    damage: 1.1,
    dropRate: 0.06368421052631579,
    lootExponent: 1.0842105263157895,
  },
  {
    name: "物流争奪",
    map: 3,
    brief: "ボスなしの4連戦。各波で優先目標を切り替える。",
    waves: [
      {
        troops: {
          ant: 26,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
      {
        troops: {
          crawler: 8,
          spider: 20,
          calyx: 2,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
      {
        troops: {
          spitter: 12,
          hornet: 12,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          crawler: 10,
          ant: 10,
          spider: 8,
          hornet: 6,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
    ],
    elevated: true,
    id: 7,
    hp: 1.15,
    damage: 1.12,
    dropRate: 0.06842105263157894,
    lootExponent: 1.0510526315789472,
  },
  {
    name: "開幕の王",
    map: 1,
    brief: "開始直後にFOUNDRY ZERO。撃破後にも掃討戦が続く。",
    waves: [
      {
        troops: {
          crawler: 12,
          hornet: 8,
        },
        bosses: ["crown"],
        interval: 1.1,
        guards: 3,
      },
      {
        troops: {
          ant: 18,
          spider: 14,
          spitter: 10,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
      {
        troops: {
          ant: 16,
          hornet: 12,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
    ],
    elevated: true,
    id: 8,
    hp: 1.175,
    damage: 1.1400000000000001,
    dropRate: 0.0731578947368421,
    lootExponent: 1.0178947368421052,
  },
  {
    name: "空域封鎖",
    map: 1,
    brief: "空中のRAYと遠距離のエネルギー弾を同時に処理。",
    waves: [
      {
        troops: {
          spider: 14,
          hornet: 20,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          spitter: 16,
          hornet: 18,
        },
        bosses: [],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          ant: 18,
          spitter: 10,
          hornet: 12,
        },
        bosses: ["crown"],
        interval: 0.95,
        guards: 3,
      },
    ],
    elevated: false,
    id: 9,
    hp: 1.2,
    damage: 1.16,
    dropRate: 0.07789473684210527,
    lootExponent: 0.9847368421052631,
  },
  {
    name: "地底の反攻",
    map: 5,
    brief: "中盤の連結炉を越え、最後は雑魚の増援を掃討。",
    waves: [
      {
        troops: {
          ant: 22,
          spider: 14,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
      {
        troops: {
          crawler: 16,
          spitter: 10,
        },
        bosses: ["worm"],
        interval: 1,
        guards: 3,
      },
      {
        troops: {
          ant: 20,
          spider: 16,
          hornet: 14,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
    ],
    elevated: false,
    id: 10,
    hp: 1.225,
    damage: 1.18,
    dropRate: 0.08263157894736842,
    lootExponent: 0.9515789473684211,
  },
  {
    name: "双冠の門",
    map: 2,
    brief: "FOUNDRY ZERO2体が初めて同時出現。片側から崩す。",
    waves: [
      {
        troops: {
          crawler: 18,
          ant: 16,
          hornet: 10,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
      {
        troops: {
          ant: 18,
          spitter: 10,
        },
        bosses: ["crown", "crown"],
        interval: 1.1,
        guards: 3,
      },
    ],
    elevated: false,
    id: 11,
    hp: 1.25,
    damage: 1.2,
    dropRate: 0.08736842105263157,
    lootExponent: 0.9184210526315789,
  },
  {
    name: "工業区奔流",
    map: 2,
    brief: "ボスなしの大群戦。短い5波で位置取りを試す。",
    waves: [
      {
        troops: {
          ant: 34,
        },
        bosses: [],
        interval: 0.55,
        guards: 3,
      },
      {
        troops: {
          crawler: 10,
          spider: 26,
        },
        bosses: [],
        interval: 0.6,
        guards: 3,
      },
      {
        troops: {
          ant: 14,
          hornet: 22,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
      {
        troops: {
          crawler: 16,
          spitter: 20,
        },
        bosses: [],
        interval: 0.65,
        guards: 3,
      },
      {
        troops: {
          crawler: 10,
          ant: 16,
          spider: 12,
          spitter: 10,
          hornet: 10,
        },
        bosses: [],
        interval: 0.5,
        guards: 3,
      },
    ],
    elevated: true,
    id: 12,
    hp: 1.275,
    damage: 1.22,
    dropRate: 0.09210526315789473,
    lootExponent: 0.8852631578947368,
  },
  {
    name: "異形共闘",
    map: 4,
    brief: "通常型と連結炉型が同時出現。間に挟まれない。",
    waves: [
      {
        troops: {
          spider: 20,
          spitter: 10,
          hornet: 16,
        },
        bosses: [],
        interval: 0.7,
        guards: 3,
      },
      {
        troops: {
          ant: 20,
          hornet: 12,
        },
        bosses: ["crown", "worm"],
        interval: 1,
        guards: 3,
      },
      {
        troops: {
          ant: 22,
          spitter: 14,
          hornet: 14,
        },
        bosses: [],
        interval: 0.6,
        guards: 3,
      },
    ],
    elevated: false,
    id: 13,
    hp: 1.3,
    damage: 1.24,
    dropRate: 0.0968421052631579,
    lootExponent: 0.8521052631578947,
  },
  {
    name: "王の待ち伏せ",
    map: 4,
    brief: "開幕から2体と護衛。撃破後も空陸の追撃が続く。",
    waves: [
      {
        troops: {
          crawler: 16,
          spitter: 10,
        },
        bosses: ["crown", "worm"],
        interval: 1.15,
        guards: 3,
      },
      {
        troops: {
          spider: 20,
          hornet: 24,
        },
        bosses: [],
        interval: 0.6,
        guards: 3,
      },
      {
        troops: {
          crawler: 18,
          ant: 20,
          spitter: 16,
          hornet: 12,
        },
        bosses: [],
        interval: 0.55,
        guards: 3,
      },
    ],
    elevated: true,
    id: 14,
    hp: 1.325,
    damage: 1.26,
    dropRate: 0.10157894736842105,
    lootExponent: 0.8189473684210526,
  },
  {
    name: "連続重装襲撃",
    map: 2,
    brief: "3波すべてにボスと護衛。回復区間を活用。",
    waves: [
      {
        troops: {
          ant: 20,
          hornet: 12,
        },
        bosses: ["crown"],
        interval: 0.85,
        guards: 3,
      },
      {
        troops: {
          spider: 20,
          spitter: 12,
        },
        bosses: ["worm"],
        interval: 0.85,
        guards: 3,
      },
      {
        troops: {
          crawler: 16,
          hornet: 14,
        },
        bosses: ["crown", "crown"],
        interval: 0.9,
        guards: 3,
      },
    ],
    elevated: false,
    id: 15,
    hp: 1.35,
    damage: 1.28,
    dropRate: 0.1063157894736842,
    lootExponent: 0.7857894736842105,
  },
  {
    name: "双頭地底戦",
    map: 5,
    brief: "連結炉2体と遠距離護衛。射線と退路を維持。",
    waves: [
      {
        troops: {
          spider: 20,
          spitter: 14,
          hornet: 18,
        },
        bosses: [],
        interval: 0.6,
        guards: 3,
      },
      {
        troops: {
          spitter: 18,
          hornet: 16,
        },
        bosses: ["worm", "worm"],
        interval: 0.9,
        guards: 3,
      },
      {
        troops: {
          crawler: 20,
          ant: 24,
          spider: 18,
          hornet: 12,
        },
        bosses: [],
        interval: 0.5,
        guards: 3,
      },
    ],
    elevated: false,
    id: 16,
    hp: 1.375,
    damage: 1.3,
    dropRate: 0.11105263157894738,
    lootExponent: 0.7526315789473683,
  },
  {
    name: "三冠包囲",
    map: 3,
    brief: "3体同時の包囲戦。集中攻撃でボスの数を減らす。",
    waves: [
      {
        troops: {
          ant: 24,
          spider: 18,
          hornet: 14,
        },
        bosses: [],
        interval: 0.55,
        guards: 3,
      },
      {
        troops: {
          crawler: 18,
          spitter: 14,
          hornet: 10,
        },
        bosses: ["crown", "worm", "crown"],
        interval: 0.9,
        guards: 3,
      },
    ],
    elevated: true,
    id: 17,
    hp: 1.4,
    damage: 1.32,
    dropRate: 0.11578947368421053,
    lootExponent: 0.7194736842105263,
  },
  {
    name: "炉心消耗戦",
    map: 2,
    brief: "5波の長期戦。重装・空陸混成・双頭を連続突破。",
    waves: [
      {
        troops: {
          ant: 20,
          spider: 16,
        },
        bosses: ["worm"],
        interval: 0.85,
        guards: 3,
      },
      {
        troops: {
          spitter: 16,
          hornet: 24,
        },
        bosses: [],
        interval: 0.55,
        guards: 3,
      },
      {
        troops: {
          crawler: 16,
          hornet: 12,
        },
        bosses: ["crown", "crown"],
        interval: 0.85,
        guards: 3,
      },
      {
        troops: {
          ant: 28,
          spider: 20,
          spitter: 12,
        },
        bosses: [],
        interval: 0.5,
        guards: 3,
      },
      {
        troops: {
          ant: 18,
          hornet: 14,
        },
        bosses: ["worm", "worm"],
        interval: 0.85,
        guards: 3,
      },
    ],
    elevated: true,
    id: 18,
    hp: 1.425,
    damage: 1.34,
    dropRate: 0.12052631578947368,
    lootExponent: 0.6863157894736842,
  },
  {
    name: "王群急襲",
    map: 4,
    brief: "開幕3体から再増援。ボス撃破後の大群まで油断禁物。",
    waves: [
      {
        troops: {
          crawler: 16,
          hornet: 12,
        },
        bosses: ["crown", "worm", "crown"],
        interval: 1,
        guards: 3,
      },
      {
        troops: {
          spider: 20,
          spitter: 16,
          hornet: 12,
        },
        bosses: ["worm", "crown"],
        interval: 0.8,
        guards: 3,
      },
      {
        troops: {
          crawler: 20,
          ant: 28,
          spider: 20,
          spitter: 18,
          hornet: 18,
        },
        bosses: [],
        interval: 0.45,
        guards: 3,
      },
    ],
    elevated: true,
    id: 19,
    hp: 1.45,
    damage: 1.3599999999999999,
    dropRate: 0.12526315789473683,
    lootExponent: 0.653157894736842,
  },
  {
    name: "中枢総力戦",
    map: 2,
    brief: "開幕双頭・大群・三冠・最後の混成掃討で総仕上げ。",
    waves: [
      {
        troops: {
          ant: 20,
          hornet: 14,
        },
        bosses: ["worm", "crown"],
        interval: 0.85,
        guards: 3,
      },
      {
        troops: {
          crawler: 20,
          ant: 24,
          spider: 20,
          spitter: 16,
          hornet: 16,
        },
        bosses: [],
        interval: 0.45,
        guards: 3,
      },
      {
        troops: {
          spider: 18,
          spitter: 14,
          hornet: 14,
        },
        bosses: ["worm", "crown", "worm"],
        interval: 0.75,
        guards: 3,
      },
      {
        troops: {
          crawler: 22,
          ant: 28,
          spider: 22,
          spitter: 18,
          hornet: 18,
        },
        bosses: [],
        interval: 0.4,
        guards: 3,
      },
    ],
    elevated: true,
    id: 20,
    hp: 1.475,
    damage: 1.38,
    dropRate: 0.13,
    lootExponent: 0.6199999999999999,
  },
];

/** Restore a v1 checkpoint using its original campaign stage and solo modifiers. */
export function legacyCampaignPlan(w: {
  stage?: number;
  solo?: { stage: number; difficulty: "normal" | "medium" };
}): StagePlan | undefined {
  const id = w.stage ?? 1;
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    id > LEGACY_STAGES.length ||
    !w.solo ||
    !Number.isInteger(w.solo.stage) ||
    w.solo.stage < 1 ||
    w.solo.stage > 21 ||
    !["normal", "medium"].includes(w.solo.difficulty)
  )
    return undefined;
  const base = LEGACY_STAGES[id - 1];
  return JSON.parse(
    JSON.stringify({
      ...base,
      name: w.solo.stage === 21 ? "街区奥部の調査" : base.name,
      hp: base.hp * (w.solo.difficulty === "medium" ? 1.25 : 1),
      damage: base.damage * (w.solo.difficulty === "medium" ? 1.15 : 1),
      dropRate: 0.05,
    }),
  ) as StagePlan;
}
