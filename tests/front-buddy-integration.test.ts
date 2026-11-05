import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  hurtPlayer,
  neutral,
  step,
  type Input,
  type World,
} from "../src/shared/game";
import {
  createBuddyBattleState,
  equipBattleBuddy,
} from "../src/shared/buddy-combat";
import type { BuddyId } from "../src/shared/buddy-progression";
import { applyBuddyAction } from "../src/client/buddy-controller";
import { freshProgress, loadProgress } from "../src/client/progression-save";
import { bankRewards } from "../src/client/save";
import {
  loadSharedCoopSave,
  persistSharedCoopSave,
} from "../src/client/shared-armory";

// 実World.step/hurtPlayerと保存経路のロジック統合検証。実UI・実通信の代替ではない。
function setup(buddy?: BuddyId) {
  const world = createWorld("integrated-buddy", 71, 1);
  addPlayer(world, "owner");
  addPlayer(world, "ally");
  world.phase = "battle";
  world.wave = 1;
  world.nextSpawn = 1000000;
  if (buddy) {
    world.buddies = createBuddyBattleState(world);
    equipBattleBuddy(world.buddies, world.players[0], buddy);
  }
  return world;
}
function advance(world: World, seconds: number, input: Partial<Input> = {}) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++)
    step(world, { owner: { ...neutral(), ...input } }, 0.05);
}
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
describe("進撃バディの既存処理への接続", () => {
  it("step入力で自己持続回復し、自然回復と味方の回復を区別できる", () => {
    const world = setup("yosuga"),
      control = setup();
    for (const w of [world, control])
      w.players.forEach((p) => {
        p.hp = 40;
      });
    advance(world, 0.05, { buddySkill: true });
    advance(control, 0.05);
    expect(world.players[0].hp).toBe(40);
    expect(world.buddies!.entries.owner.visible).toBe(true);
    advance(world, 6);
    advance(control, 6);
    expect(control.players[0].hp).toBeGreaterThan(40); // 既存の自然回復
    expect(world.players[0].hp - control.players[0].hp).toBeCloseTo(40);
    expect(world.players[1].hp).toBeCloseTo(control.players[1].hp);
    expect(world.buddies!.entries.owner.skillReadyAt).toBeCloseTo(25.05);
  });
  it("stepで付いた防御支援をhurtPlayerが近くの味方にも適用し、終了後は元へ戻る", () => {
    const world = setup("tobari"),
      control = setup();
    advance(world, 0.05, { buddySkill: true });
    advance(control, 0.05);
    for (let i = 0; i < 2; i++) {
      hurtPlayer(world, world.players[i], 40);
      hurtPlayer(control, control.players[i], 40);
      expect(160 - world.players[i].hp).toBeCloseTo(
        (160 - control.players[i].hp) * 0.7,
      );
    }
    advance(world, 6.1);
    advance(control, 6.1);
    const before = world.players[1].hp,
      baseline = control.players[1].hp;
    hurtPlayer(world, world.players[1], 20);
    hurtPlayer(control, control.players[1], 20);
    expect(before - world.players[1].hp).toBeCloseTo(
      baseline - control.players[1].hp,
    );
  });
  it("移動と回避の本処理が身体強化を使用し、回避速度自体は増やさない", () => {
    const world = setup("oriha"),
      control = setup();
    const start = world.players[0].x;
    advance(world, 0.05, { buddySkill: true, mx: 1 });
    advance(control, 0.05, { mx: 1 });
    expect(world.players[0].x - start).toBeCloseTo(
      (control.players[0].x - start) * 1.2,
    );
    const before = world.players[0].x,
      baseline = control.players[0].x;
    advance(world, 0.05, { dodge: true, mx: 1 });
    advance(control, 0.05, { dodge: true, mx: 1 });
    expect(world.players[0].evadeCd).toBeCloseTo(
      control.players[0].evadeCd * 0.8,
    );
    expect(world.players[0].x - before).toBeCloseTo(
      control.players[0].x - baseline,
    );
  });
  it("切断中は回復を解除し、再接続で重複生成や再使用時間リセットをしない", () => {
    const world = setup("yosuga");
    const owner = world.players[0];
    owner.hp = 40;
    owner.safe = -100;
    advance(world, 0.05, { buddySkill: true });
    advance(world, 1);
    const healed = owner.hp;
    const ready = world.buddies!.entries.owner.skillReadyAt;
    owner.connected = false;
    advance(world, 1, { buddySkill: true });
    expect(world.buddies!.entries.owner.visible).toBe(false);
    expect(world.buddies!.entries.owner.healUntil).toBe(0);
    owner.connected = true;
    advance(world, 1, { buddySkill: true });
    expect(owner.hp).toBeCloseTo(healed);
    expect(Object.keys(world.buddies!.entries)).toEqual(["owner"]);
    expect(world.buddies!.entries.owner.skillReadyAt).toBe(ready);
    expect(world.buddies!.entries.owner.visible).toBe(true);
    world.time = 26;
    advance(world, 0.05, { buddySkill: true });
    expect(world.buddies!.entries.owner.skillReadyAt).toBe(ready);
    advance(world, 0.05);
    advance(world, 0.05, { buddySkill: true });
    expect(world.buddies!.entries.owner.skillReadyAt).toBeCloseTo(51.15);
    world.players = world.players.filter((p) => p.id !== "owner");
    advance(world, 0.05);
    expect(world.buddies!.entries.owner).toBeUndefined();
  });
  it("協力戦果の再受領・設定保存をまたいでも報酬と同行XPは一度だけ", () => {
    const storage = memory();
    applyBuddyAction(
      freshProgress("normal"),
      { kind: "starter", buddyId: "yosuga" },
      { inBattle: false, storage },
    );
    let shared = loadSharedCoopSave(storage);
    const campaign = {
      run: "buddy-coop-clear",
      stage: 21,
      buddyId: "yosuga" as const,
    };
    shared = bankRewards(shared, campaign.run, []);
    persistSharedCoopSave(shared, storage, campaign);
    const once = loadProgress("normal", storage)!;
    expect(once.buddies!.tickets).toBe(2);
    expect(once.buddies!.fragments).toBe(1);
    expect(once.buddies!.owned.yosuga!.xp).toBe(310);
    expect(once.buddies!.clearedStages).toEqual([22]); // 旧保存ID21は3-A。通常ST21は22。
    persistSharedCoopSave(shared, storage, campaign);
    shared.volume = 0.4;
    persistSharedCoopSave(shared, storage);
    expect(loadProgress("normal", storage)!.buddies).toEqual(once.buddies);
  });
  it("協力報酬の保存失敗ではcallerを変えず、成功再試行で一度だけ加算", () => {
    const storage = memory();
    applyBuddyAction(
      freshProgress("normal"),
      { kind: "starter", buddyId: "tatara" },
      { inBattle: false, storage },
    );
    const shared = bankRewards(loadSharedCoopSave(storage), "retry-coop", []);
    const before = structuredClone(shared);
    const unavailable = {
      getItem: storage.getItem,
      setItem() {
        throw Error("quota");
      },
    };
    const campaign = {
      run: "retry-coop",
      stage: 1,
      buddyId: "tatara" as const,
    };
    expect(() =>
      persistSharedCoopSave(shared, unavailable, campaign),
    ).toThrow();
    expect(shared).toEqual(before);
    expect(loadProgress("normal", storage)!.buddies!.tickets).toBe(0);
    persistSharedCoopSave(shared, storage, campaign);
    persistSharedCoopSave(shared, storage, campaign);
    expect(loadProgress("normal", storage)!.buddies!.tickets).toBe(2);
    expect(loadProgress("normal", storage)!.buddies!.owned.tatara!.xp).toBe(
      110,
    );
  });
});
