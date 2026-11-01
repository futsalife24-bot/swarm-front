// PLEATの量産負荷を、変更前後で同じ条件のまま比べる計測。
// 同じseed・地形(都市stage 1)・敵配置・入力列で、サーバー側の移動時間・
// 接地探索(surfaceRay)回数・端末側の姿勢更新時間を分けて記録する。
// 実行: npx vitest run --config scripts/vitest.pleat-load.config.ts
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { it, vi } from "vitest";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const counters = { rays: 0, steps: 0, stepMs: 0 };
vi.mock("../src/shared/surface-ray", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/shared/surface-ray")>();
  return {
    ...actual,
    surfaceRay: (...args: Parameters<typeof actual.surfaceRay>) => {
      counters.rays++;
      return actual.surfaceRay(...args);
    },
  };
});
vi.mock("../src/shared/pleat-locomotion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/shared/pleat-locomotion")>();
  return {
    ...actual,
    stepPleat: (...args: Parameters<typeof actual.stepPleat>) => {
      const begin = performance.now();
      actual.stepPleat(...args);
      counters.stepMs += performance.now() - begin;
      counters.steps++;
    },
  };
});

const { addPlayer, blocked, createWorld, neutral, spawn, start, step } =
  await import("../src/shared/game");
const { LIMITS } = await import("../src/shared/defs");
const { mapFor } = await import("../src/shared/stages");
const { prepareState } = await import("../src/shared/state-wire");
const { surfaceRay } = await import("../src/shared/surface-ray");
const { HoundMotionBatch } = await import("../src/client/hound-motion");
const { PleatProcedural } = await import("../src/client/pleat-procedural");

const TICKS = 400; // 20秒 × 20Hz
const FRAMES_PER_TICK = 3; // 端末60fps相当
const label = process.env.PLEAT_LOAD_LABEL ?? "current";

async function loadAsset() {
  const bytes = readFileSync("public/assets/enemies/pleat_motion_v5.glb");
  const loader = new GLTFLoader().register(() => ({
    name: "TestTextureDecoder",
    loadTexture: () => Promise.resolve(new T.Texture()),
  }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const meshes: T.SkinnedMesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.SkinnedMesh) meshes.push(o);
  });
  const skeleton = meshes[0].skeleton;
  skeleton.pose();
  gltf.scene.updateMatrixWorld(true);
  return {
    model: gltf.scene,
    clips: gltf.animations,
    meshes,
    bones: skeleton.bones.length,
    ranges: {},
    atlas: new T.DataTexture(
      new Float32Array(skeleton.bones.length * 16),
      skeleton.bones.length * 4,
      1,
      T.RGBAFormat,
      T.FloatType,
    ),
    proceduralRest: {
      names: skeleton.bones.map((b) => b.name),
      world: skeleton.bones.map((b) => b.matrixWorld.clone()),
      inverseBind: skeleton.boneInverses.map((m) => m.clone()),
      prefix: meshes[0].matrixWorld
        .clone()
        .multiply(meshes[0].bindMatrixInverse),
      bind: meshes[0].bindMatrix.clone(),
    },
  } as unknown as ConstructorParameters<typeof HoundMotionBatch>[0];
}

/** 決定的な配置: 半径14〜38mの同心円上で、建物と重ならない点を順に使う。 */
function scenario(count: number) {
  LIMITS.enemies = Math.max(LIMITS.enemies, count + 1);
  const w = createWorld("pleat-load", 11, 1),
    p = addPlayer(w, "p");
  start(w);
  w.nextSpawn = 1e9;
  w.enemies = [];
  p.hp = 1e6;
  p.x = 0;
  p.z = 0;
  const blocks = mapFor(w).blocks;
  const points: { x: number; z: number }[] = [];
  for (let ring = 0; points.length < count && ring < 40; ring++) {
    const radius = 14 + ring * 2;
    for (let k = 0; k < 24 && points.length < count; k++) {
      const a = (k / 24) * Math.PI * 2 + ring * 0.37;
      const x = Math.sin(a) * radius,
        z = Math.cos(a) * radius;
      if (!blocked(x, z, 2.5, 0, blocks)) points.push({ x, z });
    }
  }
  for (const point of points) {
    spawn(w, "crawler", point.x, point.z);
    Object.assign(w.enemies.at(-1)!, { active: true });
  }
  return { w, p, blocks };
}

/** 入力列: 隊員は半径6mの円を歩き続ける(射撃なし)。 */
const input = (tick: number) => ({
  ...neutral(),
  mx: Math.cos(tick * 0.05),
  mz: Math.sin(tick * 0.05),
  seq: tick,
});

const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
};
const round = (v: number, digits = 3) => Number(v.toFixed(digits));

