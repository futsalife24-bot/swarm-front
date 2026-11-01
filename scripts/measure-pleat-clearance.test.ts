import { execFileSync } from "node:child_process";
// PLEATの量産負荷を、変更前後で同じ条件のまま比べる計測。
// 同じseed・地形(都市stage 1)・敵配置・入力列で、サーバー側の移動時間・
// 接地探索(surfaceRay)回数とサーバー時間を比較する。端末側は対象外。
// 実行: npx vitest run --config scripts/vitest.pleat-clearance-load.config.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { it, vi } from "vitest";

let selected:
  typeof import("../src/shared/pleat-locomotion").stepPleat | undefined;
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
      (selected ?? actual.stepPleat)(...args);
      counters.stepMs += performance.now() - begin;
      counters.steps++;
    },
  };
});

const { addPlayer, blocked, createWorld, neutral, spawn, start, step } =
  await import("../src/shared/game");
const { LIMITS } = await import("../src/shared/defs");
const { mapFor } = await import("../src/shared/stages");

const TICKS = 400; // 20秒 × 20Hz

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

it("same 96 PLEAT server scenario before and after clearance, three alternating runs", async () => {
  const source = execFileSync(
    "git",
    [
      "show",
      "640de79613c585c22c0b06e696942ed357af359e:src/shared/pleat-locomotion.ts",
    ],
    { encoding: "utf8" },
  ).replaceAll('from "./', 'from "../../src/shared/');
  mkdirSync("scripts/.acceptance-courses", { recursive: true });
  writeFileSync("scripts/.acceptance-courses/lightweight.ts", source);
  const before = await import("./.acceptance-courses/lightweight");
  const rows = [];
  for (let repeat = -1; repeat < 3; repeat++)
    for (const version of repeat % 2
      ? ["fixed", "before"]
      : ["before", "fixed"]) {
      selected = version === "before" ? before.stepPleat : undefined;
      const { w, p } = scenario(96),
        tickMs: number[] = [];
      counters.rays = counters.steps = counters.stepMs = 0;
      for (let tick = 0; tick < TICKS; tick++) {
        const now = performance.now();
        step(w, { [p.id]: input(tick) });
        tickMs.push(performance.now() - now);
      }
      if (repeat >= 0)
        rows.push({
          version,
          repeat,
          tickMedianMs: round(percentile(tickMs, 0.5)),
          tickP95Ms: round(percentile(tickMs, 0.95)),
          raysPerEnemyPerSecond: round(counters.rays / 96 / 20, 1),
          stepPleatMsTotal: round(counters.stepMs, 1),
        });
    }
  mkdirSync("docs/evidence/pleat-wall-fix-20261101", { recursive: true });
  writeFileSync(
    "docs/evidence/pleat-wall-fix-20261101/server-load.json",
    JSON.stringify(
      {
        method:
          "都市seed11、96体、20秒、同じ歩行入力、両方式を1回ずつウォームアップ後、旧軽量/修正を交互に3回。実回線・実スマホではない",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(rows));
}, 600000);
