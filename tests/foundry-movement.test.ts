import {
  enemySize,
  enemyStatSize,
  enemySpeedFactor,
} from "../src/shared/enemy-size";
import { supportHeight } from "../src/shared/terrain";
import { expect, it } from "vitest";
import {
  addPlayer,
  blocked,
  createWorld,
  hurtEnemy,
  neutral,
  spawn,
  start,
  step,
} from "../src/shared/game";
import { MAPS, ELEVATED_MAPS, STAGES, mapFor } from "../src/shared/stages";
import {
  moveWorm,
  placeWormOnGround,
  wormChains,
  wormNodes,
  wormSpeed,
} from "../src/shared/worm";
import {
  FOUNDRY_LASER_RANGE,
  FOUNDRY_LASER_SPEED,
  foundryLaserOrigin,
} from "../src/shared/foundry-defs";
import {
  foundryDistance,
  foundryGroundClear,
  foundryPatrol,
  foundrySafePoint,
  foundryPath,
  foundryGroundLine,
} from "../src/shared/foundry-navigation";

it.each([MAPS[3], ELEVATED_MAPS[3], MAPS[4], ELEVATED_MAPS[4]])(
  "$name rock-edge goals project to reachable segmented-body clearance",
  (map) => {
    for (const b of map.blocks) {
      const side = b.x < 0 ? 1 : -1;
      const target = { x: b.x + side * (b.w / 2 + 1), z: b.z };
      const start = { x: b.x + side * (b.w / 2 + 12), z: b.z };
      expect(foundryGroundClear(map, target)).toBe(false);
      const goal = foundrySafePoint(map, target),
        path = foundryPath(map, start, target);
      expect(foundryGroundClear(map, goal)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
      let previous = start;
      for (const point of path) {
        expect(foundryGroundLine(map, previous, point)).toBe(true);
        previous = point;
      }
      expect(foundryDistance(previous, goal)).toBeLessThan(0.001);
    }
  },
);

it.each([3, 4])(
  "segmented enemy keeps pursuing a player beside map %i rock",
  (index) => {
    const { w, p, e } = field(index),
      map = mapFor(w),
      b = map.blocks[0],
      side = b.x < 0 ? 1 : -1;
    p.x = b.x + side * (b.w / 2 + 1);
    p.z = b.z;
    p.y = supportHeight(p.x, p.z, map.blocks);
    e.x = b.x + side * (b.w / 2 + 12);
    e.z = b.z;
    placeWormOnGround(w, e);
    e.fractured = true;
    const start = { x: e.x, z: e.z },
      before = foundryDistance(e, p);
    for (let i = 0; i < 200; i++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
    }
    expect(foundryDistance(start, e)).toBeGreaterThan(1);
    expect(foundryDistance(e, p)).toBeLessThan(before - 1);
    expect(wormNodes(e).every((n) => foundryGroundClear(map, n))).toBe(true);
  },
);

function field(map = 0) {
  const stage = STAGES.find((s) => s.map === map)!.id;
  const w = createWorld("foundry-movement", 11, stage),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  spawn(w, "boss", 0, 0, "worm");
  const e = w.enemies[0];
  placeWormOnGround(w, e);
  return { w, p, e };
}

it.each([7, 13])(
  "audit P2: actual severing keeps pursuing the rock-edge soldier in stage %i",
  (stage) => {
    const w = createWorld("audit-worm", 11, stage),
      p = addPlayer(w, "p");
    start(w);
    w.enemies = [];
    w.nextSpawn = 1e9;
    const map = mapFor(w),
      b = map.blocks[0];
    p.x = b.x + b.w / 2 + 1;
    p.z = b.z;
    p.y = supportHeight(p.x, p.z, map.blocks);
    spawn(w, "boss", 0, -35, "worm");
    const e = w.enemies[0];
    placeWormOnGround(w, e);
    hurtEnemy(w, e, 1e6, p.id, 4);
    expect(e.fractured).toBe(true);
    const before = { x: e.x, z: e.z };
    for (let n = 0; n < 200; n++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
    }
    expect(foundryDistance(before, e)).toBeGreaterThan(5);
    expect(wormNodes(e).every((n) => foundryGroundClear(map, n))).toBe(true);
  },
);

it("initial roaming and cuts do not fold a connected chain back onto itself", () => {
  const { w, p, e } = field(3);
  p.x = p.z = 70;
  let adjacent = Infinity,
    separate = Infinity,
    record: unknown;
  for (let tick = 0; tick < 241; tick++) {
    if (tick === 160) hurtEnemy(w, e, 1e6, p.id, 0);
    if (tick === 161) hurtEnemy(w, e, 1e6, p.id, 4);
    w.time += 0.05;
    moveWorm(w, e, 0.05);
    w.projectiles = [];
    const nodes = wormNodes(e);
    for (const chain of wormChains(e))
      for (let a = 0; a < chain.length; a++)
        for (let b = a + 1; b < chain.length; b++) {
          const distance = foundryDistance(nodes[chain[a]], nodes[chain[b]]);
          if (b === a + 1 && distance < adjacent) {
            adjacent = distance;
            record = {
              tick,
              a: chain[a],
              b: chain[b],
              distance,
            };
          } else if (b > a + 1) separate = Math.min(separate, distance);
        }
  }
  expect(adjacent, JSON.stringify(record)).toBeGreaterThan(2.8);
  expect(separate).toBeGreaterThan(4.5);
});

it.each(MAPS.map((map, index) => [index, map.name] as const))(
  "ground patrol stays clear and covers both axes on map %i (%s)",
  (map) => {
    const { w, e } = field(map),
      arena = mapFor(w);
    let minX = e.x,
      maxX = e.x,
      minZ = e.z,
      maxZ = e.z,
      maxPoints = 0;
    for (let tick = 0; tick < 4400; tick++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
      minZ = Math.min(minZ, e.z);
      maxZ = Math.max(maxZ, e.z);
      maxPoints = Math.max(
        maxPoints,
        wormNodes(e).reduce((sum, node) => sum + (node.trail?.length ?? 0), 0),
      );
      if (tick % 5) continue;
      for (const [index, node] of wormNodes(e).entries()) {
        expect(node.y).toBeCloseTo(
          supportHeight(node.x, node.z, arena.blocks),
          6,
        );
        expect(
          blocked(node.x, node.z, index ? 2.6 : 4, node.y, arena.blocks),
          `node ${index} tick ${tick}`,
        ).toBe(false);
        if (!index) continue;
        const previous = wormNodes(e)[index - 1];
        for (let sample = 1; sample < 8; sample++) {
          const f = sample / 8;
          expect(
            blocked(
              node.x + (previous.x - node.x) * f,
              node.z + (previous.z - node.z) * f,
              0.7,
              0,
              arena.blocks,
            ),
            `connector ${index} tick ${tick}`,
          ).toBe(false);
        }
      }
    }
    expect(maxX - minX).toBeGreaterThan(80);
    expect(maxZ - minZ).toBeGreaterThan(80);
    expect(maxPoints).toBeLessThan(100);
    expect(JSON.stringify(e).length).toBeLessThan(10000);
  },
);

it.each(MAPS.map((_, index) => index))(
  "unsafe initial spawn projects all eight units safely on map %i",
  (map) => {
    const { w, e } = field(map);
    e.x = MAPS[map].blocks[0]?.x ?? 90;
    e.z = MAPS[map].blocks[0]?.z ?? 90;
    placeWormOnGround(w, e);
    for (const node of wormNodes(e))
      expect(foundryGroundClear(mapFor(w), node)).toBe(true);
    expect(
      new Set(
        wormNodes(e).map((node) => `${node.x.toFixed(2)},${node.z.toFixed(2)}`),
      ).size,
    ).toBe(8);
  },
);

it("head destruction retains normal speed; body cuts promote chasing leaders without teleporting", () => {
  const { w, p, e } = field(3);
  p.x = 70;
  p.z = 70;
  for (let tick = 0; tick < 160; tick++) {
    w.time += 0.05;
    moveWorm(w, e, 0.05);
    w.projectiles = [];
  }
  hurtEnemy(w, e, 1e6, p.id, 0);
  expect(wormSpeed(e)).toBeCloseTo(4.2 * enemySpeedFactor(e));
  const initial = wormNodes(e).map((node) => ({ x: node.x, z: node.z }));
  w.time += 0.05;
  moveWorm(w, e, 0.05);
  expect(
    Math.hypot(
      e.segments![0].x - initial[1].x,
      e.segments![0].z - initial[1].z,
    ),
  ).toBeLessThanOrEqual(0.211 * enemySpeedFactor(e));
  hurtEnemy(w, e, 1e6, p.id, 4);
  expect(wormSpeed(e)).toBeCloseTo(6.3 * enemySpeedFactor(e));
  const chains = wormChains(e),
    nodes = wormNodes(e),
    before = nodes.map((node) => ({ x: node.x, z: node.z }));
  w.time += 0.05;
  moveWorm(w, e, 0.05);
  expect(chains.map((parts) => parts[0])).toEqual([1, 5]);
  for (const parts of chains) {
    const leader = nodes[parts[0]],
      moved = Math.hypot(
        leader.x - before[parts[0]].x,
        leader.z - before[parts[0]].z,
      );
    expect(moved).toBeCloseTo(6.3 * enemySpeedFactor(e) * 0.05, 5);
    expect(leader.groundGoal).toEqual(foundrySafePoint(mapFor(w), p));
    for (const part of parts)
      expect(
        Math.hypot(
          nodes[part].x - before[part].x,
          nodes[part].z - before[part].z,
        ),
      ).toBeLessThan(0.34 * enemySpeedFactor(e));
  }
  expect(nodes.filter((node) => node.trail).length).toBe(2);
});

it("chase ignores disconnected and defeated players and survives snapshot replay", () => {
  const { w, p, e } = field(5);
  p.x = 0;
  p.z = -70;
  const offline = addPlayer(w, "offline");
  offline.x = e.x;
  offline.z = e.z;
  offline.connected = false;
  const down = addPlayer(w, "down");
  down.x = e.x;
  down.z = e.z;
  down.hp = 0;
  hurtEnemy(w, e, 1e6, p.id, 3);
  for (let i = 0; i < 100; i++) {
    w.time += 0.05;
    moveWorm(w, e, 0.05);
    w.projectiles = [];
  }
  const copy = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 100; i++) {
    w.time += 0.05;
    copy.time += 0.05;
    moveWorm(w, e, 0.05);
    moveWorm(copy, copy.enemies[0], 0.05);
  }
  expect(copy.enemies[0]).toEqual(e);
  expect(copy.projectiles).toEqual(w.projectiles);
  for (const parts of wormChains(e))
    expect(wormNodes(e)[parts[0]].groundGoal).toEqual(
      foundrySafePoint(mapFor(w), p),
    );
});

