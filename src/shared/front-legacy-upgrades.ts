/** 更新前に一時停止保存された作戦専用。新規作戦では使用しない。 */
/**
 * 改装版の共通強化規則。候補と乱数はサーバー側またはソロ内だけに保持する。
 * 旧版の保存形式・通信ペイロードには載せない。一時的な作戦状態を不変更新する。
 * 支給武器は全て弾倉・装填を持つ。乱数は明示した整数シードのみを使う。
 */
export type FrontExplosionUpgradeId =
  "blast-core" | "fuse" | "compressed-charge";
export type FrontUpgradeId =
  | FrontExplosionUpgradeId
  | "armor-piercer"
  | "ricochet"
  | "line-shot"
  | "afterimage-mine"
  | "tactical-reload"
  | "interceptor"
  | "armor"
  | "reload"
  | "magazine";
export type FrontFamily = "explosion" | "piercing" | "interception";
export const FRONT_FAMILY_CARDS: Readonly<
  Record<FrontFamily, readonly FrontUpgradeId[]>
> = {
  explosion: ["blast-core", "fuse", "compressed-charge"],
  piercing: ["armor-piercer", "ricochet", "line-shot"],
  interception: ["afterimage-mine", "tactical-reload", "interceptor"],
};
export const FRONT_INITIAL_CARDS: readonly FrontUpgradeId[] = [
  "blast-core",
  "armor-piercer",
  "afterimage-mine",
];
export const FRONT_EVOLUTIONS: Readonly<
  Record<FrontFamily, { name: string; description: string }>
> = {
  explosion: {
    name: "連鎖崩落",
    description: "印を起爆すると近くの印へ深度2まで伝播。",
  },
  piercing: {
    name: "串刺し",
    description: "跳弾で撃破すると、次の手動弾の貫通と威力が増加。",
  },
  interception: {
    name: "反撃線",
    description: "地雷起爆後、次の手動命中に迎撃弾を追加。",
  },
};

export interface FrontUpgradeDefinition {
  readonly id: FrontUpgradeId;
  readonly name: string;
  readonly description: string;
  readonly family: FrontFamily | "generic";
  readonly maxLevel: number;
}

export const FRONT_MAX_PICKS = 7;
export const FRONT_MAX_ADDITIONAL_RIGHTS = 6;
export const FRONT_MAX_REROLLS = 2;
export const FRONT_EXPLOSION_UPGRADES: readonly FrontExplosionUpgradeId[] =
  Object.freeze(["blast-core", "fuse", "compressed-charge"]);
export const FRONT_UPGRADE_IDS: readonly FrontUpgradeId[] = Object.freeze([
  ...FRONT_EXPLOSION_UPGRADES,
  "armor-piercer",
  "ricochet",
  "line-shot",
  "afterimage-mine",
  "tactical-reload",
  "interceptor",
  "armor",
  "reload",
  "magazine",
]);

