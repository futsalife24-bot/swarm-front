// 旧PLEAT(足4本の接地計算)が平地で実際に進む速さを、指示速度とサイズごとに測る。
// 軽量化後の胴体中心の移動は、この表に合わせて速度・難易度を変えない。
// 実行: npx vitest run --config scripts/vitest.pleat-load.config.ts calibrate
// 基点の旧実装をgitから一時ファイルへ取り出して測るため、現行コードに依存しない。
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { it } from "vitest";

const BASE = "3035376932bbf3e0734e181b7040827bf033b80d";
// 製品のPLEATはscale=size×1.5、size≤1は指示5.25(突進11.55)、size>1は3.5(突進7.7)。
const SCALES = [
  1, 1.2, 1.275, 1.35, 1.425, 1.5, 1.575, 1.65, 1.725, 1.8, 1.95, 2.1, 2.25,
  2.625, 3,
];
const SPEEDS = [1, 1.5, 2, 3.5, 5.25, 7.7, 11.55];

it("calibrate legacy PLEAT effective speed", async () => {
  const source = execFileSync(
    "git",
    ["show", `${BASE}:src/shared/pleat-locomotion.ts`],
    { encoding: "utf8" },
  )
    .replace('from "./surface-math"', 'from "../../src/shared/surface-math"')
    .replace('from "./surface-ray"', 'from "../../src/shared/surface-ray"');
  mkdirSync("scripts/.legacy", { recursive: true });
  writeFileSync("scripts/.legacy/pleat-locomotion.ts", source);
  try {
    const legacy = await import("./.legacy/pleat-locomotion");
    const { surfaceRay } = await import("../src/shared/surface-ray");
    const world = {
      ray: (
        o: { x: number; y: number; z: number },
        d: { x: number; y: number; z: number },
        m: number,
      ) => surfaceRay(o, d, m, []),
    };
    const dir = { x: 0, y: 0, z: -1 };
    const ratio: number[][] = [];
    const start: number[][] = [];
    for (const scale of SCALES) {
      const row: number[] = [],
        startRow: number[] = [];
      for (const speed of SPEEDS) {
        // 定常: 3秒慣らした後の30秒平均(20Hz更新と同じdt)。
        const s = legacy.createPleat({ x: 0, y: 0, z: 0 }, dir, scale, world);
        for (let i = 0; i < 60; i++)
          legacy.stepPleat(s, dir, speed, 0.05, world);
        const z0 = s.body.z;
        for (let i = 0; i < 600; i++)
          legacy.stepPleat(s, dir, speed, 0.05, world);
        row.push(Number(((z0 - s.body.z) / 30 / speed).toFixed(3)));
        // 静止から胴体が0.5m進むまでの秒数(攻撃後の再発進)。
        const r = legacy.createPleat({ x: 0, y: 0, z: 0 }, dir, scale, world);
        let t = 0;
        while (-r.body.z < 0.5 && t < 5) {
          legacy.stepPleat(r, dir, speed, 0.05, world);
          t += 0.05;
        }
        startRow.push(Number(t.toFixed(2)));
      }
      ratio.push(row);
      start.push(startRow);
    }
    mkdirSync("docs/evidence/pleat-lightweight-20261101", { recursive: true });
    writeFileSync(
      "docs/evidence/pleat-lightweight-20261101/legacy-speed.json",
      JSON.stringify(
        {
          base: BASE,
          method:
            "平地・直進、dt=0.05。ratio=30秒間の胴体移動距離÷(指示速度×30)。startSeconds=静止から胴体が0.5m進むまで",
          scales: SCALES,
          speeds: SPEEDS,
          ratio,
          startSeconds: start,
        },
        null,
        1,
      ) + "\n",
    );
  } finally {
    rmSync("scripts/.legacy", { recursive: true, force: true });
  }
}, 600000);
