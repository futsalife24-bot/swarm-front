import type { MenuDestination } from "./menu-navigation";
import type { UnlockEntry, UnlockState } from "./unlock-stage";

const NAV_UNLOCK_ENTRIES: Partial<Record<MenuDestination, UnlockEntry>> = {
  base: "base",
  armory: "weapons",
  workshop: "workshop",
  supply: "supply",
  report: "enemyReport",
};

export type BaseCardEntry =
  | "weapons"
  | "accessories"
  | "growth"
  | "buddy"
  | "supply"
  | "survivalCards"
  | "workshop";

export interface BaseCardView {
  disabled: boolean;
  ariaDisabled: boolean;
  status: string;
}

export function campaignMenuUnlocked(
  destination: MenuDestination,
  unlock: UnlockState,
) {
  const entry = NAV_UNLOCK_ENTRIES[destination];
  return !entry || unlock.entries[entry].open;
}

export function baseCardView(
  unlock: UnlockState,
  entry: BaseCardEntry,
  openStatus: string,
  modeDisabled = false,
): BaseCardView {
  const { open, reason } = unlock.entries[entry];
  return {
    disabled: modeDisabled || !open,
    ariaDisabled: !open,
    status: open ? openStatus : reason,
  };
}
