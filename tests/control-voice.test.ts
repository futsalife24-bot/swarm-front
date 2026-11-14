import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CONTROL_SET_LINES,
  CONTROL_VOICE_LINES,
  TUTORIAL_VOICE_LINES,
  controlVoiceIdsForScene,
  controlVoiceLine,
  playableLine,
} from "../src/client/control-voice-lines";
import {
  CONTROL_VOICE_SET_VOICES,
  CONTROL_VOICE_STORAGE_KEY,
  voiceForSet,
  ControlVoiceQueue,
  DEFAULT_CONTROL_VOICE,
  GUIDE_WAIT_MS,
  controlVoicePath,
  lineMatchesMode,
  loadControlVoice,
  saveControlVoice,
  type ControlVoiceBackend,
} from "../src/client/control-voice";

function backend(missing: string[] = []) {
  const started: string[] = [];
  const stopped: string[] = [];
  const endings = new Map<string, () => void>();
  const b: ControlVoiceBackend = {
    ready: (path) => !missing.some((m) => path.endsWith(`/${m}.wav`)),
    start(path, onEnded) {
      const id = path.split("/").pop()!.replace(".wav", "");
      started.push(id);
      endings.set(id, onEnded);
      return () => stopped.push(id);
    },
  };
  const end = (id: string) => endings.get(id)!();
  return { b, started, stopped, end };
}

function queue(missing: string[] = []) {
  let now = 0;
  const t = backend(missing);
  const q = new ControlVoiceQueue(t.b, { now: () => now });
  return { ...t, q, advance: (ms: number) => (now += ms) };
}

