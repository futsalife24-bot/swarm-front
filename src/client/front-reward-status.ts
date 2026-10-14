import { awardFrontProgress, type FrontStorage } from "./front-progress";
import {
  frontCampaignCoins,
  queueFrontCampaignReward,
  readFrontCampaign,
  type SurvivalSpoils,
} from "./front-campaign";

export interface FrontRewardStatus {
  runId: string;
  progress?: string;
  campaign?: string;
  text: string;
  error: boolean;
}

/** 成功した保存先の表示を維持し、失敗した保存先だけ再試行する。永続形式は変更しない。 */
export function saveFrontRunRewards(
  progressStorage: FrontStorage,
  campaignStorage: FrontStorage,
  receipt: Parameters<typeof awardFrontProgress>[1],
  campaignSeconds: number | null,
  previous?: FrontRewardStatus,
  spoils?: SurvivalSpoils,
): FrontRewardStatus {
  const status: FrontRewardStatus =
    previous?.runId === receipt.id
      ? { ...previous }
      : { runId: receipt.id, text: "", error: false };
  let progressError = "",
    campaignError = "";
  if (!status.progress) {
    const result = awardFrontProgress(progressStorage, receipt);
    if (result.saved) {
      const recorded = result.progress.receipts.find(
        (r) => r.id === receipt.id,
      );
      status.progress =
        !recorded && receipt.at <= result.progress.receiptFloor
          ? "功績：保存履歴より古い結果のため対象外"
          : `功績 +${recorded?.reward ?? result.reward}`;
    } else progressError = result.error;
  }
  if (campaignSeconds !== null && !status.campaign) {
    try {
      queueFrontCampaignReward(
        campaignStorage,
        receipt.id,
        campaignSeconds,
        spoils,
      );
      // queueの戻り値は他作戦の未保存分も合算するため、この作戦の既存計算式で表示する。
      const stored = readFrontCampaign(campaignStorage).save;
      const ids = new Set(
        [...(stored?.inventory ?? []), ...(stored?.pending ?? [])].map(
          (w) => w.id,
        ),
      );
      const count = spoils?.weapons.filter((w) => ids.has(w.id)).length ?? 0;
      status.campaign = `攻略コイン +${frontCampaignCoins(campaignSeconds)}${spoils ? ` · 恒久武器 ${count}丁 保存済み（上限超過は保留） · 最高生存 ${Math.floor(stored?.survival?.bestSeconds ?? 0)}秒` : ""}`;
    } catch (error) {
      campaignError = (error as Error).message;
    }
  }
  status.error =
    !status.progress || (campaignSeconds !== null && !status.campaign);
  status.text = [
    status.progress || progressError,
    campaignSeconds !== null ? status.campaign || campaignError : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return status;
}
