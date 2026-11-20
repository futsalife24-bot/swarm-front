import { describe, expect, it } from "vitest";
import { SOLO_STAGE_IDS } from "../src/shared/campaign";
import {
  rarityWeights,
  varianceWeights,
  rollWeapon,
} from "../src/shared/progression";
import { nextStageDropChange } from "../src/shared/drop-progression";
import { STARTERS } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  finish,
  loot,
  start,
} from "../src/shared/game";
import {
  collectRemainingSolo,
  initSolo,
  soloDrop,
} from "../src/shared/solo-progression";
import {
  appendCollected,
  freshProgress,
  grantResult,
  validateProgress,
} from "../src/client/progression-save";

describe("new campaign drop balance", () => {
  it("fixes every stage and difficulty row", () => {
    const rows = SOLO_STAGE_IDS.flatMap((stage) =>
      (["normal", "medium"] as const).map((difficulty) => ({
        stage,
        difficulty,
        rarity: rarityWeights(stage, difficulty).map(
          (weight) => +(weight * 100).toFixed(1),
        ),
        variance: varianceWeights(stage).map(
          (weight) => +(weight * 100).toFixed(2),
        ),
      })),
    );
    expect(rows).toHaveLength(54);
    expect(rows).toMatchSnapshot();
    for (const stage of SOLO_STAGE_IDS) {
      const normal = rarityWeights(stage, "normal");
      const hard = rarityWeights(stage, "medium");
      expect(normal.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
      expect(hard.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
      for (let tier = 1; tier < 5; tier++)
        expect(
          hard.slice(tier).reduce((sum, value) => sum + value, 0),
        ).toBeGreaterThanOrEqual(
          normal.slice(tier).reduce((sum, value) => sum + value, 0) - 1e-9,
        );
    }
    expect(varianceWeights()).toEqual([0.2, 0.1, 0.57, 0.1, 0.03]);
    expect(
      varianceWeights(25).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(1);
  });

  it("starts new weapons at level one and previews the next stage", () => {
    for (const stage of SOLO_STAGE_IDS)
      expect(
        rollWeapon(`test-${stage}`, stage, "normal", false, 0, () => 0.5).level,
      ).toBe(1);
    expect(loot(createWorld("coop", 1, 25)).level).toBe(1);
    expect(nextStageDropChange(12, "normal")).toContain("SSR 8.0%→10.0%");
    expect(nextStageDropChange(20, "normal")).toContain("ST21から");
    expect(nextStageDropChange(20, "normal")).toContain("SSR 24.0%→26.0%");
    expect(nextStageDropChange(21, "normal")).toContain("ST4から");
    expect(nextStageDropChange(27, "normal")).toContain("ST16から");
    expect(nextStageDropChange(26, "normal")).toBeNull();
  });

  it("drops unlimited powder after the third weapon at ST12 and sweeps leftovers", () => {
    const world = createWorld("st12-powder", 1, 12);
    initSolo(world, 12, "normal", false, { hp: 0, aim: 0, move: 0, swap: 0 });
    addPlayer(world, "solo", STARTERS.slice(0, 2));
    start(world);
    world.pending.solo.push(...STARTERS.slice(0, 3));
    for (let index = 0; index < 400; index++)
      soloDrop(world, { x: 0, z: 0 } as Parameters<typeof soloDrop>[1]);
    expect(world.drops.filter((drop) => drop.type === "weapon")).toHaveLength(
      0,
    );
    expect(
      world.drops.filter((drop) => drop.type === "powder").length,
    ).toBeGreaterThan(3);
    finish(world, true);
    collectRemainingSolo(world);
    expect(world.solo?.powderCollected).toBeGreaterThan(3);
    expect(world.rewards.solo).toHaveLength(3);
  });

  it("accepts old checkpoints without a powder counter", () => {
    const world = createWorld("old-counter", 1, 12);
    initSolo(world, 12, "normal", false, { hp: 0, aim: 0, move: 0, swap: 0 });
    addPlayer(world, "solo", STARTERS.slice(0, 2));
    start(world);
    delete (world.solo as Partial<NonNullable<typeof world.solo>>)
      .powderCollected;
    world.drops.push({
      id: "old-powder",
      owner: "solo",
      weapon: STARTERS[0],
      type: "powder",
      x: 0,
      z: 0,
    });
    finish(world, true);
    collectRemainingSolo(world);
    expect(world.solo!.powderCollected).toBe(1);
  });

  it("credits collected powder on victory only and persists recovery pickups", () => {
    const base = freshProgress("normal");
    const input = {
      run: "powder-win",
      stage: 12,
      difficulty: "normal" as const,
      win: true,
      time: 100,
      kills: 100,
      missions: [true, false, false],
      weapons: [],
      collected: 0,
      powderCollected: 2,
    };
    const won = grantResult(base, input, () => 0.5);
    expect(won.powder - base.powder).toBe(16);
    expect(won.result?.powder).toBe(16);
    const swept = appendCollected(won, [], 3);
    expect(swept.powder - base.powder).toBe(19);
    expect(validateProgress(swept).result?.powderCollected).toBe(5);
    const lost = grantResult(
      base,
      { ...input, run: "powder-loss", win: false },
      () => 0.5,
    );
    expect(lost.powder).toBe(base.powder);
    expect(() =>
      grantResult(base, { ...input, powderCollected: 101 }, () => 0.5),
    ).toThrow();
  });
});