describe("control voice line table", () => {
  it("holds the 34 tutorial lines with tags as data", () => {
    expect(TUTORIAL_VOICE_LINES).toHaveLength(34);
    expect(new Set(TUTORIAL_VOICE_LINES.map((l) => l.id)).size).toBe(34);
    const count = (tag: string) =>
      TUTORIAL_VOICE_LINES.filter((l) => l.tag === tag).length;
    expect([count("common"), count("solo"), count("multi")]).toEqual([
      28, 2, 4,
    ]);
    const production = (p: string) =>
      TUTORIAL_VOICE_LINES.filter((l) => l.production === p).length;
    expect([
      production("required"),
      production("recommended"),
      production("optional"),
    ]).toEqual([24, 7, 3]);
  });
  it("registers all 147 control lines with unique ids", () => {
    expect(CONTROL_SET_LINES).toHaveLength(147);
    expect(CONTROL_VOICE_LINES).toHaveLength(181);
    expect(new Set(CONTROL_VOICE_LINES.map((l) => l.id)).size).toBe(181);
    const category = (c: string) =>
      CONTROL_SET_LINES.filter((l) => l.category === c).length;
    expect(
      ["announce", "supply", "coop", "system", "weapon", "report", "brief"].map(
        category,
      ),
    ).toEqual([46, 14, 10, 19, 12, 20, 26]);
    for (const line of CONTROL_VOICE_LINES) {
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.trigger.length).toBeGreaterThan(0);
    }
  });
  it("adopts required and recommended control lines by default", () => {
    for (const line of CONTROL_SET_LINES)
      expect(line.adopted).toBe(line.production !== "optional");
    expect(TUTORIAL_VOICE_LINES.every((l) => l.adopted)).toBe(true);
  });
  it("uses the adopted tut-reload wording", () => {
    expect(controlVoiceLine("tut-reload")?.text).toBe(
      "弾切れになると、自動で装填が始まります。装填ボタンで、好きなときに装填することもできます。一度、装填してください。",
    );
  });
  it("blocks brief-* and anomaly names, keeps anomaly-new and G18 disabled", () => {
    const briefs = CONTROL_SET_LINES.filter((l) => l.id.startsWith("brief-"));
    expect(briefs).toHaveLength(26);
    expect(briefs.every((l) => l.blocked === "abolished")).toBe(true);
    const names = CONTROL_SET_LINES.filter(
      (l) => l.id.startsWith("anomaly-") && l.id !== "anomaly-new",
    );
    expect(names).toHaveLength(10);
    expect(names.every((l) => l.blocked === "on-hold")).toBe(true);
    expect(playableLine(controlVoiceLine("anomaly-new")!)).toBe(true);
    expect(controlVoiceLine("tut-enemy-info")?.blocked).toBe("unimplemented");
    expect(controlVoiceIdsForScene("battle")).not.toContain("anomaly-harrow");
  });
  it("ships an audio file for every playable line in each recorded voice", () => {
    const root = path.resolve("public");
    for (const line of CONTROL_VOICE_LINES) {
      for (const voice of CONTROL_VOICE_SET_VOICES[line.set]) {
        const file = path.join(root, controlVoicePath(line, voice));
        if (line.blocked === "abolished" || line.blocked === "on-hold")
          expect(fs.existsSync(file), file).toBe(false);
        else expect(fs.existsSync(file), file).toBe(true);
      }
    }
  });
});
describe("control voice selection and paths", () => {
  const store = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };
  it("defaults to Hiromi and persists a valid choice", () => {
    const s = store();
    expect(DEFAULT_CONTROL_VOICE).toBe("hiromi");
    expect(loadControlVoice(s)).toBe("hiromi");
    expect(saveControlVoice("yoko", s)).toBe(true);
    expect(loadControlVoice(s)).toBe("yoko");
    s.setItem(CONTROL_VOICE_STORAGE_KEY, "unknown");
    expect(loadControlVoice(s)).toBe("hiromi");
    expect(loadControlVoice(undefined)).toBe("hiromi");
    const broken = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    };
    expect(loadControlVoice(broken)).toBe("hiromi");
    expect(saveControlVoice("hiyori", broken)).toBe(false);
  });
  it("builds the conventional versioned folder path", () => {
    expect(controlVoicePath(controlVoiceLine("tut-intro")!, "hiromi")).toBe(
      "assets/audio/voice-tutorial-hiromi-v1/tut-intro.wav",
    );
    expect(controlVoicePath(controlVoiceLine("wave-clear")!, "yoko")).toBe(
      "assets/audio/voice-control-yoko-v1/wave-clear.wav",
    );
  });
  it("falls back to Hiromi for the tutorial set (provisional, data-driven)", () => {
    expect(controlVoicePath(controlVoiceLine("tut-intro")!, "yoko")).toBe(
      "assets/audio/voice-tutorial-hiromi-v1/tut-intro.wav",
    );
    expect(voiceForSet("tutorial", "hiyori")).toBe("hiromi");
    expect(voiceForSet("control", "hiyori")).toBe("hiyori");
    // 代替を外せば字幕だけになる。収録が増えれば選んだ声で鳴る。
    expect(voiceForSet("tutorial", "hiyori", undefined, null)).toBe(undefined);
    expect(
      voiceForSet(
        "tutorial",
        "hiyori",
        { tutorial: ["hiromi", "hiyori"], control: [] },
        null,
      ),
    ).toBe("hiyori");
  });
  it("filters solo and multi lines by entry route", () => {
    const medkit = controlVoiceLine("tut-medkit")!,
      revive = controlVoiceLine("tut-revive")!,
      intro = controlVoiceLine("tut-intro")!;
    expect(lineMatchesMode(medkit, "solo")).toBe(true);
    expect(lineMatchesMode(medkit, "multi")).toBe(false);
    expect(lineMatchesMode(revive, "solo")).toBe(false);
    expect(lineMatchesMode(intro, "multi")).toBe(true);
  });
});

