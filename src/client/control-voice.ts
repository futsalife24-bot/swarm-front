/**
 * 管制AI音声の再生基盤（W0）。
 * 再生の決まりは docs/tutorial-proposal-20261113.md §8-1:
 * - 発話は同時に1本。
 * - 基礎訓練の説明（tutorial）は、再生中なら最新の1本だけ待たせる。
 * - 警告系（warning）は tutorial / ack / guide に割り込める。逆はしない。
 * - 初回ガイド（guide）は、再生中なら鳴り終わりを最大5秒待ち、だめなら声を諦める。
 * 実ファイルが無い・読み込み前・SE音量0のときは "unavailable" を返すだけで例外にしない
 * （画面テキストだけで進められるようにするため、音声の終了を進行条件にしない）。
 */
import {
  controlVoiceLine,
  type ControlVoiceLine,
  type ControlVoicePriority,
  type ControlVoiceSet,
} from "./control-voice-lines";

export const CONTROL_VOICES = ["hiromi", "hiyori", "yoko"] as const;
export type ControlVoiceId = (typeof CONTROL_VOICES)[number];
/** 既定の管制AIはヒロミ（本人決定）。 */
export const DEFAULT_CONTROL_VOICE: ControlVoiceId = "hiromi";
export const CONTROL_VOICE_STORAGE_KEY = "swarm-front-control-voice-v1";
/** フォルダの版。録り直したら上書きせず版を上げる（Service Worker のキャッシュ対策）。 */
export const CONTROL_VOICE_SET_VERSION: Record<ControlVoiceSet, number> = {
  tutorial: 1,
  control: 1,
};
/**
 * セットごとに収録済みの声（データで切り替える）。
 * 暫定仕様（2026-11-14 本人確定）: チュートリアルはヒロミだけ収録済みのため、
 * 選択中の声が無いセットでは CONTROL_VOICE_FALLBACK の声で再生する。
 * 3声分が届いたら tutorial の一覧に声を足すだけで、選んだ声で鳴るようになる。
 */
export const CONTROL_VOICE_SET_VOICES: Record<
  ControlVoiceSet,
  readonly ControlVoiceId[]
> = {
  tutorial: ["hiromi"],
  control: ["hiromi", "hiyori", "yoko"],
};
/** 選択中の声が収録されていないセットで使う声。null なら代替せず字幕だけにする。 */
export const CONTROL_VOICE_FALLBACK: ControlVoiceId | null = "hiromi";
/** 初回ガイドが前の台詞の鳴り終わりを待つ上限。 */
export const GUIDE_WAIT_MS = 5000;

/** そのセットで実際に鳴らす声。収録が無く代替も無ければ undefined。 */
export function voiceForSet(
  set: ControlVoiceSet,
  voice: ControlVoiceId,
  available: Record<
    ControlVoiceSet,
    readonly ControlVoiceId[]
  > = CONTROL_VOICE_SET_VOICES,
  fallback: ControlVoiceId | null = CONTROL_VOICE_FALLBACK,
): ControlVoiceId | undefined {
  if (available[set].includes(voice)) return voice;
  return fallback && available[set].includes(fallback) ? fallback : undefined;
}

/** 規約パス `assets/audio/voice-<set>-<voice>-v<N>/<clip>.wav`（BASE_URL を除く）。 */
export function controlVoicePath(
  line: Pick<ControlVoiceLine, "id" | "set">,
  voice: ControlVoiceId,
) {
  const actual = voiceForSet(line.set, voice) ?? voice;
  return `assets/audio/voice-${line.set}-${actual}-v${CONTROL_VOICE_SET_VERSION[line.set]}/${line.id}.wav`;
}

export const isControlVoice = (v: unknown): v is ControlVoiceId =>
  CONTROL_VOICES.includes(v as ControlVoiceId);

type Store = Pick<Storage, "getItem" | "setItem">;
const defaultStore = (): Store | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

/** 端末ごとの選択。未保存・不正値・保存先なしは既定（ヒロミ）。 */
export function loadControlVoice(store = defaultStore()): ControlVoiceId {
  try {
    const v = store?.getItem(CONTROL_VOICE_STORAGE_KEY);
    return isControlVoice(v) ? v : DEFAULT_CONTROL_VOICE;
  } catch {
    return DEFAULT_CONTROL_VOICE;
  }
}

export function saveControlVoice(
  voice: ControlVoiceId,
  store = defaultStore(),
) {
  if (!isControlVoice(voice)) return false;
  try {
    store?.setItem(CONTROL_VOICE_STORAGE_KEY, voice);
    return !!store;
  } catch {
    return false;
  }
}

