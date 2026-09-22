import { expect, it } from "vitest";
import {
  addPlayer,
  createWorld,
  spawn,
  hurtEnemy,
  type World,
} from "../src/shared/game";
import {
  HARROW,
  harrowMissilePosition,
  queueHarrowMissiles,
  stepHarrowMissiles,
  stepHarrow,
  staggerHarrow,
} from "../src/shared/harrow";
import { RAY_MAX_FLIGHT_HEIGHT } from "../src/shared/defs";
import { TRAINING_MAP, stageFor } from "../src/shared/stages";
import { prepareState } from "../src/shared/state-wire";
import { freshProgress } from "../src/client/progression-save";
import { initSolo } from "../src/shared/solo-progression";
import {
  readBattleCheckpoint,
  writeBattleCheckpoint,
} from "../src/client/battle-checkpoint";
import { developerProgress } from "../src/client/developer-mode";
import { SOLO_STAGE_IDS } from "../src/shared/campaign";

function fixture() {
  const w = createWorld("harrow-missiles", 723, 20);
  w.training = true;
  w.phase = "battle";
  w.wave = 1;
  const p = addPlayer(w, "solo");
  p.x = 0;
  p.y = 0;
  p.z = 12;
  p.safe = 0;
  const e = spawn(w, "boss", 0, -12, "harrow")!;
  e.y = 0;
  e.harrow = { kind: "Threat", started: w.time, fired: false, yaw: 0 };
  return { w, p, e };
}

it("launches five missiles from each wing upward toward fixed, preannounced targets", () => {
  const { w, p, e } = fixture();
  queueHarrowMissiles(w, e, [p]);
  const missiles = w.harrowMissiles!;
  expect(missiles).toHaveLength(10);
  expect(missiles.filter((m) => m.origin.x < e.x)).toHaveLength(5);
  expect(missiles.filter((m) => m.origin.x > e.x)).toHaveLength(5);
  expect(new Set(missiles.map((m) => m.id)).size).toBe(10);
  expect(missiles.every((m) => m.launch - w.time >= 2)).toBe(true);
  const targets = structuredClone(missiles.map((m) => m.target));
  p.x = 15;
  p.z = -4;
  w.time += 0.5;
  stepHarrowMissiles(w, [p], 0.5);
  expect(w.harrowMissiles!.map((m) => m.target)).toEqual(targets);
  for (const m of missiles) {
    expect(harrowMissilePosition(m, m.launch)).toEqual(m.origin);
    const rising = harrowMissilePosition(m, m.launch + 0.001);
    expect(rising.y).toBeGreaterThan(m.origin.y);
    expect(
      Math.hypot(rising.x - m.origin.x, rising.z - m.origin.z),
    ).toBeLessThan((rising.y - m.origin.y) * 0.01);
    expect(harrowMissilePosition(m, m.impact)).toEqual(m.target);
  }
});

it("cancels unlaunched missiles when the source dies but preserves launched missiles", () => {
  const { w, p, e } = fixture();
  queueHarrowMissiles(w, e, [p]);
  e.hp = 0;
  w.time = HARROW.markerLead - 0.1;
  stepHarrowMissiles(w, [p], 0.05);
  expect(w.harrowMissiles).toEqual([]);
  e.hp = e.maxHp;
  queueHarrowMissiles(w, e, [p]);
  w.time = w.harrowMissiles![0].launch + 0.1;
  e.hp = 0;
  stepHarrowMissiles(w, [p], 0.05);
  expect(w.harrowMissiles).toHaveLength(10);
});

it("resolves launched impacts after owner death and clears missiles when battle ends", () => {
  const { w, p, e } = fixture();
  queueHarrowMissiles(w, e, [p]);
  const missile = w.harrowMissiles![0];
  w.harrowMissiles = [missile];
  e.hp = 0;
  w.time = missile.impact;
  const hp = p.hp;
  stepHarrowMissiles(w, [p], missile.impact - missile.launch);
  expect(p.hp).toBeLessThan(hp);
  expect(w.harrowMissiles).toEqual([]);
  e.hp = e.maxHp;
  queueHarrowMissiles(w, e, [p]);
  w.phase = "victory";
  stepHarrowMissiles(w, [p], 0.05);
  expect(w.harrowMissiles).toEqual([]);
});

