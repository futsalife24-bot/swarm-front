import { describe, expect, it } from "vitest";
import {
  createWorld,
  addPlayer,
  start,
  step,
  neutral,
  spawn,
  hurtEnemy,
  type World,
} from "../src/shared/game";
import { initSolo, soloSpawnAndProgress } from "../src/shared/solo-progression";
import { settings } from "../src/shared/progression";
import {
  freshProgress,
  blankLevels,
  grantResult,
} from "../src/client/progression-save";
import {
  stageFor,
  mapFor,
  troopCount,
  STAGES,
  ELEVATED_MAPS,
  MAPS,
} from "../src/shared/stages";
import {
  BRANCH_15,
  campaignNumber,
  normalSaveId,
} from "../src/shared/campaign";
import {
  BATTLE_CHECKPOINT_KEY,
  writeBattleCheckpoint,
  readBattleCheckpoint,
} from "../src/client/battle-checkpoint";

function fixture(stage = 1, difficulty: "normal" | "medium" = "normal") {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const progress = freshProgress("normal"),
    world = createWorld("checkpoint-run", 17, campaignNumber(stage));
  initSolo(world, stage, difficulty, false, blankLevels());
  addPlayer(world, "solo", progress.inventory.slice(0, 2));
  start(world);
  return { storage, progress, world };
}

