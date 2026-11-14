import { describe, expect, it, vi } from "vitest";
import {
  CONTROL_VOICE_LINES,
  controlVoiceLine,
} from "../src/client/control-voice-lines";
import {
  CONTROL_VOICE_STORAGE_KEY,
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
    expect(CONTROL_VOICE_LINES).toHaveLength(34);
    expect(new Set(CONTROL_VOICE_LINES.map((l) => l.id)).size).toBe(34);
    const count = (tag: string) =>
      CONTROL_VOICE_LINES.filter((l) => l.tag === tag).length;
    expect([count("common"), count("solo"), count("multi")]).toEqual([
      28, 2, 4,
    ]);
    const production = (p: string) =>
      CONTROL_VOICE_LINES.filter((l) => l.production === p).length;
    expect([
      production("required"),
      production("recommended"),
      production("optional"),
    ]).toEqual([24, 7, 3]);
  });
  it("uses the adopted tut-reload wording", () => {
    expect(controlVoiceLine("tut-reload")?.text).toBe(
      "弾を撃ち切ると、自動で装填が始まります。装填ボタンで、好きなときに装填することもできます。一度、装填してください。",
    );
  });
  it("excludes brief-* and anomaly-* lines and keeps G18 disabled", () => {
    expect(
      CONTROL_VOICE_LINES.filter((l) => /^(brief|anomaly)-/.test(l.id)),
    ).toEqual([]);
    expect(controlVoiceLine("tut-enemy-info")?.enabled).toBe(false);
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
    expect(q.request("brief-01")).toBe("unknown");
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
