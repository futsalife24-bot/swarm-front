import type { FrontUpgradeId } from "../shared/front-upgrades";

// 絵だけの素材。名前・分類・数値・段階・状態はUIが描画する。
// 未制作カードは既存アイコンへフォールバック。素材保存の索引もこの表から読む。
export const SURVIVAL_CARD_ART: Partial<Record<FrontUpgradeId, string>> = {
  "fire-rounds": "rebuild/card-art/fire-rounds-v1.webp",
  "frost-rounds": "rebuild/card-art/frost-rounds-v1.webp",
  "chain-lightning": "rebuild/card-art/chain-lightning-v1.webp",
  "fusion-reactor": "rebuild/card-art/fusion-reactor-v1.webp",
};

export function survivalCardArt(
  id: FrontUpgradeId,
  base: string,
  large = false,
) {
  const file = SURVIVAL_CARD_ART[id];
  return file
    ? base + (large ? file : file.replace(".webp", "-thumb.webp"))
    : undefined;
}
