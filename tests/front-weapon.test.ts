import { describe, expect, it } from "vitest";
import {
  FRONT_SURVIVAL_WEAPON_NAME,
  createFrontSurvivalWeapon,
  isFrontSurvivalWeapon,
} from "../src/shared/front-weapon";
import { STARTERS, stats, validBattleWeapon } from "../src/shared/defs";
import { addPlayer, createWorld, neutral, step } from "../src/shared/game";

describe("生存戦専用の支給武器", () => {
  it("既存ライフルの無属性性能を使い、長い識別子でも戦闘用IDが有効", () => {
    const weapon = createFrontSurvivalWeapon("r".repeat(80), "p".repeat(80));
    expect(weapon).toMatchObject({
      kind: "rifle",
      rarity: 0,
      power: 1,
      effect: "none",
    });
    expect(weapon).not.toHaveProperty("level");
    expect(weapon).not.toHaveProperty("mods");
    expect(weapon).not.toHaveProperty("rolls");
    expect(weapon.id.length).toBeLessThanOrEqual(100);
    expect(validBattleWeapon(weapon)).toBe(true);
    expect(isFrontSurvivalWeapon(weapon)).toBe(true);
    expect(isFrontSurvivalWeapon(STARTERS[0])).toBe(false);
    expect(stats(weapon)).toEqual({
      ...stats(STARTERS[0]),
      name: FRONT_SURVIVAL_WEAPON_NAME,
    });
    expect(createFrontSurvivalWeapon("other", "p".repeat(80)).id).not.toBe(
      weapon.id,
    );
    expect(createFrontSurvivalWeapon("r".repeat(80), "other").id).not.toBe(
      weapon.id,
    );
  });

  it("実際に武器1本で切替・射撃・再装填を進める", () => {
    const world = createWorld("front-one-weapon", 1);
    const player = addPlayer(world, "p", [
      createFrontSurvivalWeapon(world.run, "p"),
    ]);
    world.phase = "battle";
    const full = player.ammo[0];

    step(world, { p: { ...neutral(), swap: true, fire: true } });
    expect(player.weapons).toHaveLength(1);
    expect(player.slot).toBe(0);
    expect(player.swapCd).toBe(0);
    expect(player.ammo).toEqual([full - 1]);

    player.ammo[0] = 0;
    step(world, { p: { ...neutral(), swap: true, reload: true } });
    expect(player.slot).toBe(0);
    expect(player.reload).toBeGreaterThan(0);
    for (let n = 0; n < 40; n++) step(world, { p: neutral() });
    expect(player.ammo).toEqual([full]);
  });
});
