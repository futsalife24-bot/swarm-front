/**
 * 初回ガイドの既読と基礎訓練の修了の記録（tutorial-proposal §8-2）。
 * 端末ごとの新しい記録 `swarm-front-tutorial-v1` に、見たIDの一覧だけを持つ。
 * 進撃（playtest-app）・生存（front-app）・協力（main.ts）の3つの入口から同じ記録を読む。
 * 進撃の保存データ（ProgressSave。既存の tutorials 3件を含む）は変えない。
 */
export const TUTORIAL_FLAGS_KEY = "swarm-front-tutorial-v1";

/** 初回ガイド（第2層）の記録キー。G18 は仕組みの実装後に追加する。 */
export const GUIDE_KEYS = [
  "gear",
  "battle-multi",
  "buddy-battle",
  "result",
  "base",
  "supply",
  "buddy-menu",
  "survival",
  "card",
  "fusion",
  "defense",
  "lobby",
  "loot-multi",
  "revive",
] as const;
export type GuideKey = (typeof GUIDE_KEYS)[number];

export const OPERATION_KEYS = [
  "move",
  "fire",
  "swap",
  "dodge",
  "buddy-skill",
  "look",
  "reload",
  "jump",
  "kill",
  "pickup",
  "medkit",
] as const;
export const FTUE_KEYS = [
  "start",
  "first-sortie",
  "first-clear",
  "first-supply10",
  "equip",
  "box",
  "done",
] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
export type FtueKey = (typeof FTUE_KEYS)[number];
export type TutorialFlag =
  | GuideKey
  | "offer"
  | "training"
  | `op:${OperationKey}`
  | `ftue:${FtueKey}`
  | `ftue:${string}`;

const operationFlags = OPERATION_KEYS.map((key) => `op:${key}` as TutorialFlag);
const ftueFlags = FTUE_KEYS.map((key) => `ftue:${key}` as TutorialFlag);
const migrationFlag = "ftue:v2" as TutorialFlag;
const achievementFlags: readonly TutorialFlag[] = [
  ...operationFlags,
  ...ftueFlags,
  migrationFlag,
];

interface TutorialFlags {
  version: 1;
  seen: string[];
}
type Store = Pick<Storage, "getItem" | "setItem">;
export const defaultStore = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

function read(store: Store | undefined): TutorialFlags | undefined {
  try {
    const raw = store?.getItem(TUTORIAL_FLAGS_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as TutorialFlags;
    return value?.version === 1 && Array.isArray(value.seen)
      ? { version: 1, seen: value.seen.filter((v) => typeof v === "string") }
      : undefined;
  } catch {
    return undefined;
  }
}
function write(store: Store | undefined, flags: TutorialFlags) {
  try {
    store?.setItem(TUTORIAL_FLAGS_KEY, JSON.stringify(flags));
    return !!store;
  } catch {
    return false;
  }
}

/** 保存できない端末でも、この起動中は同じ案内を繰り返さない。 */
const session = new Set<string>();
const returnVisitSession = new Set<string>();

/**
 * 記録が無いときだけ作る。既存のプレイヤー（判断点5）には訓練の誘いと初回ガイドを
 * 自動で出さないため、すべて既読として始める。新しいプレイヤーは空から始める。
 */
export function ensureTutorialFlags(
  existingPlayer: boolean,
  store = defaultStore(),
) {
  if (read(store)) return false;
  return write(store, {
    version: 1,
    seen: existingPlayer ? ["offer", ...GUIDE_KEYS] : [],
  });
}
/** C-6 F1: seed operation and milestone flags without touching ProgressSave. */
export function migrateTutorialFlags(
  clearedNormalStage: boolean,
  store = defaultStore(),
) {
  if (session.has(migrationFlag)) return false;
  const flags = read(store);
  if (!flags) {
    if (!clearedNormalStage) return false;
    const seen = ["offer", ...GUIDE_KEYS, ...achievementFlags];
    const saved = write(store, { version: 1, seen: [...seen] });
    if (!saved) for (const flag of seen) session.add(flag);
    return saved;
  }
  if (!clearedNormalStage || flags.seen.includes(migrationFlag)) return false;
  const fresh = achievementFlags.filter((flag) => !flags.seen.includes(flag));
  flags.seen.push(...fresh);
  const saved = write(store, flags);
  if (!saved) for (const flag of fresh) session.add(flag);
  return saved;
}/** Reads only; never mutates or saves ProgressSave. */
export function hasClearedNormalStage(
  save: { mode?: string; missions?: Record<string, boolean[]> } | null,
) {
  return Object.entries(save?.missions ?? {}).some(
    ([key, flags]) => key.endsWith(":normal") && !!flags?.[0],
  );
}

export function hasOperationFlag(
  flag: `op:${OperationKey}`,
  store = defaultStore(),
) {
  return hasSeen(flag, store);
}

export function markOperationFlag(
  flag: `op:${OperationKey}`,
  store = defaultStore(),
) {
  return markSeen(flag, store);
}

export function hasFtueFlag(flag: `ftue:${FtueKey}`, store = defaultStore()) {
  return hasSeen(flag, store);
}

export function markFtueFlag(flag: `ftue:${FtueKey}`, store = defaultStore()) {
  return markSeen(flag, store);
}

export function hasSeen(flag: TutorialFlag, store = defaultStore()) {
  return session.has(flag) || !!read(store)?.seen.includes(flag);
}

export function markSeen(flag: TutorialFlag, store = defaultStore()) {
  session.add(flag);
  const flags = read(store) ?? { version: 1 as const, seen: [] };
  if (flags.seen.includes(flag)) return true;
  flags.seen.push(flag);
  return write(store, flags);
}

/** 初回導線の「別の日本時間の日に再訪」だけを同じ記録の中で管理する。 */
export function markReturnVisit(date: string, store = defaultStore()) {
  const marker = `ftue:return:${date}`;
  if (returnVisitSession.has(marker)) return false;
  returnVisitSession.add(marker);
  const flags = read(store) ?? { version: 1 as const, seen: [] };
  const previous = flags.seen.filter((value) =>
    value.startsWith("ftue:return:"),
  );
  flags.seen = flags.seen.filter((value) => !value.startsWith("ftue:return:"));
  flags.seen.push(marker);
  const saved = write(store, flags);
  return saved && previous.length > 0 && !previous.includes(marker);
}

/** タイトルの「初回ガイドをもう一度表示」。訓練の誘い・修了の記録は残す。 */
export function resetGuides(store = defaultStore()) {
  for (const key of GUIDE_KEYS) session.delete(key);
  const flags = read(store) ?? { version: 1 as const, seen: [] };
  flags.seen = flags.seen.filter(
    (v) => !(GUIDE_KEYS as readonly string[]).includes(v),
  );
  return write(store, flags);
}

/** テスト用。 */
export function clearTutorialSession() {
  session.clear();
  returnVisitSession.clear();
}
