import { beforeEach, describe, expect, it } from "vitest";
import {
  GUIDE_KEYS,
  TUTORIAL_FLAGS_KEY,
  clearTutorialSession,
  ensureTutorialFlags,
  hasSeen,
  markSeen,
  resetGuides,
} from "../src/client/tutorial-flags";
import {
  BuddyGuideWatch,
  CoopGuideWatch,
  FIRST_GUIDES,
  GuideCaption,
  completeFirstGuide,
  forgetShownGuides,
  showFirstGuide,
} from "../src/client/first-guides";
import { controlVoiceLine } from "../src/client/control-voice-lines";

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
    const v = voice(),
      watch = new BuddyGuideWatch(),
      w = {
        run: "r",
        time: 5,
        phase: "battle",
        buddies: { entries: { me: { lastSkillAt: -1 } } },
      };
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual([]);
    w.time = 10;
    watch.update(w, "me", true, v, () => {});
    expect(v.said).toEqual(["tut-buddy-battle"]);
    expect(hasSeen("buddy-battle")).toBe(false);
    w.buddies.entries.me.lastSkillAt = 11;
    watch.update(w, "me", true, v, () => {});
    expect(hasSeen("buddy-battle")).toBe(true);
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