it("each unit warns then emits a straight 60m/s, 100m laser from its model socket", () => {
  const { w, p, e } = field(3);
  p.x = e.x + 20;
  p.z = e.z + 20;
  for (const node of wormNodes(e)) node.acidAt = w.time + 0.8;
  moveWorm(w, e, 0);
  const target = { x: p.x, y: (p.y ?? 0) + 1.2, z: p.z };
  expect(wormNodes(e).every((node) => node.pulseAim?.x === target.x)).toBe(
    true,
  );
  p.x += 10;
  w.time += 0.79;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(0);
  w.time += 0.01;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(8);
  for (const [part, q] of w.projectiles.entries()) {
    expect(q.style).toBe("laser");
    expect(q.gravity).toBe(0);
    expect(q.damage).toBe(10 * enemyStatSize(e));
    expect(Math.hypot(q.dx, q.dy, q.dz)).toBeCloseTo(FOUNDRY_LASER_SPEED, 9);
    expect(q.life * FOUNDRY_LASER_SPEED).toBeCloseTo(FOUNDRY_LASER_RANGE, 9);
    expect({ x: q.x, y: q.y, z: q.z }).toEqual(
      foundryLaserOrigin(wormNodes(e)[part], part, enemySize(e)),
    );
    const flight =
      Math.hypot(target.x - q.x, target.y - q.y, target.z - q.z) /
      FOUNDRY_LASER_SPEED;
    expect(q.x + q.dx * flight).toBeCloseTo(target.x, 8);
    expect(q.y + q.dy * flight).toBeCloseTo(target.y, 8);
    expect(q.z + q.dz * flight).toBeCloseTo(target.z, 8);
    expect(wormNodes(e)[part].acidAt).toBeCloseTo(
      w.time + 4.8 * Math.max(1, enemyStatSize(e)),
      8,
    );
  }
});