it("a wall blocks explosion damage to a player on its opposite side", () => {
  const { w, p, e } = fixture();
  queueHarrowMissiles(w, e, [p]);
  const missile = w.harrowMissiles![0];
  missile.origin = { x: -1, y: 5, z: 0 };
  missile.target = { x: -1, y: 0.06, z: 0 };
  w.harrowMissiles = [missile];
  p.x = 1;
  p.y = 0;
  p.z = 0;
  const wall = { x: 0, z: 0, w: 0.25, d: 5, h: 10 };
  TRAINING_MAP.blocks.push(wall);
  try {
    w.time = missile.impact;
    const hp = p.hp;
    stepHarrowMissiles(w, [p], missile.impact - missile.launch);
    expect(w.events.some((event) => event.type === "burst")).toBe(true);
    expect(p.hp).toBe(hp);
    expect(w.harrowMissiles).toEqual([]);
  } finally {
    TRAINING_MAP.blocks.splice(TRAINING_MAP.blocks.indexOf(wall), 1);
  }
});

it("checkpoint replay keeps missile timing exact and wire packets preserve every marker", () => {
  const { w, p, e } = fixture();
  const progress = freshProgress("normal");
  initSolo(w, 20, "normal", false, progress.soldiers[0].levels);
  queueHarrowMissiles(w, e, [p]);
  w.time = HARROW.markerLead + 0.3;
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
  expect(writeBattleCheckpoint(w, progress, storage)).toBe(true);
  const resumed = readBattleCheckpoint(progress, storage)!.world;
  expect(resumed.harrowMissiles).toEqual(w.harrowMissiles);
  w.time = resumed.time = w.harrowMissiles![0].impact;
  stepHarrowMissiles(w, w.players, HARROW.missileFlight);
  stepHarrowMissiles(resumed, resumed.players, HARROW.missileFlight);
  expect(resumed.harrowMissiles).toEqual(w.harrowMissiles);
  expect(resumed.players[0].hp).toBe(w.players[0].hp);
  queueHarrowMissiles(w, e, [p]);
  const wire = JSON.parse(
    prepareState(w, 0, { members: [], stage: 20 }).packet(p.id),
  ).world as World;
  expect(wire.harrowMissiles).toHaveLength(10);
  for (const [i, missile] of wire.harrowMissiles!.entries()) {
    const original = w.harrowMissiles![i];
    expect(missile.launch).toBe(original.launch);
    expect(missile.impact).toBe(original.impact);
    expect(missile.owner).toBe(original.owner);
    for (const axis of ["x", "y", "z"] as const)
      expect(
        Math.abs(missile.target[axis] - original.target[axis]),
      ).toBeLessThanOrEqual(0.00501);
  }
});

it("developer sandbox includes every new stage and HARROW encounter", () => {
  const save = developerProgress();
  for (const stage of SOLO_STAGE_IDS)
    for (const difficulty of ["normal", "medium"])
      expect(save.missions[`${stage}:${difficulty}`]).toEqual([
        true,
        true,
        true,
      ]);
  expect(save.encounters.harrow).toBe("solo");
});

it("ordinary damage applies airborne stagger while lethal damage remains a kill", () => {
  const { w, p, e } = fixture();
  e.harrowAirborne = true;
  e.y = HARROW.flightHeight;
  const threshold = e.maxHp * HARROW.staggerFraction;
  hurtEnemy(w, e, threshold / 2, p.id);
  expect(e.harrow?.kind).toBe("Threat");
  hurtEnemy(w, e, threshold / 2, p.id);
  expect(e.harrow?.kind).toBe("StaggerFall");
  expect(e.hp).toBeCloseTo(e.maxHp - threshold);
  const other = spawn(w, "boss", 10, 0, "harrow")!;
  hurtEnemy(w, other, other.hp, p.id);
  expect(other.hp).toBeLessThanOrEqual(0);
  expect(other.harrow?.kind).not.toBe("StaggerFall");
});

