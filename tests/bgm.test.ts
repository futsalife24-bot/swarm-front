import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { musicForBattle, musicForScreen } from "../src/client/bgm";
import { BackgroundMusic } from "../src/client/bgm";
import { setGameMediaMetadata } from "../src/client/media-session";
import { STAGES, HARROW_BRANCH } from "../src/shared/stages";

describe("game media notification identity", () => {
  afterEach(() => vi.unstubAllGlobals());
  const session = () => {
    const mediaSession = {
      metadata: null as MediaMetadataInit | null,
      playbackState: "paused",
      setActionHandler: vi.fn(),
    };
    vi.stubGlobal("navigator", { mediaSession });
    vi.stubGlobal(
      "MediaMetadata",
      class {
        constructor(value: MediaMetadataInit) {
          Object.assign(this, value);
        }
      },
    );
    return mediaSession;
  };
  it.each(["/", "/swarm-front/"])(
    "uses the existing square logo below deployment base %s",
    (base) => {
      const media = session();
      setGameMediaMetadata(base);
      expect(media.metadata?.title).toBe("SWARM FRONT.");
      expect(media.metadata?.artwork?.[0]?.src).toBe(
        `${base}icon-swarm-v2-512.png`,
      );
      const png = readFileSync("public/icon-swarm-v2-512.png");
      expect(media.metadata?.artwork?.[0]?.sizes).toBe(
        `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,
      );
      expect(media.setActionHandler).not.toHaveBeenCalled();
      expect(media.playbackState).toBe("paused");
    },
  );
  it("sets metadata through the common BGM initialization without starting audio", () => {
    const media = session();
    const play = vi.fn();
    vi.stubGlobal(
      "Audio",
      class extends EventTarget {
        dataset = {};
        play = play;
      },
    );
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), { body: { append() {} } }),
    );
    vi.stubGlobal("window", new EventTarget());
    new BackgroundMusic();
    expect(media.metadata?.title).toBe("SWARM FRONT.");
    expect(play).not.toHaveBeenCalled();
  });
  it("tolerates unavailable browser APIs", () => {
    vi.stubGlobal("navigator", undefined);
    expect(() => setGameMediaMetadata()).not.toThrow();
    vi.stubGlobal("navigator", {});
    expect(() => setGameMediaMetadata()).not.toThrow();
    vi.stubGlobal("navigator", { mediaSession: {} });
    vi.stubGlobal("MediaMetadata", undefined);
    expect(() => setGameMediaMetadata()).not.toThrow();
  });
  it("does not break audio initialization if the browser rejects metadata", () => {
    session();
    vi.stubGlobal("navigator", {
      mediaSession: {
        set metadata(_value: unknown) {
          throw new Error("metadata unavailable");
        },
      },
    });
    expect(() => setGameMediaMetadata()).not.toThrow();
  });
});

describe("map battle music", () => {
  it.each([
    [1, 0],
    [5, 1],
    [11, 2],
    [2, 3],
    [13, 4],
    [10, 5],
  ])(
    "plays the map of stage %i in solo and cooperative battles",
    (stage, map) => {
      expect(musicForScreen("battle", false, { stage })).toBe(`map-${map}`);
      expect(
        musicForBattle({ stage, solo: { stage, difficulty: "medium" } }),
      ).toBe(`map-${map}`);
    },
  );
  it("covers every campaign stage and elevated route", () => {
    for (const plan of [...STAGES, HARROW_BRANCH]) {
      expect(musicForBattle({ campaignPlan: plan })).toBe(`map-${plan.map}`);
    }
  });
  it("follows a saved active plan instead of a changed stage selection", () => {
    expect(musicForBattle({ stage: 1, campaignPlan: STAGES[9] })).toBe("map-5");
  });
  it("leaves training and an absent world silent", () => {
    expect(musicForBattle({ stage: 1, training: true })).toBeNull();
    expect(musicForBattle()).toBeNull();
    expect(musicForBattle(null)).toBeNull();
  });
  it("rejects an unknown map instead of requesting a missing asset", () => {
    expect(
      musicForBattle({ campaignPlan: { ...STAGES[0], map: 99 } }),
    ).toBeNull();
  });
  it("preserves menu, loading, clear and defeat routing", () => {
    const world = { stage: 13 };
    expect(musicForScreen("gear", false, world)).toBe("prepare");
    expect(musicForScreen("lobby", false, world)).toBe("lobby");
    expect(musicForScreen("loading", false, world)).toBeUndefined();
    expect(musicForScreen("layout", false, world)).toBeUndefined();
    expect(musicForScreen("stage-clear", true, world)).toBe("clear");
    expect(musicForScreen("collection", true, world)).toBe("clear");
    expect(musicForScreen("result", true, world)).toBe("victory");
    expect(musicForScreen("result", false, world)).toBeNull();
    expect(musicForScreen("down", false, world)).toBeNull();
  });
});

describe("streaming media gain on Safari", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const setup = async () => {
    const { MediaVolume } = await import("../src/client/media-volume");
    const media = { volume: 1, muted: false } as HTMLMediaElement;
    const parameter = { value: 0, setTargetAtTime: vi.fn() };
    const destination = {};
    const gain = { gain: parameter, connect: vi.fn(), disconnect: vi.fn() };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const context = {
      state: "suspended",
      currentTime: 4,
      destination,
      createGain: vi.fn(() => gain),
      createMediaElementSource: vi.fn(() => source),
      resume: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
    };
    const create = vi.fn(function () {
      return context;
    });
    vi.stubGlobal("AudioContext", create);
    return {
      media,
      output: new MediaVolume(media),
      context,
      gain,
      source,
      create,
    };
  };
  it("routes actual media through one gain graph and resumes that graph on later gestures", async () => {
    const { media, output, context, gain, source, create } = await setup();
    output.volume = 0.2;
    expect(create).not.toHaveBeenCalled();
    output.unlock();
    expect(context.createMediaElementSource).toHaveBeenCalledExactlyOnceWith(
      media,
    );
    expect(source.connect).toHaveBeenCalledExactlyOnceWith(gain);
    expect(gain.connect).toHaveBeenCalledExactlyOnceWith(context.destination);
    expect(gain.gain.value).toBe(0.2);
    expect(media.volume).toBe(1);
    output.volume = 0.05;
    expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.05, 4, 0.015);
    output.unlock();
    expect(create).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(2);
    output.volume = 0;
    expect(media.muted).toBe(true);
    output.volume = 0.5;
    expect(media.muted).toBe(false);
    expect(media.volume).toBe(1);
    output.dispose();
    output.dispose();
    output.unlock();
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("closes incomplete graphs and can retry without retaining failed contexts", async () => {
    const { output, context, create } = await setup();
    context.createMediaElementSource.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    output.unlock();
    expect(context.close).toHaveBeenCalledTimes(1);
    output.unlock();
    expect(create).toHaveBeenCalledTimes(2);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(2);
  });
  it("retains native playback and mute when Web Audio is unavailable", async () => {
    const { media, output } = await setup();
    vi.stubGlobal("AudioContext", undefined);
    output.volume = 0.2;
    expect(() => output.unlock()).not.toThrow();
    expect(media.volume).toBe(0.2);
    output.volume = 0;
    expect(media.muted).toBe(true);
  });
});
