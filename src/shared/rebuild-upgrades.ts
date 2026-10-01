/**
 * Isolated P1a draft rules. This is transient, solo-local run state, not a save
 * format or wire payload. All supported P1a weapons have a magazine and reload.
 * Calls are immutable; the explicit uint32 seed is the only source of randomness.
 */
export type RebuildExplosionUpgradeId =
  "blast-core" | "fuse" | "compressed-charge";
export type RebuildUpgradeId =
  RebuildExplosionUpgradeId | "armor" | "reload" | "magazine";

export interface RebuildUpgradeDefinition {
  readonly id: RebuildUpgradeId;
  readonly name: string;
  readonly description: string;
  readonly family: "explosion" | "generic";
  readonly maxLevel: number;
}

export const REBUILD_MAX_PICKS = 7;
export const REBUILD_MAX_ADDITIONAL_RIGHTS = 6;
export const REBUILD_MAX_REROLLS = 2;
export const REBUILD_EXPLOSION_UPGRADES: readonly RebuildExplosionUpgradeId[] =
  Object.freeze(["blast-core", "fuse", "compressed-charge"]);
export const REBUILD_UPGRADE_IDS: readonly RebuildUpgradeId[] = Object.freeze([
  ...REBUILD_EXPLOSION_UPGRADES,
  "armor",
  "reload",
  "magazine",
]);

export const REBUILD_UPGRADE_CATALOG: Readonly<
  Record<RebuildUpgradeId, RebuildUpgradeDefinition>
> = Object.freeze({
  "blast-core": Object.freeze({
    id: "blast-core",
    name: "誘爆核",
    description: "手動射撃で撃破すると小爆発。導火を持つと爆発で印も付ける。",
    family: "explosion",
    maxLevel: 1,
  }),
  fuse: Object.freeze({
    id: "fuse",
    name: "導火",
    description: "手動命中で印を付け、次の手動命中で印を消費して起爆。",
    family: "explosion",
    maxLevel: 1,
  }),
  "compressed-charge": Object.freeze({
    id: "compressed-charge",
    name: "圧縮炸薬",
    description:
      "同じ敵へ3回の手動命中で小爆発。他の爆発と重なる場合は半径を拡張。",
    family: "explosion",
    maxLevel: 1,
  }),
  armor: Object.freeze({
    id: "armor",
    name: "装甲補強",
    description: "最大HPを基準値の5%追加。増加分だけ現在HPも回復。最大4段階。",
    family: "generic",
    maxLevel: 4,
  }),
  reload: Object.freeze({
    id: "reload",
    name: "整備手順",
    description: "装填時間を基準値から5%短縮。最大4段階で20%短縮。",
    family: "generic",
    maxLevel: 4,
  }),
  magazine: Object.freeze({
    id: "magazine",
    name: "拡張弾倉",
    description:
      "基準弾倉の10%を切り上げた固定量を追加（最低1発）。最大4段階。",
    family: "generic",
    maxLevel: 4,
  }),
});

export interface RebuildUpgradeOffer {
  readonly id: string;
  readonly revision: number;
  readonly kind: "initial" | "additional";
  readonly cardIds: readonly RebuildUpgradeId[];
  readonly defaultCardId: RebuildUpgradeId;
  /** Combination keys already shown for this one selection, including this offer. */
  readonly seenCombinations: readonly string[];
}

export interface RebuildUpgradeState {
  readonly runId: string;
  readonly revision: number;
  readonly picks: number;
  readonly levels: Readonly<Record<RebuildUpgradeId, number>>;
  readonly initialCardId: RebuildExplosionUpgradeId | null;
  readonly evolved: boolean;
  readonly rightsGranted: number;
  readonly rightsSpent: number;
  readonly rerollsRemaining: number;
  /** Internal only; do not put this state in the existing shared World payload. */
  readonly rngState: number;
  readonly offerSerial: number;
  readonly offer: RebuildUpgradeOffer | null;
  /** Replays are rejected, rather than consuming a second card or reroll. */
  readonly processedRequestIds: readonly string[];
}

export interface RebuildUpgradeRequest {
  readonly runId: string;
  readonly offerId: string;
  readonly revision: number;
  readonly requestId: string;
}
export interface RebuildUpgradeSelection extends RebuildUpgradeRequest {
  readonly cardId: RebuildUpgradeId;
}
export type RebuildUpgradeFailure =
  | "invalid-state"
  | "invalid-request"
  | "wrong-run"
  | "duplicate-request"
  | "stale-revision"
  | "stale-offer"
  | "no-offer"
  | "offer-open"
  | "no-rights"
  | "pick-limit"
  | "not-offered"
  | "initial-reroll"
  | "reroll-limit"
  | "no-new-combination";
