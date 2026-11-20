/**
 * 支給ボックス（2026-11-14 本人決定の名称）。
 * 配布物を「受け取るまで保持する」共通の受け箱。配布＝即付与にせず、受け取りで初めて効果が付く。
 * 今後のイベント報酬・補填・ログインボーナスなどもここへ入れる。
 *
 * 保存は端末ごとの新キー（SUPPLY_BOX_KEY）だけ。既存の進行保存（ProgressSave）の形式・キーは変えない。
 * コインの付与は受け取り時に既存の保存処理（呼び出し側の addCoins）で行う。
 */
import { japanDay } from "../shared/calendar";
import {
  isControlVoice,
  unlockControlVoice,
  type ControlVoiceId,
} from "./control-voice";

export const SUPPLY_BOX_KEY = "swarm-front-supply-box-v1";
/** 未受取の上限。超える分のログインボーナスは入れず、空きができた日に入る。 */
export const SUPPLY_BOX_LIMIT = 100;

export type SupplyBoxReward =
  | { kind: "coins"; amount: number }
  | { kind: "control-voice"; voice: ControlVoiceId };
export type SupplyBoxSource =
  "login" | "distribution" | "event" | "compensation";
export interface SupplyBoxItem {
  /** 配布ごとに一意。一度きり配布はこのIDで二重配布を防ぐ。 */
  id: string;
  source: SupplyBoxSource;
  title: string;
  detail: string;
  reward: SupplyBoxReward;
  /** 配布した時刻（ms）。 */
  at: number;
}
export interface SupplyBoxState {
  version: 1;
  /** 未受取の中身。 */
  items: SupplyBoxItem[];
  /** 一度きり配布の済み記録（受け取り後も残す）。 */
  granted: string[];
  /** ログインボーナスの最終付与日（日本時間）と通算日数。 */
  login?: { day: string; count: number };
}

/**
 * ログインボーナスの報酬表（仮置き・要確認。本人が後からバランス調整する前提）。
 * 通算ログイン日数で7日周期。補給券・ガチャ関連は配らない。
 */
export const LOGIN_BONUS_TABLE: readonly SupplyBoxReward[] = [
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 50 },
  { kind: "coins", amount: 100 },
];

/** 本実装の初起動時に1回だけ配る、管制AIヒヨリの解放アイテム。 */
export const HIYORI_RELEASE: Omit<SupplyBoxItem, "at"> = {
  id: "dist-control-voice-hiyori-20261114",
  source: "distribution",
  title: "管制AI「ヒヨリ」解放",
  detail:
    "受け取ると、設定の「管制AIボイス」でヒヨリを選べます。音声は設定からダウンロードします。",
  reward: { kind: "control-voice", voice: "hiyori" },
};

type Store = Pick<Storage, "getItem" | "setItem">;
const defaultStore = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};
export const emptySupplyBox = (): SupplyBoxState => ({
  version: 1,
  items: [],
  granted: [],
});

const validReward = (r: SupplyBoxReward) =>
  !!r &&
  ((r.kind === "coins" &&
    Number.isSafeInteger(r.amount) &&
    r.amount > 0 &&
    r.amount <= 100000) ||
    (r.kind === "control-voice" && isControlVoice(r.voice)));

export function validateSupplyBox(value: unknown): SupplyBoxState {
  const s = value as SupplyBoxState;
  const fail = () => {
    throw Error("支給ボックスの保存を読めません。上書きを停止しました。");
  };
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.items) ||
    !Array.isArray(s.granted) ||
    s.items.length > SUPPLY_BOX_LIMIT ||
    s.granted.length > 1000 ||
    !s.granted.every((id) => typeof id === "string")
  )
    fail();
  const ids = new Set<string>();
  for (const item of s.items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      !["login", "distribution", "event", "compensation"].includes(
        item.source,
      ) ||
      typeof item.title !== "string" ||
      typeof item.detail !== "string" ||
      !Number.isFinite(item.at) ||
      !validReward(item.reward)
    )
      fail();
    ids.add(item.id);
  }
  if (
    s.login !== undefined &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(s.login?.day) ||
      !Number.isSafeInteger(s.login.count) ||
      s.login.count < 1)
  )
    fail();
  return s;
}

/** 未保存は空の箱。壊れた保存は例外（上書きしない）。 */
export function loadSupplyBox(store = defaultStore()): SupplyBoxState {
  const raw = store?.getItem(SUPPLY_BOX_KEY);
  if (raw === null || raw === undefined) return emptySupplyBox();
  return validateSupplyBox(JSON.parse(raw));
}
export function saveSupplyBox(state: SupplyBoxState, store = defaultStore()) {
  if (!store) throw Error("この端末では支給ボックスを保存できません。");
  validateSupplyBox(state);
  try {
    store.setItem(SUPPLY_BOX_KEY, JSON.stringify(state));
  } catch {
    throw Error("端末へ保存できません。空き容量を確認して再試行してください。");
  }
}

