import { describe, expect, it } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
  spawn,
  hurtEnemy,
} from "../src/shared/game";
import { initSolo } from "../src/shared/solo-progression";
import {
  initDailyDefense,
  defenseTarget,
  finishDefenseTick,
  defenseBonus,
} from "../src/shared/daily-defense";
import {
  beginDefense,
  collectDefense,
  settleDefense,
} from "../src/shared/daily-rewards";
import {
  freshProgress,
  blankLevels,
  validateProgress,
} from "../src/client/progression-save";
import { rollWeapon } from "../src/shared/progression";
function battle() {
  const w = createWorld("daily-test-run-0001", 12);
  initSolo(w, 1, "normal", false, blankLevels());
  addPlayer(w, "solo");
  initDailyDefense(w, "2026-09-17");
  start(w);
  return w;
}
describe("daily defense", () => {
  it("keeps soldiers outside the authored vault footprint, including a centered spawn", () => {
    for (const [x, z] of [
      [0, 0],
      [1, 1],
      [-1, -1],
    ]) {
      const w = battle();
      Object.assign(w.players[0], { x, z });
      step(w, { solo: neutral() });
      expect(Math.hypot(w.players[0].x, w.players[0].z)).toBeGreaterThanOrEqual(
        1.949,
      );
    }
  });
  it("changes attention per enemy and returns to the armory outside its leash", () => {
    const w = battle();
    const a = spawn(w, "crawler", 20, 0)!,
      b = spawn(w, "crawler", -20, 0)!;
    expect(defenseTarget(w, a, w.players)).toBe(w.defense!.armory);
    hurtEnemy(w, a, 1, "solo");
    expect(defenseTarget(w, a, w.players)).toBe(w.players[0]);
    expect(defenseTarget(w, b, w.players)).toBe(w.defense!.armory);
    w.players[0].z = 30;
    expect(defenseTarget(w, a, w.players)).toBe(w.defense!.armory);
  });
  it("lets real enemy attacks damage the armory despite soldier invulnerability", () => {
    const w = battle();
    w.players[0].z = 35;
    w.solo!.invincible = 100;
    const enemy = spawn(w, "spider", 1.9, 0)!;
    enemy.cool = 0;
    for (let n = 0; n < 100; n++) step(w, { solo: neutral() });
    expect(w.defense!.armory.hp).toBeLessThan(w.defense!.maxHp);
    expect(w.players[0].hp).toBe(160);
  });
  it("wins on the time limit without cleanup but loses ties if either defender dies", () => {
    for (const defeated of ["none", "soldier", "armory"]) {
      const w = battle();
      spawn(w, "crawler", 20, 20);
      w.time = 180;
      if (defeated === "soldier") w.players[0].hp = 0;
      if (defeated === "armory") w.defense!.armory.hp = 0;
      finishDefenseTick(w);
      expect(w.phase).toBe(defeated === "none" ? "victory" : "defeat");
      expect(w.enemies.length).toBeGreaterThan(0);
    }
  });
  it("uses exact bonus boundaries", () => {
    expect(
      [0, 1, 199, 200, 399, 400, 599, 600, 799, 800, 1000].map((hp) =>
        defenseBonus(hp, 1000),
      ),
    ).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it("banks a guarantee at admission and permanently retains collected drops on defeat", () => {
    const original = freshProgress("normal"),
      run = "daily-rewards-0001";
    let s = beginDefense(original, "2026-09-17", run, () => 0.1);
    expect(s.inventory.length).toBe(original.inventory.length + 1);
    expect(beginDefense(s, "2026-09-17", run, () => 0.1)).toBe(s);
    expect(() =>
      beginDefense(s, "2026-09-17", "daily-rewards-0002", () => 0.1),
    ).toThrow();
    const drop = rollWeapon(
      run + "-drop-1",
      1,
      "normal",
      false,
      s.serial,
      () => 0.1,
    );
    s = collectDefense(s, run, [drop, drop]);
    expect(s.inventory.length).toBe(original.inventory.length + 2);
    s = settleDefense(s, run, "defeat", 0, 2000, () => 0.1);
    expect(s.powder).toBe(5);
    expect(s.inventory.length).toBe(original.inventory.length + 2);
    expect(settleDefense(s, run, "defeat", 0, 2000, () => 0.1)).toBe(s);
    expect(s.points).toBe(original.points);
    expect(s.materials).toBe(original.materials);
    validateProgress(s);
  });
  it("banks victory bonuses once and gives no interruption bonus", () => {
    const s = beginDefense(
      freshProgress("normal"),
      "2026-09-17",
      "daily-rewards-0001",
      () => 0.1,
    );
    const win = settleDefense(
      s,
      s.dailyDefense!.run,
      "victory",
      1800,
      2000,
      () => 0.1,
    );
    expect(win.inventory.length).toBe(s.inventory.length + 5);
    expect(
      settleDefense(win, s.dailyDefense!.run, "victory", 2000, 2000, () => 0.1),
    ).toBe(win);
    const lost = settleDefense(
      s,
      s.dailyDefense!.run,
      "interrupted",
      0,
      2000,
      () => 0.1,
    );
    expect(lost.powder).toBe(0);
    expect(lost.inventory).toEqual(s.inventory);
  });
});
