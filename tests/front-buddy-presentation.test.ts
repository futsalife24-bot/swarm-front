import { expect, it } from "vitest";
import {
  getBuddyUiState,
  getBuddySkillView,
} from "../src/client/buddy-presentation";
import { freshProgress } from "../src/client/progression-save";
import {
  chooseStarterBuddy,
  freshBuddyProgress,
  buddyXpForLevel,
  BUDDY_IDS,
} from "../src/shared/buddy-progression";
import { createWorld, addPlayer } from "../src/shared/game";
import {
  BUDDY_COMBAT,
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";

it("HUDは権威時刻からチャージ率と発動中を読み、中断や旧状態を区別する", () => {
  const w = createWorld("charged-view");
  addPlayer(w, "p");
  w.phase = "battle";
  w.buddies = createBuddyBattleState(w);
  equipBattleBuddy(w.buddies, w.players[0], "tatara");
  const buddy = w.buddies.entries.p;
  expect(getBuddySkillView(w, "p", true)!.charge).toBeUndefined();
  buddy.chargeStartedAt = 1;
  w.time = 1;
  expect(getBuddySkillView(w, "p", true)!.charge).toBe(0);
  w.time = 1 + BUDDY_COMBAT.chargeThreshold + BUDDY_COMBAT.chargeDuration / 2;
  expect(getBuddySkillView(w, "p", true)!.charge).toBeCloseTo(0.5);
  w.time += BUDDY_COMBAT.chargeDuration;
  expect(getBuddySkillView(w, "p", true)!.charge).toBe(1);
  expect(getBuddySkillView(w, "p", false)!.charge).toBeUndefined();
  buddy.skillPending = true;
  expect(getBuddySkillView(w, "p", true)).toMatchObject({
    charge: undefined,
    casting: true,
  });
  expect(getBuddySkillView(w, "p", false)!.casting).toBe(false);
  buddy.skillPending = false;
  buddy.chargeStartedAt = -1;
  expect(getBuddySkillView(w, "p", true)).toMatchObject({
    charge: undefined,
    casting: false,
  });
  delete buddy.chargeStartedAt;
  delete buddy.skillPending;
  expect(getBuddySkillView(w, "p", true)).toMatchObject({
    charge: undefined,
    casting: false,
  });
});

it("初回表示は旧保存を書き換えず、保証中は未所持だけの実確率を出す", () => {
  const save = freshProgress("normal");
  expect(getBuddyUiState(save).starterChosen).toBe(false);
  expect(save.buddies).toBeUndefined();
  save.buddies = chooseStarterBuddy(freshBuddyProgress(), "yosuga");
  save.buddies.pity = 4;
  const view = getBuddyUiState(save);
  expect(view.recruit.pityThreshold).toBe(4);
  expect(view.recruit.guaranteedNext).toBe(true);
  expect(view.recruit.odds.find((x) => x.id === "yosuga")!.percent).toBe(0);
  expect(view.recruit.odds.find((x) => x.id === "tatara")!.percent).toBeCloseTo(
    100 / 3,
  );
  expect(view.recruit.provisional).toBeUndefined();
  BUDDY_IDS.forEach((id) => {
    save.buddies!.owned[id] = { xp: 0, breakthrough: 0 };
  });
  const complete = getBuddyUiState(save);
  expect(complete.recruit.guaranteedNext).toBe(false);
  expect(complete.recruit.pityCount).toBe(0);
  expect(complete.recruit.odds.map((x) => x.percent)).toEqual([25, 25, 25, 25]);
});
it("現在レベル内XPと突破費用を実育成データから計算する", () => {
  const save = freshProgress("normal");
  save.buddies = chooseStarterBuddy(freshBuddyProgress(), "yosuga");
  save.buddies.owned.yosuga!.xp = 30;
  const growing = getBuddyUiState(save).owned.yosuga!;
  expect(growing.level).toBe(2);
  expect(growing.xpIntoLevel).toBe(10);
  expect(growing.xpForNext).toBe(60);
  save.buddies.owned.yosuga!.xp = buddyXpForLevel(10);
  const capped = getBuddyUiState(save).owned.yosuga!;
  expect(capped.xpForNext).toBeNull();
  expect(capped.nextLevelCap).toBe(20);
  expect(capped.breakthroughCost).toBe(3);
});
it("HUDは実HP・接続・操作可否を反映し、Displayを持続効果と混同しない", () => {
  const w = createWorld("view");
  addPlayer(w, "p");
  w.phase = "battle";
  w.buddies = createBuddyBattleState(w);
  equipBattleBuddy(w.buddies, w.players[0], "yosuga");
  expect(getBuddySkillView(w, "p", true)!.unavailable).toBe("HPが満タンです");
  w.players[0].hp = 80;
  w.buddies.entries.p.healUntil = 5;
  expect(getBuddySkillView(w, "p", true)!.activeRemaining).toBe(5);
  expect(getBuddySkillView(w, "p", false)!.unavailable).toBe("操作できません");
  equipBattleBuddy(w.buddies, w.players[0], "tatara");
  w.buddies.entries.p.displayUntil = 5;
  expect(getBuddySkillView(w, "p", true)!.activeRemaining).toBe(0);
  equipBattleBuddy(w.buddies, w.players[0], "tobari");
  w.buddies.buffs.p = { guardUntil: 6, boostUntil: 0 };
  expect(getBuddySkillView(w, "p", true)!.activeRemaining).toBe(6);
  w.players[0].connected = false;
  expect(getBuddySkillView(w, "p", true)!.unavailable).toBe("接続待ち");
  expect(getBuddySkillView(w, "p", true)!.activeRemaining).toBe(0);
});
it("別モード・別作戦・結果画面ではスキルHUDを出さない", () => {
  const w = createWorld("view");
  addPlayer(w, "p");
  w.phase = "battle";
  w.buddies = createBuddyBattleState(w);
  equipBattleBuddy(w.buddies, w.players[0], "oriha");
  for (const mode of ["front", "defense", "training", "rebuild"]) {
    expect(getBuddySkillView({ ...w, [mode]: {} }, "p", true)).toBeNull();
  }
  expect(getBuddySkillView({ ...w, run: "next" }, "p", true)).toBeNull();
  expect(getBuddySkillView({ ...w, phase: "victory" }, "p", true)).toBeNull();
});