export type RebuildUpgradeResult =
  | { readonly ok: true; readonly state: RebuildUpgradeState }
  | {
      readonly ok: false;
      readonly state: RebuildUpgradeState;
      readonly reason: RebuildUpgradeFailure;
    };

type Build = Pick<RebuildUpgradeState, "levels" | "initialCardId">;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integerIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 128;
const isUpgradeId = (value: unknown): value is RebuildUpgradeId =>
  typeof value === "string" &&
  (REBUILD_UPGRADE_IDS as readonly string[]).includes(value);
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const combinationKey = (ids: readonly RebuildUpgradeId[]) =>
  [...ids].sort(compareIds).join(",");
const familyCount = (build: Build) =>
  REBUILD_EXPLOSION_UPGRADES.reduce((sum, id) => sum + build.levels[id], 0);

function eligibleFor(build: Build): RebuildUpgradeId[] {
  return REBUILD_UPGRADE_IDS.filter(
    (id) => build.levels[id] < REBUILD_UPGRADE_CATALOG[id].maxLevel,
  );
}
function guaranteedFor(build: Build): RebuildUpgradeId[] {
  return familyCount(build) === 2
    ? REBUILD_EXPLOSION_UPGRADES.filter((id) => build.levels[id] === 0)
    : [];
}
function defaultFor(
  build: Build,
  cardIds: readonly RebuildUpgradeId[],
): RebuildUpgradeId {
  const guarantees = guaranteedFor(build);
  const priority = (id: RebuildUpgradeId) =>
    guarantees.includes(id)
      ? 0
      : build.initialCardId !== null &&
          REBUILD_UPGRADE_CATALOG[id].family === "explosion"
        ? 1
        : 2;
  return [...cardIds].sort(
    (a, b) => priority(a) - priority(b) || compareIds(a, b),
  )[0];
}

/** All valid three-card combinations. Exact enumeration also makes rerolls bounded. */
function combinationsFor(build: Build): RebuildUpgradeId[][] {
  const eligible = eligibleFor(build).sort(compareIds);
  const guaranteed = guaranteedFor(build);
  const continuation = familyCount(build) === 1;
  const combinations: RebuildUpgradeId[][] = [];
  for (let a = 0; a < eligible.length - 2; a++) {
    for (let b = a + 1; b < eligible.length - 1; b++) {
      for (let c = b + 1; c < eligible.length; c++) {
        const ids = [eligible[a], eligible[b], eligible[c]];
        if (!guaranteed.every((id) => ids.includes(id))) continue;
        // P1a has one family: one continuation slot, the other two generic.
        if (
          continuation &&
          ids.filter((id) => REBUILD_UPGRADE_CATALOG[id].family === "explosion")
            .length !== 1
        )
          continue;
        combinations.push(ids);
      }
    }
  }
  return combinations;
}

/** Validate untrusted or accidentally corrupted state before any transition. */
export function isValidRebuildUpgradeState(
  value: unknown,
): value is RebuildUpgradeState {
  if (!isRecord(value) || !validId(value.runId) || !isRecord(value.levels))
    return false;
  if (
    !integerIn(value.picks, 0, REBUILD_MAX_PICKS) ||
    value.revision !== value.picks ||
    !integerIn(value.rightsGranted, 0, REBUILD_MAX_ADDITIONAL_RIGHTS) ||
    !integerIn(value.rightsSpent, 0, value.rightsGranted) ||
    !integerIn(value.rerollsRemaining, 0, REBUILD_MAX_REROLLS) ||
    !integerIn(value.rngState, 0, 0xffffffff) ||
    !integerIn(value.offerSerial, 1, REBUILD_MAX_PICKS + REBUILD_MAX_REROLLS)
  )
    return false;
  if (
    Object.keys(value.levels).length !== REBUILD_UPGRADE_IDS.length ||
    !REBUILD_UPGRADE_IDS.every((id) =>
      integerIn(
        (value.levels as Record<string, unknown>)[id],
        0,
        REBUILD_UPGRADE_CATALOG[id].maxLevel,
      ),
    )
  )
    return false;
  const state = value as unknown as RebuildUpgradeState;
  if (
    REBUILD_UPGRADE_IDS.reduce((sum, id) => sum + state.levels[id], 0) !==
      state.picks ||
    state.evolved !== (familyCount(state) === 3)
  )
    return false;
  if (state.picks === 0) {
    if (
      state.initialCardId !== null ||
      state.rightsSpent !== 0 ||
      state.rerollsRemaining !== REBUILD_MAX_REROLLS
    )
      return false;
  } else if (
    !(REBUILD_EXPLOSION_UPGRADES as readonly unknown[]).includes(
      state.initialCardId,
    ) ||
    state.levels[state.initialCardId!] !== 1 ||
    state.picks !== state.rightsSpent + 1
  )
    return false;
  if (
    !Array.isArray(state.processedRequestIds) ||
    !state.processedRequestIds.every(validId) ||
    new Set(state.processedRequestIds).size !==
      state.processedRequestIds.length ||
    state.processedRequestIds.length !==
      state.picks + REBUILD_MAX_REROLLS - state.rerollsRemaining ||
    state.offerSerial !==
      state.processedRequestIds.length + (state.offer === null ? 0 : 1)
  )
    return false;
  if (state.offer === null) return state.picks > 0;
  if (!isRecord(state.offer)) return false;
  const offer = state.offer;
  if (
    state.picks === REBUILD_MAX_PICKS ||
    offer.id !== `${state.runId}:offer:${state.offerSerial}` ||
    offer.revision !== state.revision ||
    !Array.isArray(offer.cardIds) ||
    offer.cardIds.length !== 3 ||
    !offer.cardIds.every(isUpgradeId) ||
    new Set(offer.cardIds).size !== 3 ||
    !Array.isArray(offer.seenCombinations) ||
    offer.seenCombinations.length < 1 ||
    offer.seenCombinations.length >
      1 + REBUILD_MAX_REROLLS - state.rerollsRemaining ||
    new Set(offer.seenCombinations).size !== offer.seenCombinations.length ||
    offer.seenCombinations.at(-1) !== combinationKey(offer.cardIds) ||
    offer.defaultCardId !== defaultFor(state, offer.cardIds)
  )
    return false;
  if (state.picks === 0)
    return (
      offer.kind === "initial" &&
      combinationKey(offer.cardIds) ===
        combinationKey(REBUILD_EXPLOSION_UPGRADES) &&
      offer.seenCombinations.length === 1
    );
  const validCombinations = combinationsFor(state).map(combinationKey);
  return (
    offer.kind === "additional" &&
    state.rightsSpent < state.rightsGranted &&
    offer.seenCombinations.every((key) => validCombinations.includes(key))
  );
}

