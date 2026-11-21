export const SWARM_M2_KINDS = [
  "operation_achieved",
  "training_started",
  "training_completed",
  "first_buddy",
  "first_supply_opened",
  "second_sortie",
  "first_box_claim",
  "first_defeat",
] as const;

export type SwarmM2Kind = (typeof SWARM_M2_KINDS)[number];

export const SWARM_ELAPSED_BUCKETS = [
  "under_3m",
  "from_3m",
  "from_5m",
  "from_10m",
  "from_20m",
  "another_launch",
] as const;

export type ElapsedBucket = (typeof SWARM_ELAPSED_BUCKETS)[number];

export const M2_MARKERS = {
  operationAchieved: "ftue:operation-achieved",
  trainingStarted: "ftue:training-started",
  trainingCompleted: "ftue:training-completed",
  firstBuddy: "ftue:first-buddy",
  firstSupplyOpened: "ftue:first-supply-opened",
  secondSortie: "ftue:second-sortie",
  firstBoxClaim: "ftue:first-box-claim",
  firstDefeat: "ftue:first-defeat",
} as const;

export function isSwarmM2Kind(value: unknown): value is SwarmM2Kind {
  return (
    typeof value === "string" &&
    (SWARM_M2_KINDS as readonly string[]).includes(value)
  );
}

export function isElapsedBucket(value: unknown): value is ElapsedBucket {
  return (
    typeof value === "string" &&
    (SWARM_ELAPSED_BUCKETS as readonly string[]).includes(value)
  );
}

export function elapsedBucketFromSeconds(seconds: number): ElapsedBucket {
  if (seconds < 180) return "under_3m";
  if (seconds < 300) return "from_3m";
  if (seconds < 600) return "from_5m";
  if (seconds < 1200) return "from_10m";
  return "from_20m";
}
