import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FTUE_KEYS,
  GUIDE_KEYS,
  OPERATION_KEYS,
  TUTORIAL_FLAGS_KEY,
  clearTutorialSession,
  ensureTutorialFlags,
  hasClearedNormalStage,
  hasFtueFlag,
  hasOperationFlag,
  hasSeen,
  markFtueFlag,
  markOperationFlag,
  markSeen,
  markReturnVisit,
  migrateTutorialFlags,
  migrateC7Terminal,
  resetGuides,
} from "../src/client/tutorial-flags";
import {
  BATTLE_REMINDER,
  BattleReminderWatch,
  BuddyGuideWatch,
  CoopGuideWatch,
  FIRST_GUIDES,
  GuideCaption,
  completeFirstGuide,
  forgetShownGuides,
  showFirstGuide,
} from "../src/client/first-guides";
import { controlVoiceLine } from "../src/client/control-voice-lines";
import { M2_MARKERS } from "../src/shared/analytics-kinds";
import { blankLevels, freshProgress } from "../src/client/progression-save";
import { unlockState } from "../src/client/unlock-stage";
import {
  addPlayer,
  createWorld,
  neutral,
  start,
  step,
  type Input,
  type World,
} from "../src/shared/game";
import { initSolo } from "../src/shared/solo-progression";

function memory() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

beforeEach(() => {
  clearTutorialSession();
  forgetShownGuides();
});

describe("tutorial flags (W4)", () => {
  it("keeps everything unseen for a new player", () => {
    const s = memory();
    expect(ensureTutorialFlags(false, s)).toBe(true);
    expect(hasSeen("offer", s)).toBe(false);
    expect(hasSeen("gear", s)).toBe(false);
    // 2回目は作り直さない。
    expect(ensureTutorialFlags(true, s)).toBe(false);
    expect(hasSeen("gear", s)).toBe(false);
  });
  it("marks the offer and all guides as seen for an existing player", () => {
    const s = memory();
    ensureTutorialFlags(true, s);
    expect(hasSeen("offer", s)).toBe(true);
    for (const key of GUIDE_KEYS) expect(hasSeen(key, s)).toBe(true);
    expect(hasSeen("training", s)).toBe(false);
  });
  it("records progress apart from the progression save", () => {
    const s = memory();
    ensureTutorialFlags(false, s);
    markSeen("training", s);
    markSeen("base", s);
    expect([...s.m.keys()]).toEqual([TUTORIAL_FLAGS_KEY]);
    expect(JSON.parse(s.m.get(TUTORIAL_FLAGS_KEY)!)).toEqual({
      version: 1,
      seen: ["training", "base"],
    });
  });
  it("replays guides without forgetting the offer or training", () => {
    const s = memory();
    ensureTutorialFlags(true, s);
    markSeen("training", s);
    clearTutorialSession();
    resetGuides(s);
    expect(hasSeen("base", s)).toBe(false);
    expect(hasSeen("offer", s)).toBe(true);
    expect(hasSeen("training", s)).toBe(true);
  });
  it("still avoids repeats in the session when storage fails", () => {
    const broken = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    };
    expect(ensureTutorialFlags(false, broken)).toBe(false);
    expect(hasSeen("supply", broken)).toBe(false);
    markSeen("supply", broken);
    expect(hasSeen("supply", broken)).toBe(true);
  });
  it("records only the first visit on another Japanese day", () => {
    const s = memory();
    ensureTutorialFlags(false, s);
    expect(markReturnVisit("2026-11-19", s)).toBe(false);
    expect(markReturnVisit("2026-11-19", s)).toBe(false);
    expect(markReturnVisit("2026-11-20", s)).toBe(true);
    expect(markReturnVisit("2026-11-20", s)).toBe(false);
    const flags = JSON.parse(s.m.get(TUTORIAL_FLAGS_KEY)!) as {
      seen: string[];
    };
    expect(flags.seen).toContain("ftue:return:2026-11-20");
    expect(flags.seen.filter((v) => v.startsWith("ftue:return:"))).toHaveLength(
      1,
    );
  });
});

