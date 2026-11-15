import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sound } from "../src/client/audio";
import {
  loadControlVoiceRate,
  CONTROL_VOICE_RATE_KEY,
} from "../src/client/control-voice-rate";
import type { ControlVoicePacks } from "../src/client/control-voice-packs";
vi.mock("../src/client/bgm", () => ({
  backgroundMusic: () => ({ volume: 1, unlock() {} }),
}));
let sources: {
  playbackRate: number;
  preservesPitch: boolean;
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  onended?: () => void;
}[];
const node = () => ({
  connect: (n: unknown) => n,
  disconnect() {},
  gain: { value: 1, setTargetAtTime() {} },
  threshold: {},
  knee: {},
  ratio: {},
  attack: {},
  release: {},
});
beforeEach(() => {
  sources = [];
  vi.stubGlobal("document", { hidden: false, addEventListener() {} });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.spyOn(Sound.prototype, "preload").mockImplementation(
    () => new Promise<void>(() => {}),
  );
  vi.stubGlobal(
    "Audio",
    class {
      playbackRate = 1;
      preservesPitch = false;
      start = vi.fn();
      play = vi.fn(async () => {
        this.start();
      });
      pause = vi.fn();
      removeAttribute() {}
      load() {}
      onended?: () => void;
      constructor() {
        sources.push(this);
      }
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 0;
      destination = {};
      createGain = node;
      createDynamicsCompressor = node;
      resume = async () => {};
      decodeAudioData = vi.fn(async () => ({ duration: 3 }));
      createMediaElementSource = node;
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function sound(clip = async () => new ArrayBuffer(4)) {
  return new Sound({
    subscribe: () => () => {},
    clip,
    state: async () => "ready",
  } as unknown as ControlVoicePacks);
}
describe("管制AIの準備と再生", () => {
  it("割込みと終了で音声を止め、Blob URLを1回だけ解放する", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const s = sound();
    s.unlock();
    await s.prepareControlVoice(["home", "retire-ack"]);
    s.controlVoice.request("home");
    const old = sources[0];
    s.controlVoice.request("retire-ack");
    expect(old.pause).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(s.controlVoice.current).toBe("retire-ack");
    sources[1].onended?.();
    s.controlVoice.stop();
    expect(s.controlVoice.current).toBeUndefined();
    expect(revoke).toHaveBeenCalledTimes(2);
  });
  it("SEが永久に未完了でも管制AIは開始し、準備の重複をまとめる", async () => {
    const clip = vi.fn(async () => new ArrayBuffer(4));
    const s = sound(clip);
    s.unlock();
    await Promise.all([
      s.prepareControlVoice(["home"]),
      s.prepareControlVoice(["home"]),
    ]);
    expect(clip).toHaveBeenCalledTimes(1);
    expect(s.controlVoice.request("home")).toBe("playing");
    expect(sources[0].start).toHaveBeenCalledTimes(1);
  });
  it("準備待ち中のsayをannounceが追い越しても古い声は後から鳴らない", async () => {
    let done!: (v: ArrayBuffer) => void;
    const s = sound(() => new Promise((r) => (done = r)));
    s.unlock();
    await s.prepareControlVoice([]);
    s.say("home");
    await Promise.resolve();
    // 別台詞だけ先に用意して直接イベントから要求。
    const slow = done;
    const ready = s.prepareControlVoice(["loading"]);
    await Promise.resolve();
    done(new ArrayBuffer(4));
    await ready;
    s.announce("loading");
    slow(new ArrayBuffer(4));
    await vi.waitFor(() => expect(s.controlVoice.waiting).toBeUndefined());
    expect(s.controlVoice.current).toBe("loading");
    expect(sources).toHaveLength(1);
  });
  it("速度を復元し通常発話と試聴に適用、SE倍率は維持する", async () => {
    const stored = new Map([[CONTROL_VOICE_RATE_KEY, "1.3"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => stored.set(k, v),
    });
    const s = sound();
    s.unlock();
    await s.prepareControlVoice(["home"]);
    s.controlVoice.request("home");
    expect(sources[0].playbackRate).toBe(1.3);
    expect(sources[0].preservesPitch).toBe(true);
    s.setControlVoiceRate(1);
    expect(sources[0].playbackRate).toBe(1);
    await s.previewControlVoice("hiromi");
    expect(sources.at(-1)?.playbackRate).toBe(1);
    s.setControlVoiceRate(1.3);
    expect(sources.at(-1)?.playbackRate).toBe(1.3);
    expect(
      new Sound({ subscribe: () => () => {} } as unknown as ControlVoicePacks)
        .controlVoiceRate,
    ).toBe(1.3);
    expect(s.effectsVolume).toBe(0.35);
  });
  it("不正な速度・保存拒否は通常速度で安全に開始する", () => {
    for (const raw of [null, "0", "2", "false", "{", '"1.3"']) {
      vi.stubGlobal("localStorage", { getItem: () => raw });
      expect(loadControlVoiceRate()).toBe(1);
    }
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    });
    expect(loadControlVoiceRate()).toBe(1);
    const s = sound();
    s.setControlVoiceRate(1.3);
    expect(s.controlVoiceRate).toBe(1.3);
  });
});