it("laser authority stops at cover before crossing a building", () => {
  const { w, p } = field(),
    block = mapFor(w).blocks[0];
  p.x = block.x + block.w / 2 + 3;
  p.z = block.z;
  const q = {
    id: ++w.serial,
    style: "laser" as const,
    x: block.x - block.w / 2 - 1,
    y: (p.y ?? 0) + 1.2,
    z: block.z,
    dx: 60,
    dy: 0,
    dz: 0,
    life: 100 / 60,
    gravity: 0,
    owner: "enemy",
    damage: 10,
    rocket: false,
  };
  w.projectiles = [q];
  const hp = p.hp;
  step(w, { p: neutral() }, 0.05);
  expect(w.projectiles.some((projectile) => projectile.id === q.id)).toBe(
    false,
  );
  expect(q.x).toBeCloseTo(block.x - block.w / 2, 6);
  expect(p.hp).toBe(hp);
});

it("entering muzzle range immediately before an old fire time still gets a full warning", () => {
  const { w, p, e } = field(3);
  e.segments!.forEach((node) => {
    node.partHp = 0;
  });
  e.partHp = e.hp = 100;
  e.heading = 0;
  e.acidAt = 0.8;
  const origin = foundryLaserOrigin(e, 0, enemySize(e));
  p.x = origin.x;
  p.z = origin.z + 100.1;
  moveWorm(w, e, 0);
  expect(e.pulseAim).toBeUndefined();
  w.time = 0.79;
  p.z = origin.z + 99.9;
  moveWorm(w, e, 0);
  expect(e.pulseAim).toEqual({ x: p.x, y: (p.y ?? 0) + 1.2, z: p.z });
  expect(e.acidAt).toBeCloseTo(1.59, 9);
  w.time = 0.8;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(0);
  w.time = 1.58;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(0);
  w.time = 1.59;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(1);
  expect(e.acidAt).toBeCloseTo(6.39, 9);
  w.projectiles = [];
  w.time = 5.59;
  moveWorm(w, e, 0);
  expect(e.acidAt).toBeCloseTo(6.39, 9);
  w.time = 6.38;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(0);
  w.time = 6.39;
  moveWorm(w, e, 0);
  expect(w.projectiles).toHaveLength(1);
});