// Encode the historical v1 on-disk envelope, without relying on the v2 writer.
function legacySave(f: ReturnType<typeof fixture>) {
  const world = JSON.parse(JSON.stringify(f.world)) as World;
  delete world.campaignPlan;
  const body = JSON.stringify({
    version: 1,
    savedAt: 123,
    progress: JSON.stringify(f.progress),
    world,
  });
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++)
    hash = Math.imul(hash ^ body.charCodeAt(i), 16777619);
  f.storage.setItem(
    BATTLE_CHECKPOINT_KEY,
    JSON.stringify({ body, checksum: (hash >>> 0).toString(16) }),
  );
}
function finishRemainingWaves(world: World) {
  // Synthetic roster completion checks wave advancement/reward eligibility only;
  // deleting enemies here is not an actual combat or balance victory test.
  for (let n = 0; n < 8 && world.phase === "battle"; n++) {
    const wave = stageFor(world).waves[world.wave - 1];
    world.enemies = [];
    world.spawned = troopCount(wave);
    world.solo!.bossSpawned = wave.bosses.length;
    step(world, { solo: neutral() });
  }
  expect(world.phase).toBe("victory");
}
describe("battle checkpoint", () => {
  it.each([
    [7, 1, 23],
    [20, 4, 108],
  ])(
    "resumes audit F1 legacy ST%d wave %d after %d troops and the last living enemy",
    (stage, wave, spawned) => {
      const f = fixture(stage);
      f.world.wave = wave;
      f.world.spawned = spawned;
      f.world.enemies = [];
      f.world.solo!.bossSpawned = 0;
      const survivor = spawn(f.world, "ant", 40, 40)!;
      legacySave(f);
      const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
      expect(
        resumed.enemies.find((e) => e.id === survivor.id)?.hp,
      ).toBeGreaterThan(0);
      hurtEnemy(resumed, resumed.enemies[0], resumed.enemies[0].hp + 1, "solo");
      for (
        let i = 0;
        i < 600 && resumed.phase === "battle" && resumed.wave === wave;
        i++
      ) {
        step(resumed, { solo: neutral() });
        // State-controlled audit reproduction, not a full combat victory.
        for (const e of resumed.enemies.filter((e) => e.hp > 0))
          hurtEnemy(resumed, e, e.hp + 1, "solo");
      }
      if (stage === 20) expect(resumed.phase).toBe("victory");
      else expect(resumed.wave).toBeGreaterThan(wave);
    },
  );
  it("restores deterministic combat without advancing elapsed time", () => {
    const f = fixture();
    for (let n = 0; n < 30; n++) step(f.world, { solo: neutral() });
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(true);
    const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
    expect(resumed).toEqual(JSON.parse(JSON.stringify(f.world)));
    for (let n = 0; n < 10; n++) {
      step(f.world, { solo: neutral() });
      step(resumed, { solo: neutral() });
    }
    expect(resumed).toEqual(JSON.parse(JSON.stringify(f.world)));
  });
  it("does not replay a battle against newer progress or duplicate rewards", () => {
    const f = fixture();
    writeBattleCheckpoint(f.world, f.progress, f.storage);
    f.progress.coins++;
    expect(readBattleCheckpoint(f.progress, f.storage)).toBeNull();
    f.progress.receipts.push(f.world.run);
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(false);
  });
  it("preserves corrupt data and refuses to resume it", () => {
    const f = fixture();
    writeBattleCheckpoint(f.world, f.progress, f.storage);
    const raw = f.storage.getItem(BATTLE_CHECKPOINT_KEY)!;
    f.storage.setItem(
      BATTLE_CHECKPOINT_KEY,
      raw.replace("checkpoint-run", "corrupted-run"),
    );
    expect(() => readBattleCheckpoint(f.progress, f.storage)).toThrow();
    expect(f.storage.getItem(BATTLE_CHECKPOINT_KEY)).not.toBeNull();
  });
  it("rejects non-finite combat data and test saves", () => {
    const f = fixture();
    f.world.time = Infinity;
    expect(() =>
      writeBattleCheckpoint(f.world, f.progress, f.storage),
    ).toThrow();
    f.progress.mode = "test";
    expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(false);
  });
  it.each([
    [18, 4, 5, 60, 0],
    [18, 5, 5, 32, 2],
    [20, 3, 4, 46, 3],
    [20, 4, 4, 108, 0],
  ])(
    "resumes legacy ST%d wave %d with all %d waves and advances to victory after synthetic roster completion",
    (stage, wave, total, troops, bosses) => {
      const f = fixture(stage);
      f.world.wave = wave;
      legacySave(f);
      const before = JSON.stringify(f.progress);
      const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
      expect(stageFor(resumed).waves).toHaveLength(total);
      expect(troopCount(stageFor(resumed).waves[wave - 1])).toBe(troops);
      expect(stageFor(resumed).waves[wave - 1].bosses).toHaveLength(bosses);
      expect(stageFor(resumed).map).toBe(2);
      expect(stageFor(resumed).elevated).toBe(true);
      expect(mapFor(resumed)).toBe(ELEVATED_MAPS[2]);
      expect(() => step(resumed, { solo: neutral() })).not.toThrow();
      finishRemainingWaves(resumed);
      expect(JSON.stringify(f.progress)).toBe(before);
      const granted = grantResult(
        f.progress,
        {
          run: resumed.run,
          stage,
          difficulty: "normal",
          win: true,
          time: resumed.time,
          kills: resumed.totalKills,
          missions: [true, false, false],
          weapons: [],
          collected: 0,
        },
        () => 0.5,
      );
      expect(granted.missions[`${stage}:normal`][0]).toBe(true);
      expect(readBattleCheckpoint(granted, f.storage)).toBeNull();
      expect(grantResult(granted, granted.result!, () => 0.5)).toBe(granted);
    },
  );
  it("preserves the legacy 3-A save id, city map and medium modifiers exactly once", () => {
    const f = fixture(21, "medium");
    legacySave(f);
    const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
    expect(resumed.solo!.stage).toBe(21);
    expect(resumed.stage).toBe(3);
    expect(stageFor(resumed).name).toBe("街区奥部の調査");
    expect(stageFor(resumed).map).toBe(0);
    expect(mapFor(resumed)).toBe(ELEVATED_MAPS[0]);
    expect(stageFor(resumed).hp).toBeCloseTo(1.05 * 1.25);
    expect(stageFor(resumed).damage).toBeCloseTo(1.04 * 1.15);
    expect(writeBattleCheckpoint(resumed, f.progress, f.storage)).toBe(true);
    const again = readBattleCheckpoint(f.progress, f.storage)!;
    expect(again.version).toBe(2);
    expect(stageFor(again.world)).toEqual(stageFor(resumed));
  });
  it.each([
    [18, 4, 1434],
    [20, 3, 1786],
  ])(
    "keeps legacy ST%d wave %d timed reinforcements and the %d-second mission target",
    (stage, wave, targetTime) => {
      const f = fixture(stage);
      f.world.wave = wave;
      legacySave(f);
      const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
      const cfg = settings(stage, "normal", resumed.campaignPlan);
      expect(cfg.timeLimit).toBe(targetTime);
      expect(cfg.waveWait).toHaveLength(stage === 18 ? 5 : 4);
      const plan = stageFor(resumed).waves[wave - 1];
      resumed.spawned = troopCount(plan);
      resumed.solo!.bossSpawned = plan.bosses.length;
      resumed.solo!.waveCompleteAt = 0;
      const survivor = spawn(resumed, "ant", 40, 40)!;
      expect(survivor.hp).toBeGreaterThan(0);
      resumed.time = 44.9;
      soloSpawnAndProgress(resumed);
      expect(resumed.wave).toBe(wave);
      resumed.time = 45;
      soloSpawnAndProgress(resumed);
      expect(resumed.wave).toBe(wave + 1);
      expect(resumed.enemies).toContain(survivor);
      expect(survivor.hp).toBeGreaterThan(0);
    },
  );
  it.each([BRANCH_15, normalSaveId(25)])(
    "pins current stage id %d for resume without changing a fresh campaign",
    (id) => {
      const f = fixture(id, "medium"),
        expected = JSON.parse(JSON.stringify(stageFor(f.world)));
      expect(writeBattleCheckpoint(f.world, f.progress, f.storage)).toBe(true);
      const checkpoint = readBattleCheckpoint(f.progress, f.storage)!;
      expect(checkpoint.version).toBe(2);
      expect(stageFor(checkpoint.world)).toEqual(expected);
      expect(checkpoint.world.campaignPlan).not.toBe(f.world.campaignPlan);
      expect(f.world.campaignPlan!.waves).not.toBe(
        STAGES[campaignNumber(id) - 1].waves,
      );
      if (id === BRANCH_15) expect(mapFor(checkpoint.world)).toBe(MAPS[3]);
      finishRemainingWaves(checkpoint.world);
      expect(fixture(id).world.campaignPlan).toBeUndefined();
    },
  );
  it("isolates the pinned plan from later roster changes while fresh games use the new balance", () => {
    const f = fixture(normalSaveId(25), "medium");
    writeBattleCheckpoint(f.world, f.progress, f.storage);
    const original = JSON.parse(JSON.stringify(stageFor(f.world)));
    const live = STAGES[24],
      hp = live.hp,
      interval = live.waves[0].interval;
    try {
      live.hp += 0.4;
      live.waves[0].interval += 0.3;
      const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
      expect(stageFor(resumed)).toEqual(original);
      expect(stageFor(f.world)).toEqual(original);
      const fresh = fixture(normalSaveId(25), "medium").world;
      expect(fresh.campaignPlan).toBeUndefined();
      expect(stageFor(fresh).hp).toBeCloseTo((hp + 0.4) * 1.25);
      expect(stageFor(fresh).waves[0].interval).toBeCloseTo(interval + 0.3);
    } finally {
      live.hp = hp;
      live.waves[0].interval = interval;
    }
  });
});
