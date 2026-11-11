import { BUDDY_IDS } from "./buddy-progression";
import { EFFECT_POOLS, KINDS } from "./defs";
import {
  makeWeapon,
  rollVariance,
  VARIANCE_KEYS,
  type Variances,
} from "./progression";
import {
  supplyRequestId,
  type SupplyReceipt,
  type SupplyReward,
} from "./supply-contract";

export const SUPPLY_RULES = {
  initialTickets: 10,
  dailyTickets: 1,
  singleCost: 1,
  tenCost: 10,
  shardAmount: 10,
  weights: { N: 0.45, R: 0.3, SR: 0.15, SSR: 0.04, buddy: 0.01, shard: 0.05 },
  guaranteeWeights: { SR: 0.75, SSR: 0.2, buddy: 0.05 },
} as const;

function random(rng: () => number) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw Error("乱数が不正です");
  return value;
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(random(rng) * items.length)];
}

function reward(
  category: "N" | "R" | "SR" | "SSR" | "buddy" | "shard",
  requestId: string,
  index: number,
  now: number,
  rng: () => number,
): SupplyReward {
  if (category === "shard")
    return { type: "shard", amount: SUPPLY_RULES.shardAmount };
  if (category === "buddy")
    return { type: "buddy", buddyId: pick(BUDDY_IDS, rng) };
  const kind = pick(KINDS, rng);
  const rarity = { N: 0, R: 1, SR: 2, SSR: 3 }[category];
  const variance = Object.fromEntries(
    VARIANCE_KEYS.map((key) => [key, rollVariance(() => random(rng))]),
  ) as Variances;
  const effect =
    rarity > 0 && random(rng) < 0.6 ? pick(EFFECT_POOLS[kind], rng) : "none";
  return {
    type: "weapon",
    weapon: {
      ...makeWeapon(
        `supply_${requestId.replaceAll("-", "")}_${index}`,
        kind,
        rarity,
        variance,
        false,
        now + index,
        effect,
      ),
      level: 1,
    },
  };
}

function category(rng: () => number) {
  const value = random(rng);
  const weights = SUPPLY_RULES.weights;
  if (value < weights.N) return "N";
  if (value < weights.N + weights.R) return "R";
  if (value < weights.N + weights.R + weights.SR) return "SR";
  if (value < weights.N + weights.R + weights.SR + weights.SSR) return "SSR";
  if (value < weights.N + weights.R + weights.SR + weights.SSR + weights.buddy)
    return "buddy";
  return "shard";
}

const isHighReward = (item: SupplyReward) =>
  item.type === "buddy" || (item.type === "weapon" && item.weapon.rarity >= 2);

/** 10連の既存当たりを確定位置へ移す。報酬と入力配列は変更しない。 */
export function orderSupplyRewards(
  rewards: readonly SupplyReward[],
): SupplyReward[] {
  const ordered = [...rewards];
  if (ordered.length !== 10 || isHighReward(ordered[9])) return ordered;
  for (let index = 8; index >= 0; index--) {
    if (isHighReward(ordered[index])) {
      [ordered[index], ordered[9]] = [ordered[9], ordered[index]];
      break;
    }
  }
  return ordered;
}

/** Pure draw: the caller commits this receipt together with the ticket debit. */
export function drawSupply(
  count: 1 | 10,
  requestId: string,
  now: number,
  rng: () => number,
): SupplyReceipt {
  if (
    (count !== 1 && count !== 10) ||
    !supplyRequestId(requestId) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > Number.MAX_SAFE_INTEGER - 10
  )
    throw Error("抽選指定が不正です");
  const rewards = Array.from({ length: count }, (_, index) =>
    reward(category(rng), requestId, index, now, rng),
  );
  if (count === 10 && !rewards.some(isHighReward)) {
    const value = random(rng);
    const guaranteed =
      value < SUPPLY_RULES.guaranteeWeights.SR
        ? "SR"
        : value <
            SUPPLY_RULES.guaranteeWeights.SR + SUPPLY_RULES.guaranteeWeights.SSR
          ? "SSR"
          : "buddy";
    rewards[9] = reward(guaranteed, requestId, 9, now, rng);
  }
  return {
    version: 1,
    requestId,
    count,
    createdAt: now,
    rewards: orderSupplyRewards(rewards),
  };
}
