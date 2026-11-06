import { expect, it } from "vitest";
import {
  getAdvanceBuddyView,
  getBuddySkillView,
} from "../src/client/buddy-presentation";
import { createWorld, addPlayer } from "../src/shared/game";
import {
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";
import { BUDDY_IDS } from "../src/shared/buddy-progression";
import {
  advanceBuddyMarkup,
  advanceDownMarkup,
} from "../src/client/advance-pause-ui";

it("表示は欠損と同行なしを区別し、文字をHTMLとして扱わない", () => {
  expect(advanceBuddyMarkup({ status: "none" })).toContain("同行なし");
  expect(advanceBuddyMarkup(undefined)).toContain("情報を表示できません");
  const html = advanceBuddyMarkup({
    status: "present",
    name: "<img src=x>",
    level: NaN,
    remaining: Infinity,
  });
  expect(html).toContain("&lt;img src=x&gt;");
  expect(html).not.toMatch(/<img|NaN|Infinity|undefined/);
  const down = advanceDownMarkup({ stageLabel: "<script>", kills: NaN });
  expect(down).toContain("&lt;script&gt;");
  expect(down).not.toMatch(/<script>|NaN|undefined|復活|再挑戦/);
  expect(down).toContain('id="pt-defeat"');
});

function battle() {
  const w = createWorld("pause");
  addPlayer(w, "solo");
  w.phase = "battle";
  w.buddies = createBuddyBattleState(w);
  return w;
}
it("同行なしと不明な作戦/個体を区別しHUDも不明IDで落ちない", () => {
  const w = battle();
  expect(getAdvanceBuddyView(w, "solo").status).toBe("none");
  equipBattleBuddy(w.buddies!, w.players[0], "tatara", 17);
  expect(getAdvanceBuddyView({ ...w, run: "old" }, "solo").status).toBe(
    "unavailable",
  );
  Object.assign(w.buddies!.entries.solo, { buddyId: "unknown" });
  expect(getAdvanceBuddyView(w, "solo").status).toBe("unavailable");
  expect(getBuddySkillView(w, "solo", true)).toBeNull();
  Object.assign(w.buddies!, { entries: undefined });
  expect(getAdvanceBuddyView(w, "solo").status).toBe("unavailable");
  expect(getBuddySkillView(w, "solo", true)).toBeNull();
});
it.each(BUDDY_IDS)(
  "%sの実レベル・再使用・効果を読み、状態を書き換えない",
  (id) => {
    const w = battle();
    equipBattleBuddy(w.buddies!, w.players[0], id, 17);
    w.time = 10;
    w.players[0].hp = 50;
    Object.assign(w.buddies!.entries.solo, {
      skillReadyAt: 22,
      healUntil: 14,
      displayUntil: 99,
    });
    w.buddies!.buffs.solo = { guardUntil: 16, boostUntil: 15 };
    const before = structuredClone(w);
    const view = getAdvanceBuddyView(w, "solo");
    expect(view.level).toBe(17);
    expect(view.remaining).toBe(12);
    expect(view.activeRemaining).toBe(
      { tatara: 0, yosuga: 4, tobari: 6, oriha: 5 }[id],
    );
    expect(view.unavailable).toBeNull();
    if (id === "yosuga") expect(view.skillText).toContain("持ち主だけ");
    expect(w).toEqual(before);
  },
);
it("欠損数値をNaNや仮レベルで埋めず、接続/体力の事実を反映", () => {
  const w = battle();
  equipBattleBuddy(w.buddies!, w.players[0], "yosuga");
  Object.assign(w.buddies!.entries.solo, {
    level: NaN,
    skillReadyAt: undefined,
    healUntil: undefined,
  });
  expect(getAdvanceBuddyView(w, "solo")).toMatchObject({
    level: null,
    remaining: null,
    activeRemaining: null,
  });
  w.players[0].hp = 0;
  expect(getAdvanceBuddyView(w, "solo")).toMatchObject({
    unavailable: "戦闘不能",
    activeRemaining: 0,
  });
  w.players[0].connected = false;
  expect(getAdvanceBuddyView(w, "solo").unavailable).toBe("接続待ち");
});
