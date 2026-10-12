import { describe, expect, it } from "vitest";
import { STARTERS } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  finish,
  hurtEnemy,
  loot,
  spawn,
  start,
  step,
  neutral,
} from "../src/shared/game";
import { stageFor } from "../src/shared/stages";
import {
  collectSolo,
  initSolo,
  soloDrop,
} from "../src/shared/solo-progression";

function solo() {
  const world = createWorld("campaign-cap", 1);
  initSolo(world, 1, "normal", false, { hp: 0, aim: 0, move: 0, swap: 0 });
  const player = addPlayer(world, "solo", STARTERS.slice(0, 2));
  start(world);
  return { world, player };
}

describe("campaign weapon limit", () => {
  it("marks co-op campaign loot with the cleared mission stage", () => {
    expect(loot(createWorld("stage-one", 1, 1)).level).toBe(1);
    expect(loot(createWorld("stage-three", 1, 3)).level).toBe(3);
  });

  it("limits new solo weapons to three including picked drops and victory gifts", () => {
    const { world, player } = solo();
    world.pending.solo.push(...STARTERS.slice(0, 2));
    for (let i = 0; i < 1000; i++)
      soloDrop(world, { x: 0, z: 0 } as Parameters<typeof soloDrop>[1]);
    const weapons = world.drops.filter((d) => d.type === "weapon");
    expect(weapons).toHaveLength(1);
    player.x = weapons[0].x;
    player.z = weapons[0].z;
    collectSolo(world, player);
    expect(world.pending.solo).toHaveLength(3);
    for (let i = 0; i < 100; i++)
      soloDrop(world, { x: 0, z: 0 } as Parameters<typeof soloDrop>[1]);
    expect(world.drops.filter((d) => d.type === "weapon")).toHaveLength(0);
    finish(world, true);
    expect(world.rewards.solo).toHaveLength(3);
  });

  it("fills empty slots and preserves older pending collections", () => {
    const fresh = solo().world;
    finish(fresh, true);
    expect(fresh.rewards.solo).toHaveLength(3);
    const older = solo().world;
    older.pending.solo.push(...STARTERS, STARTERS[0], STARTERS[1]);
    const oldIds = older.pending.solo.map((w) => w.id);
    finish(older, true);
    expect(older.rewards.solo.map((w) => w.id)).toEqual(oldIds);
  });

  it("caps newly earned co-op drops and fills only remaining reward slots", () => {
    const world = createWorld("coop-cap", 1);
    const first = addPlayer(world, "first", STARTERS.slice(0, 2));
    addPlayer(world, "second", STARTERS.slice(0, 2));
    start(world);
    world.enemies = [];
    world.campaignPlan = { ...stageFor(world), dropRate: 1 };
    world.pending.first.push(...STARTERS.slice(0, 2));
    for (let i = 0; i < 6; i++) {
      const enemy = spawn(world, "crawler", i * 2, -10)!;
      hurtEnemy(world, enemy, enemy.hp + 1, "first");
    }
    expect(world.drops.filter((d) => d.owner === "first")).toHaveLength(1);
    expect(world.drops.filter((d) => d.owner === "second")).toHaveLength(3);
    first.x = world.drops.find((d) => d.owner === "first")!.x;
    first.z = world.drops.find((d) => d.owner === "first")!.z;
    world.nextSpawn = Infinity;
    step(world, { first: neutral(), second: neutral() });
    expect(world.pending.first).toHaveLength(3);
    finish(world, true);
    expect(world.rewards.first).toHaveLength(3);
    expect(world.rewards.second).toHaveLength(3);
  });

  it("keeps older co-op pending collections intact", () => {
    const world = createWorld("coop-old", 1);
    addPlayer(world, "first", STARTERS.slice(0, 2));
    start(world);
    world.pending.first.push(...STARTERS, STARTERS[0], STARTERS[1]);
    const oldIds = world.pending.first.map((w) => w.id);
    finish(world, true);
    expect(world.rewards.first.map((w) => w.id)).toEqual(oldIds);
  });
});
