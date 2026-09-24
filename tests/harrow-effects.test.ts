import { it, expect, vi } from "vitest";
import * as T from "three";
import { HarrowEffects } from "../src/client/harrow-effects";
import type { HarrowMissile } from "../src/shared/harrow";
import { HARROW } from "../src/shared/harrow";
import type { Enemy } from "../src/shared/game";
import { TerrainProjectedMarkers } from "../src/client/terrain-projected-marker";
import { MAPS, ELEVATED_MAPS, stageFor } from "../src/shared/stages";
import { supportHeight } from "../src/shared/terrain";

// The upper rendered patch is authoritative at overlapping/vertical rock edges.
// A lower edge may quantize a few micrometres across its upper neighbour.
function markerTop(view: TerrainProjectedMarkers, x: number, z: number) {
  const p = view.geometry.getAttribute("position"),
    ids = view.geometry.index!;
  let top = -Infinity;
  for (let i = 0; i < view.geometry.drawRange.count; i += 3) {
    const a = ids.getX(i),
      b = ids.getX(i + 1),
      c = ids.getX(i + 2);
    const ax = p.getX(a),
      az = p.getZ(a),
      bx = p.getX(b),
      bz = p.getZ(b),
      cx = p.getX(c),
      cz = p.getZ(c);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
    const sign = Math.sign(det);
    const tolerances = [
      Math.hypot(bx - cx, bz - cz),
      Math.hypot(cx - ax, cz - az),
      Math.hypot(ax - bx, az - bz),
    ].map((length) => (1e-5 * length) / Math.abs(det));
    if (
      sign &&
      u >= -tolerances[0] &&
      v >= -tolerances[1] &&
      1 - u - v >= -tolerances[2]
    )
      top = Math.max(
        top,
        u * p.getY(a) + v * p.getY(b) + (1 - u - v) * p.getY(c),
      );
  }
  return top;
}

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
      const vertices = view.ringInfo(0)!.triangles * 3;
      const heights: number[] = [];
      for (let vertex = 0; vertex < vertices; vertex++) {
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
      view.setCount(1);
      expect(position.array).toBe(original);
      expect(position.version).toBeGreaterThan(version);
      expect(material.depthTest).toBe(true);
      expect(view.geometry.drawRange.count).toBe(
        view.ringInfo(0)!.triangles * 3,
      );
    } finally {
      view.dispose();
      material.dispose();
    }
  },
);
it("clips face interiors over every campaign grass/snow rock instead of bridging their ridges", () => {
  const view = new TerrainProjectedMarkers(new T.MeshBasicMaterial(), 1);
  let worst = -Infinity,
    maximum = 0,
    cases = 0;
  try {
    for (const map of [...MAPS, ...ELEVATED_MAPS].filter(
      (map) => map.biome === "grass" || map.biome === "snow",
    ))
      for (const block of map.blocks)
        for (const radius of [
          HARROW.missileRadius,
          HARROW.diveRadius,
          HARROW.spinRadius,
        ])
          for (const side of [-1, 0, 1]) {
            const point = {
              x: block.x + side * radius,
              z: block.z - radius * 0.45,
              y: 0,
            };
            point.y = supportHeight(point.x, point.z, map.blocks);
            view.setRing(0, point, radius, map.blocks);
            view.setCount(1);
            const info = view.ringInfo(0)!;
            maximum = Math.max(maximum, info.triangles);
            expect(info.widthFactor).toBe(1);
            const p = view.geometry.getAttribute("position");
            for (let triangle = 0; triangle < info.triangles; triangle++)
              for (let a = 1; a < 5; a++)
                for (let b = 1; b < 5 - a; b++) {
                  const u = a / 5,
                    v = b / 5,
                    s = 1 - u - v,
                    t = triangle * 3;
                  const x =
                    p.getX(t) * u + p.getX(t + 1) * v + p.getX(t + 2) * s;
                  const y =
                    p.getY(t) * u + p.getY(t + 1) * v + p.getY(t + 2) * s;
                  const z =
                    p.getZ(t) * u + p.getZ(t + 1) * v + p.getZ(t + 2) * s;
                  worst = Math.max(
                    worst,
                    supportHeight(x, z, map.blocks, point.y) - y,
                  );
                }
            cases++;
          }
    expect(cases).toBe(180);
    expect(worst).toBeLessThan(-0.1);
    expect(maximum).toBeLessThan(TerrainProjectedMarkers.maxTrianglesPerRing);
  } finally {
    view.dispose();
    view.material.dispose();
  }
});

it("stays within the production pool for all map variants and all three attack radii", () => {
  const view = new TerrainProjectedMarkers(new T.MeshBasicMaterial(), 1);
  let cases = 0;
  try {
    for (const map of [...MAPS, ...ELEVATED_MAPS])
      for (const radius of [
        HARROW.missileRadius,
        HARROW.diveRadius,
        HARROW.spinRadius,
      ])
        for (const center of [
          { x: 0, z: 0 },
          map.blocks[0] ?? { x: 10, z: 10 },
        ]) {
          const point = {
            x: center.x,
            z: center.z,
            y: supportHeight(center.x, center.z, map.blocks),
          };
          view.setRing(0, point, radius, map.blocks);
          view.setCount(1);
          expect(view.ringInfo(0)!.triangles).toBeGreaterThan(0);
          expect(view.ringInfo(0)!.triangles).toBeLessThanOrEqual(4096);
          expect(view.ringInfo(0)!.widthFactor).toBe(1);
          cases++;
        }
    expect(cases).toBe(72);
  } finally {
    view.dispose();
    view.material.dispose();
  }
});

