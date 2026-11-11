import { KINDS } from "../shared/defs";
import {
  makeWeapon,
  VARIANCE_KEYS,
  type Variances,
} from "../shared/progression";
import type { SupplyReward } from "../shared/supply-contract";
import { drawSupply } from "../shared/supply-policy";
import { supplyResults } from "./supply-presentation";

export const SUPPLY_EFFECT_NAMES = [
  "金の射出",
  "流星群の降下",
  "地割れの着地",
  "目印の先読み",
  "飛び級昇格",
  "再点火",
  "長押し解放",
  "無音と時間停止",
  "画面割れ",
  "通信ジャック",
] as const;

/** 選択した下限を満たす使い捨ての10枠。取得処理へは渡さない。 */
export function selectedSupplyPreview(effect: number) {
  if (!Number.isInteger(effect) || effect < 1 || effect > 10)
    throw Error("演出を選択してください");
  const variance = Object.fromEntries(
    VARIANCE_KEYS.map((key) => [key, 0]),
  ) as Variances;
  const rarities = [3, 0, 1, 2, 0, 1, 0, 1, 0, 0];
  const rewards: SupplyReward[] = rarities.map((rarity, i) => ({
    type: "weapon",
    weapon: {
      ...makeWeapon(
        `preview_${i}`,
        KINDS[i % KINDS.length],
        rarity,
        variance,
        true,
        i,
      ),
      level: 1,
    },
  }));
  rewards[9] = { type: "shard", amount: 10 };
  if (effect === 10) rewards[0] = { type: "buddy", buddyId: "tatara" };
  return supplyResults(rewards);
}

/** 本番サーバーと同じ抽選・10連保証を端末内で試す。通信・受領・保存なし。 */
export function randomSupplyPreview(rng: () => number = Math.random) {
  return supplyResults(
    drawSupply(10, crypto.randomUUID(), Date.now(), rng).rewards,
  );
}
