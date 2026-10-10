import { awardFrontProgress, type FrontStorage } from "./front-progress";
import { frontCampaignCoins, queueFrontCampaignReward } from "./front-campaign";

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
      status.progress = recorded ? `功績 +${recorded.reward}` : "功績 受取済み";
    } else progressError = result.error;
  }
  if (campaignSeconds !== null && !status.campaign) {
    try {
      queueFrontCampaignReward(campaignStorage, receipt.id, campaignSeconds);
      // queueの戻り値は他作戦の未保存分も合算するため、この作戦の既存計算式で表示する。
      status.campaign = `攻略コイン +${frontCampaignCoins(campaignSeconds)}`;
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
