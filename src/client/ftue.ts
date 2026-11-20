import { highestClearedStage } from "./front-campaign";
import type { ProgressSave } from "./progression-save";

export type FtueNextStep =
  | { kind: "solo"; label: "solo advance （進撃）"; destination: "solo" }
  | {
      kind: "buddy";
      label: "最初のバディを選ぶ";
      destination: "base → buddy card";
    }
  | {
      kind: "supply";
      label: "初回補給10連";
      destination: "base → supply pod";
    }
  | {
      kind: "supplyBox";
      label: "支給ボックス";
      destination: "supplyBox";
    }
  | { kind: "none"; label: null; destination: null };

export interface FtueContext {
  /** 支給ボックスに、この端末で受け取れる物があるか。 */
  supplyBoxClaimable?: boolean;
}

export function nextFtueStep(
  save: ProgressSave | null,
  context: FtueContext = {},
): FtueNextStep {
  if (!save || highestClearedStage(save) < 1)
    return { kind: "solo", label: "solo advance （進撃）", destination: "solo" };
  if (save.buddies?.starterChosen !== true)
    return {
      kind: "buddy",
      label: "最初のバディを選ぶ",
      destination: "base → buddy card",
    };
  if (!(save.receipts ?? []).some((receipt) => receipt.startsWith("supply:")))
    return {
      kind: "supply",
      label: "初回補給10連",
      destination: "base → supply pod",
    };
  if (context.supplyBoxClaimable === true)
    return {
      kind: "supplyBox",
      label: "支給ボックス",
      destination: "supplyBox",
    };
  return { kind: "none", label: null, destination: null };
}

export interface FirstVictoryRouteContext {
  normalMode: boolean;
  developerMode: boolean;
  firstVictory: boolean;
  stage: number;
  firstBuddyChosen: boolean;
  firstSupplyDone: boolean;
  ticketsAvailable: number;
}

export type FirstVictoryRoute = "buddy" | "supply" | "none";

/** Direct route is shown only for an unfinished FTUE and a server balance of at least 10. */
export function firstVictoryRoute(context: FirstVictoryRouteContext): FirstVictoryRoute {
  if (
    !context.normalMode ||
    context.developerMode ||
    !context.firstVictory ||
    context.stage !== 1 ||
    context.firstSupplyDone ||
    context.ticketsAvailable < 10
  )
    return "none";
  return context.firstBuddyChosen ? "supply" : "buddy";
}