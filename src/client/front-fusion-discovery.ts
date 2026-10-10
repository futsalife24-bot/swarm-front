import {
  FRONT_FUSION_IDS,
  type FrontUpgradeId,
} from "../shared/front-upgrades";
import type { FrontStorage } from "./front-progress";

export const FRONT_FUSION_DISCOVERY_KEY = "swarm-front-fusion-discovery-v1";
export function readFrontFusionDiscovery(storage: FrontStorage) {
  try {
    const raw = storage.getItem(FRONT_FUSION_DISCOVERY_KEY);
    if (raw === null) return { ids: [] as FrontUpgradeId[], error: "" };
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Array.isArray(value.ids) ||
      value.ids.length > FRONT_FUSION_IDS.length ||
      new Set(value.ids).size !== value.ids.length ||
      !value.ids.every((id: FrontUpgradeId) =>
        FRONT_FUSION_IDS.includes(id as (typeof FRONT_FUSION_IDS)[number]),
      )
    )
      throw new Error();
    return { ids: value.ids as FrontUpgradeId[], error: "" };
  } catch {
    return {
      ids: [] as FrontUpgradeId[],
      error: "融合の発見記録を読み込めません。既存の記録は保持しています。",
    };
  }
}

/** 自分の確定済み強化だけを記録。抽選候補や部隊員の所持からは解放しない。 */
export function recordFrontFusionDiscovery(
  storage: FrontStorage,
  view: {
    growthVersion?: number;
    levels: Partial<Record<FrontUpgradeId, number>>;
  },
) {
  const current = readFrontFusionDiscovery(storage);
  if (current.error || view.growthVersion !== 3) return current;
  const ids = [
    ...new Set([
      ...current.ids,
      ...FRONT_FUSION_IDS.filter((id) => (view.levels[id] ?? 0) > 0),
    ]),
  ];
  if (ids.length === current.ids.length) return current;
  try {
    storage.setItem(
      FRONT_FUSION_DISCOVERY_KEY,
      JSON.stringify({ version: 1, ids }),
    );
    return { ids, error: "" };
  } catch {
    return { ...current, error: "融合の発見記録を保存できません。" };
  }
}
