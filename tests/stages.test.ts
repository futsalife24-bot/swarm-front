import { it, expect } from "vitest";
import {
  STAGES,
  MAPS,
  mapFor,
  validStage,
  waveCount,
  troopCount,
  troopAt,
} from "../src/shared/stages";
import {
  createWorld,
  addPlayer,
  start,
  spawn,
  loot,
  blocked,
  wallDistance,
  roofHeight,
  move,
  validInput,
  eye,
  type World,
} from "../src/shared/game";
import { validWeapon } from "../src/shared/defs";
import { STARTERS } from "../src/shared/defs";
import { step } from "../src/shared/game";
import { pilot } from "./bot";
import { supportHeight } from "../src/shared/terrain";
import { MIN_PITCH, MAX_PITCH } from "../src/shared/aim";
import { HARROW } from "../src/shared/harrow";

function spinPilotFixture(until: number, evadeCd = 0) {
  const w = createWorld("pilot-boundary", 37, 1);
  addPlayer(w, "p");
  start(w);
  w.enemies = [];
  w.nextSpawn = Number.MAX_SAFE_INTEGER;
  w.time = 12;
  const p = w.players[0];
  p.x = p.z = p.y = 0;
  p.evadeCd = evadeCd;
  const e = spawn(w, "harrow", 0, -10)!;
  e.y = 0;
  e.harrowAirborne = false;
  e.harrow = {
    kind: "Spin",
    started: w.time - HARROW.spinWind + until,
    fired: false,
    yaw: 0,
  };
  return { w, p, e };
}

it("pilot retreats during an early Spin warning without spending the dodge", () => {
  const { w, p, e } = spinPilotFixture(HARROW.spinWind);
  const distance = Math.hypot(p.x - e.x, p.z - e.z);
  const input = pilot(w, "p");
  expect(validInput(input)).toBe(true);
  expect(input.dodge).toBe(false);
  step(w, { p: input });
  expect(Math.hypot(p.x - e.x, p.z - e.z)).toBeGreaterThan(distance);
  expect(p.evadeCd).toBe(0);
});

it("pilot times a ready dodge to survive actual Spin contact without repeat hits", () => {
  const { w, p, e } = spinPilotFixture(0.1);
  const hp = p.hp;
  const first = pilot(w, "p");
  expect(validInput(first)).toBe(true);
  expect(first.dodge).toBe(true);
  step(w, { p: first });
  for (let n = 0; n < 12; n++) {
    const input = pilot(w, "p");
    expect(validInput(input)).toBe(true);
    step(w, { p: input });
    expect(p.hp).toBe(hp);
  }
  expect(e.harrow?.hitIds).toContain("p");
  expect(p.evade).toBe(0);
  expect(pilot(w, "p").dodge).toBe(false);
});

it.each([
  { cooldown: 0.05, starts: true },
  { cooldown: 0.051, starts: false },
])(
  "pilot respects the next-tick dodge cooldown boundary $cooldown",
  ({ cooldown, starts }) => {
    const { w, p } = spinPilotFixture(0.1, cooldown);
    const input = pilot(w, "p");
    expect(validInput(input)).toBe(true);
    expect(input.dodge).toBe(starts);
    step(w, { p: input });
    expect(p.evade > 0).toBe(starts);
  },
);

it.each(["already-contacted", "finished"] as const)(
  "pilot does not spend a dodge on a Spin that is $0",
  (state) => {
    const { w, e } = spinPilotFixture(0.1);
    if (state === "already-contacted") e.harrow!.hitIds = ["p"];
    else e.harrow!.started = w.time - HARROW.spinWind - HARROW.spinTurn - 0.05;
    const input = pilot(w, "p");
    expect(validInput(input)).toBe(true);
    expect(input.dodge).toBe(false);
  },
);

it.each([
  { name: "above", playerY: 0, enemyY: 100, boundary: MAX_PITCH },
  { name: "below", playerY: 100, enemyY: 0, boundary: MIN_PITCH },
])(
  "pilot keeps near-vertical aim $name within the product input limits",
  ({ playerY, enemyY, boundary }) => {
    const { w, p, e } = spinPilotFixture(HARROW.spinWind);
    p.y = playerY;
    e.y = enemyY;
    e.z = -1;
    e.harrow = undefined;
    const rawPitch = Math.atan2(eye(e) - (p.y + 1.5), 1);
    expect(Math.abs(rawPitch)).toBeGreaterThan(Math.abs(boundary));
    const input = pilot(w, "p");
    expect(input.fire).toBe(true);
    expect(validInput(input)).toBe(true);
    expect(input.pitch).toBe(boundary);
  },
);

