import { describe, expect, it } from "vitest";
import {
  CONTROL_SET_LINES,
  CONTROL_VOICE_LINES,
  TUTORIAL_VOICE_LINES,
  controlVoiceIdsForScene,
  controlVoiceLine,
  playableLine,
} from "../src/client/control-voice-lines";
import {
  CONTROL_VOICE_STORAGE_KEY,
  CONTROL_VOICE_UNLOCK_KEY,
  isControlVoiceUnlocked,
  unlockControlVoice,
  unlockedControlVoices,
  voiceForSet,
  ControlVoiceQueue,
  DEFAULT_CONTROL_VOICE,
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
    ready: (path) => !missing.some((m) => path.endsWith(`/${m}`)),
    start(path, onEnded) {
      const id = path.split("/").pop()!;
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
  it("registers all 148 control lines with unique ids", () => {
    expect(CONTROL_SET_LINES).toHaveLength(148);
    expect(CONTROL_VOICE_LINES).toHaveLength(182);
    expect(new Set(CONTROL_VOICE_LINES.map((l) => l.id)).size).toBe(182);
    const category = (c: string) =>
      CONTROL_SET_LINES.filter((l) => l.category === c).length;
    expect(
      ["announce", "supply", "coop", "system", "weapon", "report", "brief"].map(
        category,
      ),
    ).toEqual([47, 14, 10, 19, 12, 20, 26]);
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
  it("loads only the training lines for the basic training", () => {
    const ids = controlVoiceIdsForScene("training");
    expect(ids).toContain("tut-intro");
    expect(ids).toContain("tut-skip");
    expect(ids).not.toContain("tut-offer");
    expect(ids).toHaveLength(19);
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
    // 未解放の声は選んでいても既定に戻る。解放後は保存した選択を使う。
    expect(loadControlVoice(s)).toBe("hiromi");
    expect(unlockControlVoice("yoko", s)).toBe(true);
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
  it("unlocks only Hiromi by default and stores extra voices in a new key", () => {
    const s = store();
    expect(unlockedControlVoices(s)).toEqual(["hiromi"]);
    expect(isControlVoiceUnlocked("hiyori", s)).toBe(false);
    expect(unlockControlVoice("hiyori", s)).toBe(true);
    expect(unlockControlVoice("hiyori", s)).toBe(true);
    expect(s.getItem(CONTROL_VOICE_UNLOCK_KEY)).toBe('["hiyori"]');
    expect(unlockedControlVoices(s)).toEqual(["hiromi", "hiyori"]);
    expect(isControlVoiceUnlocked("yoko", s)).toBe(false);
    s.setItem(CONTROL_VOICE_UNLOCK_KEY, "{broken");
    expect(unlockedControlVoices(s)).toEqual(["hiromi"]);
    expect(unlockControlVoice("hiyori", undefined)).toBe(false);
  });
  it("builds the conventional versioned clip key", () => {
    expect(controlVoicePath(controlVoiceLine("tut-intro")!, "hiromi")).toBe(
      "voice-tutorial-hiromi-v1/tut-intro",
    );
    expect(controlVoicePath(controlVoiceLine("wave-clear")!, "yoko")).toBe(
      "voice-control-yoko-v1/wave-clear",
    );
  });
  it("falls back to Hiromi for the tutorial set (provisional, data-driven)", () => {
    expect(controlVoicePath(controlVoiceLine("tut-intro")!, "yoko")).toBe(
      "voice-tutorial-hiromi-v1/tut-intro",
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
  it("分類を問わず新しい台詞が即座に古い台詞を止める", () => {
    const { q, started, stopped, end } = queue();
    for (const id of [
      "tut-intro",
      "tut-base",
      "tut-ack-1",
      "wave-incoming",
      "home",
      "tut-look",
    ])
      expect(q.request(id)).toBe("playing");
    expect(stopped).toEqual(started.slice(0, -1));
    expect(q.waiting).toBeUndefined();
    end("tut-intro");
    expect(q.current).toBe("tut-look");
  });
  it("同じ台詞の二重・直後の連続再生を抑える", () => {
    const { q, end, advance } = queue();
    expect(q.request("tut-move")).toBe("playing");
    expect(q.request("tut-move")).toBe("duplicate");
    advance(8000);
    end("tut-move");
    expect(q.request("tut-move")).toBe("duplicate");
    advance(251);
    expect(q.request("tut-move")).toBe("playing");
  });
  it("準備完了が逆順でも最後の要求だけを鳴らす", async () => {
    const t = backend();
    const ready = new Set<string>();
    const done = new Map<string, () => void>();
    const q = new ControlVoiceQueue({
      ...t.b,
      ready: (path) => ready.has(path.split("/").pop()!),
      prepare: (line) =>
        new Promise<void>((resolve) =>
          done.set(line.id, () => {
            ready.add(line.id);
            resolve();
          }),
        ),
    });
    q.request("tut-intro");
    q.request("home");
    expect(q.request("home")).toBe("duplicate");
    done.get("home")!();
    await Promise.resolve();
    done.get("tut-intro")!();
    await Promise.resolve();
    expect(t.started).toEqual(["home"]);
    expect(q.current).toBe("home");
  });
  it("明示停止は準備中の遅延再生も取り消す", async () => {
    const t = backend();
    let ready = false;
    let done!: () => void;
    const q = new ControlVoiceQueue({
      ...t.b,
      ready: () => ready,
      prepare: () => new Promise<void>((resolve) => (done = resolve)),
    });
    q.request("home");
    q.stop();
    ready = true;
    done();
    await Promise.resolve();
    expect(t.started).toEqual([]);
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
    expect(stopped).toEqual(["tut-move", "tut-look"]);
    end("tut-move");
    expect(started).toEqual(["tut-move", "tut-look"]);
    expect(q.current).toBeUndefined();
  });
});
