import { expect, it } from "vitest";
import { foundryLaserWarningLine } from "../src/client/foundry-laser-warning";
import { FOUNDRY_LASER_RANGE } from "../src/shared/foundry-defs";
import type { Block } from "../src/shared/defs";
import {
  addPlayer,
  createWorld,
  neutral,
  start,
  step,
  wallDistance,
  type Projectile,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";

it("warns beyond the stored aim point to a player hit by the live laser", () => {
  const w = createWorld("laser-warning", 11, 1);
  const p = addPlayer(w, "p");
  start(w);
  w.enemies = [];
  const blocks = mapFor(w).blocks;
  const startZ = [-40, -30, -20, -10, 0, 10, 20];
  const startX = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
  const lane = startX
    .flatMap((x) => startZ.map((z) => ({ x, z })))
    .find(({ x, z }) => wallDistance(x, 1.2, z, 0, 0, 1, 16, blocks) >= 16);
  expect(lane).toBeDefined();
  const origin = { x: lane!.x, y: 1.2, z: lane!.z };
  const line = foundryLaserWarningLine(
    origin,
    { x: origin.x, y: 1.2, z: origin.z + 10 },
    blocks,
  );
  expect(line.to.z).toBeGreaterThan(origin.z + 14);
  p.x = origin.x;
  p.z = origin.z + 14;
  const hp = p.hp;
  w.projectiles = [
    {
      id: ++w.serial,
      ...origin,
      dx: 0,
      dy: 0,
      dz: 60,
      gravity: 0,
      life: FOUNDRY_LASER_RANGE / 60,
      owner: "enemy",
      damage: 10,
      rocket: false,
      style: "laser",
    } satisfies Projectile,
  ];
  for (let i = 0; i < 3; i++) step(w, { p: neutral() }, 0.1);
  expect(p.hp).toBeLessThan(hp);
});

it("clips the warning at the first wall, matching laser cover", () => {
  const wall: Block = { x: 0, z: 5, w: 4, d: 2, h: 5 };
  const line = foundryLaserWarningLine(
    { x: 0, y: 1.2, z: 0 },
    { x: 0, y: 1.2, z: 10 },
    [wall],
  );
  expect(line.to.z).toBeCloseTo(4);
  expect(line.length).toBeCloseTo(4);
});

it("clips downward fire at ground and otherwise at the laser lifetime range", () => {
  const descending = foundryLaserWarningLine(
    { x: 0, y: 3, z: 0 },
    { x: 0, y: 1.2, z: 10 },
    [],
  );
  expect(descending.to.y).toBeCloseTo(0);
  expect(descending.to.z).toBeGreaterThan(10);
  const horizontal = foundryLaserWarningLine(
    { x: 0, y: 1.2, z: 0 },
    { x: 0, y: 1.2, z: 300 },
    [],
  );
  expect(horizontal.length).toBe(FOUNDRY_LASER_RANGE);
  expect(horizontal.to.z).toBe(FOUNDRY_LASER_RANGE);
});