// ST25の有限な診断。値の代入は元どおりに行い、HP減少だけを記録する。
function observeStage25Damage(w: World) {
  const p = w.players[0];
  let hp = p.hp;
  let count = 0;
  const hits: unknown[] = [];
  Object.defineProperty(p, "hp", {
    enumerable: true,
    configurable: true,
    get: () => hp,
    set: (next: number) => {
      const before = hp;
      hp = next;
      if (next >= before) return;
      count++;
      if (hits.length >= 100) return;
      hits.push({
        time: w.time,
        before,
        after: next,
        player: { x: p.x, y: p.y, z: p.z, evade: p.evade, evadeCd: p.evadeCd },
        source: new Error().stack?.split("\n").slice(1, 7),
        enemies: structuredClone(
          w.enemies.filter(
            (e) =>
              e.hp > 0 &&
              (e.kind === "harrow" || Math.hypot(p.x - e.x, p.z - e.z) < 25),
          ),
        ),
      });
    },
  });
  return () => ({ count, truncated: count > hits.length, hits });
}

it.each(STAGES)(
  "stage $id completes within the time limit using legal endgame gear and ordinary inputs",
  (s) => {
    const w = createWorld(`clear-${s.id}`, 814, s.id);
    const gear = STARTERS.slice(0, 2).map((item) => ({
      ...item,
      power: 1.36,
      rarity: 3 as const,
      effect: "pierce" as const,
      rolls: { power: 1.25, mag: 1.25, reload: 0.8, range: 1.25, rate: 1.25 },
    }));
    expect(gear.every(validWeapon)).toBe(true);
    addPlayer(w, "p", gear);
    start(w);
    const damage = s.id === 25 ? observeStage25Damage(w) : undefined;
    let inputCount = 0;
    for (let n = 0; n < 12001 && w.phase === "battle"; n++) {
      const input = pilot(w, "p");
      expect(validInput(input), `ST${s.id} input at ${w.time}s`).toBe(true);
      inputCount++;
      step(w, { p: input });
    }
    if (damage)
      console.log(
        `ST25_DIAGNOSTICS ${JSON.stringify({ time: w.time, phase: w.phase, kills: w.totalKills, hp: w.players[0].hp, inputCount, damage: damage() })}`,
      );
    console.log(
      `Clear ST${s.id}: ${w.time.toFixed(1)}s / ${w.totalKills} kills / HP ${w.players[0].hp.toFixed(1)}`,
    );
    if (w.phase !== "victory")
      console.log(
        JSON.stringify({
          wave: w.wave,
          spawned: w.spawned,
          nextSpawn: w.nextSpawn,
          waveClearAt: w.waveClearAt,
          player: w.players[0],
          enemies: w.enemies.filter((e) => e.hp > 0),
        }),
      );
    expect(
      w.phase,
      `Stage ${s.id}, time ${w.time}, kills ${w.totalKills}`,
    ).toBe("victory");
    expect(w.totalKills).toBe(
      s.waves.reduce((a, b) => a + waveCount(b), 0) + (w.foundrySpawned ?? 0),
    );
  },
);

it("twenty-five stages increase combat pressure and reward quality within legal weapon bounds", () => {
  const results = STAGES.map((s) => {
    const w = createWorld(`stage-${s.id}`, 951, s.id);
    addPlayer(w, "p");
    start(w);
    w.enemies = [];
    spawn(w, "boss");
    expect(w.enemies[0].maxHp).toBeCloseTo(4200 * s.hp * 2);
    const tiers = [0, 0, 0, 0];
    for (let n = 0; n < 50000; n++) {
      const item = loot(w);
      if (!validWeapon(item))
        throw new Error(`Invalid weapon at stage ${s.id}`);
      tiers[item.rarity]++;
    }
    return {
      stage: s.id,
      tiers: tiers.map((n) => n / 500),
      drop: s.dropRate * 100,
    };
  });
  console.log("Stage rarity percentages", JSON.stringify(results));
  expect(STAGES).toHaveLength(25);
  expect(MAPS).toHaveLength(6);
  expect(STAGES[0].dropRate).toBe(0.04);
  for (let i = 1; i < STAGES.length; i++) {
    expect(STAGES[i].hp).toBeGreaterThan(STAGES[i - 1].hp);
    expect(STAGES[i].damage).toBeGreaterThan(STAGES[i - 1].damage);
    expect(STAGES[i].dropRate).toBeGreaterThanOrEqual(STAGES[i - 1].dropRate);
    expect(results[i].tiers[2] + results[i].tiers[3]).toBeGreaterThan(
      results[i - 1].tiers[2] + results[i - 1].tiers[3] - (i >= 20 ? 2 : 0),
    );
    expect(STAGES[i].lootExponent).toBeLessThanOrEqual(
      STAGES[i - 1].lootExponent,
    );
  }
});

