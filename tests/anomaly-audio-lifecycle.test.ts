import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sound } from "../src/client/audio";
import { addPlayer, createWorld, start } from "../src/shared/game";

vi.mock("../src/client/bgm", () => ({
  backgroundMusic: () => ({ volume: 1, unlock() {} }),
}));
const parameter = () => ({ value: 0, setTargetAtTime: vi.fn() });
const node = () => ({
  connect: (other: unknown) => other,
  disconnect: vi.fn(),
});
let sources: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}[];
beforeEach(() => {
  sources = [];
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(4),
    }),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      currentTime = 5;
      destination = {};
      onstatechange?: () => void;
      decodeAudioData = async () => ({});
      resume = async () => {
        this.state = "running";
      };
      createGain() {
        return { ...node(), gain: parameter() };
      }
      createStereoPanner() {
        return { ...node(), pan: parameter() };
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
      createBufferSource() {
        const source = {
          ...node(),
          playbackRate: parameter(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        sources.push(source);
        return source;
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("cancels interrupted monster voices before audio resumes, without occupying new voice slots", async () => {
  const sound = new Sound();
  sound.unlock();
  await sound.load();
  sound.play("anomaly:harrow-0");
  sound.play("anomaly:calyx-0");
  expect(sources).toHaveLength(2);
  const context = sound.context!;
  Object.defineProperty(context, "state", {
    value: "suspended",
    configurable: true,
  });
  context.onstatechange!(new Event("statechange"));
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(
    true,
  );
  Object.defineProperty(context, "state", {
    value: "running",
    configurable: true,
  });
  // onended is asynchronous: stopped nodes must release both slots immediately.
  sound.play("anomaly:ant-0");
  sound.play("anomaly:spider-0");
  expect(sources).toHaveLength(4);
  expect(
    sources.slice(0, 2).every((source) => source.start.mock.calls.length === 1),
  ).toBe(true);
});

it.each(["disconnect", "death", "new-run", "no-world"])(
  "cancels playing monster voices on %s",
  async (transition) => {
    const sound = new Sound();
    sound.unlock();
    await sound.load();
    const world = createWorld("voice-lifecycle"),
      player = addPlayer(world, "p");
    start(world);
    sound.update(world, player.id, 0, true);
    sound.play("anomaly:harrow-0");
    const playing = sources.at(-1)!;
    if (transition === "disconnect") player.connected = false;
    if (transition === "death") player.hp = 0;
    if (transition === "new-run") world.run += "-next";
    sound.update(transition === "no-world" ? null : world, player.id, 0, true);
    expect(playing.stop).toHaveBeenCalledOnce();
  },
);
