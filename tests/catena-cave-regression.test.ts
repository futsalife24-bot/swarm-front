import { expect, it } from "vitest";
import { MAPS } from "../src/shared/stages";
import {
  CAVE_BLOCKS,
  caveCeiling,
  caveClearance,
  CAVE_NODES,
} from "../src/shared/cave";
import { groundHeight } from "../src/shared/terrain";
import { surfaceRay } from "../src/shared/surface-ray";
import { groundFieldScale, registerTerrain } from "../src/shared/terrain";
import { readFileSync } from "node:fs";
import { step, neutral, type World } from "../src/shared/game";

it.each([
  [-38.58105399473524, 2.563852367976604],
  [45.964668302909885, -48.06939509052723],
  [-0.25, 44.25],
])("ST10回帰地点と洞窟代表点(%s,%s)の接地面が地表・遮蔽と一致する", (x, z) => {
  expect(MAPS.some((m) => m.blocks === CAVE_BLOCKS)).toBe(true);
  const floor = groundHeight(x, z, CAVE_BLOCKS);
  expect(caveClearance(x, z)).toBeGreaterThan(0);
  expect(floor).toBeGreaterThan(0.1);
  for (const [start, dy] of [
    [floor + 2, -1],
    [floor - 0.2, 1],
  ]) {
    const hit = surfaceRay(
      { x, y: start, z },
      { x: 0, y: dy, z: 0 },
      3,
      CAVE_BLOCKS,
    );
    expect(hit).toBeDefined();
    expect(hit!.point.y).toBeCloseTo(floor, 4);
    expect(hit!.normal.y).toBeGreaterThan(0.9);
  }
});
it("洞窟の地表斜面を斜めに横切ってもすり抜けず、床上の空間と壁・天井を保つ", () => {
  for (const { x, z } of CAVE_NODES) {
    const floor = groundHeight(x, z, CAVE_BLOCKS),
      roof = caveCeiling(x, z);
    if (roof - floor < 3) continue;
    const up = surfaceRay(
      { x, y: floor + 1, z },
      { x: 0, y: 1, z: 0 },
      20,
      CAVE_BLOCKS,
    )!;
    expect(up.point.y).toBeCloseTo(roof, 4);
    expect(up.normal.y).toBeLessThan(0);
    const down = surfaceRay(
      { x: x - 0.1, y: floor + 1, z: z - 0.1 },
      { x: 0.1, y: -1, z: 0.1 },
      3,
      CAVE_BLOCKS,
    )!;
    expect(down.point.y).toBeCloseTo(
      groundHeight(down.point.x, down.point.z, CAVE_BLOCKS),
      4,
    );
    expect(caveClearance(down.point.x, down.point.z)).toBeGreaterThan(0);
  }
});
it("地表距離場は全三角形の勾配で保守的に正規化し、再登録後の古い上限を使わない", () => {
  const blocks: import("../src/shared/map-blocks").Block[] = [];
  registerTerrain(blocks, 3);
  const scale = groundFieldScale(blocks);
  expect(scale).toBeGreaterThan(0);
  expect(scale).toBeLessThan(1);
  for (let i = 0; i < 200; i++) {
    const x = -90 + ((i * 13.1) % 175),
      z = -100 + ((i * 7.3) % 195),
      y = (i % 7) * 0.4;
    const a = (y - groundHeight(x, z, blocks)) * scale,
      b = (y + 0.2 - groundHeight(x + 0.7, z - 0.4, blocks)) * scale;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(
      Math.hypot(0.7, 0.4, 0.2) + 1e-8,
    );
  }
  registerTerrain(blocks, 0);
  expect(groundFieldScale(blocks)).toBe(1);
});
it("旧保存の地下アンカーから復帰しても同じ地表へ接地し、敵HPと保存の決定性を保つ", () => {
  const old = JSON.parse(
    readFileSync(
      new URL(
        "../docs/evidence/catena-omega-20261021/st10-followup/candidate-814-0-snapshot.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as World;
  const e = old.enemies.find((e) => e.id === 97)!;
  const hp = e.hp;
  expect(e.pleat!.anchor.y).toBeLessThan(
    groundHeight(e.x, e.z, CAVE_BLOCKS) - 0.5,
  );
  const copy = structuredClone(old);
  for (let i = 0; i < 20; i++) {
    step(old, { p: neutral() });
    step(copy, { p: neutral() });
  }
  expect(e.pleat!.anchor.y).toBeCloseTo(
    groundHeight(e.pleat!.anchor.x, e.pleat!.anchor.z, CAVE_BLOCKS),
    3,
  );
  expect(e.pleat!.body.y).toBeGreaterThan(groundHeight(e.x, e.z, CAVE_BLOCKS));
  expect(e.hp).toBe(hp);
  expect(copy).toEqual(old);
});