/** 一度きりの配布。済みなら何もしない。 */
export function grantOnce(
  state: SupplyBoxState,
  item: Omit<SupplyBoxItem, "at">,
  now: number,
): SupplyBoxState {
  if (state.granted.includes(item.id) || state.items.length >= SUPPLY_BOX_LIMIT)
    return state;
  const next = structuredClone(state);
  next.items.push({ ...structuredClone(item), at: now });
  next.granted.push(item.id);
  return next;
}

/**
 * 日次ログインボーナス。判定は日本時間の日付（既存の日替わり防衛・週間ミッションと同じ japanDay）。
 * 同じ日には二重に入らない。端末の時計が最終付与日より前に戻っていたら入れない。
 */
export function grantLoginBonus(
  state: SupplyBoxState,
  now: number,
  table: readonly SupplyBoxReward[] = LOGIN_BONUS_TABLE,
): SupplyBoxState {
  let day: string;
  try {
    day = japanDay(now);
  } catch {
    return state;
  }
  if (state.login && state.login.day >= day) return state;
  if (state.items.length >= SUPPLY_BOX_LIMIT || !table.length) return state;
  const count = (state.login?.count ?? 0) + 1,
    cycle = ((count - 1) % table.length) + 1;
  const next = structuredClone(state);
  next.items.push({
    id: `login-${day}`,
    source: "login",
    title: `ログインボーナス ${cycle}日目`,
    detail: `通算${count}日目のログイン報酬`,
    reward: structuredClone(table[cycle - 1]),
    at: now,
  });
  next.login = { day, count };
  return next;
}

export function rewardLabel(reward: SupplyBoxReward) {
  return reward.kind === "coins"
    ? `${reward.amount}コイン`
    : `管制AIボイス解放`;
}

export interface SupplyBoxReceiver {
  /** コインを既存の進行保存へ加える。進行が未開始なら undefined（受け取れない）。 */
  addCoins?: (amount: number) => void;
  unlockVoice?: (voice: ControlVoiceId) => boolean;
  store?: Store;
}
/** 受け取れるか（進行の開始前はコインを受け取れない）。 */
export const receivable = (item: SupplyBoxItem, receiver: SupplyBoxReceiver) =>
  item.reward.kind !== "coins" || !!receiver.addCoins;

/**
 * 指定した中身を受け取る（個別・一括の共通）。受け取りで初めて効果が付く。
 * 順序: 声の解放（何度でも同じ）→ 箱から取り除いて保存 → コインを進行保存へ。
 * コインの保存に失敗したら箱を元に戻して例外にする（二重受け取り・取りこぼしを防ぐ）。
 */
export function receiveSupplyBox(
  ids: readonly string[],
  receiver: SupplyBoxReceiver,
) {
  const store = receiver.store ?? defaultStore();
  const state = loadSupplyBox(store);
  const taken = state.items.filter(
    (item) => ids.includes(item.id) && receivable(item, receiver),
  );
  if (!taken.length) return { state, received: [] as SupplyBoxItem[] };
  const unlock =
    receiver.unlockVoice ??
    ((v: ControlVoiceId) => unlockControlVoice(v, store));
  for (const item of taken)
    if (item.reward.kind === "control-voice" && !unlock(item.reward.voice))
      throw Error("声の解放を保存できません。再試行してください。");
  const coins = taken.reduce(
    (n, item) => n + (item.reward.kind === "coins" ? item.reward.amount : 0),
    0,
  );
  const next: SupplyBoxState = {
    ...state,
    items: state.items.filter((item) => !taken.includes(item)),
  };
  const before = store?.getItem(SUPPLY_BOX_KEY) ?? null;
  saveSupplyBox(next, store);
  if (coins > 0) {
    try {
      receiver.addCoins!(coins);
    } catch (error) {
      try {
        if (before === null)
          store?.setItem(SUPPLY_BOX_KEY, JSON.stringify(state));
        else store?.setItem(SUPPLY_BOX_KEY, before);
      } catch {
        /* 戻せない場合も、コインは付いていないので中身の取りこぼしだけに留まる。 */
      }
      throw error;
    }
  }
  return { state: next, received: taken };
}

/**
 * ホームを開いたときの配布（初起動のヒヨリ解放・その日のログインボーナス）。
 * 壊れた保存は上書きせず、例外のまま呼び出し側へ返す。
 */
export function refreshSupplyBox(now = Date.now(), store = defaultStore()) {
  const state = loadSupplyBox(store);
  const next = grantLoginBonus(grantOnce(state, HIYORI_RELEASE, now), now);
  if (next !== state) saveSupplyBox(next, store);
  return next;
}
