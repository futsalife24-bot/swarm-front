import { expect, it } from "vitest";
import { MAPS, STAGES, ELEVATED_MAPS, mapFor } from "../src/shared/stages";
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
  validInput,
  playerVerticalStep,
  spawn,
  eye,
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
import { rockHeight } from "../src/shared/rock";

it("rifle damages a target past the rock shoulder, but solid rock still stops it", () => {
  for (const shoulder of [true, false]) {
    const w = createWorld("rock-shot", 42, 7),
      p = addPlayer(w, "p", [STARTERS[0], STARTERS[1]]);
    const map = mapFor(w),
      b = map.blocks[0],
      rayY = b.h - 0.1;
    p.x = b.x + (shoulder ? b.w * 0.45 : 0);
    p.z = b.z - b.d * 0.7;
    p.y = rayY - 1.5;
    spawn(w, "crawler", p.x, b.z + b.d * 0.7);
    const e = w.enemies[0];
    e.y = rayY - (eye(e) - e.y);
    const hp = e.hp;
    fire(w, p, { ...neutral(), yaw: Math.PI });
    expect(e.hp < hp).toBe(shoulder);
  }
});

it.each([0.016, 0.05, 0.1])(
  "diagonal jump resumes full uphill movement after landing at dt=%s",
  (dt) => {
    const map = MAPS[3],
      w = createWorld("diagonal", 42, 7),
      p = addPlayer(w, "p");
    p.x = 0;
    p.z = 0;
    p.y = supportHeight(0, 0, map.blocks);
    let peak = 0;
    for (let n = 0; n < Math.ceil(3 / dt); n++) {
      const air = playerVerticalStep(
        p,
        { ...neutral(), jump: n === 0 },
        map.blocks,
        dt,
      );
      const x = p.x,
        z = p.z;
      move(p, -4 * dt, 4 * dt, 0.55, map.blocks, air, true);
      peak = Math.max(peak, p.y! - supportHeight(p.x, p.z, map.blocks));
      if (n * dt > 2) {
        expect(air).toBe(false);
        expect(p.verticalSpeed).toBe(0);
        expect(Math.hypot(p.x - x, p.z - z)).toBeCloseTo(
          Math.hypot(4 * dt, 4 * dt),
          6,
        );
      }
    }
    expect(peak).toBeGreaterThan(1);
  },
);

it.each([MAPS[3], ELEVATED_MAPS[3], MAPS[4], ELEVATED_MAPS[4]])(
  "$name rock shoulders do not have invisible box walls",
  (map) => {
    for (const b of map.blocks) {
      const x = b.x + b.w * 0.45,
        z = b.z;
      const h = rockHeight(b, x, z);
      expect(h).toBeLessThan(b.h - 0.2);
      expect(blocked(x, z, 0.55, h + 0.1, map.blocks)).toBe(false);
      expect(supportHeight(x, z, map.blocks)).toBeCloseTo(h, 5);
      expect(landingHeight(x, z, b.h + 1, h - 0.1, map.blocks)).toBeCloseTo(
        h,
        5,
      );
      expect(
        wallDistance(x, b.h + 2, z, 0, -1, 0, 100, map.blocks),
      ).toBeCloseTo(b.h + 2 - h, 5);
      // This line crosses the old box corner, above the actual shoulder.
      expect(
        wallDistance(x, b.h - 0.1, b.z - b.d, 0, 0, 1, b.d * 2, map.blocks),
      ).toBeCloseTo(b.d * 2);
      expect(
        wallDistance(b.x, b.h - 0.1, b.z - b.d, 0, 0, 1, b.d * 2, map.blocks),
      ).toBeLessThan(b.d * 2);
    }
  },
);

it.each([MAPS[3], ELEVATED_MAPS[3]])(
  "$name low rocks can be climbed and jumped onto",
  (map) => {
    for (const b of map.blocks) {
      const w = createWorld("rock-jump", 22, 7),
        soldier = addPlayer(w, "p");
      Object.assign(soldier, {
        x: b.x - b.w / 2 - 0.8,
        z: b.z,
        y: supportHeight(b.x - b.w / 2 - 0.8, b.z, map.blocks),
      });
      let peak = soldier.y!,
        landed = false;
      for (let n = 0; n < 200; n++) {
        const air = playerVerticalStep(
          soldier,
          { ...neutral(), jump: n < 150 && n % 24 === 0 },
          map.blocks,
          0.05,
        );
        move(
          soldier,
          Math.max(0, Math.min(0.1, b.x - soldier.x)),
          0,
          0.55,
          map.blocks,
          air,
          true,
        );
        peak = Math.max(peak, soldier.y!);
        if (n > 5 && !air) landed = true;
      }
      expect(soldier.x).toBeCloseTo(b.x, 4);
      expect(soldier.y).toBeCloseTo(b.h, 4);
      expect(landed).toBe(true);
      expect(peak).toBeGreaterThan(b.terrainBase! + 1);
      expect(soldier.y).toBeCloseTo(
        supportHeight(soldier.x, soldier.z, map.blocks),
        4,
      );
    }
  },
);

