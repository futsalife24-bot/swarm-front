import { afterAll, expect, it } from "vitest";
import {
  HARROW_BRANCH,
  MAPS,
  STAGES,
  mapFor,
  type BossForm,
  type TroopKind,
} from "../src/shared/stages";
import {
  blocked,
  createWorld,
  spawn,
  type Enemy,
  type World,
} from "../src/shared/game";
import { ENEMIES } from "../src/shared/defs";
import {
  flushFoundrySpawns,
  queueFoundrySpawn,
} from "../src/shared/foundry-spawning";

// 採用済み編成の固定表。実装から期待値を生成せず、編成の追加・欠落を検出する。
const CONTRACTS = [
  {
    map: 3,
    label: "草原",
    stages: [2, 4, 7, 15, 17, 20, 24, 25],
    entryStage: 2,
    foundryStage: 15,
    branch: true,
    troops: ["crawler", "ant", "spider", "spitter", "hornet", "calyx"],
    bosses: ["crown", "worm", "harrow"],
    foundry: ["crawler", "ant", "spider", "spitter", "hornet", "calyx"],
  },
  {
    map: 4,
    label: "雪峡",
    stages: [13, 14, 19, 23],
    entryStage: 13,
    foundryStage: 13,
    branch: false,
    troops: ["crawler", "ant", "spider", "spitter", "hornet", "calyx"],
    bosses: ["crown", "worm"],
    foundry: ["crawler", "ant", "spider", "spitter", "hornet", "calyx"],
  },
  {
    map: 5,
    label: "洞窟",
    stages: [10, 16],
    entryStage: 10,
    foundryStage: 10,
    branch: false,
    troops: ["crawler", "ant", "spider", "spitter", "hornet"],
    bosses: ["worm"],
    foundry: ["crawler", "ant", "spider", "spitter", "hornet"],
  },
] satisfies {
  map: number;
  label: string;
  stages: number[];
  entryStage: number;
  foundryStage: number;
  branch: boolean;
  troops: TroopKind[];
  bosses: BossForm[];
  foundry: TroopKind[];
}[];
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const trace: Record<string, unknown>[] = [];
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

afterAll(() => {
  console.log(
    "ADOPTED_MAP_TRACE " +
      JSON.stringify({
        contracts: CONTRACTS,
        seeds: SEEDS,
        observations: trace,
      }),
  );
});

function placement(
  w: World,
  enemy: Enemy,
  map: number,
  seed: number,
  route: string,
  form: BossForm,
) {
  const radius = ENEMIES[enemy.kind].radius;
  // 元のmaps試験と同じ最終高度・基本半径・実衝突判定。縮尺や天井を緩めない。
  const collision = blocked(
    enemy.x,
    enemy.z,
    radius,
    enemy.y,
    MAPS[map].blocks,
  );
  const observation = {
    route,
    map,
    stage: w.stage,
    seed,
    kind: enemy.kind,
    form,
    position: { x: enemy.x, y: enemy.y, z: enemy.z },
    radius,
    collision,
    segments: enemy.segments?.map(({ x, y, z }) => ({ x, y, z })),
  };
  trace.push(observation);
  expect.soft(collision, JSON.stringify(observation)).toBe(false);
}

function createEntry(
  w: World,
  kind: Enemy["kind"],
  form: BossForm,
  map: number,
  seed: number,
  route: string,
) {
  const before = w.enemies.length;
  let enemy: Enemy | undefined;
  let error: string | undefined;
  try {
    enemy = spawn(w, kind, undefined, undefined, form);
  } catch (failure) {
    error = String(failure);
  }
  const context = { route, map, stage: w.stage, seed, kind, form, error };
  expect.soft(error, JSON.stringify(context)).toBeUndefined();
  expect.soft(w.enemies.length, JSON.stringify(context)).toBe(before + 1);
  if (enemy) placement(w, enemy, map, seed, route, form);
  else trace.push({ ...context, created: false });
  return enemy;
}

