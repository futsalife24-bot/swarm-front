import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sound } from "../src/client/audio";
import type { ControlVoicePacks } from "../src/client/control-voice-packs";

vi.mock("../src/client/bgm", () => ({
  backgroundMusic: () => ({ volume: 1, unlock() {} }),
}));

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

class FakeDocument extends EventTarget {
  hidden = false;
}

class FakeContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {};
  onstatechange: (() => void) | null = null;
  createGain = node;
  createDynamicsCompressor = node;
  createMediaElementSource = node;
  decodeAudioData = vi.fn(async () => ({ duration: 3 }));
  resume = vi.fn(async () => {
    this.state = "running";
    this.onstatechange?.();
  });
  constructor() {
    contexts.push(this);
  }
}

class FakeAudio {
  playbackRate = 1;
  preservesPitch = false;
  paused = true;
  ended = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {
    if (nextPlayError) {
      const error = nextPlayError;
      nextPlayError = undefined;
      throw error;
    }
    if (rejectNextPlay) {
      rejectNextPlay = false;
      throw new DOMException("gesture required", "NotAllowedError");
    }
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor() {
    sources.push(this);
  }
}

let doc: FakeDocument;
let win: EventTarget;
let contexts: FakeContext[];
let sources: FakeAudio[];
let rejectNextPlay: boolean;
let nextPlayError: DOMException | undefined;
let revoke: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  doc = new FakeDocument();
  win = new EventTarget();
  contexts = [];
  sources = [];
  rejectNextPlay = false;
  nextPlayError = undefined;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(Sound.prototype, "preload").mockImplementation(
    () => new Promise<void>(() => {}),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:voice-test");
  revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
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

async function playing(id = "home") {
  const s = sound();
  s.unlock();
  await s.prepareControlVoice(["home", "loading", "retire-ack"]);
  expect(s.controlVoice.request(id)).toBe("playing");
  return s;
}

const restoreEvents = [
  ["visibilitychange", "document"],
  ["pageshow", "window"],
  ["focus", "window"],
] as const;
const gestureEvents = ["pointerdown", "touchend", "click", "keydown"] as const;

describe("別アプリから戻ったときの管制AI音声", () => {
  it("終了通知待ちの台詞を最初の操作で先頭から再生しない", async () => {
    const s = await playing();
    sources[0].paused = sources[0].ended = true;
    doc.dispatchEvent(new Event("pointerdown"));
    expect(sources[0].play).toHaveBeenCalledTimes(1);
    sources[0].onended?.();
    expect(s.controlVoice.current).toBeUndefined();
  });
  it.each(restoreEvents)(
    "%sで既存AudioContextを再開する",
    async (event, target) => {
      const s = sound();
      s.unlock();
      const context = contexts[0];
      context.state = "suspended";
      context.onstatechange?.();
      (target === "document" ? doc : win).dispatchEvent(new Event(event));
      await vi.waitFor(() => expect(context.resume).toHaveBeenCalledTimes(1));
      expect(context.state).toBe("running");
    },
  );

  it.each(gestureEvents)("%sで既存AudioContextを再開する", async (event) => {
    const s = sound();
    s.unlock();
    const context = contexts[0];
    context.state = "interrupted";
    context.onstatechange?.();
    doc.dispatchEvent(new Event(event));
    await vi.waitFor(() => expect(context.resume).toHaveBeenCalledTimes(1));
    expect(context.state).toBe("running");
  });

  it("初回操作前や非表示中は復旧イベントだけでcontextを作らない", async () => {
    sound();
    win.dispatchEvent(new Event("focus"));
    doc.dispatchEvent(new Event("pointerdown"));
    expect(contexts).toHaveLength(0);
    const s = sound();
    s.unlock();
    const context = contexts[0];
    doc.hidden = true;
    context.state = "suspended";
    context.onstatechange?.();
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("pageshow"));
    doc.dispatchEvent(new Event("click"));
    await Promise.resolve();
    expect(context.resume).not.toHaveBeenCalled();
  });

  it("NotAllowedErrorの現リクエストを次の操作で一度だけ再生する", async () => {
    rejectNextPlay = true;
    const s = await playing();
    await Promise.resolve();
    expect(sources).toHaveLength(1);
    expect(sources[0].play).toHaveBeenCalledTimes(1);
    expect(sources[0].paused).toBe(true);
    doc.dispatchEvent(new Event("pointerdown"));
    await vi.waitFor(() => expect(sources[0].play).toHaveBeenCalledTimes(2));
    expect(sources[0].paused).toBe(false);
    expect(s.controlVoice.current).toBe("home");
    expect(revoke).not.toHaveBeenCalled();
    doc.dispatchEvent(new Event("click"));
    await Promise.resolve();
    expect(sources[0].play).toHaveBeenCalledTimes(2);
  });

  it("保留中の新要求を優先し、旧要素を一度だけ解放する", async () => {
    rejectNextPlay = true;
    const s = await playing();
    await Promise.resolve();
    expect(s.controlVoice.request("loading")).toBe("playing");
    expect(sources).toHaveLength(2);
    expect(sources[0].pause).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event("keydown"));
    await Promise.resolve();
    expect(sources[0].play).toHaveBeenCalledTimes(1);
    expect(sources[1].play).toHaveBeenCalledTimes(1);
    expect(s.controlVoice.current).toBe("loading");
    sources[0].onended?.();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("OSに要素だけpauseされた場合はfocusで現要素を再生する", async () => {
    const s = await playing();
    sources[0].paused = true;
    win.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(sources[0].play).toHaveBeenCalledTimes(2));
    expect(sources[0].paused).toBe(false);
    expect(s.controlVoice.current).toBe("home");
    expect(revoke).not.toHaveBeenCalled();
  });

  it.each(["new request", "hidden", "mute"] as const)(
    "非同期resume待ちに%sが入ると旧音声を復活させない",
    async (change) => {
      const s = await playing();
      const old = sources[0];
      old.paused = true;
      const context = contexts[0];
      context.state = "suspended";
      let resolveResume!: () => void;
      context.resume = vi.fn(
        () => new Promise<void>((resolve) => (resolveResume = resolve)),
      );
      doc.dispatchEvent(new Event("pointerdown"));
      expect(context.resume).toHaveBeenCalledTimes(1);
      if (change === "new request") {
        // 別の経路でcontextが稼働に戻り、古いresume Promiseだけが未完了。
        context.state = "running";
        expect(s.controlVoice.request("loading")).toBe("playing");
      } else if (change === "hidden") {
        doc.hidden = true;
        doc.dispatchEvent(new Event("visibilitychange"));
      } else s.controlVoiceVolume = 0;
      resolveResume();
      await Promise.resolve();
      await Promise.resolve();
      expect(old.play, change).toHaveBeenCalledTimes(1);
      expect(old.pause, change).toHaveBeenCalledTimes(1);
      expect(revoke, change).toHaveBeenCalledTimes(1);
      expect(s.controlVoice.current).toBe(
        change === "new request" ? "loading" : undefined,
      );
    },
  );

  it("NotAllowedError以外の再生失敗は現音声とBlob URLを解放する", async () => {
    nextPlayError = new DOMException("unsupported format", "NotSupportedError");
    const s = await playing();
    await vi.waitFor(() => expect(s.controlVoice.current).toBeUndefined());
    expect(sources[0].pause).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(sources[0].play).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("非表示・ボイスなし・無音化は保留音声を復活させない", async () => {
    for (const cancel of ["hidden", "disabled", "mute"] as const) {
      rejectNextPlay = true;
      const s = await playing();
      await Promise.resolve();
      const audio = sources.at(-1)!;
      if (cancel === "hidden") {
        doc.hidden = true;
        doc.dispatchEvent(new Event("visibilitychange"));
      } else if (cancel === "disabled") s.setControlVoiceEnabled(false);
      else s.controlVoiceVolume = 0;
      doc.hidden = false;
      doc.dispatchEvent(new Event("pointerdown"));
      await Promise.resolve();
      expect(audio.play, cancel).toHaveBeenCalledTimes(1);
      expect(s.controlVoice.current, cancel).toBeUndefined();
    }
  });

  it("未ダウンロードの声は復帰操作でも取得・再生しない", async () => {
    const clip = vi.fn(async () => undefined);
    const s = sound(clip);
    s.unlock();
    expect(s.controlVoice.request("home")).toBe("queued");
    await vi.waitFor(() => expect(s.controlVoice.waiting).toBeUndefined());
    doc.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(sources).toHaveLength(0);
    expect(s.controlVoice.current).toBeUndefined();
    expect(clip).toHaveBeenCalledTimes(1);
  });
});
