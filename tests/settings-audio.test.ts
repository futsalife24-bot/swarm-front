import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sound } from "../src/client/audio";
import { fresh, parseSave } from "../src/client/save";
import { coopPreferences } from "../src/client/progression-save";

const music = vi.hoisted(() => ({ volume: 0, unlock: vi.fn() }));
vi.mock("../src/client/bgm", () => ({ backgroundMusic: () => music }));
const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
const node = () => ({
  connect(other: unknown) {
    return other;
  },
});
let gains: ReturnType<typeof parameter>[];
beforeEach(() => {
  gains = [];
  vi.stubGlobal("document", new EventTarget());
  vi.spyOn(Sound.prototype, "preload").mockResolvedValue();
  vi.spyOn(Sound.prototype, "load").mockResolvedValue();
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 5;
      destination = {};
      createGain() {
        const gain = parameter();
        gains.push(gain);
        return { ...node(), gain };
      }
      createDynamicsCompressor() {
        return {
          ...node(),
          threshold: parameter(),
          knee: parameter(),
          ratio: parameter(),
          attack: parameter(),
          release: parameter(),
        };
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("independent sound levels", () => {
  it("preserves the audible levels and mute of old saves", () => {
    const sound = new Sound();
    for (const volume of [0, 0.35, 1]) {
      const saved = parseSave(JSON.stringify({ ...fresh(), volume }));
      sound.setVolumes(saved.volume, saved.bgmVolume, saved.seVolume);
      expect(music.volume).toBe(volume);
      expect(sound.effectsVolume).toBe(volume);
    }
  });
  it("applies the SE factor on unlock, independently updates BGM, and preserves ratios under master changes", () => {
    const sound = new Sound();
    sound.setVolumes(0.5, 0.2, 0.8);
    sound.unlock();
    expect(music.volume).toBeCloseTo(0.1);
    expect(gains[0].value).toBeCloseTo(0.4);
    sound.setVolumes(0.5, 0, 0.8);
    expect(music.volume).toBe(0);
    expect(gains[0].setTargetAtTime).toHaveBeenLastCalledWith(0.4, 5, 0.015);
    sound.setVolumes(0.5, 0.2, 0);
    expect(music.volume).toBeCloseTo(0.1);
    expect(gains[0].setTargetAtTime).toHaveBeenLastCalledWith(0, 5, 0.015);
    sound.setVolumes(0.5, 0.2, 0.8);
    sound.volume = 0;
    expect(music.volume).toBe(0);
    expect(sound.effectsVolume).toBe(0);
    sound.volume = 1;
    expect(music.volume).toBe(0.2);
    expect(sound.effectsVolume).toBe(0.8);
  });
  it("round trips independent zero levels through cooperative preferences", () => {
    const saved = { ...fresh(), bgmVolume: 0, seVolume: 0.65 };
    const restored = parseSave(
      JSON.stringify({ ...fresh(), ...coopPreferences(saved) }),
    );
    expect(restored.bgmVolume).toBe(0);
    expect(restored.seVolume).toBe(0.65);
    expect(restored.inventory).toEqual(saved.inventory);
  });
  it.each(["bgmVolume", "seVolume"])(
    "rejects malformed %s without changing the save",
    (key) => {
      for (const value of [-0.1, 1.1, null, "0.5", false]) {
        expect(() =>
          parseSave(JSON.stringify({ ...fresh(), [key]: value })),
        ).toThrow();
      }
    },
  );
});
