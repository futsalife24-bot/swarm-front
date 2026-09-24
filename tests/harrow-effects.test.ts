import { it, expect, vi } from "vitest";
import * as T from "three";
import { HarrowEffects } from "../src/client/harrow-effects";
import type { HarrowMissile } from "../src/shared/harrow";
import { HARROW } from "../src/shared/harrow";
import type { Enemy } from "../src/shared/game";
import { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";
import { MAPS, stageFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

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
  const warnings = view.root.children[3] as TerrainProjectedMarkers;
  const positions = warnings.geometry.getAttribute("position");
  try {
    view.update({ time: 0.1, enemies: [enemy] });
    expect(warnings.count).toBe(1);
    expect(positions.getX(0)).toBeCloseTo(enemy.x + HARROW.spinRadius * 0.945);
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
    expect(positions.getX(0)).toBeCloseTo(7 + HARROW.diveRadius * 0.945);
    expect(positions.getY(0)).toBeCloseTo(3.12);
    expect(positions.getZ(0)).toBe(9);
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
    expect(meshes[0].geometry.getAttribute("position").getY(0)).toBeCloseTo(
      3.12,
    );
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

it("uses the world's map for flat range markers and elevated roof impacts", () => {
  const view = new HarrowEffects();
  const markers = view.root.children[0] as TerrainProjectedMarkers;
  const position = markers.geometry.getAttribute("position");
  try {
    view.update({
      time: 1,
      training: true,
      harrowMissiles: [{ ...missile, target: { x: 0, y: 0.06, z: 0 } }],
    });
    expect(position.getY(0)).toBeCloseTo(0.12);
    view.update({
      time: 1,
      stage: 20,
      campaignPlan: { ...stageFor({ stage: 20 }), map: 1 },
      harrowMissiles: [{ ...missile, target: { x: -58, y: 6.06, z: -64 } }],
    });
    expect(position.getY(0)).toBeCloseTo(6.12);
    expect((markers.material as T.Material).depthTest).toBe(true);
    view.update(null);
    expect(markers.geometry.drawRange.count).toBe(0);
  } finally {
    view.dispose();
  }
});

it.each([
  { name: "grass slope", map: 3, x: 4, z: -35, radius: HARROW.spinRadius },
  { name: "snow rock", map: 4, x: -65.5, z: -10, radius: 2.5 },
  { name: "roof", map: 1, x: -58, z: -64, radius: 2.5 },
])(
  "projects a closed marker onto the actual $name without reallocating",
  ({ map, x, z, radius }) => {
    const material = new T.MeshBasicMaterial({ depthWrite: false });
    const view = new TerrainProjectedMarkers(material, 40);
    const blocks = MAPS[map].blocks;
    const point = { x, y: supportHeight(x, z, blocks), z };
    try {
      view.setRing(0, point, radius, blocks);
      view.setCount(1);
      const position = view.geometry.getAttribute(
        "position",
      ) as T.BufferAttribute;
      const original = position.array;
      const version = position.version;
      const last = TerrainProjectedMarkers.segments * 2;
      const heights: number[] = [];
      for (let vertex = 0; vertex < last + 2; vertex++) {
        const vx = position.getX(vertex),
          vy = position.getY(vertex),
          vz = position.getZ(vertex);
        heights.push(vy);
        expect(vy).toBeGreaterThan(
          supportHeight(vx, vz, blocks, point.y) + 0.1,
        );
      }
      if (map !== 1)
        expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(
          0.1,
        );
      else
        expect(heights.every((height) => Math.abs(height - 6.12) < 1e-5)).toBe(
          true,
        );
      for (let edge = 0; edge < 2; edge++) {
        expect([
          position.getX(edge),
          position.getY(edge),
          position.getZ(edge),
        ]).toEqual([
          position.getX(last + edge),
          position.getY(last + edge),
          position.getZ(last + edge),
        ]);
      }
      const index = view.geometry.index!;
      for (let i = 0; i < view.geometry.drawRange.count; i += 3) {
        const a = index.getX(i),
          b = index.getX(i + 1),
          c = index.getX(i + 2);
        const tx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
        const ty = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
        const tz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
        expect(ty).toBeGreaterThan(supportHeight(tx, tz, blocks, point.y));
      }
      view.setRing(0, point, radius, blocks);
      expect(position.version).toBe(version);
      view.setRing(0, { ...point, x: x + 0.1 }, radius, blocks);
      expect(position.array).toBe(original);
      expect(position.version).toBeGreaterThan(version);
      expect(material.depthTest).toBe(true);
      expect(view.geometry.drawRange.count).toBe(
        TerrainProjectedMarkers.segments * 6,
      );
    } finally {
      view.dispose();
      material.dispose();
    }
  },
);
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