it("target eligibility uses the 100m three-dimensional distance from the muzzle", () => {
  const { w, p, e } = field(3);
  e.segments!.forEach((node) => {
    node.partHp = 0;
  });
  e.partHp = e.hp = 100;
  e.heading = Math.PI;
  e.acidAt = 0.8;
  const origin = foundryLaserOrigin(e, 0, enemySize(e));
  p.x = origin.x;
  p.z = origin.z + 100.01;
  // The target is closer than 100m to the root, but outside the muzzle's range.
  expect(Math.hypot(p.x - e.x, p.z - e.z)).toBeLessThan(100);
  moveWorm(w, e, 0);
  expect(e.pulseAim).toBeUndefined();
  w.time = 0.2;
  p.z = origin.z + 99.9;
  moveWorm(w, e, 0);
  expect(e.pulseAim).toBeDefined();
  expect(e.acidAt).toBeCloseTo(1, 9);
});

it.each(MAPS.map((_, index) => index))(
  "all cut chains navigate to a distant player on map %i",
  (map) => {
    const { w, p, e } = field(map),
      arena = mapFor(w);
    const goal = foundryPatrol(arena).sort(
      (a, b) => foundryDistance(e, b) - foundryDistance(e, a),
    )[0];
    p.x = goal.x;
    p.z = goal.z;
    hurtEnemy(w, e, 1e6, p.id, 2);
    hurtEnemy(w, e, 1e6, p.id, 5);
    for (let tick = 0; tick < 3600; tick++) {
      w.time += 0.05;
      moveWorm(w, e, 0.05);
      w.projectiles = [];
      if (tick % 10) continue;
      for (const parts of wormChains(e))
        for (const part of parts) {
          const node = wormNodes(e)[part];
          expect(node.y).toBeCloseTo(
            supportHeight(node.x, node.z, arena.blocks),
            6,
          );
          expect(
            blocked(node.x, node.z, part ? 2.6 : 4, node.y, arena.blocks),
            `map ${map} tick ${tick} part ${part}`,
          ).toBe(false);
        }
    }
    for (const parts of wormChains(e))
      expect(
        foundryDistance(wormNodes(e)[parts[0]], goal),
        `map ${map} leader ${parts[0]}`,
      ).toBeLessThan(0.1);
  },
);

it("three worms keep only bounded leader histories inside the rounded multiplayer snapshot budget", () => {
  const { w, p } = field(3);
  for (let i = 0; i < 2; i++) spawn(w, "boss", i * 9, 0, "worm");
  for (let i = 0; i < 3; i++) addPlayer(w, `extra${i}`);
  for (const e of w.enemies) placeWormOnGround(w, e);
  for (let tick = 0; tick < 1000; tick++) {
    w.time += 0.05;
    for (const e of w.enemies) moveWorm(w, e, 0.05);
    w.projectiles = [];
  }
  for (const e of w.enemies) {
    hurtEnemy(w, e, 1e6, p.id, 2);
    hurtEnemy(w, e, 1e6, p.id, 5);
  }
  for (let tick = 0; tick < 100; tick++) {
    w.time += 0.05;
    for (const e of w.enemies) moveWorm(w, e, 0.05);
    w.projectiles = [];
  }
  const rounded = JSON.stringify(w, (_key, value) =>
    typeof value === "number" ? Math.round(value * 100) / 100 : value,
  );
  expect(new TextEncoder().encode(rounded).length).toBeLessThan(40000);
  const restored = JSON.parse(rounded),
    copied = JSON.parse(rounded);
  for (let tick = 0; tick < 100; tick++) {
    restored.time += 0.05;
    copied.time += 0.05;
    for (const e of restored.enemies) moveWorm(restored, e, 0.05);
    for (const e of copied.enemies) moveWorm(copied, e, 0.05);
  }
  expect(restored).toEqual(copied);
  for (const e of restored.enemies) {
    const leaders = new Set(wormChains(e).map((parts) => parts[0]));
    for (const [part, node] of wormNodes(e).entries())
      expect(Boolean(node.trail)).toBe(leaders.has(part));
  }
});