function requireValidState(state: RebuildUpgradeState): void {
  if (!isValidRebuildUpgradeState(state))
    throw new RangeError("Invalid P1a upgrade state");
}
export function getEligibleRebuildUpgrades(
  state: RebuildUpgradeState,
): RebuildUpgradeId[] {
  requireValidState(state);
  return eligibleFor(state);
}
export function getGuaranteedRebuildUpgrades(
  state: RebuildUpgradeState,
): RebuildUpgradeId[] {
  requireValidState(state);
  return guaranteedFor(state);
}

function makeOffer(
  state: RebuildUpgradeState,
  ids: readonly RebuildUpgradeId[],
  kind: RebuildUpgradeOffer["kind"],
  serial: number,
  seen: readonly string[] = [],
): RebuildUpgradeOffer {
  return Object.freeze({
    id: `${state.runId}:offer:${serial}`,
    revision: state.revision,
    kind,
    cardIds: Object.freeze([...ids]),
    defaultCardId: defaultFor(state, ids),
    seenCombinations: Object.freeze([...seen, combinationKey(ids)]),
  });
}

/** Creates the initial explosion-only offer. Invalid run IDs or uint32 seeds throw. */
export function createRebuildUpgradeState(
  runId: string,
  seed: number,
): RebuildUpgradeState {
  if (!validId(runId) || !integerIn(seed, 0, 0xffffffff))
    throw new RangeError("P1a requires a nonempty run ID and a uint32 seed");
  const state: RebuildUpgradeState = {
    runId,
    revision: 0,
    picks: 0,
    levels: Object.freeze({
      "blast-core": 0,
      fuse: 0,
      "compressed-charge": 0,
      armor: 0,
      reload: 0,
      magazine: 0,
    }),
    initialCardId: null,
    evolved: false,
    rightsGranted: 0,
    rightsSpent: 0,
    rerollsRemaining: REBUILD_MAX_REROLLS,
    rngState: seed,
    offerSerial: 1,
    offer: null,
    processedRequestIds: Object.freeze([]),
  };
  return Object.freeze({
    ...state,
    offer: makeOffer(state, REBUILD_EXPLOSION_UPGRADES, "initial", 1),
  });
}

/** Cumulative XP rights, not a delta: repeating an XP update cannot grant twice. */
export function grantRebuildUpgradeRights(
  state: RebuildUpgradeState,
  cumulativeRights: number,
): RebuildUpgradeState {
  requireValidState(state);
  if (
    !integerIn(
      cumulativeRights,
      state.rightsGranted,
      REBUILD_MAX_ADDITIONAL_RIGHTS,
    )
  )
    throw new RangeError(
      "P1a XP rights must be a nondecreasing integer up to 6",
    );
  return cumulativeRights === state.rightsGranted
    ? state
    : Object.freeze({ ...state, rightsGranted: cumulativeRights });
}

