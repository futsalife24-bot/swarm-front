import { it, expect, vi } from "vitest";
import * as T from "three";
import { HarrowEffects } from "../src/client/harrow-effects";
import type { HarrowMissile } from "../src/shared/harrow";
import { HARROW } from "../src/shared/harrow";
import type { Enemy } from "../src/shared/game";

it("marks the spin wind-up and the committed dive landing point", () => {
  const view = new HarrowEffects();
  const enemy: Enemy = {
    id: 2,
    kind: "harrow",
    x: 1,
    y: 0,
    z: 2,
    hp: 100,
    maxHp: 100,
    cool: 0,
    wind: 0,
    hurt: 0,
    tx: 0,
    tz: 0,
    harrow: { kind: "Spin", started: 0, fired: false, yaw: 0 },
  };
  const warnings = view.root.children[3] as T.InstancedMesh;
  const matrix = new T.Matrix4();
  try {
    view.update({ time: 0.1, enemies: [enemy] });
    expect(warnings.count).toBe(1);
    warnings.getMatrixAt(0, matrix);
    expect(matrix.elements[0]).toBeCloseTo(HARROW.spinRadius);
    view.update({ time: HARROW.spinWind + 0.1, enemies: [enemy] });
    expect(warnings.count).toBe(0);
    enemy.harrow = {
      kind: "Glide",
      started: 1,
      fired: false,
      yaw: 0,
      to: { x: 7, y: 3, z: 9 },
    };
    view.update({ time: 1.1, enemies: [enemy] });
    expect(warnings.count).toBe(1);
    warnings.getMatrixAt(0, matrix);
    expect(matrix.elements.slice(12, 15)).toEqual([7, expect.closeTo(3.06), 9]);
    enemy.harrow.kind = "Land";
    view.update({ time: 2, enemies: [enemy] });
    expect(warnings.count).toBe(0);
  } finally {
    view.dispose();
  }
});

const missile: HarrowMissile = {
  id: 1,
  owner: 1,
  origin: { x: 0, y: 5, z: 0 },
  target: { x: 4, y: 3, z: -10 },
  launch: 2,
  impact: 5,
  damage: 22,
  radius: 2.5,
};
it("shows target rings before launch, missiles after launch and removes both at impact", () => {
  const view = new HarrowEffects();
  const meshes = view.root.children as T.InstancedMesh[];
  const matrix = new T.Matrix4();
  try {
    view.update({ time: 1, harrowMissiles: [missile] });
    expect(meshes.map((m) => m.count)).toEqual([1, 0, 0, 0]);
    meshes[0].getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(3.06);
    view.update({ time: 2.01, harrowMissiles: [missile] });
    expect(meshes.map((m) => m.count)).toEqual([1, 1, 1, 0]);
    meshes[1].getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeGreaterThan(missile.origin.y);
    view.update({ time: 5, harrowMissiles: [missile] });
    expect(meshes.map((m) => m.count)).toEqual([0, 0, 0, 0]);
  } finally {
    view.dispose();
  }
});
it("caps instance storage at forty, clears absent worlds and disposes owned resources", () => {
  const view = new HarrowEffects();
  const meshes = view.root.children as T.InstancedMesh[];
  const disposals = meshes.flatMap((mesh) => [
    vi.spyOn(mesh, "dispose"),
    vi.spyOn(mesh.geometry, "dispose"),
    vi.spyOn(mesh.material as T.Material, "dispose"),
  ]);
  const scene = new T.Scene();
  scene.add(view.root);
  view.update({
    time: 3,
    harrowMissiles: Array.from({ length: 50 }, (_, id) => ({ ...missile, id })),
  });
  expect(meshes.map((m) => m.count)).toEqual([40, 40, 40, 0]);
  view.update(null);
  expect(meshes.map((m) => m.count)).toEqual([0, 0, 0, 0]);
  view.dispose();
  expect(view.root.parent).toBeNull();
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
});