it("PLEAT負荷を24/48/96体で計測する", async () => {
  const asset = await loadAsset();
  const results: Record<string, unknown>[] = [];
  for (const count of [24, 48, 96]) {
    const { w, p, blocks } = scenario(count);
    const wireStates: unknown[][] = [];
    const tickMs: number[] = [];
    counters.rays = counters.steps = counters.stepMs = 0;
    let packetBytes = 0,
      pleatBytes = 0,
      wallTicks = 0,
      stalls = 0;
    const last = new Map<number, { x: number; z: number }>();
    for (let tick = 0; tick < TICKS; tick++) {
      const begin = performance.now();
      step(w, { [p.id]: input(tick) });
      tickMs.push(performance.now() - begin);
      for (const e of w.enemies) {
        if (e.pleat && Math.abs(e.pleat.normal.y) < 0.5) wallTicks++;
        const before = last.get(e.id);
        if (before && Math.hypot(e.x - before.x, e.z - before.z) < 1e-4)
          stalls++;
        last.set(e.id, { x: e.x, z: e.z });
      }
      if (tick % 4 === 0) {
        const packet = prepareState(w, 0, {
          members: [],
          preparationGeneration: 0,
        }).packet(p.id);
        const world = JSON.parse(packet).world;
        if (tick === TICKS - 4) {
          packetBytes = new TextEncoder().encode(packet).length;
          pleatBytes = world.enemies.reduce(
            (sum: number, e: { pleat?: unknown }) =>
              sum + (e.pleat ? JSON.stringify(e.pleat).length : 0),
            0,
          );
        }
        wireStates.push(world.enemies);
      }
    }
    const server = {
      stepPleatCalls: counters.steps,
      stepPleatMsTotal: round(counters.stepMs, 1),
      stepPleatUsPerCall: round((counters.stepMs / counters.steps) * 1000, 1),
      raysTotal: counters.rays,
      raysPerEnemyPerSecond: round(counters.rays / count / (TICKS * 0.05), 1),
      tickMedianMs: round(percentile(tickMs, 0.5)),
      tickP95Ms: round(percentile(tickMs, 0.95)),
      tickMaxMs: round(Math.max(...tickMs)),
    };

    // 端末: 遠隔受信と同じJSONを、20Hz受信・60fps描画で姿勢更新する。
    // 視点は隊員の位置(群れの中)と、隊員から60m離れた位置の2条件。
    const clientRun = (offset: number) => {
      const batch = new HoundMotionBatch(asset, count);
      const rig = new PleatProcedural(batch) as InstanceType<
        typeof PleatProcedural
      > & {
        setSurface?: (
          ray: (
            o: { x: number; y: number; z: number },
            d: { x: number; y: number; z: number },
            max: number,
          ) => unknown,
        ) => void;
        setViewer?: (p: { x: number; y: number; z: number }) => void;
        beginFrame?: () => void;
        detail?: Record<string, number>;
      };
      const detail: Record<string, number> = {};
      rig.setSurface?.((o, d, max) => surfaceRay(o, d, max, blocks));
      const frameMs: number[] = [];
      counters.rays = 0;
      for (const enemies of wireStates)
        for (let f = 0; f < FRAMES_PER_TICK * 4; f++) {
          rig.setViewer?.({ x: p.x, y: 1.5, z: p.z + offset });
          rig.beginFrame?.();
          const begin = performance.now();
          (
            enemies as {
              id: number;
              pleat?: never;
              wind: number;
              cool: number;
            }[]
          ).forEach((e, i) => {
            if (e.pleat)
              rig.update(i, e.pleat, 1 / 60, e.wind, e.cool, undefined, e.id);
          });
          frameMs.push(performance.now() - begin);
          for (const [key, value] of Object.entries(rig.detail ?? {}))
            detail[key] = (detail[key] ?? 0) + value;
        }
      batch.dispose();
      return {
        viewerOffsetMeters: offset,
        frames: frameMs.length,
        poseMedianMs: round(percentile(frameMs, 0.5)),
        poseP95Ms: round(percentile(frameMs, 0.95)),
        poseMaxMs: round(Math.max(...frameMs)),
        clientRaysPerFrame: round(counters.rays / frameMs.length, 2),
        perFrame: Object.fromEntries(
          Object.entries(detail).map(([key, value]) => [
            key,
            round(value / frameMs.length, 2),
          ]),
        ),
      };
    };
    const client = clientRun(0);
    const clientDistant = clientRun(60);
    results.push({
      enemies: w.enemies.length,
      server,
      client,
      clientDistant,
      wire: { packetBytes, pleatBytes },
      behaviour: {
        wallEnemyTicks: wallTicks,
        stalledEnemyTicks: stalls,
        playerHp: p.hp,
      },
    });
  }
  const report = {
    label,
    scenario: {
      seed: 11,
      stage: 1,
      run: "pleat-load",
      ticks: TICKS,
      dt: 0.05,
      clientFramesPerTick: FRAMES_PER_TICK,
      input: "隊員は射撃なしで円を歩く(mx=cos(0.05t), mz=sin(0.05t))",
      placement: "半径14m起点・2m刻みの同心円24方位から建物外の点を順に採用",
      node: process.version,
    },
    results,
  };
  mkdirSync("docs/evidence/pleat-lightweight-20261101", { recursive: true });
  writeFileSync(
    `docs/evidence/pleat-lightweight-20261101/load-${label}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.info(JSON.stringify(report));
}, 600000);