it("maps share collision, roof and ray geometry and keep player/boss entry clear", () => {
  for (const s of STAGES) {
    const w = createWorld("map", 5, s.id),
      blocks = mapFor(w).blocks;
    for (let i = 0; i < 4; i++) {
      const p = addPlayer(w, String(i));
      expect(blocked(p.x, p.z, 0.55, 0, blocks)).toBe(false);
    }
    expect(blocked(0, -70, 4, 0, blocks)).toBe(false);
    for (const b of blocks) {
      expect(blocked(b.x, b.z, 0.55, 0, blocks)).toBe(true);
      expect(roofHeight(b.x, b.z, 0, blocks)).toBeCloseTo(b.h, 9);
      expect(wallDistance(b.x, b.h + 1, b.z, 0, -1, 0, 30, blocks)).toBeCloseTo(
        1,
      );
      const p = {
        x: b.x - b.w / 2 - 1,
        z: b.z,
        y: supportHeight(b.x - b.w / 2 - 1, b.z, blocks),
      };
      const old = p.x;
      move(p, 1, 0, 0.55, blocks);
      expect(p.x).toBeGreaterThanOrEqual(old);
      expect(blocked(p.x, p.z, 0.55, p.y, blocks)).toBe(false);
      expect(p.x).toBeLessThanOrEqual(b.x - b.w / 2 + 1e-9);
    }
  }
  for (const bad of [0, 26, 1.5, "2", null, NaN])
    expect(validStage(bad)).toBe(false);
  expect(mapFor({})).toBe(MAPS[0]);
});

it("exact rosters and boss forms survive all wave transitions without early clears", () => {
  for (const stage of STAGES) {
    const w = createWorld("rosters", 44, stage.id);
    const p = addPlayer(w, "p");
    start(w);
    for (let wi = 0; wi < stage.waves.length; wi++) {
      const wave = stage.waves[wi];
      expect(w.wave).toBe(wi + 1);
      const bosses = w.enemies.filter(
        (e) => (e.kind === "boss" || e.kind === "harrow") && e.hp > 0,
      );
      expect(
        bosses.map((e) =>
          e.kind === "harrow" ? "harrow" : e.segments ? "worm" : "crown",
        ),
      ).toEqual(wave.bosses);
      const observed: Record<string, number> = {};
      const seen = new Set<number>();
      // Eliminate each spawn to isolate progression, not a balance simulation.
      for (let n = 0; n < 4000 && w.spawned < troopCount(wave); n++) {
        for (const e of w.enemies) {
          if (!seen.has(e.id)) {
            observed[e.kind] = (observed[e.kind] ?? 0) + 1;
            seen.add(e.id);
          }
          e.hp = 0;
        }
        p.hp = 160;
        step(w, {});
        expect(w.phase).toBe("battle");
        expect(w.wave).toBe(wi + 1);
      }
      for (const e of w.enemies) {
        if (!seen.has(e.id)) {
          observed[e.kind] = (observed[e.kind] ?? 0) + 1;
          seen.add(e.id);
        }
      }
      expect(w.spawned).toBe(troopCount(wave));
      expect(observed).toEqual({
        ...wave.troops,
        ...Object.fromEntries(
          [
            ...new Set(
              wave.bosses.map((b) => (b === "harrow" ? "harrow" : "boss")),
            ),
          ].map((kind) => [
            kind,
            wave.bosses.filter(
              (b) => (b === "harrow" ? "harrow" : "boss") === kind,
            ).length,
          ]),
        ),
      });
      // One survivor blocks advancement even after the spawn quota is exhausted.
      const survivor = w.enemies.find((e) => e.hp > 0)!;
      survivor.cool = 100;
      for (let n = 0; n < 85; n++) {
        p.hp = 160;
        step(w, {});
      }
      expect(w.phase).toBe("battle");
      expect(w.wave).toBe(wi + 1);
      survivor.hp = 0;
      for (let n = 0; n < 85 && w.wave === wi + 1 && w.phase === "battle"; n++)
        step(w, {});
    }
    expect(w.phase).toBe("victory");
  }
});

it("roster indexing is bounded and preserves each declared species count", () => {
  for (const stage of STAGES)
    for (const wave of stage.waves) {
      const counts: Record<string, number> = {};
      for (let i = 0; i < troopCount(wave); i++) {
        const kind = troopAt(wave, i);
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
      expect(counts).toEqual(wave.troops);
      expect(() => troopAt(wave, troopCount(wave))).toThrow();
    }
});

it.each(STAGES.slice(0, 6))(
  "intro stage $id is completable with starter weapons",
  (s) => {
    const w = createWorld("starter", 814, s.id);
    addPlayer(w, "p");
    start(w);
    for (let n = 0; n < 12001 && w.phase === "battle"; n++)
      step(w, { p: pilot(w, "p") });
    expect(w.phase, `ST${s.id}: ${w.time}s, ${w.totalKills} kills`).toBe(
      "victory",
    );
  },
);