export const FRONT_UPGRADE_CATALOG: Readonly<
  Record<FrontUpgradeId, FrontUpgradeDefinition>
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
  "armor-piercer": Object.freeze({
    id: "armor-piercer",
    name: "徹甲芯",
    description: "手動弾の貫通対象を1体追加。",
    family: "piercing",
    maxLevel: 1,
  }),
  ricochet: Object.freeze({
    id: "ricochet",
    name: "反射弾",
    description: "同じ敵へ3回の手動命中で、近くの別対象へ1回跳弾。",
    family: "piercing",
    maxLevel: 1,
  }),
  "line-shot": Object.freeze({
    id: "line-shot",
    name: "整列射",
    description: "貫通対象+1。1発で3体以上に当てると弾倉へ1発返す。",
    family: "piercing",
    maxLevel: 1,
  }),
  "afterimage-mine": Object.freeze({
    id: "afterimage-mine",
    name: "残像地雷",
    description: "回避終了地点に地雷。最大3個、4個目は最古を置換。",
    family: "interception",
    maxLevel: 1,
  }),
  "tactical-reload": Object.freeze({
    id: "tactical-reload",
    name: "戦術装填",
    description: "回避後の次の装填を短縮。",
    family: "interception",
    maxLevel: 1,
  }),
  interceptor: Object.freeze({
    id: "interceptor",
    name: "迎撃子機",
    description: "手動命中で充填。弾を消費した装填中に短い迎撃を1回。",
    family: "interception",
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

export interface FrontUpgradeOffer {
  readonly id: string;
  readonly revision: number;
  readonly kind: "initial" | "additional";
  readonly cardIds: readonly FrontUpgradeId[];
  readonly defaultCardId: FrontUpgradeId;
  /** Combination keys already shown for this one selection, including this offer. */
  readonly seenCombinations: readonly string[];
}

export interface FrontUpgradeState {
  readonly runId: string;
  readonly revision: number;
  readonly picks: number;
  readonly levels: Readonly<Record<FrontUpgradeId, number>>;
  readonly initialCardId: FrontUpgradeId | null;
  readonly initialCards: readonly FrontUpgradeId[];
  readonly evolved: boolean;
  readonly rightsGranted: number;
  readonly rightsSpent: number;
  readonly rerollsRemaining: number;
  /** Internal only; do not put this state in the existing shared World payload. */
  readonly rngState: number;
  readonly offerSerial: number;
  readonly offer: FrontUpgradeOffer | null;
  /** Replays are rejected, rather than consuming a second card or reroll. */
  readonly processedRequestIds: readonly string[];
}

export interface FrontUpgradeRequest {
  readonly runId: string;
  readonly offerId: string;
  readonly revision: number;
  readonly requestId: string;
}
export interface FrontUpgradeSelection extends FrontUpgradeRequest {
  readonly cardId: FrontUpgradeId;
}
export type FrontUpgradeFailure =
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
export type FrontUpgradeResult =
  | { readonly ok: true; readonly state: FrontUpgradeState }
  | {
      readonly ok: false;
      readonly state: FrontUpgradeState;
      readonly reason: FrontUpgradeFailure;
    };

type Build = Pick<FrontUpgradeState, "levels" | "initialCardId">;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integerIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 128;
const isUpgradeId = (value: unknown): value is FrontUpgradeId =>
  typeof value === "string" &&
  (FRONT_UPGRADE_IDS as readonly string[]).includes(value);
const compareIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const combinationKey = (ids: readonly FrontUpgradeId[]) =>
  [...ids].sort(compareIds).join(",");
export const frontFamilyCount = (
  build: Pick<FrontUpgradeState, "levels">,
  family: FrontFamily,
) => FRONT_FAMILY_CARDS[family].reduce((sum, id) => sum + build.levels[id], 0);
export const frontEvolvedFamilies = (
  build: Pick<FrontUpgradeState, "levels">,
): FrontFamily[] =>
  (Object.keys(FRONT_FAMILY_CARDS) as FrontFamily[]).filter(
    (family) => frontFamilyCount(build, family) === 3,
  );
const families = Object.keys(FRONT_FAMILY_CARDS) as FrontFamily[];

function eligibleFor(build: Build): FrontUpgradeId[] {
  return FRONT_UPGRADE_IDS.filter(
    (id) => build.levels[id] < FRONT_UPGRADE_CATALOG[id].maxLevel,
  );
}
function guaranteedFor(build: Build): FrontUpgradeId[] {
  return families.flatMap((family) =>
    frontFamilyCount(build, family) === 2
      ? FRONT_FAMILY_CARDS[family].filter((id) => build.levels[id] === 0)
      : [],
  );
}
function defaultFor(
  build: Build,
  cardIds: readonly FrontUpgradeId[],
): FrontUpgradeId {
  const guarantees = guaranteedFor(build);
  const priority = (id: FrontUpgradeId) =>
    guarantees.includes(id)
      ? 0
      : build.initialCardId !== null &&
          FRONT_UPGRADE_CATALOG[id].family ===
            FRONT_UPGRADE_CATALOG[build.initialCardId].family
        ? 1
        : 2;
  return [...cardIds].sort(
    (a, b) => priority(a) - priority(b) || compareIds(a, b),
  )[0];
}

/** All valid three-card combinations. Exact enumeration also makes rerolls bounded. */
function combinationsFor(build: Build): FrontUpgradeId[][] {
  const eligible = eligibleFor(build).sort(compareIds);
  const guaranteed = guaranteedFor(build);
  const continuation = families.filter(
    (family) => frontFamilyCount(build, family) === 1,
  );
  const combinations: FrontUpgradeId[][] = [];
  for (let a = 0; a < eligible.length - 2; a++) {
    for (let b = a + 1; b < eligible.length - 1; b++) {
      for (let c = b + 1; c < eligible.length; c++) {
        const ids = [eligible[a], eligible[b], eligible[c]];
        if (!guaranteed.every((id) => ids.includes(id))) continue;
        // まだ1枚の系統がある場合、続きの候補を少なくとも1つ含める。
        if (
          continuation.length &&
          !ids.some((id) =>
            continuation.includes(
              FRONT_UPGRADE_CATALOG[id].family as FrontFamily,
            ),
          )
        )
          continue;
        combinations.push(ids);
      }
    }
  }
  return combinations;
}
/** 候補の全経路検証用。実抽選と同じ組合せを返す。 */
export function frontCandidateCombinations(
  build: Build,
): readonly (readonly FrontUpgradeId[])[] {
  return combinationsFor(build);
}

/** Validate untrusted or accidentally corrupted state before any transition. */
export function isValidFrontUpgradeState(
  value: unknown,
): value is FrontUpgradeState {
  if (!isRecord(value) || !validId(value.runId) || !isRecord(value.levels))
    return false;
  if (
    !Array.isArray(value.initialCards) ||
    value.initialCards.length !== 3 ||
    !families.every(
      (family) =>
        (value.initialCards as unknown[]).filter(
          (id) =>
            isUpgradeId(id) && FRONT_UPGRADE_CATALOG[id].family === family,
        ).length === 1,
    )
  )
    return false;
  if (
    !integerIn(value.picks, 0, FRONT_MAX_PICKS) ||
    value.revision !== value.picks ||
    !integerIn(value.rightsGranted, 0, FRONT_MAX_ADDITIONAL_RIGHTS) ||
    !integerIn(value.rightsSpent, 0, value.rightsGranted) ||
    !integerIn(value.rerollsRemaining, 0, FRONT_MAX_REROLLS) ||
    !integerIn(value.rngState, 0, 0xffffffff) ||
    !integerIn(value.offerSerial, 1, FRONT_MAX_PICKS + FRONT_MAX_REROLLS)
  )
    return false;
  if (
    Object.keys(value.levels).length !== FRONT_UPGRADE_IDS.length ||
    !FRONT_UPGRADE_IDS.every((id) =>
      integerIn(
        (value.levels as Record<string, unknown>)[id],
        0,
        FRONT_UPGRADE_CATALOG[id].maxLevel,
      ),
    )
  )
    return false;
  const state = value as unknown as FrontUpgradeState;
  if (
    FRONT_UPGRADE_IDS.reduce((sum, id) => sum + state.levels[id], 0) !==
      state.picks ||
    state.evolved !== frontEvolvedFamilies(state).length > 0
  )
    return false;
  if (state.picks === 0) {
    if (
      state.initialCardId !== null ||
      state.rightsSpent !== 0 ||
      state.rerollsRemaining !== FRONT_MAX_REROLLS
    )
      return false;
  } else if (
    !(state.initialCards as readonly unknown[]).includes(state.initialCardId) ||
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
      state.picks + FRONT_MAX_REROLLS - state.rerollsRemaining ||
    state.offerSerial !==
      state.processedRequestIds.length + (state.offer === null ? 0 : 1)
  )
    return false;
  if (state.offer === null) return state.picks > 0;
  if (!isRecord(state.offer)) return false;
  const offer = state.offer;
  if (
    state.picks === FRONT_MAX_PICKS ||
    offer.id !== `${state.runId}:offer:${state.offerSerial}` ||
    offer.revision !== state.revision ||
    !Array.isArray(offer.cardIds) ||
    offer.cardIds.length !== 3 ||
    !offer.cardIds.every(isUpgradeId) ||
    new Set(offer.cardIds).size !== 3 ||
    !Array.isArray(offer.seenCombinations) ||
    offer.seenCombinations.length < 1 ||
    offer.seenCombinations.length >
      1 + FRONT_MAX_REROLLS - state.rerollsRemaining ||
    new Set(offer.seenCombinations).size !== offer.seenCombinations.length ||
    offer.seenCombinations.at(-1) !== combinationKey(offer.cardIds) ||
    offer.defaultCardId !== defaultFor(state, offer.cardIds)
  )
    return false;
  if (state.picks === 0)
    return (
      offer.kind === "initial" &&
      combinationKey(offer.cardIds) === combinationKey(state.initialCards) &&
      offer.seenCombinations.length === 1
    );
  const validCombinations = combinationsFor(state).map(combinationKey);
  return (
    offer.kind === "additional" &&
    state.rightsSpent < state.rightsGranted &&
    offer.seenCombinations.every((key) => validCombinations.includes(key))
  );
}

function requireValidState(state: FrontUpgradeState): void {
  if (!isValidFrontUpgradeState(state))
    throw new RangeError("改装版の強化状態が不正です");
}
export function getEligibleFrontUpgrades(
  state: FrontUpgradeState,
): FrontUpgradeId[] {
  requireValidState(state);
  return eligibleFor(state);
}
export function getGuaranteedFrontUpgrades(
  state: FrontUpgradeState,
): FrontUpgradeId[] {
  requireValidState(state);
  return guaranteedFor(state);
}

function makeOffer(
  state: FrontUpgradeState,
  ids: readonly FrontUpgradeId[],
  kind: FrontUpgradeOffer["kind"],
  serial: number,
  seen: readonly string[] = [],
): FrontUpgradeOffer {
  return Object.freeze({
    id: `${state.runId}:offer:${serial}`,
    revision: state.revision,
    kind,
    cardIds: Object.freeze([...ids]),
    defaultCardId: defaultFor(state, ids),
    seenCombinations: Object.freeze([...seen, combinationKey(ids)]),
  });
}

/** 各系統から1枚ずつの初期候補を作る。不正な作戦ID・シードは拒否する。 */
export function createFrontUpgradeState(
  runId: string,
  seed: number,
  initialCards: readonly FrontUpgradeId[] = FRONT_INITIAL_CARDS,
): FrontUpgradeState {
  if (!validId(runId) || !integerIn(seed, 0, 0xffffffff))
    throw new RangeError("作戦IDと32ビット整数シードが必要です");
  const state: FrontUpgradeState = {
    runId,
    revision: 0,
    picks: 0,
    levels: Object.freeze({
      "blast-core": 0,
      fuse: 0,
      "compressed-charge": 0,
      "armor-piercer": 0,
      ricochet: 0,
      "line-shot": 0,
      "afterimage-mine": 0,
      "tactical-reload": 0,
      interceptor: 0,
      armor: 0,
      reload: 0,
      magazine: 0,
    }),
    initialCardId: null,
    initialCards: Object.freeze([...initialCards]),
    evolved: false,
    rightsGranted: 0,
    rightsSpent: 0,
    rerollsRemaining: FRONT_MAX_REROLLS,
    rngState: seed,
    offerSerial: 1,
    offer: null,
    processedRequestIds: Object.freeze([]),
  };
  const result = Object.freeze({
    ...state,
    offer: makeOffer(state, initialCards, "initial", 1),
  });
  requireValidState(result);
  return result;
}

/** Cumulative XP rights, not a delta: repeating an XP update cannot grant twice. */
export function grantFrontUpgradeRights(
  state: FrontUpgradeState,
  cumulativeRights: number,
): FrontUpgradeState {
  requireValidState(state);
  if (
    !integerIn(
      cumulativeRights,
      state.rightsGranted,
      FRONT_MAX_ADDITIONAL_RIGHTS,
    )
  )
    throw new RangeError("経験値による取得権は0〜6の整数で、減らせません");
  return cumulativeRights === state.rightsGranted
    ? state
    : Object.freeze({ ...state, rightsGranted: cumulativeRights });
}

function rejected(
  state: FrontUpgradeState,
  reason: FrontUpgradeFailure,
): FrontUpgradeResult {
  return { ok: false, state, reason };
}

/** A uint32 LCG. Math.imul makes behavior independent of floating point products. */
function drawOffer(
  state: FrontUpgradeState,
  combinations: readonly (readonly FrontUpgradeId[])[],
  seen: readonly string[] = [],
): FrontUpgradeState {
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
export function openFrontUpgradeOffer(
  state: FrontUpgradeState,
): FrontUpgradeResult {
  if (!isValidFrontUpgradeState(state)) return rejected(state, "invalid-state");
  if (state.offer !== null) return rejected(state, "offer-open");
  if (state.picks >= FRONT_MAX_PICKS) return rejected(state, "pick-limit");
  if (state.rightsSpent >= state.rightsGranted)
    return rejected(state, "no-rights");
  return { ok: true, state: drawOffer(state, combinationsFor(state)) };
}

function validateRequest(
  state: FrontUpgradeState,
  request: FrontUpgradeRequest,
): FrontUpgradeFailure | null {
  if (!isValidFrontUpgradeState(state)) return "invalid-state";
  if (
    !isRecord(request) ||
    !validId(request.runId) ||
    typeof request.offerId !== "string" ||
    !validId(request.requestId) ||
    !integerIn(request.revision, 0, FRONT_MAX_PICKS)
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

export function selectFrontUpgrade(
  state: FrontUpgradeState,
  request: FrontUpgradeSelection,
): FrontUpgradeResult {
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
  const next: FrontUpgradeState = {
    ...state,
    levels,
    picks: state.picks + 1,
    revision: state.revision + 1,
    rightsSpent:
      state.rightsSpent + (state.offer!.kind === "additional" ? 1 : 0),
    initialCardId: state.initialCardId ?? request.cardId,
    evolved: frontEvolvedFamilies({ levels }).length > 0,
    offer: null,
    processedRequestIds: Object.freeze([
      ...state.processedRequestIds,
      request.requestId,
    ]),
  };
  return { ok: true, state: Object.freeze(next) };
}

/** UI availability uses the same legal combinations as the authoritative action. */
export function canRerollFrontUpgrade(state: FrontUpgradeState): boolean {
  if (
    !isValidFrontUpgradeState(state) ||
    state.offer?.kind !== "additional" ||
    state.rerollsRemaining === 0
  )
    return false;
  return combinationsFor(state).some(
    (ids) => !state.offer!.seenCombinations.includes(combinationKey(ids)),
  );
}

export function rerollFrontUpgrade(
  state: FrontUpgradeState,
  request: FrontUpgradeRequest,
): FrontUpgradeResult {
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