it.each([3, 4])(
  "landing on map %i clears downward velocity and preserves diagonal uphill speed",
  (index) => {
    const map = MAPS[index],
      w = createWorld("slope", 22, 7),
      p = addPlayer(w, "p");
    p.x = 0;
    p.z = 0;
    p.y = groundHeight(0, 0, map.blocks) - 0.01;
    p.verticalSpeed = -4;
    let distance = 0;
    for (let n = 0; n < 40; n++) {
      const air = playerVerticalStep(p, neutral(), map.blocks, 0.05);
      expect(air).toBe(false);
      expect(p.verticalSpeed).toBe(0);
      const x = p.x,
        z = p.z;
      move(p, -0.1, 0.1, 0.55, map.blocks, air, true);
      distance += Math.hypot(p.x - x, p.z - z);
    }
    expect(distance).toBeCloseTo(40 * Math.hypot(0.1, 0.1), 5);
  },
);
import { subdivideMapGeometry, addMapDetail } from "../src/client/map-detail";

it("jumps once per press, rejects midair jumps, lands, and preserves wire determinism", () => {
  const w = createWorld("jump", 22, 1),
    p = addPlayer(w, "p");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  const copy = structuredClone(w);
  let peak = 0;
  for (let tick = 0; tick < 50; tick++) {
    const i = { ...neutral(), jump: true, seq: tick };
    step(w, { p: i });
    step(copy, { p: i });
    peak = Math.max(peak, p.y ?? 0);
  }
  expect(peak).toBeCloseTo(1.6, 2);
  expect(p.y).toBe(0);
  expect(p.verticalSpeed).toBe(0);
  expect(copy).toEqual(w);
  step(w, { p: neutral() });
  step(w, { p: { ...neutral(), jump: true } });
  expect(p.y).toBeGreaterThan(0);
  expect(validInput({ ...neutral(), jump: 9 })).toBe(false);
  const legacy = { ...neutral() };
  delete legacy.jump;
  expect(validInput(legacy)).toBe(true);
});

it.each([0, 1, 2])("a downed airborne soldier lands on map %i", (index) => {
  const w = createWorld(
    "down-jump",
    1,
    STAGES.find((s) => s.map === index)!.id,
  );
  const p = addPlayer(w, "p");
  addPlayer(w, "q");
  w.phase = "battle";
  w.wave = 1;
  w.nextSpawn = 1e9;
  step(w, { p: { ...neutral(), jump: true } });
  expect(p.y).toBeGreaterThan(0);
  p.hp = 0;
  p.down = 10;
  for (let n = 0; n < 25; n++) step(w, {});
  expect(p.y).toBe(0);
});

it.each([0, 1, 2])(
  "map %i stairs connect from service lane to annex roof and permit falling off",
  (index) => {
    const stage = STAGES.find((s) => s.map === index && s.elevated)!;
    const w = createWorld("stairs", 22, stage.id),
      p = addPlayer(w, "p");
    w.phase = "battle";
    w.wave = 1;
    w.nextSpawn = 1e9;
    expect(mapFor(w)).toBe(ELEVATED_MAPS[index]);
    p.x = 74.5;
    p.z = 9;
    p.y = 0;
    for (let n = 0; n < 75; n++) move(p, 0, -0.2, 0.55, mapFor(w).blocks);
    expect(p.y).toBeCloseTo(3.6);
    for (let n = 0; n < 40; n++) move(p, 0.2, 0, 0.55, mapFor(w).blocks);
    expect(p.x).toBeGreaterThan(81);
    expect(p.y).toBeCloseTo(3.6);
    p.z = -7;
    for (let n = 0; n < 20; n++) step(w, { p: { ...neutral(), mz: 1 } });
    expect(p.z).toBeLessThan(-9);
    for (let n = 0; n < 30; n++) step(w, { p: neutral() });
    expect(p.y).toBe(0);
  },
);

it("fixed stage assignments cover both versions of every non-cave region", () => {
  for (let index = 0; index < 5; index++) {
    expect(STAGES.some((s) => s.map === index && s.elevated)).toBe(true);
    expect(STAGES.some((s) => s.map === index && !s.elevated)).toBe(true);
  }
  expect(ELEVATED_MAPS[5]).toBe(MAPS[5]);
  expect(mapFor({ stage: 1 })).toBe(MAPS[0]);
  expect(mapFor({ stage: 3 })).toBe(ELEVATED_MAPS[0]);
});

it("resumes old checkpoints above revised ground instead of falling through it", () => {
  for (const stage of [2, 7, 13, 14]) {
    const w = createWorld("old-checkpoint", 1, stage),
      p = addPlayer(w, "p");
    p.y = 0;
    w.phase = "battle";
    w.wave = 1;
    w.nextSpawn = 1e9;
    step(w, { p: neutral() });
    expect(p.y).toBeCloseTo(groundHeight(p.x, p.z, mapFor(w).blocks));
  }
});

it("grass slopes in one broad direction, snow rises around a depression, and natural high routes add walkable relief", () => {
  expect(groundHeight(-20, 0, MAPS[3].blocks)).toBeGreaterThan(
    groundHeight(20, 0, MAPS[3].blocks),
  );
  expect(groundHeight(0, 0, MAPS[4].blocks)).toBeLessThan(
    groundHeight(0, 70, MAPS[4].blocks),
  );
  for (const index of [3, 4]) {
    expect(groundHeight(-25, -28, ELEVATED_MAPS[index].blocks)).toBeGreaterThan(
      groundHeight(-25, -28, MAPS[index].blocks),
    );
    expect(terrainProps(ELEVATED_MAPS[index].blocks)).toEqual([]);
    const blocks = ELEVATED_MAPS[index].blocks;
    const p = { x: 0, z: -28, y: groundHeight(0, -28, blocks) };
    for (let n = 0; n < 150; n++) move(p, -0.2, 0, 0.55, blocks);
    expect(p.x).toBeCloseTo(-30);
    expect(p.y).toBeCloseTo(groundHeight(-30, -28, blocks));
  }
});

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