it("first spawn is airborne at three RAY maximum flight heights and alternates through landing and takeoff", () => {
  const { w, p, e } = fixture();
  const newcomer = spawn(w, "boss", 10, -10, "harrow")!;
  expect(newcomer.harrowAirborne).toBe(true);
  expect(newcomer.y).toBeCloseTo(RAY_MAX_FLIGHT_HEIGHT * 3);
  e.harrow = undefined;
  e.harrowAirborne = true;
  e.y = HARROW.flightHeight;
  e.harrowSwitchAt = 0;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Land");
  w.time += HARROW.landDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrowAirborne).toBe(false);
  expect(e.y).toBeCloseTo(0);
  w.time = e.harrowSwitchAt!;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Takeoff");
  w.time += HARROW.takeoffDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrowAirborne).toBe(true);
  expect(e.y).toBeCloseTo(HARROW.flightHeight);
});

it("lands for a target directly below, then performs exactly one ground rotation and one hit", () => {
  const { w, p, e } = fixture();
  p.x = e.x;
  p.z = e.z + 1;
  e.harrow = undefined;
  e.harrowAirborne = true;
  e.y = HARROW.flightHeight;
  e.harrowSwitchAt = HARROW.airDuration;
  e.cool = 100;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow).toBeUndefined();
  w.time = 2;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Land");
  w.time += HARROW.landDuration;
  stepHarrow(w, e, p, [p], 0.05);
  e.cool = 0;
  e.heading = 0;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Spin");
  const start = w.time;
  const hp = p.hp;
  w.time = start + HARROW.spinWind + 0.001;
  stepHarrow(w, e, p, [p], 0.05);
  expect(p.hp).toBeCloseTo(hp - HARROW.spinDamage * stageFor(w).damage);
  w.time = start + HARROW.spinWind + HARROW.spinTurn;
  p.safe = 0;
  stepHarrow(w, e, p, [p], HARROW.spinTurn);
  expect(e.heading).toBeCloseTo(Math.PI * 2);
  expect(p.hp).toBeCloseTo(hp - HARROW.spinDamage * stageFor(w).damage);
});

it("airborne ranged attacks choose glide dives near 30 percent and retain the committed dive target", () => {
  const { w, p, e } = fixture();
  let dives = 0;
  for (let i = 0; i < 1000; i++) {
    e.harrow = undefined;
    e.harrowAirborne = true;
    e.y = HARROW.flightHeight;
    e.harrowSwitchAt = 100;
    e.cool = 0;
    e.heading = 0;
    w.harrowMissiles = [];
    stepHarrow(w, e, p, [p], 0.05);
    if (e.harrow?.kind === "Glide") dives++;
  }
  expect(dives).toBeGreaterThan(240);
  expect(dives).toBeLessThan(360);
  const committed = { x: p.x, y: 0, z: p.z };
  e.harrow = {
    kind: "Glide",
    started: w.time,
    fired: false,
    yaw: 0,
    from: { x: e.x, y: e.y, z: e.z },
    to: committed,
  };
  p.x += 12;
  w.time += HARROW.glideDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Dive");
  expect(e.harrow?.to).toEqual(committed);
  w.time += HARROW.diveDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Land");
  expect({ x: e.x, y: e.y, z: e.z }).toEqual(committed);
});

it("airborne accumulated damage triggers StaggerFall, cancels pending missiles and returns to ground", () => {
  const { w, p, e } = fixture();
  e.y = HARROW.flightHeight;
  e.harrowAirborne = true;
  queueHarrowMissiles(w, e, [p]);
  const launched = w.harrowMissiles![0];
  launched.launch = w.time;
  const threshold = e.maxHp * HARROW.staggerFraction;
  staggerHarrow(w, e, threshold - 1);
  expect(e.harrow?.kind).toBe("Threat");
  staggerHarrow(w, e, 1);
  expect(e.harrow?.kind).toBe("StaggerFall");
  expect(w.harrowMissiles).toEqual([launched]);
  w.time += HARROW.staggerFallDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow?.kind).toBe("Land");
  expect(e.harrowAirborne).toBe(false);
  expect(e.y).toBeCloseTo(0);
  w.time += HARROW.landDuration;
  stepHarrow(w, e, p, [p], 0.05);
  expect(e.harrow).toBeUndefined();
  expect(e.harrowAirDamage).toBe(0);
});
