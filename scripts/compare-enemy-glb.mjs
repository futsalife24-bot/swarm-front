// Before/after render comparison for re-encoded enemy GLBs.
// Prerequisites: `npx vite --host 127.0.0.1 --port 5199 --strictPort` in this worktree and
// the source GLBs copied to dist-validation/anomaly-before/.
//   node scripts/compare-enemy-glb.mjs [outDir]
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const base = process.env.COMPARE_BASE ?? "http://127.0.0.1:5199";
const out = process.argv[2] ?? "dist-validation/anomaly-compare";
mkdirSync(out, { recursive: true });
const cases = [
  ["harrow_motion_v14", "Idle", 1.0, true],
  ["harrow_motion_v14", "Attack", 2.4, true],
  ["harrow_motion_v14", "Flight", 5.0, true],
  ["leaper_motion_v3", "Idle", 1.0],
  ["leaper_motion_v3", "Leap", 0.45],
  ["pleat_motion_v5", "Idle", 1.0],
  ["pleat_motion_v5", "Lunge", 0.6],
  ["foundry_zero_motion_v1", "Idle", 1.0],
  ["foundry_zero_motion_v1", "Attack", 2.4],
  ["foundry_zero_mechanical_legs_v2", "", 0],
];
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

async function shot(file, clip, t, harrow, view, path) {
  const url = `${base}/scripts/enemy-glb-compare.html?file=${encodeURIComponent(file)}&clip=${clip}&t=${t}&view=${view}&harrow=${harrow ? 1 : 0}`;
  await page.goto(url, { timeout: 240000 });
  await page.waitForFunction(() => document.getElementById("status")?.textContent === "ready", null, { timeout: 240000 });
  const info = await page.evaluate(() => window.compareInfo);
  await page.locator("canvas").screenshot({ path });
  return info;
}

async function diff(a, b, path) {
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  const n = x.info.width * x.info.height;
  let sum = 0;
  let max = 0;
  let over8 = 0;
  const heat = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(x.data[i * 3 + c] - y.data[i * 3 + c]));
    sum += d;
    max = Math.max(max, d);
    if (d > 8) over8++;
    heat[i * 3] = Math.min(255, d * 16);
  }
  await sharp(heat, { raw: { width: x.info.width, height: x.info.height, channels: 3 } }).png().toFile(path);
  return { meanAbs: +(sum / n).toFixed(4), max, pixelsOver8Pct: +((over8 / n) * 100).toFixed(4) };
}

const results = [];
for (const [name, clip, t, harrow] of cases)
  for (const view of ["close", "game"]) {
    const tag = `${name}-${clip || "static"}-${view}`;
    const before = await shot(`/dist-validation/anomaly-before/${name}.glb`, clip, t, harrow, view, `${out}/${tag}-before.png`);
    const after = await shot(`/assets/enemies/${name}.glb`, clip, t, harrow, view, `${out}/${tag}-after.png`);
    const d = await diff(`${out}/${tag}-before.png`, `${out}/${tag}-after.png`, `${out}/${tag}-diff.png`);
    results.push({ tag, ...d, trianglesBefore: before.triangles, trianglesAfter: after.triangles, callsBefore: before.calls, callsAfter: after.calls });
    console.log(JSON.stringify(results.at(-1)));
  }
writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
if (errors.length) console.log("errors", errors);
await browser.close();
