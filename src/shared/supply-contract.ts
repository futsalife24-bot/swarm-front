import { validNewWeapon, type NewWeapon } from "./progression";
import { isBuddyId, type BuddyId } from "./buddy-progression";

/** サーバーが券消費と同時に確定した報酬。表示側で再抽選しない。 */
export type SupplyReward =
  | { type: "weapon"; weapon: NewWeapon }
  | { type: "buddy"; buddyId: BuddyId }
  | { type: "shard"; amount: number };

export interface SupplyReceipt {
  version: 1;
  requestId: string;
  count: 1 | 10;
  createdAt: number;
  rewards: SupplyReward[];
}

export interface SupplySnapshot {
  tickets: number;
  day: string;
  pending: SupplyReceipt | null;
}

export const supplyRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );

export function validSupplyReceipt(value: unknown): value is SupplyReceipt {
  if (!value || typeof value !== "object") return false;
  const r = value as SupplyReceipt;
  if (
    r.version !== 1 ||
    !supplyRequestId(r.requestId) ||
    (r.count !== 1 && r.count !== 10) ||
    !Number.isSafeInteger(r.createdAt) ||
    r.createdAt < 0 ||
    !Array.isArray(r.rewards) ||
    r.rewards.length !== r.count
  )
    return false;
  const ids = new Set<string>();
  return r.rewards.every((reward) => {
    if (!reward || typeof reward !== "object") return false;
    if (reward.type === "weapon") {
      if (!validNewWeapon(reward.weapon) || ids.has(reward.weapon.id))
        return false;
      ids.add(reward.weapon.id);
      return true;
    }
    if (reward.type === "buddy") return isBuddyId(reward.buddyId);
    return (
      reward.type === "shard" &&
      Number.isSafeInteger(reward.amount) &&
      reward.amount > 0 &&
      reward.amount <= 1_000_000
    );
  });
}

export const supplyReceiptKey = (receipt: SupplyReceipt) =>
  `supply:${receipt.requestId}`;
