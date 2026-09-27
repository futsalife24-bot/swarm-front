import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sound } from "../src/client/audio";
import { SOLDIER_VOICES } from "../src/client/soldier-voice";
import { createWorld, addPlayer, start, spawn } from "../src/shared/game";
vi.mock("../src/client/bgm", () => ({
  backgroundMusic: () => ({ unlock() {}, volume: 1 }),
}));
const param = () => ({ value: 0, setTargetAtTime() {} });
const node = () => ({
  connect(other: unknown) {
    return other;
  },
  disconnect() {},
});
class Context {
  state = "running";
  currentTime = 10;
  sampleRate = 24000;
  destination = {};
  onstatechange?: () => void;
  sources: {
    buffer?: { voice?: boolean };
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }[] = [];
  createGain() {
    return { ...node(), gain: param() };
  }
  createStereoPanner() {
    return { ...node(), pan: param() };
  }
  createDynamicsCompressor() {
    return {
      ...node(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
    };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = {
      ...node(),
      playbackRate: param(),
      buffer: undefined,
      stop: vi.fn(),
      start: vi.fn(),
    };
    this.sources.push(source);
    return source;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
}
beforeEach(() => {
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.stubGlobal("AudioContext", Context);
  vi.spyOn(Sound.prototype, "preload").mockResolvedValue();
  vi.spyOn(Sound.prototype, "load").mockResolvedValue();
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture() {
  const sound = new Sound();
  sound.unlock();
  const buffers = (sound as unknown as { buffers: Map<string, unknown> })
    .buffers;
  for (const { id } of SOLDIER_VOICES)
    buffers.set(`voice:${id}`, { voice: true });
  const w = createWorld("playback"),
    p = addPlayer(w, "p");
  start(w);
  w.enemies = [];
  const update = (active = true) => sound.update(w, p.id, 0, active);
  update();
  const context = sound.context as unknown as Context;
  const speech = () => context.sources.filter((s) => s.buffer?.voice);
  return { sound, w, p, update, context, speech };
}
it("does not let a burst of 40 SE steal a new warning source", () => {
  const { w, p, update, sound, speech } = fixture();
  spawn(w, "boss", p.x, p.z + 5);
  update();
  const voice = speech()[0];
  expect(voice).toBeDefined();
  for (let i = 0; i < 40; i++) sound.play("rifle", 1, 0, `shot:${i}`);
  expect(voice.stop).not.toHaveBeenCalled();
  sound.stop(true);
  expect(voice.stop).toHaveBeenCalledTimes(1);
});
it.each([
  "paused",
  "suspended",
  "hidden",
  "run",
  "owner-disconnected",
  "muted",
] as const)(
  "cancels speech at %s and suppresses the stale first resumed state",
  (mode) => {
    const { w, p, update, sound, context, speech } = fixture();
    p.reload = 1;
    update();
    const voice = speech()[0];
    expect(voice).toBeDefined();
    if (mode === "paused") update(false);
    if (mode === "suspended") {
      context.state = "suspended";
      context.onstatechange?.();
      context.state = "running";
    }
    if (mode === "hidden") {
      Object.assign(document, { hidden: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.assign(document, { hidden: false });
    }
    if (mode === "run") {
      w.run = "new";
      update();
    }
    if (mode === "owner-disconnected") {
      p.connected = false;
      update();
      p.connected = true;
    }
    if (mode === "muted") {
      sound.volume = 0;
      sound.volume = 0.35;
    }
    w.time += 20;
    update();
    expect(voice.stop).toHaveBeenCalled();
    expect(speech()).toHaveLength(1);
  },
);
it("resets at the first reconnect snapshot even if old-world frames ran in between", () => {
  const { w, p, update, sound, speech } = fixture();
  sound.resetSpeech();
  update();
  p.reload = 1;
  w.time += 20;
  sound.resetSpeech();
  update();
  expect(speech()).toHaveLength(0);
  p.reload = 0;
  update();
  p.reload = 1;
  update();
  expect(speech()).toHaveLength(1);
});