describe("tutorial flag migration (C-6 F1)", () => {
  const legacyRecord = () => ({
    version: 1,
    seen: ["offer", "gear"],
  });
  const clearedSave = () => ({
    mode: "normal" as const,
    missions: { "ST1:normal": [true, false, false] },
  });

  it("reads a version-1 legacy record", () => {
    const s = memory();
    s.m.set(TUTORIAL_FLAGS_KEY, JSON.stringify(legacyRecord()));
    expect(ensureTutorialFlags(false, s)).toBe(false);
    expect(hasSeen("gear", s)).toBe(true);
    expect(hasOperationFlag("op:dodge", s)).toBe(false);
  });

  it("keeps a new player empty without a cleared save", () => {
    const s = memory();
    expect(ensureTutorialFlags(false, s)).toBe(true);
    expect(migrateTutorialFlags(false, s)).toBe(false);
    expect(JSON.parse(s.m.get(TUTORIAL_FLAGS_KEY)!)).toEqual({
      version: 1,
      seen: [],
    });
  });

  it("seeds every operation and milestone when only a cleared save exists", () => {
    const s = memory();
    expect(hasClearedNormalStage(clearedSave())).toBe(true);
    expect(migrateTutorialFlags(true, s)).toBe(true);
    for (const key of OPERATION_KEYS)
      expect(hasOperationFlag(`op:${key}`, s), key).toBe(true);
    for (const key of FTUE_KEYS)
      expect(hasFtueFlag(`ftue:${key}`, s), key).toBe(true);
    expect(hasSeen("ftue:v2", s)).toBe(true);
  });

  it("does not seed flags for a saved game without a normal clear", () => {
    const s = memory();
    expect(ensureTutorialFlags(true, s)).toBe(true);
    expect(migrateTutorialFlags(hasClearedNormalStage({
      mode: "normal",
      missions: { "ST1:hard": [true] },
    }), s)).toBe(false);
    expect(hasOperationFlag("op:move", s)).toBe(false);
    expect(hasSeen("ftue:v2", s)).toBe(false);
  });

  it("migrates an existing record once and leaves it unchanged afterwards", () => {
    const s = memory();
    s.m.set(TUTORIAL_FLAGS_KEY, JSON.stringify(legacyRecord()));
    expect(migrateTutorialFlags(true, s)).toBe(true);
    const migrated = s.m.get(TUTORIAL_FLAGS_KEY);
    expect(migrateTutorialFlags(true, s)).toBe(false);
    expect(s.m.get(TUTORIAL_FLAGS_KEY)).toBe(migrated);
    expect(hasOperationFlag("op:kill", s)).toBe(true);
  });

  it("keeps migrated flags when guides are reset", () => {
    const s = memory();
    migrateTutorialFlags(true, s);
    expect(resetGuides(s)).toBe(true);
    expect(hasSeen("gear", s)).toBe(false);
    expect(hasOperationFlag("op:swap", s)).toBe(true);
    expect(hasFtueFlag("ftue:first-clear", s)).toBe(true);
    expect(hasSeen("ftue:v2", s)).toBe(true);
  });

  it("keeps migration active for the session when storage fails", () => {
    const broken = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    };
    migrateTutorialFlags(true, broken);
    expect(hasOperationFlag("op:dodge", broken)).toBe(true);
    expect(hasFtueFlag("ftue:first-clear", broken)).toBe(true);
    expect(hasSeen("ftue:v2", broken)).toBe(true);
    expect(migrateTutorialFlags(true, broken)).toBe(false);
  });

  it("round-trips operation and milestone keys in version-1 storage", () => {
    const s = memory();
    expect(markOperationFlag("op:swap", s)).toBe(true);
    expect(markFtueFlag("ftue:equip", s)).toBe(true);
    expect(markOperationFlag("op:swap", s)).toBe(true);
    expect(JSON.parse(s.m.get(TUTORIAL_FLAGS_KEY)!)).toEqual({
      version: 1,
      seen: ["op:swap", "ftue:equip"],
    });
  });

  it("never writes to the progression save", () => {
    const save = Object.freeze({
      version: 2 as const,
      mode: "normal" as const,
      missions: { "ST1:normal": [true] },
      receipts: [],
    });
    const before = JSON.stringify(save);
    const s = memory();
    migrateTutorialFlags(hasClearedNormalStage(save), s);
    expect(JSON.stringify(save)).toBe(before);
    expect([...s.m.keys()]).toEqual([TUTORIAL_FLAGS_KEY]);
  });
});
describe("first-journey analytics", () => {
  const loadAnalytics = async (search: string) => {
    vi.resetModules();
    vi.stubGlobal("location", {
      href: "https://swarm-front.invalid/" + search,
      search,
      origin: "https://swarm-front.invalid",
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "0123456789abcdef0123456789abcdef",
    });
    return import("../src/client/analytics");
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends a first-journey event only once per browser", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    const { trackOnce } = await loadAnalytics("");
    expect(trackOnce("first_sortie", "ftue:first-sortie", storage)).toBe(true);
    expect(trackOnce("first_sortie", "ftue:first-sortie", storage)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls[0] as any[])[1].body)).toEqual({
      kind: "first_sortie",
      visitor: "0123456789abcdef0123456789abcdef",
      admin: false,
    });
  });

  it("does not send in developer mode", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    const { trackOnce } = await loadAnalytics("?developer=1");
    expect(trackOnce("first_clear", "ftue:first-clear", storage)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still sends once in the session when storage fails", async () => {
    const broken = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("denied");
      },
    };
    vi.stubGlobal("localStorage", broken);
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    const { trackOnce } = await loadAnalytics("");
    expect(trackOnce("first_supply10", "ftue:first-supply10", broken)).toBe(
      true,
    );
    expect(trackOnce("first_supply10", "ftue:first-supply10", broken)).toBe(
      false,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sends return once after another Japanese day", async () => {
    const saved = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    });
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers();
    const { trackReturn } = await loadAnalytics("");
    vi.setSystemTime(Date.parse("2026-11-19T15:00:00Z"));
    trackReturn();
    vi.setSystemTime(Date.parse("2026-11-20T15:00:00Z"));
    trackReturn();
    trackReturn();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetch.mock.calls[0] as any[])[1].body).kind).toBe(
      "return",
    );
  });

  it("sends each extended milestone once with only an elapsed bucket", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-11-21T00:00:00Z"));
    const { trackOnce } = await loadAnalytics("");
    expect(trackOnce("ftue_start", "ftue:start", storage)).toBe(true);
    vi.setSystemTime(Date.parse("2026-11-21T00:04:00Z"));
    expect(trackOnce("first_buddy", M2_MARKERS.firstBuddy, storage)).toBe(true);
    expect(trackOnce("first_buddy", M2_MARKERS.firstBuddy, storage)).toBe(false);
    vi.setSystemTime(Date.parse("2026-11-21T00:06:00Z"));
    expect(trackOnce("second_sortie", M2_MARKERS.secondSortie, storage)).toBe(
      true,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    const bodies = fetch.mock.calls.map(
      (call) => JSON.parse((call as any[])[1].body) as Record<string, unknown>,
    );
    expect(bodies[0]).toEqual({
      kind: "ftue_start",
      visitor: "0123456789abcdef0123456789abcdef",
      admin: false,
    });
    expect(bodies[1]).toEqual({
      kind: "first_buddy",
      visitor: "0123456789abcdef0123456789abcdef",
      admin: false,
      elapsed_bucket: "from_3m",
    });
    expect(bodies[2]).toEqual({
      kind: "second_sortie",
      visitor: "0123456789abcdef0123456789abcdef",
      admin: false,
      elapsed_bucket: "from_5m",
    });
    expect(JSON.stringify(bodies)).not.toMatch(/timestamp|duration|2026-11/);
  });

  it("marks milestones from another page launch as another_launch", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    const { trackOnce } = await loadAnalytics("");
    expect(trackOnce("first_defeat", M2_MARKERS.firstDefeat, storage)).toBe(
      true,
    );
    expect(
      JSON.parse((fetch.mock.calls[0] as any[])[1].body).elapsed_bucket,
    ).toBe("another_launch");
  });

  it("does not interrupt play when an extended milestone cannot be sent", async () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const { trackOnce } = await loadAnalytics("");
    expect(() =>
      trackOnce("first_box_claim", M2_MARKERS.firstBoxClaim, storage),
    ).not.toThrow();
  });
});