it("the upper rock patch covers Float32 boundary edges and keeps the full outline", () => {
  const view = new TerrainProjectedMarkers(new T.MeshBasicMaterial(), 1);
  const blocks = MAPS[4].blocks;
  const point = {
    x: -91.2,
    z: -77.54,
    y: supportHeight(-91.2, -77.54, blocks),
  };
  try {
    view.setRing(0, point, HARROW.spinRadius, blocks);
    view.setCount(1);
    for (const [x, z] of [
      [-72.16715545654297, -85.83406524658203],
      [-70.37545013427734, -85.44886322021485],
    ])
      expect(markerTop(view, x, z)).toBeGreaterThan(
        supportHeight(x, z, blocks, point.y) + 0.1,
      );
    for (let sample = 0; sample < 360; sample++) {
      const angle = (sample / 360) * Math.PI * 2;
      const x = point.x + Math.cos(angle) * HARROW.spinRadius;
      const z = point.z + Math.sin(angle) * HARROW.spinRadius;
      expect(markerTop(view, x, z)).toBeGreaterThan(
        supportHeight(x, z, blocks, point.y) + 0.1,
      );
    }
  } finally {
    view.dispose();
    view.material.dispose();
  }
});

it("covers the independent ST25 Spin counterexample where the former wide faces cut through rock", () => {
  const point = { x: -68.972786, y: 15.317685, z: -51.436221 };
  const blocks = MAPS[3].blocks,
    radius = HARROW.spinRadius;
  const view = new TerrainProjectedMarkers(new T.MeshBasicMaterial(), 1);
  let buriedOldFaces = 0,
    worstOldBurial = 0;
  try {
    view.setRing(0, point, radius, blocks);
    view.setCount(1);
    // Independent reconstruction of fad580b's 512 sectors, one face across
    // the whole width. Validate its interior witnesses against the NEW mesh.
    const oldVertex = (angle: number, edge: number) => {
      const r = radius * (edge ? 1.055 : 0.945);
      const x = point.x + Math.cos(angle) * r,
        z = point.z + Math.sin(angle) * r;
      return { x, z, y: supportHeight(x, z, blocks, point.y) + 0.12 };
    };
    for (let sector = 0; sector < 512; sector++) {
      const angle = (sector / 512) * Math.PI * 2,
        next = ((sector + 1) / 512) * Math.PI * 2;
      const a = oldVertex(angle, 0),
        b = oldVertex(next, 0),
        c = oldVertex(angle, 1),
        d = oldVertex(next, 1);
      for (const vertices of [
        [a, b, c],
        [c, b, d],
      ]) {
        const x = vertices.reduce((sum, p) => sum + p.x, 0) / 3;
        const z = vertices.reduce((sum, p) => sum + p.z, 0) / 3;
        const oldY = vertices.reduce((sum, p) => sum + p.y, 0) / 3;
        const ground = supportHeight(x, z, blocks, point.y);
        worstOldBurial = Math.max(worstOldBurial, ground - oldY);
        if (oldY < ground) {
          buriedOldFaces++;
          expect(markerTop(view, x, z)).toBeGreaterThan(ground + 0.1);
        }
      }
    }
    expect(buriedOldFaces).toBeGreaterThan(50);
    expect(worstOldBurial).toBeGreaterThan(0.3);
    expect(view.ringInfo(0)!.widthFactor).toBe(1);
  } finally {
    view.dispose();
    view.material.dispose();
  }
});

it("a constrained tessellation budget keeps a complete clipped outline instead of dropping faces", () => {
  const view = new TerrainProjectedMarkers(new T.MeshBasicMaterial(), 1, 2048);
  const blocks = MAPS[3].blocks;
  const point = { x: 4, z: -35, y: supportHeight(4, -35, blocks) };
  try {
    view.setRing(0, point, HARROW.spinRadius, blocks);
    view.setCount(1);
    expect(view.ringInfo(0)!.widthFactor).toBe(0.5);
    expect(view.ringInfo(0)!.triangles).toBeLessThanOrEqual(2048);
    for (let sample = 0; sample < 360; sample++) {
      const angle = (sample / 360) * Math.PI * 2;
      const x = point.x + Math.cos(angle) * HARROW.spinRadius,
        z = point.z + Math.sin(angle) * HARROW.spinRadius;
      expect(markerTop(view, x, z)).toBeGreaterThan(
        supportHeight(x, z, blocks, point.y) + 0.1,
      );
    }
    expect(view.material.depthTest).toBe(true);
  } finally {
    view.dispose();
    view.material.dispose();
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
