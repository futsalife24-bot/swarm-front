import { describe, expect, it } from "vitest";
import { addPlayer, createWorld, spawn } from "../src/shared/game";
import { STARTERS } from "../src/shared/defs";
import {
  activateBuddySkill,
  buddyDamageMultiplier,
  buddyEvadeCooldownMultiplier,
  buddyMoveMultiplier,
  createBuddyBattleState,
  equipBattleBuddy,
  tickBuddyCombat,
} from "../src/shared/buddy-combat";
import type { BuddyId } from "../src/shared/buddy-progression";

function setup(ids: BuddyId[] = ["yosuga"]) {
  const w = createWorld("buddy-combat", 71, 1);
  ids.forEach((id, index) => {
    addPlayer(w, `p${index}`, STARTERS);
    Object.assign(w.players[index], { x: index, y: 0, z: 0 });
  });
  w.phase = "battle";
  const state = createBuddyBattleState(w);
  ids.forEach((id, index) => equipBattleBuddy(state, w.players[index], id));
  return { w, state };
}
function advance(f: ReturnType<typeof setup>, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) {
    f.w.time += 0.05;
    tickBuddyCombat(f.w, f.state, {}, 0.05);
  }
}
describe("進撃バディの権威戦闘コア", () => {
  it("ヨスガ4体でも本人だけを5秒で25%回復し、同時発動で回復量が重ならない", () => {
    const f = setup(["yosuga", "yosuga", "yosuga", "yosuga"]);
    f.w.players.forEach((p) => {
      p.hp = 40;
    });
    f.w.players.forEach((p) =>
      expect(activateBuddySkill(f.w, f.state, p.id)).toBe(true),
    );
    expect(f.w.players.map((p) => p.hp)).toEqual([40, 40, 40, 40]);
    advance(f, 2.5);
    f.w.players.forEach((p) => expect(p.hp).toBeCloseTo(60));
    advance(f, 3);
    f.w.players.forEach((p) => expect(p.hp).toBeCloseTo(80));
    expect(activateBuddySkill(f.w, f.state, "p0")).toBe(false);
  });
  it("満タンは消費せず、ダウンを蘇生せず、切断で持続回復を解除する", () => {
    const f = setup();
    expect(activateBuddySkill(f.w, f.state, "p0")).toBe(false);
    expect(f.state.entries.p0.skillReadyAt).toBe(0);
    f.w.players[0].hp = 40;
    activateBuddySkill(f.w, f.state, "p0");
    advance(f, 1);
    f.w.players[0].hp = 0;
    advance(f, 1);
    expect(f.w.players[0].hp).toBe(0);
    f.w.players[0].hp = 40;
    f.w.time = 25;
    tickBuddyCombat(f.w, f.state, {}, 0.05);
    activateBuddySkill(f.w, f.state, "p0");
    f.w.players[0].connected = false;
    advance(f, 0.1);
    f.w.players[0].connected = true;
    advance(f, 1);
    expect(f.w.players[0].hp).toBe(40);
    expect(f.state.entries.p0.skillReadyAt).toBe(50);
  });
  it("支援は5m内の生存味方へ適用し、同じ支援を重ねても倍率を加算しない", () => {
    const f = setup(["tobari", "tobari", "oriha", "yosuga"]);
    f.w.players[3].x = 20;
    ["p0", "p1", "p2"].forEach((id) => activateBuddySkill(f.w, f.state, id));
    expect(buddyDamageMultiplier(f.w, f.state, "p0")).toBe(0.7);
    expect(buddyMoveMultiplier(f.w, f.state, "p0")).toBe(1.2);
    expect(buddyEvadeCooldownMultiplier(f.w, f.state, "p0")).toBe(0.8);
    expect(buddyDamageMultiplier(f.w, f.state, "p3")).toBe(1);
    f.w.time = 6;
    expect(buddyDamageMultiplier(f.w, f.state, "p0")).toBe(1);
    expect(buddyMoveMultiplier(f.w, f.state, "p0")).toBe(1);
  });
  it("通常攻撃は既存の撃破・所有者帰属を通し、攻撃間隔を守る", () => {
    const f = setup(["tatara"]);
    const enemy = spawn(f.w, "hornet", 0, -2)!;
    Object.assign(enemy, { x: 0, y: 0, z: -2, hp: 5 });
    advance(f, 0.05);
    expect(enemy.hp).toBeLessThanOrEqual(0);
    expect(f.w.players[0].kills).toBe(1);
    expect(f.w.totalKills).toBe(1);
    const second = spawn(f.w, "hornet", 0, -2)!;
    Object.assign(second, { x: 0, y: 0, z: -2, hp: 60 });
    advance(f, 0.1);
    expect(second.hp).toBe(60);
    expect(
      f.w.events.some((e) => e.type === "shot" && e.owner === "p0" && e.silent),
    ).toBe(true);
  });
  it("タタラはバディ位置の4m内だけを攻撃し、連続要求では再発動しない", () => {
    const f = setup(["tatara"]);
    const near = spawn(f.w, "hornet", 0, -2)!;
    const far = spawn(f.w, "hornet", 0, -8)!;
    Object.assign(near, { x: 0, y: 0, z: -2, hp: 100 });
    Object.assign(far, { x: 0, y: 0, z: -8, hp: 100 });
    expect(activateBuddySkill(f.w, f.state, "p0")).toBe(true);
    expect(near.hp).toBe(40);
    expect(far.hp).toBe(100);
    expect(activateBuddySkill(f.w, f.state, "p0")).toBe(false);
    expect(near.hp).toBe(40);
  });
  it("押しっぱなしはCD終了後も再発動せず、離して押すと発動する", () => {
    const f = setup(["tobari"]);
    f.w.time = 0.05;
    tickBuddyCombat(f.w, f.state, { p0: { buddySkill: true } }, 0.05);
    const first = f.state.entries.p0.skillReadyAt;
    f.w.time = 26;
    tickBuddyCombat(f.w, f.state, { p0: { buddySkill: true } }, 0.05);
    expect(f.state.entries.p0.skillReadyAt).toBe(first);
    tickBuddyCombat(f.w, f.state, {}, 0.05);
    tickBuddyCombat(f.w, f.state, { p0: { buddySkill: true } }, 0.05);
    expect(f.state.entries.p0.skillReadyAt).toBe(51);
  });
  it("他モード・別run・表示不可位置では戦闘せず、削除された所有者を残さない", () => {
    const f = setup(["tobari"]);
    for (const key of ["front", "rebuild", "defense", "training"] as const) {
      const other = { ...f.w, [key]: {} } as typeof f.w;
      expect(activateBuddySkill(other, f.state, "p0")).toBe(false);
    }
    expect(activateBuddySkill({ ...f.w, run: "another" }, f.state, "p0")).toBe(
      false,
    );
    tickBuddyCombat(
      f.w,
      f.state,
      { p0: { buddySkill: true } },
      0.05,
      () => null,
    );
    expect(f.state.entries.p0.skillReadyAt).toBe(0);
    f.w.players = [];
    tickBuddyCombat(f.w, f.state, {}, 0.05);
    expect(Object.keys(f.state.entries)).toEqual([]);
  });
});
