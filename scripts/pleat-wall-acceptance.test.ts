// 壁・段差コースを旧PLEAT(基点の足4本方式)と現行の胴体中心方式で同条件に走らせ、
// 到達・所要時間・最長停止・胴体の最大移動・固体への侵入・レイ回数を比べる。
// 実行: npx vitest run --config scripts/vitest.pleat-load.config.ts compare
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { it, expect } from "vitest";
import type { Block } from "../src/shared/map-blocks";
import type { V3 } from "../src/shared/surface-math";

const BASE = "3035376932bbf3e0734e181b7040827bf033b80d";
type State = {
  anchor: V3;
  normal: V3;
  body: V3;
  up: V3;
  forward: V3;
  poseForward: V3;
  scale: number;
  transfer?: { age: number; duration?: number; convex: boolean };
  switches: number;
  settling: boolean;
};
type Controller = {
  createPleat(a: V3, f: V3, s: number, w: unknown): State;
  stepPleat(s: State, d: V3, v: number, dt: number, w: unknown): void;
};
const courses: {
  name: string;
  blocks: Block[];
  start: (scale: number) => V3;
  speed: number;
  goal: (s: State, scale: number) => boolean;
}[] = [
  {
    name: "生存戦の薄い外壁(厚さ2m・高さ4m)を越えて内側の地面へ",
    blocks: [{ x: 0, z: 48, w: 94, d: 2, h: 4 }],
    start: () => ({ x: 0, y: 0, z: 54 }),
    speed: 3.5,
    goal: (s) => s.anchor.z < 44 && s.normal.y > 0.9 && s.anchor.y < 0.1,
  },
  {
    name: "床→壁→屋上(高さ5m+サイズ)",
    blocks: [{ x: 0, z: -8, w: 20, d: 2, h: 6.5 }],
    start: () => ({ x: 0, y: 0, z: 0 }),
    speed: 3.5,
    goal: (s) => s.normal.y > 0.9 && s.anchor.y > 6.4,
  },
  {
    name: "屋上(高さ4m)の縁→壁を下る→床",
    blocks: [{ x: 0, z: 0, w: 12, d: 12, h: 4 }],
    start: () => ({ x: 0, y: 4, z: 0 }),
    speed: 3.5,
    goal: (s) => s.normal.y > 0.9 && s.anchor.y < 0.05 && s.anchor.z < -6.5,
  },
  {
    name: "床→壁→天井→薄板(厚さ0.3m)の外縁→板の上",
    blocks: [
      { x: 0, z: -5, w: 16, d: 2, h: 8 },
      { x: 0, z: 0, w: 16, d: 8, h: 4.3, terrainBase: 4 },
    ],
    start: () => ({ x: 0, y: 0, z: 1 }),
    speed: 1.5,
    goal: (s) => s.normal.y > 0.9 && s.anchor.y > 4.2,
  },
  {
    name: "低い段差(0.2m)へ上がる",
    blocks: [{ x: 0, z: -10, w: 12, d: 8, h: 0.2 }],
    start: () => ({ x: 0, y: 0, z: 0 }),
    speed: 3.5,
    goal: (s) => s.anchor.z < -7 && Math.abs(s.anchor.y - 0.2) < 0.02,
  },
];
function inside(p: V3, blocks: Block[]) {
  if (p.y < -0.02) return true;
  return blocks.some(
    (b) =>
      Math.abs(p.x - b.x) < b.w / 2 - 0.02 &&
      Math.abs(p.z - b.z) < b.d / 2 - 0.02 &&
      p.y > (b.terrainBase ?? 0) + 0.02 &&
      p.y < b.h - 0.02,
  );
}
async function loadLegacy(): Promise<Controller> {
  const source = execFileSync(
    "git",
    ["show", `${BASE}:src/shared/pleat-locomotion.ts`],
    { encoding: "utf8" },
  )
    .replace('from "./surface-math"', 'from "../../src/shared/surface-math"')
    .replace('from "./surface-ray"', 'from "../../src/shared/surface-ray"')
    .replace('from "./pleat-gait"', 'from "../../src/shared/pleat-gait"');
  mkdirSync("scripts/.acceptance-courses", { recursive: true });
  writeFileSync("scripts/.acceptance-courses/legacy.ts", source);
  return (await import("./.acceptance-courses/legacy")) as unknown as Controller;
}

