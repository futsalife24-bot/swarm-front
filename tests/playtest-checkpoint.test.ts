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
import {
  HARROW,
  harrowMissilePosition,
  queueHarrowMissiles,
  stepHarrowMissiles,
  type HarrowAttack,
} from "../src/shared/harrow";
import { enemySize } from "../src/shared/enemy-size";
import { supportHeight } from "../src/shared/terrain";

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

// Encode historical on-disk envelopes without relying on the current writer.
function legacySave(f: ReturnType<typeof fixture>, version: 1 | 2 | 3 = 1) {
  const world = JSON.parse(JSON.stringify(f.world)) as World;
  if (version === 1) delete world.campaignPlan;
  else world.campaignPlan = structuredClone(stageFor(f.world));
  const body = JSON.stringify({
    version,
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
    expect(again.version).toBe(4);
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
      expect(checkpoint.version).toBe(4);
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

  it.each([
    ["Spin", 1.1, false],
    ["Threat", 1, true],
    ["Threat", 2.1, true],
    ["Takeoff", 1.5, true],
    ["Glide", 0.8, true],
    ["Dive", 0.6, true],
    ["Land", 0.7, true],
    ["StaggerFall", 1.1, true],
    [undefined, 0, true],
  ] as const)(
    "migrates published v6 %s checkpoints without a stale impact, position jump or lost progress",
    (kind, age, airborne) => {
      const f = fixture(normalSaveId(25), "medium");
      const w = f.world;
      w.time = 100;
      w.wave = stageFor(w).waves.length;
      w.spawned = troopCount(stageFor(w).waves[w.wave - 1]);
      w.solo!.bossSpawned = 1;
      w.nextSpawn = 1e9;
      w.enemies = [];
      const p = w.players[0];
      Object.assign(p, { x: 0, z: 0, safe: 0 });
      p.y = supportHeight(p.x, p.z, mapFor(w).blocks);
      const e = spawn(w, "harrow", 0, 0)!;
      // Historical v6: size is its stat factor (1), not its old visual scale .65.
      const maxHp = 5200 * stageFor(w).hp;
      Object.assign(e, {
        size: 1,
        hp: maxHp * 0.6,
        maxHp,
        y: p.y + (kind === "Takeoff" ? 29.109375 : airborne ? 17 : 0),
        cool: 0,
        heading: 0.7,
        harrowAirborne: airborne,
        harrowAirDamage: 234,
        harrowSwitchAt: w.time + 1,
        harrow: kind
          ? {
              kind,
              started: w.time - age,
              fired: kind === "Spin" || kind === "Threat",
              yaw: 0,
              from: { x: -5, y: p.y + 34.5, z: -6 },
              to: { x: p.x, y: p.y, z: p.z },
              hitIds: kind === "Spin" ? ["solo"] : undefined,
            }
          : undefined,
      });
      const other = spawn(w, "ant", 60, 60)!;
      other.active = false;
      const missile = {
        id: ++w.serial,
        owner: e.id,
        origin: { x: -2, y: p.y + 35, z: -1 },
        target: { x: p.x + 60, y: p.y, z: p.z + 60 },
        launch: w.time - 2.99,
        impact: w.time + 0.01,
        damage: 22,
        radius: 2.5,
      };
      // A launched missile, a pending warning, and an orphan from a dead owner.
      w.harrowMissiles = [
        missile,
        {
          ...missile,
          id: ++w.serial,
          target: { x: p.x, y: p.y, z: p.z },
          launch: w.time + 1,
          impact: w.time + 4,
        },
        { ...missile, id: ++w.serial, owner: -1 },
      ];
      const before = structuredClone(w);
      const progressBefore = JSON.stringify(f.progress);
      legacySave(f, 2);
      const rawBefore = f.storage.getItem(BATTLE_CHECKPOINT_KEY);
      const checkpoint = readBattleCheckpoint(f.progress, f.storage)!;
      const resumed = checkpoint.world;
      const harrow = resumed.enemies.find((enemy) => enemy.id === e.id)!;
      expect(checkpoint.version).toBe(4);
      expect(resumed.harrowMissiles).toEqual([
        before.harrowMissiles![0],
        before.harrowMissiles![2],
      ]);
      expect([harrow.x, harrow.y, harrow.z]).toEqual([e.x, e.y, e.z]);
      expect([harrow.hp, harrow.maxHp, harrow.harrowAirDamage]).toEqual([
        e.hp,
        e.maxHp,
        e.harrowAirDamage,
      ]);
      expect(enemySize(harrow)).toBe(HARROW.scale);
      expect(resumed.players).toEqual(before.players);
      expect(resumed.enemies.find((enemy) => enemy.id === other.id)).toEqual(
        other,
      );
      for (const key of [
        "time",
        "seed",
        "serial",
        "run",
        "wave",
        "spawned",
        "solo",
        "projectiles",
        "pending",
        "rewards",
        "drops",
        "events",
      ] as const)
        expect(resumed[key]).toEqual(before[key]);
      expect(resumed.campaignPlan).toEqual(stageFor(before));
      expect(JSON.stringify(f.progress)).toBe(progressBefore);
      expect(f.storage.getItem(BATTLE_CHECKPOINT_KEY)).toBe(rawBefore);
      if (kind === "Spin" || kind === "Threat" || !kind) {
        expect(harrow.harrow).toBeUndefined();
        expect(harrow.cool).toBeGreaterThanOrEqual(HARROW.threatWind);
      } else {
        expect(harrow.harrow!.kind).toBe(
          kind === "StaggerFall" ? "StaggerFall" : "Land",
        );
        expect(harrow.harrow!.started).toBe(resumed.time);
        expect(harrow.harrow!.from).toEqual({ x: e.x, y: e.y, z: e.z });
        expect(harrow.harrow!.to).toEqual({ x: e.x, y: p.y, z: e.z });
      }
      // Real ticks with the player beneath the enlarged body: no inherited
      // pending missile, Spin or Dive may deal damage during migration recovery.
      const hp = p.hp;
      const recoveryTicks =
        kind === "Spin"
          ? Math.floor((HARROW.threatWind + HARROW.spinWind) / 0.05) - 2
          : 60;
      for (let tick = 0; tick < recoveryTicks; tick++) {
        step(resumed, { solo: neutral() });
        expect(resumed.players[0].hp).toBe(hp);
        if (tick === 0 && kind === "Takeoff")
          expect(Math.abs(harrow.y - e.y)).toBeLessThan(0.1);
      }
      if (kind === "Spin") {
        // The previous Spin had already resolved this player's contact. It is
        // gone, and only a newly announced Spin may create a fresh hit list.
        expect(harrow.harrow!.kind).toBe("Spin");
        expect(harrow.harrow!.started).toBeGreaterThanOrEqual(
          before.time + HARROW.threatWind - 1e-8,
        );
        expect(harrow.harrow!.hitIds).toBeUndefined();
        const announcedAt = harrow.harrow!.started;
        for (let tick = 0; tick < 10 && resumed.players[0].hp === hp; tick++)
          step(resumed, { solo: neutral() });
        expect(resumed.time - announcedAt).toBeGreaterThanOrEqual(
          HARROW.spinWind,
        );
        expect(resumed.players[0].hp).toBeCloseTo(
          hp - HARROW.spinDamage * stageFor(resumed).damage,
        );
        expect(harrow.harrow!.hitIds).toEqual(["solo"]);
      }
      expect(JSON.stringify(f.progress)).toBe(progressBefore);
      expect(f.storage.getItem(BATTLE_CHECKPOINT_KEY)).toBe(rawBefore);
    },
  );

  it("keeps an already-launched v6 missile's path and old impact damage exactly once", () => {
    const f = fixture(normalSaveId(20));
    const w = f.world;
    w.time = 100;
    w.enemies = [];
    const p = w.players[0];
    Object.assign(p, { x: 0, z: 0, safe: 0 });
    p.y = supportHeight(p.x, p.z, mapFor(w).blocks);
    const e = spawn(w, "harrow", 0, 0)!;
    e.harrow = { kind: "Threat", started: 97, fired: true, yaw: 0 };
    const missile = {
      id: ++w.serial,
      owner: e.id,
      origin: { x: 0, y: p.y + 34.5, z: 0 },
      target: { x: p.x, y: p.y, z: p.z },
      launch: 99,
      impact: 102,
      damage: 22,
      radius: 2.5,
    };
    w.harrowMissiles = [missile];
    legacySave(f, 2);
    const resumed = readBattleCheckpoint(f.progress, f.storage)!.world;
    expect(resumed.harrowMissiles).toEqual([missile]);
    for (const time of [100, 100.5, 101, 102])
      expect(harrowMissilePosition(resumed.harrowMissiles![0], time)).toEqual(
        harrowMissilePosition(missile, time),
      );
    const hp = resumed.players[0].hp;
    resumed.time = 102;
    stepHarrowMissiles(resumed, resumed.players, 0.05);
    expect(resumed.players[0].hp).toBeCloseTo(
      hp - 22 * stageFor(resumed).damage,
    );
    expect(resumed.harrowMissiles).toEqual([]);
    stepHarrowMissiles(resumed, resumed.players, 0.05);
    expect(resumed.players[0].hp).toBeCloseTo(
      hp - 22 * stageFor(resumed).damage,
    );
  });

  it("migrates once, then preserves new HARROW attacks, missiles and earned damage on v4 round trips", () => {
    const f = fixture(normalSaveId(20));
    f.world.enemies = [];
    const e = spawn(f.world, "harrow", 0, 0)!;
    e.maxHp = 5200 * stageFor(f.world).hp;
    e.hp = e.maxHp * 0.4;
    legacySave(f, 2);
    const migrated = readBattleCheckpoint(f.progress, f.storage)!.world;
    const enemy = migrated.enemies[0];
    enemy.harrow = {
      kind: "Threat",
      started: migrated.time,
      fired: false,
      yaw: 0,
    };
    queueHarrowMissiles(migrated, enemy, migrated.players);
    expect(migrated.harrowMissiles).toHaveLength(10);
    expect(migrated.harrowMissiles![0].damage).toBe(HARROW.missileDamage);
    expect(
      migrated.harrowMissiles![0].impact - migrated.harrowMissiles![0].launch,
    ).toBeCloseTo(HARROW.missileFlight);
    expect(writeBattleCheckpoint(migrated, f.progress, f.storage)).toBe(true);
    const reread = readBattleCheckpoint(f.progress, f.storage)!;
    expect(reread.version).toBe(4);
    expect(reread.world).toEqual(JSON.parse(JSON.stringify(migrated)));
    expect(reread.world.enemies[0].hp).toBe(e.hp);
    expect(reread.world.enemies[0].maxHp).toBe(e.maxHp);
  });

  it.each([
    "Spin",
    "Threat",
    "Glide",
    "Dive",
    "StaggerFall",
  ] as HarrowAttack["kind"][])(
    "does not apply legacy recovery to a current v4 %s checkpoint",
    (kind) => {
      const f = fixture(normalSaveId(20));
      f.world.enemies = [];
      const e = spawn(f.world, "harrow", 0, 0)!;
      e.harrow = {
        kind,
        started: f.world.time - 0.3,
        fired: false,
        yaw: 0,
        from: { x: e.x, y: e.y, z: e.z },
        to: { x: 4, y: 0, z: 8 },
        hitIds: ["solo"],
      };
      queueHarrowMissiles(f.world, e, f.world.players);
      writeBattleCheckpoint(f.world, f.progress, f.storage);
      expect(readBattleCheckpoint(f.progress, f.storage)!.world).toEqual(
        JSON.parse(JSON.stringify(f.world)),
      );
    },
  );

  it.each([
    [0.4, false],
    [1.2, false],
    [2, false],
    [2, true],
    [5.9, true],
  ] as const)(
    "retires a v3 Spin saved at %ss (prior hit %s) without heading jumps or immediate damage",
    (age, previouslyHit) => {
      const f = fixture(normalSaveId(25), "medium");
      const w = f.world;
      w.time = 100;
      w.wave = stageFor(w).waves.length;
      w.spawned = troopCount(stageFor(w).waves[w.wave - 1]);
      w.solo!.bossSpawned = 1;
      w.nextSpawn = 1e9;
      w.enemies = [];
      const p = w.players[0];
      Object.assign(p, { x: 0, z: 0, safe: 0 });
      p.y = supportHeight(0, 0, mapFor(w).blocks);
      const e = spawn(w, "harrow", 0, 0)!;
      const oldHeading =
        0.4 + Math.PI * 2 * Math.max(0, Math.min(1, (age - 1.4) / 3.5));
      Object.assign(e, {
        hp: e.maxHp * 0.6,
        y: p.y,
        heading: oldHeading,
        cool: 0,
        wind: Math.max(0, 1.4 - age),
        harrowAirborne: false,
        harrowSwitchAt: w.time + 10,
        harrow: {
          kind: "Spin",
          started: w.time - age,
          yaw: 0.4,
          fired: age >= 1.4,
          hitIds: previouslyHit ? [p.id] : [],
        },
      });
      queueHarrowMissiles(w, e, [p]);
      for (const missile of w.harrowMissiles!) {
        missile.target = { x: 60, y: p.y, z: 60 };
        if (missile.id % 2) missile.launch = w.time - 0.2;
      }
      legacySave(f, 3);
      const raw = f.storage.getItem(BATTLE_CHECKPOINT_KEY);
      const progress = JSON.stringify(f.progress);
      const checkpoint = readBattleCheckpoint(f.progress, f.storage)!;
      const resumed = checkpoint.world;
      const enemy = resumed.enemies[0];
      const expected = JSON.parse(JSON.stringify(w)) as World;
      expected.campaignPlan = structuredClone(stageFor(w));
      delete expected.enemies[0].harrow;
      expected.enemies[0].wind = 0;
      expected.enemies[0].cool = HARROW.threatWind;
      expect(checkpoint.version).toBe(4);
      expect(JSON.parse(JSON.stringify(resumed))).toEqual(expected);
      expect(enemy.heading).toBe(oldHeading);
      const hp = p.hp;
      const safeTicks =
        Math.floor((HARROW.threatWind + HARROW.spinWind) / 0.05) - 2;
      for (let tick = 0; tick < safeTicks; tick++) {
        const heading = enemy.heading!;
        step(resumed, { solo: neutral() });
        expect(resumed.players[0].hp).toBe(hp);
        // Ordinary steering is bounded; no old started/yaw formula can snap it.
        expect(Math.abs(enemy.heading! - heading)).toBeLessThanOrEqual(
          0.65 * 0.05 + 1e-8,
        );
      }
      expect(enemy.harrow?.kind).toBe("Spin");
      expect(enemy.harrow!.started).toBeGreaterThanOrEqual(
        100 + HARROW.threatWind - 1e-8,
      );
      expect(JSON.stringify(f.progress)).toBe(progress);
      expect(f.storage.getItem(BATTLE_CHECKPOINT_KEY)).toBe(raw);
    },
  );

  it.each([
    undefined,
    "Threat",
    "Takeoff",
    "Glide",
    "Dive",
    "Land",
    "StaggerFall",
  ] as const)(
    "preserves every non-Spin v3 state (%s), including pending and flying missiles",
    (kind) => {
      const f = fixture(normalSaveId(20));
      const w = f.world;
      w.time = 100;
      w.enemies = [];
      const e = spawn(w, "harrow", 0, 0)!;
      if (kind)
        e.harrow = {
          kind,
          started: 99.5,
          fired: false,
          yaw: 0.7,
          from: { x: e.x, y: e.y, z: e.z },
          to: { x: 4, y: 0, z: 8 },
        };
      // Preserve pending volleys even when the current attack is not Threat.
      const attack = e.harrow;
      e.harrow = { kind: "Threat", started: 99.5, fired: false, yaw: 0.7 };
      queueHarrowMissiles(w, e, w.players);
      e.harrow = attack;
      w.harrowMissiles![0].launch = 99;
      legacySave(f, 3);
      const expected = JSON.parse(JSON.stringify(w)) as World;
      expected.campaignPlan = structuredClone(stageFor(w));
      expect(readBattleCheckpoint(f.progress, f.storage)!.world).toEqual(
        expected,
      );
    },
  );
});