for (const contract of CONTRACTS) {
  it(`${contract.label}: 採用済み編成と増援許可が固定表と一致する`, () => {
    const stages = STAGES.filter((stage) => stage.map === contract.map);
    expect(stages.map((stage) => stage.id)).toEqual(contract.stages);
    expect(MAPS[contract.map].biome).toBe(
      contract.map === 3 ? "grass" : contract.map === 4 ? "snow" : "cave",
    );
    expect(HARROW_BRANCH.map === contract.map).toBe(contract.branch);
    const plans = contract.branch ? [...stages, HARROW_BRANCH] : stages;
    const troops = plans.flatMap((plan) =>
      plan.waves.flatMap((wave) =>
        Object.entries(wave.troops)
          .filter(([, count]) => count > 0)
          .map(([kind]) => kind),
      ),
    );
    const bosses = plans.flatMap((plan) =>
      plan.waves.flatMap((wave) => wave.bosses),
    );
    expect(sorted(troops)).toEqual(sorted(contract.troops));
    expect(sorted(bosses)).toEqual(sorted(contract.bosses));
    expect(sorted(MAPS[contract.map].foundryAllowed ?? [])).toEqual(
      sorted(contract.foundry),
    );
  });

  it(`${contract.label}: 元条件の床全体が接続する`, () => {
    const blocks = MAPS[contract.map].blocks;
    const open = new Set<string>();
    for (let x = -92; x <= 92; x += 2)
      for (let z = -102; z <= 102; z += 2)
        if (!blocked(x, z, 0.55, 0, blocks)) open.add(`${x},${z}`);
    const queue = [[0, 0]],
      seen = new Set(["0,0"]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      for (const [dx, dz] of [
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        const key = `${x + dx},${z + dz}`;
        if (open.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push([x + dx, z + dz]);
        }
      }
    }
    expect(seen.size).toBe(open.size);
    trace.push({
      route: "floor",
      map: contract.map,
      open: open.size,
      seen: seen.size,
    });
  });

  it.each(SEEDS)(`${contract.label}: 通常出現の最終位置 seed=%i`, (seed) => {
    const w = createWorld("adopted-entries", seed, contract.entryStage);
    expect(mapFor(w).blocks).toBe(MAPS[contract.map].blocks);
    for (const kind of contract.troops)
      createEntry(w, kind, "crown", contract.map, seed, "direct-troop");
    for (const form of contract.bosses)
      createEntry(w, "boss", form, contract.map, seed, "direct-boss");
  });

  // 未抽選キューと、合法な抽選済みキューの各種を同じ実増援処理へ渡す。
  // 初期化で頭の撃破直後を作る。戦闘step・乱数のmock・配置値の修正はしない。
  for (const kind of [undefined, ...contract.foundry]) {
    const route = kind ? "foundry-pinned" : "foundry-random";
    it.each(SEEDS)(
      `${contract.label}: ${route}/${kind ?? "抽選"} seed=%i`,
      (seed) => {
        const w = createWorld("adopted-foundry", seed, contract.foundryStage);
        expect(mapFor(w).blocks).toBe(MAPS[contract.map].blocks);
        const boss = createEntry(
          w,
          "boss",
          "worm",
          contract.map,
          seed,
          `${route}-source`,
        );
        if (!boss) return;
        queueFoundrySpawn(w, boss);
        const batch = w.foundrySpawns?.[0];
        expect(
          batch,
          `増援元なし map=${contract.map} seed=${seed}`,
        ).toBeDefined();
        if (!batch) return;
        const expected = batch.parts.length;
        expect(expected).toBeGreaterThan(0);
        if (kind) batch.kinds = batch.parts.map(() => kind);
        boss.hp = 0;
        flushFoundrySpawns(w);
        const children = w.enemies.filter(
          (enemy) => enemy.foundrySource === boss.id,
        );
        const result = {
          route,
          map: contract.map,
          stage: w.stage,
          seed,
          requestedKind: kind ?? "random",
          source: { x: boss.x, y: boss.y, z: boss.z },
          expected,
          created: children.length,
          pending: w.foundrySpawns?.map(({ kinds, parts }) => ({
            kinds,
            parts,
          })),
        };
        trace.push(result);
        expect.soft(children.length, JSON.stringify(result)).toBe(expected);
        for (const child of children) {
          expect
            .soft(contract.foundry, JSON.stringify(result))
            .toContain(child.kind);
          if (kind) expect.soft(child.kind, JSON.stringify(result)).toBe(kind);
          placement(w, child, contract.map, seed, route, "crown");
        }
      },
    );
  }
}
