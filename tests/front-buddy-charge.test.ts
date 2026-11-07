import { describe, expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  neutral,
  spawn,
  validInput,
} from "../src/shared/game";
import {
  activateBuddySkill,
  BUDDY_COMBAT,
  buddyChargeFraction,
  createBuddyBattleState,
  equipBattleBuddy,
  tickBuddyCombat,
} from "../src/shared/buddy-combat";
import type { BuddyId } from "../src/shared/buddy-progression";

function setup(kind: BuddyId = "tatara") {
  const w = createWorld("charge-test", 71, 1);
  addPlayer(w, "owner");
  Object.assign(w.players[0], { x: 0, y: 0, z: 0, hp: 40 });
  w.phase = "battle";
  const state = createBuddyBattleState(w);
  equipBattleBuddy(state, w.players[0], kind);
  const b = state.entries.owner;
  b.attackReadyAt = 1e9;
  const tick = (
    input: { buddyCharge?: boolean; buddySkill?: boolean } = {},
    seconds = 0.05,
  ) => {
    for (let i = 0; i < Math.round(seconds / 0.05); i++) {
      w.time += 0.05;
      tickBuddyCombat(w, state, { owner: input }, 0.05, () => ({
        x: w.players[0].x,
        y: 0,
        z: w.players[0].z,
      }));
    }
  };
  return { w, state, b, tick };
}
describe("バディの短押し・チャージ・発動モーション", () => {
  it("短押しはその場の着地まで無害で、着地時に一度だけ既存威力を適用する", () => {
    const f = setup();
    const enemy = spawn(f.w, "hornet", 0, -2)!;
    Object.assign(enemy, { x: 0, y: 0, z: -2, hp: 1000 });
    f.tick({ buddySkill: true });
    expect(f.b.skillCharge).toBe(0);
    expect(f.b.lastSkillAt).toBe(-1);
    f.w.players[0].x = 20;
    f.tick({}, 0.6);
    expect(f.b.x).toBe(0);
    expect(enemy.hp).toBe(1000);
    f.tick();
    expect(enemy.hp).toBe(940);
    expect(f.w.events.filter((e) => e.buddyEffect === "fire")).toHaveLength(1);
    f.tick({}, 0.2);
    expect(enemy.hp).toBe(940);
    f.tick({}, 0.1);
    expect(f.b.x).toBe(20);
  });
  it("長押し中は発動せず、満チャージを離すと威力1.5倍・範囲1.25倍", () => {
    const f = setup();
    const enemy = spawn(f.w, "hornet", 0, -4.5)!;
    Object.assign(enemy, { x: 0, y: 0, z: -4.5, hp: 1000 });
    f.tick({ buddyCharge: true }, 2);
    expect(f.b.skillReadyAt).toBe(0);
    expect(enemy.hp).toBe(1000);
    f.tick({ buddySkill: true });
    expect(f.b.skillCharge).toBe(1);
    f.tick({}, 0.65);
    expect(enemy.hp).toBe(910);
    expect(f.w.events.find((e) => e.buddyEffect === "fire")?.radius).toBe(5);
    expect(f.b.skillReadyAt).toBeCloseTo(22.05);
  });
  it("中断は解除要求だけでは発動せず、再押下の短押しへチャージを持ち越さない", () => {
    const f = setup();
    f.tick({ buddyCharge: true }, 1);
    f.tick();
    expect(f.b.chargeStartedAt).toBe(-1);
    expect(f.b.skillPending).toBe(false);
    expect(f.b.skillReadyAt).toBe(0);
    f.tick({ buddySkill: true });
    expect(f.b.skillCharge).toBe(0);
  });
  it.each(["tatara", "yosuga", "tobari", "oriha"] as BuddyId[])(
    "%s: 発動前ダウン・切断で遅延効果を残さない",
    (kind) => {
      for (const disconnect of [false, true]) {
        const f = setup(kind);
        f.tick({ buddyCharge: true }, 2);
        f.tick({ buddySkill: true });
        const ready = f.b.skillReadyAt;
        if (disconnect) f.w.players[0].connected = false;
        else f.w.players[0].hp = 0;
        f.tick({}, 1);
        expect(f.b.skillPending).toBe(false);
        expect(f.b.lastSkillAt).toBe(-1);
        f.w.players[0].connected = true;
        f.w.players[0].hp = 40;
        f.tick({}, 1);
        expect(f.b.skillReadyAt).toBe(ready);
        expect(f.b.lastSkillAt).toBe(-1);
      }
    },
  );
  it("支援倍率は維持してチャージで持続時間を延ばし、ヨスガは本人の総回復量を増す", () => {
    for (const kind of ["yosuga", "tobari", "oriha"] as BuddyId[]) {
      const f = setup(kind);
      f.tick({ buddyCharge: true }, 2);
      f.tick({ buddySkill: true });
      expect(f.b.lastSkillAt).toBe(-1);
      f.tick({}, 0.35);
      if (kind === "yosuga") {
        expect(f.b.healRate).toBeCloseTo(12);
        f.tick({}, 5);
        expect(f.w.players[0].hp).toBeCloseTo(100);
      } else {
        const buff = f.state.buffs.owner;
        expect(
          (kind === "tobari" ? buff.guardUntil : buff.boostUntil) - f.w.time,
        ).toBeCloseTo(9);
      }
    }
  });
  it("再接続スナップショットの追加フィールド欠損は通常短押しとして扱い、過剰値を制限", () => {
    const f = setup();
    delete f.b.skillStartedAt;
    delete f.b.skillImpactAt;
    delete f.b.skillPending;
    delete f.b.chargeStartedAt;
    delete f.b.skillCharge;
    expect(activateBuddySkill(f.w, f.state, "owner")).toBe(true);
    expect(f.b.skillCharge).toBe(0);
    f.tick({}, 0.65);
    expect(f.b.lastSkillAt).toBeCloseTo(0.65);
    expect(buddyChargeFraction(0.1)).toBe(0);
    expect(buddyChargeFraction(1e6)).toBe(1);
    expect(buddyChargeFraction(NaN)).toBe(0);
    expect(validInput({ ...neutral(), buddyCharge: true })).toBe(true);
    expect(validInput({ ...neutral(), buddyCharge: "yes" })).toBe(false);
  });
});