describe("control voice queue", () => {
  it("plays one line at a time and holds only the latest tutorial line", () => {
    const { q, started, end } = queue();
    expect(q.request("tut-ack-1")).toBe("playing");
    expect(q.request("tut-look")).toBe("queued");
    expect(q.request("tut-fire")).toBe("queued");
    expect(q.waiting).toBe("tut-fire");
    end("tut-ack-1");
    expect(started).toEqual(["tut-ack-1", "tut-fire"]);
    expect(q.current).toBe("tut-fire");
  });
  it("drops acknowledgements while busy and suppresses duplicates", () => {
    const { q } = queue();
    q.request("tut-move");
    expect(q.request("tut-ack-2")).toBe("dropped");
    expect(q.request("tut-move")).toBe("duplicate");
    q.request("tut-look");
    expect(q.request("tut-look")).toBe("duplicate");
  });
  it("lets a guide wait at most 5 seconds for the current line", () => {
    const { q, started, end, advance } = queue();
    q.request("tut-intro");
    expect(q.request("tut-base")).toBe("queued");
    advance(GUIDE_WAIT_MS + 1);
    end("tut-intro");
    expect(started).toEqual(["tut-intro"]);
    expect(q.current).toBeUndefined();
    q.request("tut-intro");
    q.request("tut-base");
    advance(GUIDE_WAIT_MS - 1);
    end("tut-intro");
    expect(q.current).toBe("tut-base");
  });
  it("expires a waiting guide on tick", () => {
    const { q, advance } = queue();
    q.request("tut-intro");
    q.request("tut-supply");
    advance(GUIDE_WAIT_MS + 1);
    q.tick();
    expect(q.waiting).toBeUndefined();
  });
  it("lets warnings interrupt tutorial lines but never the reverse", () => {
    const t = backend();
    const alert = {
      id: "alert",
      set: "control" as const,
      category: "announce" as const,
      scene: "battle" as const,
      adopted: true,
      trigger: "test",
      text: "警告",
      tag: "common" as const,
      priority: "warning" as const,
      production: "required" as const,
    };
    const announce = {
      ...alert,
      id: "announce",
      priority: "announce" as const,
    };
    const q = new ControlVoiceQueue(t.b, {
      lines: (id) =>
        id === "alert"
          ? alert
          : id === "announce"
            ? announce
            : controlVoiceLine(id),
    });
    q.request("tut-move");
    expect(q.request("alert")).toBe("playing");
    expect(t.stopped).toEqual(["tut-move"]);
    expect(q.request("tut-look")).toBe("queued");
    expect(q.request("tut-ack-1")).toBe("dropped");
    expect(q.current).toBe("alert");
    t.end("alert");
    expect(q.current).toBe("tut-look");
    // 通常アナウンスは割り込まない。
    expect(q.request("announce")).toBe("dropped");
    t.end("tut-look");
    q.request("announce");
    expect(q.request("alert")).toBe("dropped");
  });
  it("filters lines by mode and skips disabled or unknown ids", () => {
    const { q, started } = queue();
    expect(q.request("tut-revive")).toBe("filtered");
    q.mode = "multi";
    expect(q.request("tut-medkit")).toBe("filtered");
    expect(q.request("tut-revive")).toBe("playing");
    expect(q.request("tut-enemy-info")).toBe("disabled");
    expect(q.request("brief-01")).toBe("disabled");
    expect(q.request("anomaly-harrow")).toBe("disabled");
    expect(q.request("weapon-rifle")).toBe("unadopted");
    expect(q.request("no-such-line")).toBe("unknown");
    expect(started).toEqual(["tut-revive"]);
  });
  it("treats missing audio files as unavailable without throwing", () => {
    const { q, started, end } = queue(["tut-look"]);
    expect(q.request("tut-look")).toBe("unavailable");
    q.request("tut-move");
    q.request("tut-fire");
    end("tut-move");
    expect(started).toEqual(["tut-move", "tut-fire"]);
    const failing = new ControlVoiceQueue({
      ready: () => true,
      start: () => {
        throw Error("decode failed");
      },
    });
    expect(failing.request("tut-intro")).toBe("unavailable");
    expect(failing.current).toBeUndefined();
  });
  it("stop clears both the current and the waiting line", () => {
    const { q, stopped, end, started } = queue();
    q.request("tut-move");
    q.request("tut-look");
    q.stop();
    expect(stopped).toEqual(["tut-move"]);
    end("tut-move");
    expect(started).toEqual(["tut-move"]);
    expect(q.current).toBeUndefined();
  });
});

describe("Sound integration", () => {
  it("routes control voice through the SE master and tolerates missing files", async () => {
    vi.resetModules();
    vi.doMock("../src/client/bgm", () => ({
      backgroundMusic: () => ({ unlock() {}, volume: 1 }),
    }));
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", {
      hidden: false,
      addEventListener() {},
    });
    try {
      const { Sound } = await import("../src/client/audio");
      const sound = new Sound();
      expect(sound.controlVoice.voice).toBe("hiromi");
      await sound.prepareControlVoice(["tut-intro", "missing-line"]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "assets/audio/voice-tutorial-hiromi-v1/tut-intro.wav",
        ),
      );
      expect(sound.controlVoice.request("tut-intro")).toBe("unavailable");
      sound.setControlVoice("yoko");
      expect(sound.controlVoice.voice).toBe("yoko");
    } finally {
      vi.unstubAllGlobals();
      vi.doUnmock("../src/client/bgm");
    }
  });
});
