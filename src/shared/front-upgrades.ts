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
  | "magazine"
  | "magnet"
  | "blast-radius"
  | "opening-shot"
  | "emergency-armor"
  | "life-drain"
  | "power-cell"
  | "reserve-rounds"
  | "fusion-collapse"
  | "fusion-skewer"
  | "fusion-counter"
  | "fusion-bastion"
  | "fusion-magazine"
  | "fusion-overdrive"
  | "boost-coil"
  | "recovery-pack"
  | "burst-cell"
  | "fusion-aegis"
  | "fusion-collector"
  | "fusion-reactor";
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

export const FRONT_MAX_PICKS = 12;
export const FRONT_MAX_ADDITIONAL_RIGHTS = 11;
export const FRONT_MAX_REROLLS = 2;
export const FRONT_MAX_TYPES = 6;
export const FRONT_EXPLOSION_UPGRADES: readonly FrontExplosionUpgradeId[] =
  Object.freeze(["blast-core", "fuse", "compressed-charge"]);
export const FRONT_V2_UPGRADE_IDS: readonly FrontUpgradeId[] = Object.freeze([
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
  "magnet",
  "blast-radius",
  "opening-shot",
  "emergency-armor",
]);

export const FRONT_FUSION_IDS = [
  "fusion-collapse",
  "fusion-skewer",
  "fusion-counter",
  "fusion-bastion",
  "fusion-magazine",
  "fusion-overdrive",
  "fusion-aegis",
  "fusion-collector",
  "fusion-reactor",
] as const;
export type FrontFusionId = (typeof FRONT_FUSION_IDS)[number];
export const FRONT_PREVIOUS_BASE_IDS: readonly FrontUpgradeId[] = [
  ...FRONT_V2_UPGRADE_IDS,
  "life-drain",
  "power-cell",
  "reserve-rounds",
];
export const FRONT_BASE_IDS: readonly FrontUpgradeId[] = [
  ...FRONT_PREVIOUS_BASE_IDS,
  "boost-coil",
  "recovery-pack",
  "burst-cell",
];
export const FRONT_PREVIOUS_IDS: readonly FrontUpgradeId[] = [
  ...FRONT_PREVIOUS_BASE_IDS,
  ...FRONT_FUSION_IDS.slice(0, 6),
];
export const FRONT_UPGRADE_IDS: readonly FrontUpgradeId[] = [
  ...FRONT_BASE_IDS,
  ...FRONT_FUSION_IDS,
];
export const FRONT_FUSIONS: Record<
  FrontFusionId,
  readonly [FrontUpgradeId, FrontUpgradeId]
> = {
  "fusion-collapse": ["fuse", "blast-radius"],
  "fusion-skewer": ["ricochet", "opening-shot"],
  "fusion-counter": ["afterimage-mine", "interceptor"],
  "fusion-bastion": ["armor", "life-drain"],
  "fusion-magazine": ["reload", "magazine"],
  "fusion-overdrive": ["power-cell", "reserve-rounds"],
  "fusion-aegis": ["boost-coil", "emergency-armor"],
  "fusion-collector": ["recovery-pack", "magnet"],
  "fusion-reactor": ["burst-cell", "compressed-charge"],
};
export const isFrontFusion = (id: FrontUpgradeId): id is FrontFusionId =>
  (FRONT_FUSION_IDS as readonly string[]).includes(id);
export const frontPickLimit = (s: { fusion?: boolean }) =>
  s.fusion ? 120 : FRONT_MAX_PICKS;
export const frontConsumed = (
  levels: Readonly<Record<FrontUpgradeId, number>>,
  id: FrontUpgradeId,
) =>
  FRONT_FUSION_IDS.some((f) => levels[f] > 0 && FRONT_FUSIONS[f].includes(id));
/** 素材は表示枠から消し、戦闘用に最大段階の効果を復元する。 */
export function frontEffectiveLevels(
  levels: Readonly<Record<FrontUpgradeId, number>>,
) {
  const result = Object.fromEntries(
    FRONT_UPGRADE_IDS.map((id) => [id, levels[id] ?? 0]),
  ) as Record<FrontUpgradeId, number>;
  for (const f of FRONT_FUSION_IDS)
    if (levels[f] > 0) {
      for (const id of FRONT_FUSIONS[f])
        result[id] = FRONT_UPGRADE_CATALOG[id].maxLevel + levels[f];
    }
  return result;
}