describe("C-6 M2 training milestones", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = async (analyticsEnabled: boolean) => {
    vi.resetModules();
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("location", {
      href: "https://swarm-front.invalid/",
      search: "",
      origin: "https://swarm-front.invalid",
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "0123456789abcdef0123456789abcdef",
    });
    const fetch = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetch);
    const frame = {
      className: "",
      title: "",
      allow: "",
      src: "",
      contentWindow: {},
      remove: vi.fn(),
    };
    let listener: ((event: any) => void) | undefined;
    vi.stubGlobal("document", {
      createElement: () => frame,
      body: { append: vi.fn() },
    });
    vi.stubGlobal("window", {
      addEventListener: (_type: string, fn: (event: any) => void) => {
        listener = fn;
      },
      removeEventListener: vi.fn(),
    });
    const launch = await import("../src/client/tutorial-launch");
    const onExit = vi.fn();
    launch.openBasicTraining({
      layout: {} as any,
      analyticsEnabled: () => analyticsEnabled,
      onExit,
    });
    const post = (data: unknown) =>
      listener?.({
        origin: "https://swarm-front.invalid",
        source: frame.contentWindow,
        data,
      });
    return { fetch, launch, onExit, post };
  };

  it("sends training start, first operation and completion only once", async () => {
    const { fetch, launch, onExit, post } = await setup(true);
    post({ type: "training-began" });
    post({ type: "training-achievement", operation: "move" });
    post({ type: "training-exit", completed: true });
    expect(onExit).toHaveBeenCalledWith(true);
    const kinds = fetch.mock.calls.map(
      (call) => JSON.parse((call as any[])[1].body).kind,
    );
    expect(kinds).toEqual([
      "training_started",
      "operation_achieved",
      "training_completed",
    ]);
    expect(launch.recordTrainingAchievement("swap", true)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(launch.recordTrainingAchievement("swap", true)).toBe(true);
  });

  it("sends nothing when analytics is disabled", async () => {
    const { fetch, post } = await setup(false);
    post({ type: "training-began" });
    post({ type: "training-achievement", operation: "move" });
    post({ type: "training-exit", completed: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("first guides (W5)", () => {
  const voice = () => {
    const said: string[] = [];
    return { said, say: (id: string) => void said.push(id) };
  };
  it("defines one line per guide from the tutorial and control tables", () => {
    for (const guide of Object.values(FIRST_GUIDES)) {
      expect(controlVoiceLine(guide.line), guide.line).toBeDefined();
      expect(guide.text.length).toBeGreaterThan(0);
    }
    expect(Object.values(FIRST_GUIDES).map((g) => g.line)).not.toContain(
      "tut-enemy-info",
    );
  });
  it("shows a guide once with caption and voice", () => {
    const v = voice(),
      captions: string[] = [];
    expect(showFirstGuide("base", v, (t) => captions.push(t))).toBe(true);
    expect(showFirstGuide("base", v, (t) => captions.push(t))).toBe(false);
    expect(v.said).toEqual(["tut-base"]);
    expect(captions).toEqual([FIRST_GUIDES.base.text]);
    expect(hasSeen("base")).toBe(true);
  });
  it("keeps completion guides unread until their action happens", () => {
    const v = voice();
    showFirstGuide("buddy-menu", v, () => {});
    expect(hasSeen("buddy-menu")).toBe(false);
    // 同じ起動中は繰り返さない。
    expect(showFirstGuide("buddy-menu", v, () => {})).toBe(false);
    completeFirstGuide("buddy-menu");
    expect(hasSeen("buddy-menu")).toBe(true);
  });
  it("introduces the buddy 10 seconds into its first battle", () => {
    const store = memory(),
      v = voice(),
      watch = new BuddyGuideWatch(store),
      w = {
        run: "r",
        time: 5,
        phase: "battle",
        buddies: { entries: { me: { lastSkillAt: -1 } } },
      };
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual([]);
    expect(hasOperationFlag("op:buddy-skill", store)).toBe(false);
    w.time = 10;
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual(["tut-buddy-battle"]);
    expect(hasSeen("buddy-battle")).toBe(false);
    w.buddies.entries.me.lastSkillAt = 11;
    watch.update(w, "me", true, v, () => {});
    expect(hasSeen("buddy-battle")).toBe(true);
    expect(hasOperationFlag("op:buddy-skill", store)).toBe(true);
  });
  it("does not count the battle end as a buddy-skill achievement", () => {
    const store = memory(),
      v = voice(),
      watch = new BuddyGuideWatch(store),
      w = {
        run: "r",
        time: 10,
        phase: "battle",
        buddies: { entries: { me: { lastSkillAt: -1 } } },
      };
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual(["tut-buddy-battle"]);
    w.phase = "victory";
    watch.update(w, "me", false, v, () => {});
    expect(hasSeen("buddy-battle")).toBe(true);
    expect(hasOperationFlag("op:buddy-skill", store)).toBe(false);
  });
  it("explains loot and revive in the first co-op battle", () => {
    const v = voice(),
      watch = new CoopGuideWatch(),
      w = {
        run: "r",
        time: 19,
        phase: "battle",
        players: [
          { id: "me", hp: 100, connected: true },
          { id: "ally", hp: 100, connected: true },
        ],
      };
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual([]);
    w.time = 20;
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual(["tut-loot-multi"]);
    w.time = 26;
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual(["tut-loot-multi", "tut-revive"]);
  });
  it("brings the revive guide forward when an ally first goes down", () => {
    const v = voice(),
      watch = new CoopGuideWatch();
    watch.update(
      {
        run: "r",
        time: 3,
        phase: "battle",
        players: [
          { id: "me", hp: 100, connected: true },
          { id: "ally", hp: 0, connected: true },
        ],
      },
      "me",
      true,
      v,
      () => {},
    );
    expect(v.said).toEqual(["tut-revive"]);
  });
  it("expires captions after their time", () => {
    let now = 0;
    const c = new GuideCaption(() => now);
    c.show("案内", 2);
    expect(c.current).toBe("案内");
    now = 2001;
    expect(c.current).toBe("");
  });
});

describe("C-6 F4 battle reminders", () => {
  const battle = (run: string, time: number, wave = 1) => ({
    run,
    time,
    wave,
    phase: "battle",
    players: [{ slot: 0, evade: 0 }],
  });

  it("waits for 8 seconds and wave 2, showing each operation once", () => {
    const store = memory(),
      watch = new BattleReminderWatch(store),
      w = battle("r", 7);
    expect(watch.update(w, true)).toBeUndefined();
    w.time = BATTLE_REMINDER.dodgeAtSeconds;
    expect(watch.update(w, true)).toBe(BATTLE_REMINDER.text.dodge);
    expect(watch.update(w, true)).toBeUndefined();
    w.wave = BATTLE_REMINDER.swapAtWave;
    expect(watch.update(w, true)).toBe(BATTLE_REMINDER.text.swap);
    expect(watch.update(w, true)).toBeUndefined();
  });

  it("records achievements in place and never reminds again", () => {
    const store = memory(),
      watch = new BattleReminderWatch(store),
      w = battle("r", BATTLE_REMINDER.dodgeAtSeconds);
    expect(watch.update(w, true)).toBe(BATTLE_REMINDER.text.dodge);
    w.players[0].evade = 0.4;
    watch.update(w, true);
    expect(hasOperationFlag("op:dodge", store)).toBe(true);
    const next = battle("r2", BATTLE_REMINDER.dodgeAtSeconds);
    expect(watch.update(next, true)).toBeUndefined();
    next.players[0].slot = 1;
    watch.update(next, true);
    expect(hasOperationFlag("op:swap", store)).toBe(true);
    expect(watch.update(next, true)).toBeUndefined();
  });

  it("stops after three shown battles", () => {
    const store = memory(),
      watch = new BattleReminderWatch(store);
    for (let index = 1; index <= BATTLE_REMINDER.battleLimit; index++) {
      const w = battle(`r${index}`, BATTLE_REMINDER.dodgeAtSeconds);
      expect(watch.update(w, true)).toBe(BATTLE_REMINDER.text.dodge);
    }
    expect(
      watch.update(battle("r4", BATTLE_REMINDER.dodgeAtSeconds), true),
    ).toBeUndefined();
  });

  it("does not spend a battle while another caption blocks the reminder", () => {
    const store = memory(),
      watch = new BattleReminderWatch(store),
      w = battle("r", BATTLE_REMINDER.dodgeAtSeconds);
    expect(watch.update(w, false)).toBeUndefined();
    expect(watch.update(w, true)).toBe(BATTLE_REMINDER.text.dodge);
  });

  it("keeps a seeded battle identical with and without reminders", () => {
    const canonical = (value: unknown): string => {
      const ancestors: unknown[] = [];
      const write = (item: unknown): string => {
        if (item === undefined) return "undefined";
        if (item === null) return "null";
        if (typeof item === "number")
          return Object.is(item, -0) ? "-0" : String(item);
        if (typeof item === "string") return JSON.stringify(item);
        if (typeof item === "boolean") return String(item);
        if (typeof item !== "object" || item instanceof Map || item instanceof Set)
          throw new Error(`直列化の対象外です: ${typeof item}`);
        const seen = ancestors.indexOf(item);
        if (seen >= 0) return `^${ancestors.length - seen}`;
        ancestors.push(item);
        const text = Array.isArray(item)
          ? `[${item.map(write).join(",")}]`
          : `{${Object.entries(item)
              .map(([key, child]) => `${JSON.stringify(key)}:${write(child)}`)
              .join(",")}}`;
        ancestors.pop();
        return text;
      };
      return write(value);
    };
    const makeWorld = (): World => {
      const w = createWorld("f4-equivalence", 4242, 1);
      initSolo(w, 1, "normal", false, blankLevels());
      addPlayer(w, "solo");
      start(w);
      return w;
    };
    const command = (tick: number): Input => ({
      ...neutral(),
      seq: tick + 1,
      mx: tick % 40 < 20 ? 1 : -1,
      mz: tick % 60 < 30 ? 1 : -1,
    });
    const observed = makeWorld(),
      control = makeWorld(),
      watch = new BattleReminderWatch(memory()),
      shown: string[] = [];
    for (let tick = 0; tick < 180; tick++) {
      const input = command(tick);
      observed.players[0].hp = 160;
      control.players[0].hp = 160;
      step(observed, { solo: input });
      step(control, { solo: input });
      observed.players[0].hp = 160;
      control.players[0].hp = 160;
      const before = canonical(observed);
      const text = watch.update(observed, true);
      if (text) shown.push(text);
      expect(canonical(observed)).toBe(before);
      expect(canonical(observed)).toBe(canonical(control));
    }
    expect(shown).toContain(BATTLE_REMINDER.text.dodge);
  });
});

describe("C-6 F1 compatibility with C-7 unlock records", () => {
  it("keeps C-7 unlock markers when the F1 migration runs afterwards", () => {
    const store = memory();
    store.m.set(TUTORIAL_FLAGS_KEY, JSON.stringify({ version: 1, seen: ["offer", "ftue:unlock:all", "ftue:c7"] }));
    expect(migrateTutorialFlags(true, store)).toBe(true);
    for (const marker of ["ftue:unlock:all", "ftue:c7"])
      expect(JSON.parse(store.m.get(TUTORIAL_FLAGS_KEY)!).seen, marker).toContain(marker);
  });
});
describe("terminal unlock migration (C-7 U1)", () => {
  const seen = (store: ReturnType<typeof memory>) =>
    JSON.parse(store.m.get(TUTORIAL_FLAGS_KEY)!) as { seen: string[] };

  beforeEach(() => clearTutorialSession());

  it("grants all unlocks to a pre-C-7 terminal with a progress save", () => {
    const store = memory();
    expect(migrateC7Terminal(true, false, 1, store)).toBe(true);
    expect(seen(store).seen).toContain("ftue:unlock:all");
    expect(seen(store).seen).toContain("ftue:c7");
    expect(unlockState(freshProgress(), { seen: seen(store).seen }).stage).toBe(1);
  });

  it("grants all unlocks when only front-play history exists", () => {
    const store = memory();
    expect(migrateC7Terminal(false, true, 0, store)).toBe(true);
    expect(seen(store).seen).toContain("ftue:unlock:all");
  });

  it("starts a brand-new terminal at S0 and stamps once", () => {
    const store = memory();
    expect(migrateC7Terminal(false, false, 0, store)).toBe(true);
    expect(seen(store).seen).toEqual(["ftue:c7"]);
    expect(migrateC7Terminal(false, false, 0, store)).toBe(false);
    expect(seen(store).seen).toEqual(["ftue:c7"]);
  });

  it("does not grant all unlocks when the first save appears after migration", () => {
    const store = memory();
    migrateC7Terminal(false, false, 0, store);
    migrateC7Terminal(true, false, 1, store);
    expect(seen(store).seen).not.toContain("ftue:unlock:all");
    expect(seen(store).seen).toContain("ftue:unlock:1");
    const before = JSON.stringify(seen(store));
    expect(migrateC7Terminal(true, false, 1, store)).toBe(false);
    expect(JSON.stringify(seen(store))).toBe(before);
  });

  it("records the highest save-derived stage monotonically", () => {
    const store = memory();
    migrateC7Terminal(false, false, 2, store);
    expect(seen(store).seen).toEqual(expect.arrayContaining(["ftue:unlock:1", "ftue:unlock:2"]));
    expect(migrateC7Terminal(false, false, 1, store)).toBe(false);
    expect(seen(store).seen).not.toContain("ftue:unlock:3");
  });

  it("keeps migration markers through resetGuides", () => {
    const store = memory();
    migrateC7Terminal(true, false, 2, store);
    resetGuides(store);
    for (const marker of ["ftue:c7", "ftue:unlock:all", "ftue:unlock:2"])
      expect(seen(store).seen, marker).toContain(marker);
  });

  it("does not write to ProgressSave", () => {
    const save = Object.freeze({
      version: 2 as const,
      mode: "normal" as const,
      missions: { "ST1:normal": [true] },
      receipts: [],
    });
    const before = JSON.stringify(save);
    const store = memory();
    migrateC7Terminal(true, false, 1, store);
    expect(JSON.stringify(save)).toBe(before);
    expect([...store.m.keys()]).toEqual([TUTORIAL_FLAGS_KEY]);
  });
});
