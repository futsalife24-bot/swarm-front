import { expect, it } from "vitest";
import { MAPS, STAGES } from "../src/shared/stages";
import {
  addPlayer,
  createWorld,
  move,
  blocked,
  wallDistance,
  aimCamera,
  fire,
  neutral,
  step,
} from "../src/shared/game";
import {
  groundHeight,
  registerTerrain,
  supportHeight,
  terrainProps,
  landingHeight,
  markerAbove,
} from "../src/shared/terrain";
import { type Block, STARTERS } from "../src/shared/defs";
import * as T from "three";
import { subdivideMapGeometry, addMapDetail } from "../src/client/map-detail";

it.each(MAPS.map((map, index) => ({ map, index })))(
  "map $index has natural relief and no generic steps, boxes or loading docks",
  ({ map, index }) => {
    let max = 0;
    for (let x = -90; x < 90; x += 2)
      for (let z = -100; z < 100; z += 2)
        max = Math.max(max, groundHeight(x, z, map.blocks));
    if (index < 3) expect(max).toBe(0);
    else expect(max).toBeGreaterThan(index === 5 ? 1 : 4);
    expect(terrainProps(map.blocks)).toEqual([]);
  },
);

it.each([false, true])(
  "isolated collision fixture preserves step and landing behavior (z axis: %s)",
  (cave) => {
    const blocks: Block[] = [];
    registerTerrain(blocks, 0);
    const props = terrainProps(blocks);
    for (let step = 0; step < 4; step++)
      props.push({
        x: cave ? 0 : step * 1.1,
        z: cave ? step * 0.85 : 0,
        w: cave ? 0.85 : 1.1,
        d: cave ? 0.85 : 2.4,
        h: (step + 1) * 0.3,
        base: 0,
        style: "slab",
      });
    const first = props[0],
      last = props[3];
    const p = {
      x: first.x - (cave ? 0 : 1.3),
      z: first.z - (cave ? 1.3 : 0),
      y: first.base,
    };
    for (let n = 0; n < (cave ? 20 : 24); n++)
      move(p, cave ? 0 : 0.2, cave ? 0.2 : 0, 0.3, blocks);
    expect(p.y).toBeCloseTo(last.base + last.h, 4);
    const side = {
      x: last.x - (cave ? 1.4 : 0),
      z: last.z + (cave ? 0 : 2.1),
      y: groundHeight(
        last.x + (cave ? 1.4 : 0),
        last.z + (cave ? 0 : 2.1),
        blocks,
      ),
    };
    for (let n = 0; n < 12; n++)
      move(side, cave ? 0.2 : 0, cave ? 0 : -0.2, 0.3, blocks);
    expect(blocked(side.x, side.z, 0.3, side.y, blocks)).toBe(false);
    expect(Math.hypot(side.x - last.x, side.z - last.z)).toBeGreaterThan(0.7);
    expect(
      landingHeight(last.x, last.z, last.base + 3, last.base - 0.2, blocks),
    ).toBeCloseTo(last.base + last.h);
    expect(
      landingHeight(last.x, last.z, last.base, last.base + 3, blocks),
    ).toBeUndefined();
    const high = {
      x: first.x - (cave ? 0 : 2),
      z: first.z - (cave ? 2 : 0),
      y: first.base + 3,
    };
    move(high, cave ? 0 : 5, cave ? 5 : 0, 0.3, blocks);
    expect(cave ? high.z : high.x).toBeCloseTo((cave ? first.z : first.x) + 3);
    expect(high.y).toBeCloseTo(first.base + 3);
  },
);

it("relative enemy markers distinguish above, equal, below, and legacy player snapshots", () => {
  expect(markerAbove({ y: 6 }, { y: 8 })).toBe(false);
  expect(markerAbove({ y: 8 }, { y: 8 })).toBe(false);
  expect(markerAbove({ y: 8.2 }, { y: 8 })).toBe(true);
  expect(markerAbove({ y: 6 }, {})).toBe(true);
});
it("ridges and prop sides stop shots, roofs catch downward rays", () => {
  const blocks = MAPS[3].blocks,
    prop = { ...blocks[0], base: 0 };
  expect(
    wallDistance(prop.x, prop.base + prop.h + 2, prop.z, 0, -1, 0, 10, blocks),
  ).toBeCloseTo(2);
  expect(wallDistance(-20, 2, -70, 0, 0, 1, 80, blocks)).toBeLessThan(45);
  const floor = groundHeight(-20, -28, blocks);
  expect(wallDistance(-20, floor + 3, -28, 0, -1, 0, 20, blocks)).toBeCloseTo(
    3,
    1,
  );
});
it("feet altitude raises camera and muzzle together and remains deterministic after a wire snapshot", () => {
  const stage = STAGES.find((s) => s.map === 3)!.id,
    w = createWorld("height", 71, stage),
    p = addPlayer(w, "p", [STARTERS[2], STARTERS[0]]);
  p.x = -20;
  p.z = -28;
  p.y = supportHeight(p.x, p.z, MAPS[3].blocks);
  const low = aimCamera({ ...p, y: 0 }, neutral(), []),
    high = aimCamera(p, neutral(), []);
  expect(high.camera.y - low.camera.y).toBeCloseTo(p.y, 8);
  fire(w, p, { ...neutral(), cameraAim: true });
  expect(w.projectiles[0].y).toBeCloseTo(p.y + 1.5);
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const copy = JSON.parse(JSON.stringify(w));
  for (let n = 0; n < 60; n++) {
    const input = { ...neutral(), mx: 0.6, mz: 0.8, seq: n };
    step(w, { p: input });
    step(copy, { p: input });
  }
  expect(copy).toEqual(w);
  expect(w.players[0].y).toBeGreaterThan(1);
});

it("an explicit airborne mover does not snap down during the first 36cm of a future jump", () => {
  const p = { x: 0, z: 0, y: 0.1 };
  move(p, 0.2, 0, 0.55, [], true);
  expect(p.y).toBe(0.1);
});

it("four-way subdivision shares vertices and preserves UVs, bounds and LOD ray contacts", () => {
  const low = new T.PlaneGeometry(8, 6, 2, 2);
  low.rotateX(-Math.PI / 2);
  const high = subdivideMapGeometry(low);
  expect(high.index!.count).toBe(low.index!.count * 4);
  expect(high.getAttribute("position").count).toBeLessThan(
    high.index!.count / 2,
  );
  low.computeBoundingBox();
  high.computeBoundingBox();
  expect(high.boundingBox).toEqual(low.boundingBox);
  const group = new T.Group(),
    material = new T.MeshStandardMaterial(),
    mesh = new T.Mesh(low, material);
  mesh.position.set(4, 2, 7);
  group.add(mesh);
  addMapDetail(group);
  group.updateMatrixWorld(true);
  const batch = group.children[0].children[0] as T.BatchedMesh;
  const ray = new T.Raycaster(new T.Vector3(4, 6, 7), new T.Vector3(0, -1, 0));
  expect(ray.intersectObject(batch)[0].point.y).toBeCloseTo(2);
  expect(batch.userData.mapDetail.highTriangles).toBe(
    batch.userData.mapDetail.lowTriangles * 4,
  );
  batch.dispose();
  high.dispose();
  material.dispose();
});
