// プレビュー用のカードデータを現行ソースから書き出す（読み取りのみ。ゲームの定義は変更しない）。
// 実行: node design/survival-card-preview/tools/build-data.mjs
import {
  FRONT_BASE_IDS,
  FRONT_FUSION_IDS,
  FRONT_FUSIONS,
  FRONT_UPGRADE_CATALOG,
  FRONT_MAX_TYPES,
  FRONT_MAX_REROLLS,
  isFrontFusion,
  type FrontUpgradeId,
} from "../../../src/shared/front-upgrades";
import {
  frontUpgradeEffect,
  frontUpgradeCardCopy,
} from "../../../src/client/front-upgrade-ui";
import { FRONT_CAMPAIGN_UNLOCKS } from "../../../src/client/front-campaign";

const FAMILY_LABEL = {
  explosion: "爆発",
  piercing: "貫通",
  interception: "迎撃",
  generic: "補強",
} as const;
// 戦闘・基地と同じ画像の切り出し規則（front-upgrade-ui.ts の atlasIds）。
const ATLAS_IDS: readonly FrontUpgradeId[] = [
  "life-drain",
  "power-cell",
  "reserve-rounds",
  ...FRONT_FUSION_IDS.slice(0, 6),
];
const view = (levels: Partial<Record<FrontUpgradeId, number>>) => ({
  levels: Object.fromEntries(
    [...FRONT_BASE_IDS, ...FRONT_FUSION_IDS].map((id) => [id, levels[id] ?? 0]),
  ) as Record<FrontUpgradeId, number>,
  evolved: [],
  picks: 0,
  growthVersion: 3 as const,
});

const cards = [...FRONT_BASE_IDS, ...FRONT_FUSION_IDS].map((id) => {
  const d = FRONT_UPGRADE_CATALOG[id];
  const fusion = isFrontFusion(id);
  const atlas = ATLAS_IDS.indexOf(id);
  const levels = Array.from({ length: d.maxLevel }, (_, i) => i + 1);
  return {
    id,
    name: d.name,
    catalogDescription: d.description,
    family: d.family,
    familyLabel: FAMILY_LABEL[d.family],
    maxLevel: d.maxLevel,
    fusion,
    materials: fusion ? [...FRONT_FUSIONS[id]] : [],
    unlockStage:
      FRONT_CAMPAIGN_UNLOCKS.find((r) => r.ids.includes(id))?.stage ?? null,
    icon:
      atlas < 0
        ? { kind: "image", file: `${id}.png` }
        : { kind: "atlas", file: "fusion-atlas.png", index: atlas },
    // 段階ごとの効果文（基地の詳細・取得済み一覧と同じ関数）。
    effectByLevel: levels.map((n) => frontUpgradeEffect(id, n)),
    // プレイ中の3択に出る文面（未取得→1段階、n→n+1段階）。
    offerCopy: [0, ...levels.slice(0, -1)].map((owned) => {
      const c = frontUpgradeCardCopy(view({ [id]: owned }), id);
      return {
        owned,
        status: c.status,
        rank: c.rank,
        description: c.description,
      };
    }),
  };
});

const data = {
  source:
    "src/shared/front-upgrades.ts, src/client/front-upgrade-ui.ts, src/client/front-campaign.ts",
  limits: {
    maxTypes: FRONT_MAX_TYPES,
    minPool: 6,
    rerolls: FRONT_MAX_REROLLS,
  },
  baseIds: FRONT_BASE_IDS,
  fusionIds: FRONT_FUSION_IDS,
  cards,
};
process.stdout.write(JSON.stringify(data, null, 1));