function rejected(
  state: RebuildUpgradeState,
  reason: RebuildUpgradeFailure,
): RebuildUpgradeResult {
  return { ok: false, state, reason };
}

/** A uint32 LCG. Math.imul makes behavior independent of floating point products. */
function drawOffer(
  state: RebuildUpgradeState,
  combinations: readonly (readonly RebuildUpgradeId[])[],
  seen: readonly string[] = [],
): RebuildUpgradeState {
  const rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  const index = Math.floor((rngState / 0x100000000) * combinations.length);
  const offerSerial = state.offerSerial + 1;
  return Object.freeze({
    ...state,
    rngState,
    offerSerial,
    offer: makeOffer(
      state,
      combinations[index],
      "additional",
      offerSerial,
      seen,
    ),
  });
}

/** Open exactly one owed selection. The runtime decides when combat is paused. */
export function openRebuildUpgradeOffer(
  state: RebuildUpgradeState,
): RebuildUpgradeResult {
  if (!isValidRebuildUpgradeState(state))
    return rejected(state, "invalid-state");
  if (state.offer !== null) return rejected(state, "offer-open");
  if (state.picks >= REBUILD_MAX_PICKS) return rejected(state, "pick-limit");
  if (state.rightsSpent >= state.rightsGranted)
    return rejected(state, "no-rights");
  return { ok: true, state: drawOffer(state, combinationsFor(state)) };
}

function validateRequest(
  state: RebuildUpgradeState,
  request: RebuildUpgradeRequest,
): RebuildUpgradeFailure | null {
  if (!isValidRebuildUpgradeState(state)) return "invalid-state";
  if (
    !isRecord(request) ||
    !validId(request.runId) ||
    typeof request.offerId !== "string" ||
    !validId(request.requestId) ||
    !integerIn(request.revision, 0, REBUILD_MAX_PICKS)
  )
    return "invalid-request";
  if (request.runId !== state.runId) return "wrong-run";
  if (state.processedRequestIds.includes(request.requestId))
    return "duplicate-request";
  if (request.revision !== state.revision) return "stale-revision";
  if (!state.offer) return "no-offer";
  if (request.offerId !== state.offer.id) return "stale-offer";
  return null;
}

export function selectRebuildUpgrade(
  state: RebuildUpgradeState,
  request: RebuildUpgradeSelection,
): RebuildUpgradeResult {
  const error = validateRequest(state, request);
  if (error) return rejected(state, error);
  if (
    !isUpgradeId(request.cardId) ||
    !state.offer!.cardIds.includes(request.cardId)
  )
    return rejected(state, "not-offered");
  const levels = Object.freeze({
    ...state.levels,
    [request.cardId]: state.levels[request.cardId] + 1,
  });
  const next: RebuildUpgradeState = {
    ...state,
    levels,
    picks: state.picks + 1,
    revision: state.revision + 1,
    rightsSpent:
      state.rightsSpent + (state.offer!.kind === "additional" ? 1 : 0),
    initialCardId:
      state.initialCardId ?? (request.cardId as RebuildExplosionUpgradeId),
    evolved: familyCount({ levels, initialCardId: state.initialCardId }) === 3,
    offer: null,
    processedRequestIds: Object.freeze([
      ...state.processedRequestIds,
      request.requestId,
    ]),
  };
  return { ok: true, state: Object.freeze(next) };
}

/** UI availability uses the same legal combinations as the authoritative action. */
export function canRerollRebuildUpgrade(state: RebuildUpgradeState): boolean {
  if (
    !isValidRebuildUpgradeState(state) ||
    state.offer?.kind !== "additional" ||
    state.rerollsRemaining === 0
  )
    return false;
  return combinationsFor(state).some(
    (ids) => !state.offer!.seenCombinations.includes(combinationKey(ids)),
  );
}

export function rerollRebuildUpgrade(
  state: RebuildUpgradeState,
  request: RebuildUpgradeRequest,
): RebuildUpgradeResult {
  const error = validateRequest(state, request);
  if (error) return rejected(state, error);
  if (state.offer!.kind === "initial") return rejected(state, "initial-reroll");
  if (state.rerollsRemaining === 0) return rejected(state, "reroll-limit");
  const seen = state.offer!.seenCombinations;
  const alternatives = combinationsFor(state).filter(
    (ids) => !seen.includes(combinationKey(ids)),
  );
  if (alternatives.length === 0) return rejected(state, "no-new-combination");
  const next = drawOffer(state, alternatives, seen);
  return {
    ok: true,
    state: Object.freeze({
      ...next,
      rerollsRemaining: state.rerollsRemaining - 1,
      processedRequestIds: Object.freeze([
        ...state.processedRequestIds,
        request.requestId,
      ]),
    }),
  };
}
