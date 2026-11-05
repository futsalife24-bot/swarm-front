import type { World } from "../shared/game";
import type { FrontRunView } from "../shared/front-run";
import type { NewWeapon } from "../shared/progression";
import { frontCampaignCoins } from "./front-campaign";
import type { FrontRewardStatus } from "./front-reward-status";
import type { ProgressSave } from "./progression-save";

export interface FrontResultRewards {
  coins: number | null;
  treasureCoins: number;
  progress: string;
  campaign: string;
  error: boolean;
  eligible: boolean;
  weapons: {
    weapon: NewWeapon;
    state: "stored" | "pending" | "unsaved";
  }[];
  save: ProgressSave | null;
}

/** 表示するのは今回の本人の確定報酬だけ。保存と付与は既存経路が担当する。 */
export function frontResultRewards(
  world: World,
  info: FrontRunView,
  playerId: string,
  status: FrontRewardStatus | undefined,
  save: ProgressSave | null,
): FrontResultRewards {
  const eligible =
    info.mode === "survival" && info.growthVersion === 3 && info.rewardEligible;
  const current = status?.runId === world.run ? status : undefined;
  const stored = new Set(save?.inventory.map((w) => w.id));
  const pending = new Set(save?.pending.map((w) => w.id));
  return {
    coins: eligible
      ? frontCampaignCoins(world.time) + (info.treasureCoins ?? 0)
      : null,
    treasureCoins: eligible ? (info.treasureCoins ?? 0) : 0,
    progress: current?.progress ?? "",
    campaign: current?.campaign ?? "",
    error: current?.error ?? false,
    eligible,
    weapons: eligible
      ? ((world.rewards[playerId] ?? []) as NewWeapon[]).map((weapon) => ({
          weapon,
          state: stored.has(weapon.id)
            ? "stored"
            : pending.has(weapon.id)
              ? "pending"
              : "unsaved",
        }))
      : [],
    save,
  };
}