export const FRONT_UPGRADE_CATALOG: Readonly<
  Record<FrontUpgradeId, FrontUpgradeDefinition>
> = Object.freeze({
  "blast-core": Object.freeze({
    id: "blast-core",
    name: "誘爆核",
    description: "手動射撃で撃破すると小爆発。導火を持つと爆発で印も付ける。",
    family: "explosion",
    maxLevel: 3,
  }),
  fuse: Object.freeze({
    id: "fuse",
    name: "導火",
    description: "手動命中で印を付け、次の手動命中で印を消費して起爆。",
    family: "explosion",
    maxLevel: 3,
  }),
  "compressed-charge": Object.freeze({
    id: "compressed-charge",
    name: "圧縮炸薬",
    description:
      "同じ敵へ3回の手動命中で小爆発。他の爆発と重なる場合は半径を拡張。",
    family: "explosion",
    maxLevel: 3,
  }),
  "armor-piercer": Object.freeze({
    id: "armor-piercer",
    name: "徹甲芯",
    description: "手動弾の貫通対象を1体追加。",
    family: "piercing",
    maxLevel: 3,
  }),
  ricochet: Object.freeze({
    id: "ricochet",
    name: "反射弾",
    description: "同じ敵へ3回の手動命中で、近くの別対象へ1回跳弾。",
    family: "piercing",
    maxLevel: 3,
  }),
  "line-shot": Object.freeze({
    id: "line-shot",
    name: "整列射",
    description: "貫通対象+1。1発で3体以上に当てると弾倉へ1発返す。",
    family: "piercing",
    maxLevel: 3,
  }),
  "afterimage-mine": Object.freeze({
    id: "afterimage-mine",
    name: "残像地雷",
    description: "回避終了地点に地雷。最大3個、4個目は最古を置換。",
    family: "interception",
    maxLevel: 3,
  }),
  "tactical-reload": Object.freeze({
    id: "tactical-reload",
    name: "戦術装填",
    description: "回避後の次の装填を短縮。",
    family: "interception",
    maxLevel: 3,
  }),
  interceptor: Object.freeze({
    id: "interceptor",
    name: "迎撃子機",
    description: "手動命中で充填。弾を消費した装填中に短い迎撃を1回。",
    family: "interception",
    maxLevel: 3,
  }),
  armor: Object.freeze({
    id: "armor",
    name: "装甲補強",
    description:
      "最大HPを基準値の5%追加。生存中は増加分だけ現在HPも回復。最大4段階。",
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
  magnet: Object.freeze({
    id: "magnet",
    name: "磁力回収",
    description: "経験値の回収半径を段階ごとに3m追加。",
    family: "generic",
    maxLevel: 3,
  }),
  "blast-radius": Object.freeze({
    id: "blast-radius",
    name: "爆域拡張",
    description: "爆発・地雷の半径を段階ごとに20%拡張。",
    family: "generic",
    maxLevel: 3,
  }),
  "opening-shot": Object.freeze({
    id: "opening-shot",
    name: "装填初撃",
    description: "装填を完了した武器の初弾威力を段階ごとに25%強化。",
    family: "generic",
    maxLevel: 3,
  }),
  "emergency-armor": Object.freeze({
    id: "emergency-armor",
    name: "緊急装甲",
    description: "回避終了後2秒、被ダメージを段階ごとに10%軽減。",
    family: "generic",
    maxLevel: 3,
  }),
  "life-drain": {
    id: "life-drain",
    name: "生命回収",
    description: "撃破時に段階ごと1HP回復。",
    family: "generic",
    maxLevel: 3,
  },
  "power-cell": {
    id: "power-cell",
    name: "出力増幅",
    description: "手動射撃の威力を段階ごと10%増加。",
    family: "generic",
    maxLevel: 3,
  },
  "reserve-rounds": {
    id: "reserve-rounds",
    name: "弾薬循環",
    description: "手動射撃で撃破時、段階ごと1発を弾倉へ返却。",
    family: "generic",
    maxLevel: 3,
  },
  "boost-coil": {
    id: "boost-coil",
    name: "ブーストコイル",
    description: "回避の待ち時間を段階ごと8%短縮。",
    family: "generic",
    maxLevel: 3,
  },
  "recovery-pack": {
    id: "recovery-pack",
    name: "リカバリーパック",
    description: "経験値を拾うと段階ごと1HP回復。3秒に1回。",
    family: "generic",
    maxLevel: 3,
  },
  "burst-cell": {
    id: "burst-cell",
    name: "バーストセル",
    description: "爆発・地雷の威力を段階ごと8%増加。",
    family: "generic",
    maxLevel: 3,
  },
  "fusion-aegis": {
    id: "fusion-aegis",
    name: "イージスブースト",
    description: "回避の回転率と軽減を継承し、回避後の防御時間も延長。",
    family: "generic",
    maxLevel: 3,
  },
  "fusion-collector": {
    id: "fusion-collector",
    name: "ライフコレクター",
    description: "広い回収範囲と回復を継承し、回復の待ち時間も短縮。",
    family: "generic",
    maxLevel: 3,
  },
  "fusion-reactor": {
    id: "fusion-reactor",
    name: "ヒートリアクター",
    description:
      "爆発強化と連続命中を継承。2回命中の爆発に中心への追加ダメージ。",
    family: "explosion",
    maxLevel: 3,
  },
  "fusion-collapse": {
    id: "fusion-collapse",
    name: "チェインノヴァ",
    description: "導火と爆域拡張を継承。印の爆発が連鎖する。",
    family: "explosion",
    maxLevel: 3,
  },
  "fusion-skewer": {
    id: "fusion-skewer",
    name: "リフレクトバースト",
    description: "反射弾と装填初撃を継承。跳弾撃破で次弾を増幅。",
    family: "piercing",
    maxLevel: 3,
  },
  "fusion-counter": {
    id: "fusion-counter",
    name: "ミラージュガード",
    description: "残像地雷と迎撃子機を継承。地雷後の命中で迎撃。",
    family: "interception",
    maxLevel: 3,
  },
  "fusion-bastion": {
    id: "fusion-bastion",
    name: "リジェネアーマー",
    description: "装甲補強と生命回収を継承。最大体力と撃破回復を追加。",
    family: "generic",
    maxLevel: 3,
  },
  "fusion-magazine": {
    id: "fusion-magazine",
    name: "ラピッドマガジン",
    description: "整備手順と拡張弾倉を継承。弾倉と装填速度をさらに強化。",
    family: "generic",
    maxLevel: 3,
  },
  "fusion-overdrive": {
    id: "fusion-overdrive",
    name: "オーバードライブ",
    description: "出力増幅と弾薬循環を継承。威力と弾薬返却を追加。",
    family: "generic",
    maxLevel: 3,
  },
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
  readonly fusion?: true;
  readonly pool?: readonly FrontUpgradeId[];
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

type Build = Pick<FrontUpgradeState, "levels" | "initialCardId"> &
  Partial<Pick<FrontUpgradeState, "fusion" | "pool">>;
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
/** 進化準備の成立。実際の進化はこの条件成立後の精鋭撃破で獲得する。 */
export const FRONT_EVOLUTION_RECIPES: Record<
  FrontFamily,
  { main: FrontUpgradeId; support: FrontUpgradeId }
> = {
  explosion: { main: "fuse", support: "blast-radius" },
  piercing: { main: "ricochet", support: "opening-shot" },
  interception: { main: "afterimage-mine", support: "interceptor" },
};
export const frontEvolvedFamilies = (
  build: Pick<FrontUpgradeState, "levels">,
): FrontFamily[] =>
  (Object.keys(FRONT_EVOLUTION_RECIPES) as FrontFamily[]).filter((family) => {
    const { main, support } = FRONT_EVOLUTION_RECIPES[family];
    return (
      build.levels[main] === FRONT_UPGRADE_CATALOG[main].maxLevel &&
      build.levels[support] > 0
    );
  });
const families = Object.keys(FRONT_FAMILY_CARDS) as FrontFamily[];

/** 出撃に持ち込む基礎強化。開幕もこの候補から抽選する。 */
export function isValidFrontUpgradePool(
  value: unknown,
): value is FrontUpgradeId[] {
  return (
    Array.isArray(value) &&
    value.length >= 6 &&
    value.length <= FRONT_BASE_IDS.length &&
    new Set(value).size === value.length &&
    value.every((id) => FRONT_BASE_IDS.includes(id))
  );
}

function eligibleFor(build: Build): FrontUpgradeId[] {
  const full =
    FRONT_UPGRADE_IDS.filter((id) => build.levels[id] > 0).length >=
    FRONT_MAX_TYPES;
  return (build.fusion ? FRONT_UPGRADE_IDS : FRONT_V2_UPGRADE_IDS).filter(
    (id) => {
      if (build.fusion && isFrontFusion(id))
        return (
          (build.levels[id] > 0 && build.levels[id] < 3) ||
          (build.levels[id] === 0 &&
            FRONT_FUSIONS[id].every(
              (m) => build.levels[m] === FRONT_UPGRADE_CATALOG[m].maxLevel,
            ))
        );
      if (
        build.fusion &&
        (frontConsumed(build.levels, id) ||
          !(build.pool ?? FRONT_BASE_IDS).includes(id))
      )
        return false;
      return (
        (!full || build.levels[id] > 0) &&
        build.levels[id] < FRONT_UPGRADE_CATALOG[id].maxLevel
      );
    },
  );
}
function guaranteedFor(_build: Build): FrontUpgradeId[] {
  return _build.fusion
    ? eligibleFor(_build).filter(
        (id) => isFrontFusion(id) && !_build.levels[id],
      )
    : [];
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
  const owned = eligible.filter((id) => build.levels[id] > 0);
  const combinations: FrontUpgradeId[][] = [];
  // 6種類×最低3段階なので、12取得未満なら候補は必ず残る。
  const size = Math.min(3, eligible.length);
  if (!size) return [];
  const ready = guaranteedFor(build);
  const visit = (start: number, ids: FrontUpgradeId[]) => {
    if (ids.length === size) {
      if (ready.length && !ids.some((id) => ready.includes(id))) return;
      if (
        !owned.length ||
        ids.some((id) => owned.includes(id)) ||
        ids.some((id) => isFrontFusion(id) && !build.levels[id])
      )
        combinations.push(ids);
      return;
    }
    for (let i = start; i < eligible.length; i++)
      visit(i + 1, [...ids, eligible[i]]);
  };
  visit(0, []);
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
    new Set(value.initialCards).size !== 3 ||
    !value.initialCards.every(isUpgradeId) ||
    (!value.fusion &&
      !families.every(
        (family) =>
          (value.initialCards as unknown[]).filter(
            (id) => isUpgradeId(id) && FRONT_FAMILY_CARDS[family].includes(id),
          ).length === 1,
      ))
  )
    return false;
  if (
    !integerIn(value.picks, 0, value.fusion ? 120 : FRONT_MAX_PICKS) ||
    value.revision !== value.picks ||
    !integerIn(
      value.rightsGranted,
      0,
      value.fusion ? 119 : FRONT_MAX_ADDITIONAL_RIGHTS,
    ) ||
    !integerIn(value.rightsSpent, 0, value.rightsGranted) ||
    !integerIn(value.rerollsRemaining, 0, FRONT_MAX_REROLLS) ||
    !integerIn(value.rngState, 0, 0xffffffff) ||
    !integerIn(
      value.offerSerial,
      1,
      (value.fusion ? 120 : FRONT_MAX_PICKS) + FRONT_MAX_REROLLS,
    )
  )
    return false;
  const stateIds = value.fusion
    ? Object.keys(value.levels).length === FRONT_PREVIOUS_IDS.length
      ? FRONT_PREVIOUS_IDS
      : FRONT_UPGRADE_IDS
    : FRONT_V2_UPGRADE_IDS;
  if (
    Object.keys(value.levels).length !== stateIds.length ||
    !stateIds.every((id) =>
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
    state.fusion &&
    (!isValidFrontUpgradePool(state.pool) ||
      !state.pool.every((id) => stateIds.includes(id)) ||
      !state.initialCards.every((id) => state.pool!.includes(id)) ||
      FRONT_FUSION_IDS.some(
        (f) =>
          state.levels[f] > 0 &&
          FRONT_FUSIONS[f].some((id) => state.levels[id] !== 0),
      ))
  )
    return false;
  if (
    (state.fusion
      ? FRONT_UPGRADE_IDS.reduce(
          (sum, id) => sum + (state.levels[id] || 0),
          0,
        ) +
        FRONT_FUSION_IDS.filter((f) => state.levels[f] > 0).reduce(
          (sum, f) =>
            sum +
            FRONT_FUSIONS[f].reduce(
              (n, id) => n + FRONT_UPGRADE_CATALOG[id].maxLevel,
              0,
            ),
          0,
        )
      : FRONT_V2_UPGRADE_IDS.reduce((sum, id) => sum + state.levels[id], 0)) !==
      state.picks ||
    FRONT_UPGRADE_IDS.filter((id) => state.levels[id] > 0).length >
      FRONT_MAX_TYPES ||
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
    (state.levels[state.initialCardId!] < 1 &&
      !frontConsumed(state.levels, state.initialCardId!)) ||
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
    state.picks === frontPickLimit(state) ||
    offer.id !== `${state.runId}:offer:${state.offerSerial}` ||
    offer.revision !== state.revision ||
    !Array.isArray(offer.cardIds) ||
    offer.cardIds.length < 1 ||
    offer.cardIds.length > 3 ||
    !offer.cardIds.every(isUpgradeId) ||
    new Set(offer.cardIds).size !== offer.cardIds.length ||
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

/** 現行規則は持込候補から重複なし3種を抽選。旧規則の固定初期候補は維持する。 */
export function createFrontUpgradeState(
  runId: string,
  seed: number,
  initialCards: readonly FrontUpgradeId[] = FRONT_INITIAL_CARDS,
  pool?: readonly FrontUpgradeId[],
): FrontUpgradeState {
  if (!validId(runId) || !integerIn(seed, 0, 0xffffffff))
    throw new RangeError("作戦IDと32ビット整数シードが必要です");
  if (pool !== undefined && !isValidFrontUpgradePool(pool))
    throw new RangeError("強化候補は重複のない基礎強化6種類以上が必要です");
  const state: FrontUpgradeState = {
    runId,
    ...(pool ? { fusion: true as const, pool: Object.freeze([...pool]) } : {}),
    revision: 0,
    picks: 0,
    levels: Object.freeze({
      ...(pool
        ? Object.fromEntries(FRONT_UPGRADE_IDS.map((id) => [id, 0]))
        : {}),
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
      magnet: 0,
      "blast-radius": 0,
      "opening-shot": 0,
      "emergency-armor": 0,
    }) as Record<FrontUpgradeId, number>,
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
  const candidates = pool ? combinationsFor(state) : [];
  const rngState = pool ? (Math.imul(seed, 1664525) + 1013904223) >>> 0 : seed;
  const opening = pool
    ? candidates[Math.floor((rngState / 0x100000000) * candidates.length)]
    : initialCards;
  const opened = {
    ...state,
    rngState,
    initialCards: Object.freeze([...opening]),
  };
  const result = Object.freeze({
    ...opened,
    offer: makeOffer(opened, opening, "initial", 1),
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
    !integerIn(cumulativeRights, state.rightsGranted, frontPickLimit(state) - 1)
  )
    throw new RangeError(
      "経験値による取得権は規定上限内の整数で、減らせません",
    );
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
  if (state.picks >= frontPickLimit(state))
    return rejected(state, "pick-limit");
  if (state.rightsSpent >= state.rightsGranted)
    return rejected(state, "no-rights");
  const candidates = combinationsFor(state);
  if (!candidates.length) return rejected(state, "pick-limit");
  return { ok: true, state: drawOffer(state, candidates) };
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
    !integerIn(request.revision, 0, frontPickLimit(state))
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
    ...(state.fusion &&
    isFrontFusion(request.cardId) &&
    !state.levels[request.cardId]
      ? Object.fromEntries(FRONT_FUSIONS[request.cardId].map((id) => [id, 0]))
      : {}),
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
