import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONTROL_VOICE_LINES,
  playableLine,
} from "../src/client/control-voice-lines";
import {
  CONTROL_VOICE_SET_VOICES,
  controlVoicePath,
} from "../src/client/control-voice";
import { CONTROL_VOICE_PACKS } from "../src/client/control-voice-pack-catalog";
import {
  ControlVoicePacks,
  VOICE_PACK_HASH,
  packVoiceOfKey,
  parseVoicePack,
  type VoicePackCache,
  type VoicePackIO,
} from "../src/client/control-voice-packs";

const packFile = (url: string) => path.resolve("public", url);
const packBytes = (url: string) => {
  const b = fs.readFileSync(packFile(url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/** Cache Storage と通信の代わり。保存はバイト列とヘッダーで持つ。 */
function fakeIO(options: { broken?: boolean; noCache?: boolean } = {}) {
  const stored = new Map<string, { bytes: ArrayBuffer; headers: Headers }>();
  const fetched: string[] = [];
  const cache: VoicePackCache = {
    async match(key) {
      const s = stored.get(key);
      return s
        ? new Response(s.bytes.slice(0), { headers: s.headers })
        : undefined;
    },
    async put(key, response) {
      stored.set(key, {
        bytes: await response.arrayBuffer(),
        headers: response.headers,
      });
    },
    async delete(key) {
      return stored.delete(key);
    },
  };
  const io: VoicePackIO = {
    open: async () => (options.noCache ? undefined : cache),
    async fetch(url, init) {
      fetched.push(url);
      expect(init?.cache).toBe("reload");
      const relative = url.replace("https://game.test/", "");
      const bytes = packBytes(relative);
      if (options.broken) new Uint8Array(bytes)[200] ^= 0xff;
      return new Response(bytes);
    },
    sha256: async (bytes) =>
      createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
    resolve: (url) => `https://game.test/${url}`,
  };
  return { io, stored, fetched };
}

describe("voice packs shipped for optional download", () => {
  it("lists one compressed pack per voice and matches the files", () => {
    expect(CONTROL_VOICE_PACKS.map((p) => p.voice)).toEqual([
      "hiromi",
      "hiyori",
      "yoko",
    ]);
    for (const pack of CONTROL_VOICE_PACKS) {
      const bytes = fs.readFileSync(packFile(pack.url));
      expect(bytes.length).toBe(pack.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        pack.sha256,
      );
      // Workers の静的配信の1ファイル上限（25MiB）より十分小さい。
      expect(pack.bytes).toBeLessThan(10 * 1024 * 1024);
    }
    // ヒロミのパックにはチュートリアル34本を含める。
    expect(CONTROL_VOICE_PACKS[0].sets["voice-tutorial-hiromi-v1"]).toBe(34);
  });
  it("contains every playable line and none of the blocked ones", () => {
    const indexes = new Map(
      CONTROL_VOICE_PACKS.map((p) => [
        p.voice,
        parseVoicePack(packBytes(p.url), p.voice),
      ]),
    );
    for (const line of CONTROL_VOICE_LINES)
      for (const voice of CONTROL_VOICE_SET_VOICES[line.set]) {
        const key = controlVoicePath(line, voice);
        const has = indexes.get(voice)!.has(key);
        if (line.blocked === "abolished" || line.blocked === "on-hold")
          expect(has, key).toBe(false);
        else expect(has, key).toBe(true);
      }
    // 再生候補の台詞はMP3（フレーム同期で始まる）として収録されている。
    const hiromi = packBytes(CONTROL_VOICE_PACKS[0].url);
    const clip = indexes
      .get("hiromi")!
      .get("voice-tutorial-hiromi-v1/tut-intro")!;
    const head = new Uint8Array(hiromi, clip.offset, 2);
    expect(head[0]).toBe(0xff);
    expect(head[1] & 0xe0).toBe(0xe0);
    expect(
      CONTROL_VOICE_LINES.filter((l) => playableLine(l)).length,
    ).toBeGreaterThan(0);
  });
  it("does not ship the WAV voice sets in the public build", () => {
    const audio = path.resolve("public/assets/audio");
    const folders = fs.readdirSync(audio);
    expect(folders.filter((f) => /^voice-(control|tutorial)-/.test(f))).toEqual(
      [],
    );
    const packs = fs.readdirSync(path.resolve("public/assets/voice-packs"));
    expect(packs.every((f) => f.endsWith(".bin"))).toBe(true);
  });
  it("maps clip keys to the pack that holds them", () => {
    expect(packVoiceOfKey("voice-tutorial-hiromi-v1/tut-intro")).toBe("hiromi");
    expect(packVoiceOfKey("voice-control-yoko-v1/home")).toBe("yoko");
    expect(packVoiceOfKey("assets/audio/x.wav")).toBeUndefined();
  });
});

describe("ControlVoicePacks", () => {
  it("is silent until downloaded, then serves clips, and forgets them after removal", async () => {
    const { io, stored, fetched } = fakeIO();
    const packs = new ControlVoicePacks(io);
    const events: string[] = [];
    packs.subscribe((v) => events.push(v));
    expect(await packs.state("hiromi")).toBe("missing");
    expect(await packs.clip("voice-control-hiromi-v1/home")).toBeUndefined();
    expect(fetched).toEqual([]); // 未ダウンロードでは通信しない
    const progress: number[] = [];
    await packs.download("hiromi", (received) => progress.push(received));
    expect(progress.at(-1)).toBe(CONTROL_VOICE_PACKS[0].bytes);
    expect(await packs.state("hiromi")).toBe("ready");
    const [key] = [...stored.keys()];
    expect(stored.get(key)!.headers.get(VOICE_PACK_HASH)).toBe(
      CONTROL_VOICE_PACKS[0].sha256,
    );
    const clip = await packs.clip("voice-tutorial-hiromi-v1/tut-intro");
    expect(clip?.byteLength).toBeGreaterThan(1000);
    expect(await packs.clip("voice-control-hiyori-v1/home")).toBeUndefined();
    await packs.remove("hiromi");
    expect(await packs.state("hiromi")).toBe("missing");
    expect(
      await packs.clip("voice-tutorial-hiromi-v1/tut-intro"),
    ).toBeUndefined();
    expect(events).toEqual(["hiromi", "hiromi", "hiromi"]);
  });
  it("persists across restarts (a new instance reads the saved pack)", async () => {
    const { io, fetched } = fakeIO();
    await new ControlVoicePacks(io).download("yoko");
    const restarted = new ControlVoicePacks(io);
    expect(await restarted.state("yoko")).toBe("ready");
    expect(
      (await restarted.clip("voice-control-yoko-v1/wave-clear"))?.byteLength,
    ).toBeGreaterThan(100);
    expect(fetched).toHaveLength(1);
  });
  it("rejects a corrupted download and keeps nothing", async () => {
    const { io, stored } = fakeIO({ broken: true });
    const packs = new ControlVoicePacks(io);
    await expect(packs.download("hiyori")).rejects.toThrow(
      "音声パックの内容を確認できません",
    );
    expect(stored.size).toBe(0);
    expect(await packs.state("hiyori")).toBe("missing");
  });
  it("treats an old saved pack as outdated and does not play it", async () => {
    const { io, stored } = fakeIO();
    await new ControlVoicePacks(io).download("hiromi");
    for (const value of stored.values())
      value.headers = new Headers({ [VOICE_PACK_HASH]: "0".repeat(64) });
    const packs = new ControlVoicePacks(io);
    expect(await packs.state("hiromi")).toBe("outdated");
    expect(await packs.clip("voice-control-hiromi-v1/home")).toBeUndefined();
  });
  it("reports when the device cannot store downloads", async () => {
    const packs = new ControlVoicePacks(fakeIO({ noCache: true }).io);
    expect(await packs.state("hiromi")).toBe("missing");
    await expect(packs.download("hiromi")).rejects.toThrow("保存できません");
    expect(await packs.clip("voice-control-hiromi-v1/home")).toBeUndefined();
  });
});

describe("Sound reads control voice from downloaded packs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("../src/client/bgm");
  });
  it("falls back to silence, plays after download, and stops after removal", async () => {
    vi.resetModules();
    vi.doMock("../src/client/bgm", () => ({
      backgroundMusic: () => ({ unlock() {}, volume: 1 }),
    }));
    const network = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", network);
    vi.stubGlobal("document", { hidden: false, addEventListener() {} });
    const node = () => ({
      connect: (next: unknown) => next,
      disconnect() {},
      gain: { value: 1, setTargetAtTime() {} },
      threshold: {},
      knee: {},
      ratio: {},
      attack: {},
      release: {},
    });
    const started: unknown[] = [];
    class FakeContext {
      state = "running";
      currentTime = 0;
      destination = {};
      onstatechange: (() => void) | null = null;
      createGain = node;
      createDynamicsCompressor = node;
      createBufferSource() {
        const source = {
          ...node(),
          buffer: null as unknown,
          onended: null as null | (() => void),
          start() {
            started.push(source.buffer);
          },
          stop() {
            source.onended?.();
          },
        };
        return source;
      }
      resume = async () => {};
      decodeAudioData = async (bytes: ArrayBuffer) => ({
        duration: 1,
        bytes: bytes.byteLength,
      });
    }
    vi.stubGlobal("AudioContext", FakeContext);
    const { Sound } = await import("../src/client/audio");
    const { ControlVoicePacks: Packs } =
      await import("../src/client/control-voice-packs");
    const { io } = fakeIO();
    const packs = new Packs(io);
    const sound = new Sound(packs);
    sound.unlock();
    expect(sound.controlVoice.voice).toBe("hiromi");
    // 未ダウンロード: 無音（字幕だけ）。例外にしない。通信もしない。
    await sound.prepareControlVoice(["tut-intro"]);
    expect(sound.controlVoice.request("tut-intro")).toBe("unavailable");
    expect(
      network.mock.calls.some((c) =>
        /voice-(control|tutorial|packs)/.test(String(c[0])),
      ),
    ).toBe(false);
    // ダウンロード後は保存済みのパックから鳴る。
    await packs.download("hiromi");
    await sound.prepareControlVoice(["tut-intro"]);
    expect(sound.controlVoice.request("tut-intro")).toBe("playing");
    expect(started).toHaveLength(1);
    // 削除で展開済みの声も捨て、再生中を止める。以降は字幕だけ。
    await packs.remove("hiromi");
    expect(sound.controlVoice.current).toBeUndefined();
    await sound.prepareControlVoice(["tut-intro"]);
    expect(sound.controlVoice.request("tut-intro")).toBe("unavailable");
  });
});
