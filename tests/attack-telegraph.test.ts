import { expect, it } from "vitest";
import {
  redWarningAfterStart,
  redWarningBeforeLaunch,
  redWarningDuringWind,
} from "../src/client/attack-telegraph";
import { projectileWarningPaths } from "../src/client/projectile-warning";
import {
  addPlayer,
  createWorld,
  neutral,
  spawn,
  start,
  step,
  type Enemy,
} from "../src/shared/game";
import { mapFor } from "../src/shared/stages";

it("keeps a real preparation interval before the red area and removes it at impact", () => {
  expect(redWarningDuringWind(0.8, 0.8)).toBe(false);
  expect(redWarningDuringWind(0.401, 0.8)).toBe(false);
  expect(redWarningDuringWind(0.4, 0.8)).toBe(true);
  expect(redWarningDuringWind(0, 0.8)).toBe(false);
  expect(redWarningAfterStart(0.39, 0.8)).toBe(false);
  expect(redWarningAfterStart(0.4, 0.8)).toBe(true);
  expect(redWarningAfterStart(0.8, 0.8)).toBe(false);
  expect(redWarningBeforeLaunch(1.59, 2, 0.8)).toBe(false);
  expect(redWarningBeforeLaunch(1.6, 2, 0.8)).toBe(true);
});

it("keeps a roof-grazing VOLLEY warning on the authoritative wall impact", () => {
  const w = createWorld("warning-grazing-wall", 11, 1);
  const p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.x = 34;
  p.z = -20;
  spawn(w, "ant", 34, -20);
  const e = w.enemies[0];
  e.x = 34;
  e.z = -20;
  e.y = 0;
  e.size = 1;
  e.active = true;
  e.wind = 0.01;
  e.tx = 34;
  e.ty = 7;
  e.tz = 20;
  const paths = projectileWarningPaths(e, mapFor(w).blocks);
  expect(
    paths.reduce((sum, path) => sum + path.length - 1, 0),
  ).toBeLessThanOrEqual(120);
  const warned = paths[1].at(-1)!;
  step(w, { p: neutral() });
  const round = w.projectiles[1];
  expect(round).toBeDefined();
  let ticks = 0;
  for (; ticks < 80 && w.projectiles.includes(round); ticks++)
    step(w, { p: neutral() });
  expect(ticks).toBeLessThan(78);
  expect(round.y).toBeGreaterThan(0);
  expect(round.z).toBeGreaterThan(5);
  expect(warned.z).toBeGreaterThan(5);
  expect(
    Math.hypot(warned.x - round.x, warned.y - round.y, warned.z - round.z),
  ).toBeLessThan(1e-5);
});

it("keeps an unobstructed VOLLEY warning through the authoritative lifetime tick", () => {
  const w = createWorld("warning-lifetime", 11, 1);
  const p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.x = 0;
  p.z = 0;
  spawn(w, "ant", 0, 0);
  const e = w.enemies[0];
  e.x = 0;
  e.z = 0;
  e.y = 0;
  e.size = 1;
  e.active = true;
  e.wind = 0.01;
  e.tx = 0;
  e.ty = 100;
  e.tz = 20;
  const paths = projectileWarningPaths(e, mapFor(w).blocks);
  expect(
    paths.reduce((sum, path) => sum + path.length - 1, 0),
  ).toBeLessThanOrEqual(123);
  const warned = paths[1].at(-1)!;
  step(w, { p: neutral() });
  const round = w.projectiles[1];
  expect(round).toBeDefined();
  let ticks = 0;
  for (; ticks < 81 && w.projectiles.includes(round); ticks++)
    step(w, { p: neutral() });
  expect(ticks).toBe(80);
  expect(round.z).toBeGreaterThan(52);
  expect(
    Math.hypot(warned.x - round.x, warned.y - round.y, warned.z - round.z),
  ).toBeLessThan(1e-5);
});

it("tracks all three VOLLEY rounds and PRISM/RAY danger beyond the aim point", () => {
  const enemy = {
    id: 1,
    kind: "ant",
    x: 0,
    y: 0,
    z: 0,
    hp: 10,
    maxHp: 10,
    cool: 0,
    wind: 0.4,
    hurt: 0,
    tx: 0,
    ty: 0,
    tz: 20,
  } as Enemy;
  const volley = projectileWarningPaths(enemy, []);
  expect(volley).toHaveLength(3);
  expect(volley[0].some((p) => p.x < -2 && p.z > 15)).toBe(true);
  expect(volley[2].some((p) => p.x > 2 && p.z > 15)).toBe(true);
  expect(volley[1].some((p) => p.z > 20)).toBe(true);
  enemy.ty = 100;
  const fullLength = projectileWarningPaths(enemy, []);
  expect(fullLength.reduce((sum, path) => sum + path.length - 1, 0)).toBe(123);
  enemy.ty = 0;
  for (const kind of ["spitter", "hornet"] as const) {
    enemy.kind = kind;
    const path = projectileWarningPaths(enemy, []);
    expect(path).toHaveLength(1);
    expect(path[0].at(-1)!.z).toBeGreaterThan(20);
  }
});