it("compare legacy and body locomotion on wall courses", async () => {
  const legacy = await loadLegacy();

  {
    const current =
      (await import("../src/shared/pleat-locomotion")) as unknown as Controller;
    const { surfaceRay } = await import("../src/shared/surface-ray");
    const rows: Record<string, unknown>[] = [];
    for (const course of courses)
      for (const scale of [1.2, 1.5, 2.25, 3])
        for (const [label, c] of [
          ["before", legacy],
          ["lightweight", current],
        ] as const) {
          let rays = 0;
          const world = {
            ray: (o: V3, d: V3, m: number) => {
              rays++;
              return surfaceRay(o, d, m, course.blocks);
            },
          };
          const s = c.createPleat(
            course.start(scale),
            { x: 0, y: 0, z: -1 },
            scale,
            world,
          );
          const contacts: unknown[] = [],
            gates: unknown[] = [],
            transitions: {
              start: number;
              switch?: number;
              ready?: number;
              convex: boolean;
            }[] = [],
            frames: unknown[] = [];
          let active: (typeof transitions)[number] | undefined;
          let gateStart = -1,
            uniqueTicks = 0;
          let maxStep = 0,
            stuck = 0,
            longestStuck = 0,
            penetrations = 0,
            gated = 0,
            ticks = 0,
            done = false;
          for (; ticks < 1200 && !done; ticks++) {
            const before = { ...s.body };
            const hadTransfer = !!s.transfer,
              switches = s.switches;
            c.stepPleat(s, s.forward, course.speed, 0.05, world);
            expect(Object.values(s.body).every(Number.isFinite)).toBe(true);
            const now = (ticks + 1) * 0.05;
            if (!hadTransfer && s.transfer) {
              active = { start: now, convex: s.transfer.convex };
              transitions.push(active);
            }
            if (active && switches !== s.switches) active.switch = now;
            if (active && !s.transfer && !s.settling) {
              active.ready = now;
              active = undefined;
            }
            const moved = Math.hypot(
              s.body.x - before.x,
              s.body.y - before.y,
              s.body.z - before.z,
            );
            maxStep = Math.max(maxStep, moved);
            stuck = moved < 1e-3 ? stuck + 1 : 0;
            longestStuck = Math.max(longestStuck, stuck);
            if (s.transfer || s.settling) {
              gated++;
              if (gateStart < 0) gateStart = ticks;
            } else if (gateStart >= 0) {
              gates.push({
                start: gateStart * 0.05,
                end: ticks * 0.05,
                duration: (ticks - gateStart) * 0.05,
                switches: s.switches,
              });
              gateStart = -1;
            }
            let tickInside = false;
            const up = s.up,
              f = s.poseForward ?? s.forward;
            for (const [y, z] of [
              [0, -0.78],
              [0.244, -0.434],
              [0.302, 0.687],
              [0.302, 1.478],
            ]) {
              const p = {
                x: s.body.x + (up.x * y - f.x * z) * scale,
                y: s.body.y + (up.y * y - f.y * z) * scale,
                z: s.body.z + (up.z * y - f.z * z) * scale,
              };
              if (inside(p, course.blocks)) {
                penetrations++;
                tickInside = true;
                contacts.push({
                  time: now,
                  point: p,
                  local: [y, z],
                  solid: p.y < -0.02 ? "ground" : "block",
                  body: { ...s.body },
                  up: { ...s.up },
                  forward: { ...f },
                  anchor: { ...s.anchor },
                  normal: { ...s.normal },
                  transfer: s.transfer ? { ...s.transfer } : undefined,
                  settling: s.settling,
                  switches: s.switches,
                });
              }
            }
            if (tickInside) uniqueTicks++;
            if (course.name.includes("薄板") && (scale === 2.25 || scale === 3))
              frames.push({
                time: now,
                body: { ...s.body },
                up: { ...s.up },
                forward: { ...s.forward },
                poseForward: { ...s.poseForward },
                scale,
                anchor: { ...s.anchor },
                normal: { ...s.normal },
                speed: (s as unknown as { speed: number }).speed,
                phase: 0,
                settling: s.settling,
                switches: s.switches,
                transfer: s.transfer ? { ...s.transfer } : undefined,
              });
            done = course.goal(s, scale);
          }
          expect(done).toBe(true);
          if (frames.length) {
            mkdirSync("docs/evidence/pleat-wall-acceptance-20261101", {
              recursive: true,
            });
            writeFileSync(
              `docs/evidence/pleat-wall-acceptance-20261101/slab-${scale}-${label}.json`,
              JSON.stringify({ blocks: course.blocks, frames }),
            );
          }
          rows.push({
            course: course.name,
            scale,
            version: label,
            reached: done,
            seconds: Number((ticks * 0.05).toFixed(2)),
            longestStillSeconds: Number((longestStuck * 0.05).toFixed(2)),
            maxBodyMovePerTick: Number(maxStep.toFixed(3)),
            pointSamplesInsideSolid: penetrations,
            uniqueTicksInsideSolid: uniqueTicks,
            contacts,
            gates,
            transitions,
            attackGatedSeconds: Number((gated * 0.05).toFixed(2)),
            raysPerSecond: Math.round(rays / (ticks * 0.05)),
          });
        }
    mkdirSync("docs/evidence/pleat-wall-acceptance-20261101", {
      recursive: true,
    });
    writeFileSync(
      "docs/evidence/pleat-wall-acceptance-20261101/wall-courses.json",
      JSON.stringify(
        {
          base: BASE,
          method:
            "dt=0.05(20Hz)、入力は進行方向、最大60秒。胴体4点の固体内サンプル数と重複を除いたtick数を別々に数える。全メッシュの衝突判定ではない",
          rows,
        },
        null,
        1,
      ) + "\n",
    );
  }
}, 600000);
