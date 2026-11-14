/**
 * 管制AIボイスの任意ダウンロード（2026-11-14 本人指示）。
 * - 声ごとに1つの圧縮パック（scripts/build-voice-packs.mjs が作る SFVP 形式・MP3）。
 * - 設定から利用者が選んだときだけ取得し、端末の Cache Storage に保存する（再起動後も使える）。
 * - 起動時・戦闘前に勝手に取得しない。未ダウンロードの声は無音（字幕だけ）で進む。
 * - 保存データ（進行・設定）には触れない。
 */
import {
  CONTROL_VOICE_PACK_FORMAT,
  CONTROL_VOICE_PACKS,
  type ControlVoicePackEntry,
} from "./control-voice-pack-catalog";

export type ControlVoicePackVoice = ControlVoicePackEntry["voice"];
export const VOICE_PACK_CACHE = "swarm-front-voice-packs-v1";
export const VOICE_PACK_HASH = "x-swarm-voice-pack-sha256";
/** 保存済みの状態。outdated は旧版を保存中（再ダウンロードで更新）。 */
export type ControlVoicePackState =
  "missing" | "downloading" | "ready" | "outdated";

export interface VoicePackCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
}
export interface VoicePackIO {
  /** 保存先。Cache Storage が無い環境では undefined（ダウンロード不可・無音）。 */
  open(): Promise<VoicePackCache | undefined>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  sha256(bytes: ArrayBuffer): Promise<string>;
  /** カタログの相対URLを絶対URLにする（保存キーにも使う）。 */
  resolve(url: string): string;
}

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export function browserVoicePackIO(): VoicePackIO {
  return {
    async open() {
      try {
        return globalThis.caches
          ? await globalThis.caches.open(VOICE_PACK_CACHE)
          : undefined;
      } catch {
        return undefined;
      }
    },
    fetch: (url, init) => globalThis.fetch(url, init),
    sha256: async (bytes) =>
      hex(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    resolve: (url) =>
      new URL(`${import.meta.env.BASE_URL}${url}`, globalThis.location.href)
        .href,
  };
}

interface ParsedPack {
  sha256: string;
  data: ArrayBuffer;
  clips: Map<string, { offset: number; length: number }>;
}

/** SFVP v1 を検証して目次を返す。不正なら例外。 */
export function parseVoicePack(
  bytes: ArrayBuffer,
  voice: ControlVoicePackVoice,
): Map<string, { offset: number; length: number }> {
  const view = new DataView(bytes);
  if (
    bytes.byteLength < 12 ||
    String.fromCharCode(...new Uint8Array(bytes, 0, 4)) !== "SFVP" ||
    view.getUint8(4) !== CONTROL_VOICE_PACK_FORMAT
  )
    throw Error("音声パックの形式が不正です");
  const indexLength = view.getUint32(8, true);
  if (indexLength > bytes.byteLength - 12)
    throw Error("音声パックの目次が壊れています");
  const index = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes, 12, indexLength)),
  ) as {
    format: number;
    voice: string;
    clips: { key: string; offset: number; length: number }[];
  };
  const start = 12 + indexLength,
    size = bytes.byteLength - start;
  if (
    index.format !== CONTROL_VOICE_PACK_FORMAT ||
    index.voice !== voice ||
    !Array.isArray(index.clips)
  )
    throw Error("音声パックの声が一致しません");
  const clips = new Map<string, { offset: number; length: number }>();
  for (const clip of index.clips) {
    if (
      typeof clip.key !== "string" ||
      !Number.isSafeInteger(clip.offset) ||
      !Number.isSafeInteger(clip.length) ||
      clip.offset < 0 ||
      clip.length <= 0 ||
      clip.offset + clip.length > size
    )
      throw Error("音声パックの目次が壊れています");
    clips.set(clip.key, { offset: start + clip.offset, length: clip.length });
  }
  return clips;
}

/** 台詞キー `voice-<set>-<voice>-v<N>/<id>` から、収録しているパックの声を引く。 */
export function packVoiceOfKey(key: string) {
  return /^voice-[a-z]+-(hiromi|hiyori|yoko)-v\d+\//.exec(key)?.[1] as
    ControlVoicePackVoice | undefined;
}

