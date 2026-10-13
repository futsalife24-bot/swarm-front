import { expect, it } from "vitest";
import {
  redWarningAfterStart,
  redWarningBeforeLaunch,
  redWarningDuringWind,
} from "../src/client/attack-telegraph";
import { projectileWarningPaths } from "../src/client/projectile-warning";
import type { Enemy } from "../src/shared/game";

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
  for (const kind of ["spitter", "hornet"] as const) {
    enemy.kind = kind;
    const path = projectileWarningPaths(enemy, []);
    expect(path).toHaveLength(1);
    expect(path[0].at(-1)!.z).toBeGreaterThan(20);
  }
});