/** solo / multi / 共通 のタグで再生候補を絞る。協力の経路で入ったら multi。 */
export type ControlVoiceMode = "solo" | "multi";
export const lineMatchesMode = (
  line: Pick<ControlVoiceLine, "tag">,
  mode: ControlVoiceMode,
) => line.tag === "common" || line.tag === mode;

export type ControlVoiceResult =
  | "playing"
  | "queued"
  | "dropped"
  | "duplicate"
  | "filtered"
  | "disabled"
  | "unadopted"
  | "unknown"
  | "unavailable";

/** 実際の発音を担う口。Web Audio 側（audio.ts）とテストで差し替える。 */
export interface ControlVoiceBackend {
  /** 再生できる状態か（バッファ読み込み済み・音量0でない・コンテキスト稼働中）。 */
  ready(path: string): boolean;
  /** 再生を始め、止める関数を返す。終わったら onEnded を1回呼ぶ。 */
  start(path: string, onEnded: () => void): () => void;
}

const INTERRUPTIBLE: ReadonlySet<ControlVoicePriority> = new Set([
  "tutorial",
  "ack",
  "guide",
]);

interface Pending {
  line: ControlVoiceLine;
  /** この時刻を過ぎたら諦める（tutorial は無期限）。 */
  until: number;
}

export class ControlVoiceQueue {
  voice: ControlVoiceId;
  mode: ControlVoiceMode = "solo";
  private playing?: { line: ControlVoiceLine; stop: () => void };
  private pending?: Pending;
  private readonly now: () => number;
  private readonly lookup: (id: string) => ControlVoiceLine | undefined;
  constructor(
    private readonly backend: ControlVoiceBackend,
    options: {
      voice?: ControlVoiceId;
      now?: () => number;
      /** 台詞定義の参照先（既定は定義表）。 */
      lines?: (id: string) => ControlVoiceLine | undefined;
    } = {},
  ) {
    this.voice = options.voice ?? DEFAULT_CONTROL_VOICE;
    this.now = options.now ?? (() => performance.now());
    this.lookup = options.lines ?? controlVoiceLine;
  }
  get current() {
    return this.playing?.line.id;
  }
  get waiting() {
    return this.pending?.line.id;
  }
  path(line: ControlVoiceLine) {
    return controlVoicePath(line, this.voice);
  }
  /** 台詞IDで再生を要求する。結果は字幕だけにするかの判断に使える。 */
  request(id: string): ControlVoiceResult {
    const line = this.lookup(id);
    if (!line) return "unknown";
    if (line.blocked) return "disabled";
    if (!line.adopted) return "unadopted";
    if (!lineMatchesMode(line, this.mode)) return "filtered";
    if (this.playing?.line.id === id || this.pending?.line.id === id)
      return "duplicate";
    if (!this.backend.ready(this.path(line))) return "unavailable";
    this.expire();
    const current = this.playing?.line;
    if (!current) return this.begin(line);
    if (line.priority === "warning" && INTERRUPTIBLE.has(current.priority)) {
      this.halt();
      return this.begin(line);
    }
    if (line.priority === "tutorial") {
      this.pending = { line, until: Infinity };
      return "queued";
    }
    if (line.priority === "guide") {
      this.pending = { line, until: this.now() + GUIDE_WAIT_MS };
      return "queued";
    }
    return "dropped";
  }
  /** 待ち時間切れの初回ガイドを捨てる。毎フレーム呼んでもよい。 */
  tick() {
    this.expire();
    if (!this.playing) this.next();
  }
  /** 一時停止・画面を隠す・SE音量0などで、再生中と待ちをすべて止める。 */
  stop() {
    this.pending = undefined;
    this.halt();
  }
  private expire() {
    if (this.pending && this.now() > this.pending.until)
      this.pending = undefined;
  }
  private halt() {
    const playing = this.playing;
    this.playing = undefined;
    playing?.stop();
  }
  private begin(line: ControlVoiceLine): ControlVoiceResult {
    let stop = () => {};
    const entry = { line, stop: () => stop() };
    this.playing = entry;
    try {
      stop = this.backend.start(this.path(line), () => {
        if (this.playing !== entry) return;
        this.playing = undefined;
        this.next();
      });
    } catch {
      if (this.playing === entry) this.playing = undefined;
      return "unavailable";
    }
    return this.playing === entry ? "playing" : "dropped";
  }
  private next() {
    this.expire();
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) return;
    if (!lineMatchesMode(pending.line, this.mode)) return;
    if (!this.backend.ready(this.path(pending.line))) return;
    this.begin(pending.line);
  }
}