export class ControlVoicePacks {
  private loaded = new Map<
    ControlVoicePackVoice,
    Promise<ParsedPack | undefined>
  >();
  private active = new Map<ControlVoicePackVoice, Promise<void>>();
  private listeners = new Set<(voice: ControlVoicePackVoice) => void>();
  constructor(
    private readonly io: VoicePackIO = browserVoicePackIO(),
    readonly catalog: readonly ControlVoicePackEntry[] = CONTROL_VOICE_PACKS,
  ) {}
  entry(voice: ControlVoicePackVoice) {
    return this.catalog.find((p) => p.voice === voice);
  }
  /** 保存・削除のたびに呼ばれる（再生側のバッファを捨てるため）。 */
  subscribe(listener: (voice: ControlVoicePackVoice) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
  private emit(voice: ControlVoicePackVoice) {
    for (const listener of this.listeners) listener(voice);
  }
  async state(voice: ControlVoicePackVoice): Promise<ControlVoicePackState> {
    if (this.active.has(voice)) return "downloading";
    const entry = this.entry(voice);
    if (!entry) return "missing";
    try {
      const cache = await this.io.open();
      const stored = await cache?.match(this.io.resolve(entry.url));
      if (!stored) return "missing";
      return stored.headers.get(VOICE_PACK_HASH) === entry.sha256
        ? "ready"
        : "outdated";
    } catch {
      return "missing";
    }
  }
  /**
   * パックを取得・検証して保存する。進み具合は onProgress（受信バイト, 総バイト）。
   * 通信・容量・検証の失敗は例外（利用者向けの文言）で返す。保存済みの旧版は成功時だけ置き換える。
   */
  download(
    voice: ControlVoicePackVoice,
    onProgress: (received: number, total: number) => void = () => {},
    signal?: AbortSignal,
  ) {
    const running = this.active.get(voice);
    if (running) return running;
    const job = (async () => {
      const entry = this.entry(voice);
      if (!entry) throw Error("この声のパックはありません");
      const cache = await this.io.open();
      if (!cache) throw Error("この端末ではダウンロードを保存できません");
      // Service Worker の自動保存を通さず、毎回サーバーの現行バイトを取る。
      const response = await this.io.fetch(this.io.resolve(entry.url), {
        cache: "reload",
        signal,
      });
      if (!response.ok) throw Error("音声パックを取得できませんでした");
      const bytes = await readAll(response, entry.bytes, onProgress);
      if (
        bytes.byteLength !== entry.bytes ||
        (await this.io.sha256(bytes)) !== entry.sha256
      )
        throw Error("音声パックの内容を確認できません。再試行してください");
      const clips = parseVoicePack(bytes, voice);
      await cache.put(
        this.io.resolve(entry.url),
        new Response(bytes, {
          headers: {
            "content-type": "application/octet-stream",
            [VOICE_PACK_HASH]: entry.sha256,
          },
        }),
      );
      this.loaded.set(
        voice,
        Promise.resolve({ sha256: entry.sha256, data: bytes, clips }),
      );
      void requestPersistentStorage();
    })().finally(() => {
      this.active.delete(voice);
      this.emit(voice);
    });
    this.active.set(voice, job);
    this.emit(voice);
    return job;
  }
  async remove(voice: ControlVoicePackVoice) {
    const entry = this.entry(voice);
    this.loaded.delete(voice);
    try {
      const cache = await this.io.open();
      if (entry) await cache?.delete(this.io.resolve(entry.url));
    } finally {
      this.emit(voice);
    }
  }
  /** 保存済みパックから1本の圧縮音声を返す。無ければ undefined（無音で進める）。 */
  async clip(key: string): Promise<ArrayBuffer | undefined> {
    const voice = packVoiceOfKey(key);
    if (!voice) return undefined;
    let pack = this.loaded.get(voice);
    if (!pack) {
      pack = this.read(voice);
      this.loaded.set(voice, pack);
    }
    const parsed = await pack;
    if (!parsed) {
      // 失敗は覚えない（あとでダウンロードしたら読めるようにする）。
      if (this.loaded.get(voice) === pack) this.loaded.delete(voice);
      return undefined;
    }
    const clip = parsed.clips.get(key);
    return clip
      ? parsed.data.slice(clip.offset, clip.offset + clip.length)
      : undefined;
  }
  private async read(voice: ControlVoicePackVoice) {
    const entry = this.entry(voice);
    if (!entry) return undefined;
    try {
      const cache = await this.io.open();
      const stored = await cache?.match(this.io.resolve(entry.url));
      // 旧版は鳴らさない（台詞の差し替えと字幕がずれないように）。
      if (!stored || stored.headers.get(VOICE_PACK_HASH) !== entry.sha256)
        return undefined;
      const data = await stored.arrayBuffer();
      return { sha256: entry.sha256, data, clips: parseVoicePack(data, voice) };
    } catch {
      return undefined;
    }
  }
}

async function readAll(
  response: Response,
  expected: number,
  onProgress: (received: number, total: number) => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    onProgress(bytes.byteLength, expected);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (received > expected) throw Error("音声パックの容量が一致しません");
    onProgress(received, expected);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

async function requestPersistentStorage() {
  try {
    await globalThis.navigator?.storage?.persist?.();
  } catch {
    /* 永続化の許可は任意。拒否されても保存自体は続ける。 */
  }
}

/** 画面全体で1つ（設定画面の保存と、再生側の読み込みで同じ状態を共有する）。 */
export const controlVoicePacks = new ControlVoicePacks();
