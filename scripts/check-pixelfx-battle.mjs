import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { basename, dirname } from "node:path";

const out = "docs/evidence/pixelfx-battle-20261103";
const baseline = process.argv.includes("--baseline");
const baselineCommit = "b27b4af7691aeee7227ff094b63679078b065846";
await mkdir(out, { recursive: true });
await mkdir("output/pixelfx-battle", { recursive: true });
const bundle = await build({
  entryPoints: ["scripts/pixelfx-battle-preview.ts"],
  bundle: true,
  loader: { ".png": "dataurl" },
  format: "iife",
  platform: "browser",
  write: false,
  plugins: baseline
    ? [
        {
          name: "baseline-effects",
          setup(builder) {
            builder.onLoad(
              { filter: /(?:combat-effects|enemy-spawn-effects)\.ts$/ },
              (args) => ({
                contents: execFileSync(
                  "git",
                  [
                    "show",
                    `${baselineCommit}:src/client/${basename(args.path)}`,
                  ],
                  { encoding: "utf8" },
                ),
                loader: "ts",
                resolveDir: dirname(args.path),
              }),
            );
          },
        },
      ]
    : [],
});
const models = {
  hound: (await readFile("public/assets/enemies/hound_motion_v1.glb")).toString(
    "base64",
  ),
  ray: (await readFile("public/assets/enemies/ray_motion_v1.glb")).toString(
    "base64",
  ),
};
const script =
  `window.fxModels=${JSON.stringify(models)};\n${bundle.outputFiles[0].text}`.replaceAll(
    "</script",
    "<\\/script",
  );
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>ドット風エフェクト検証</title><style>body{margin:0;background:#151b20;color:white;font:16px sans-serif}.panels{display:flex;gap:4px}.panel{width:400px}.panel p{margin:8px}canvas{width:400px;height:300px}</style><div class="panels"><div class="panel"><p>爆風</p><canvas></canvas></div><div class="panel"><p>地上型の出現</p><canvas></canvas></div><div class="panel"><p>転移型の出現</p><canvas></canvas></div></div><script>${script}</script></html>`;
const htmlPath = resolve(
  `output/pixelfx-battle/preview${baseline ? "-baseline" : ""}.html`,
);
await writeFile(htmlPath, html);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1212, height: 360 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => window.fxReady === true, null, {
    timeout: 30000,
  });
  if (!baseline)
    await page.waitForFunction(() => window.pixelfxReady === true, null, {
      timeout: 30000,
    });
  const results = [];
  for (const seconds of [0.15, 0.4, 0.75]) {
    const result = await page.evaluate(
      (time) => window.sampleFx(time),
      seconds,
    );
    assert.deepEqual(result.arrivals, [1, 1]);
    assert.ok(result.blast > 0);
    if (!baseline) {
      assert.equal(result.spriteBlast, 1);
      assert.deepEqual(result.spriteArrivals, [true, true]);
    }
    results.push({ seconds, ...result });
    await page.screenshot({
      path: `${out}/${baseline ? "baseline-" : ""}phase-${Math.round(seconds * 100)}.png`,
    });
  }
  const crowd = baseline
    ? null
    : await page.evaluate(() => window.checkFxCrowd());
  if (!baseline)
    assert.deepEqual(crowd, {
      active: 24,
      stamps: 8,
      paused: true,
      ended: true,
      noReplay: true,
      unchanged: true,
    });
  const occlusion = await page.evaluate(() => window.checkFxOcclusion());
  assert.deepEqual(occlusion, [true, true, true]);
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/${baseline ? "baseline" : "preview"}.json`,
    JSON.stringify(
      {
        results,
        crowd,
        occlusion,
        errors,
        scope:
          "独立比較シーン。実エフェクトクラスとHOUND/RAYモデル、簡易地面。実戦・実機ではない。",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ results, crowd, occlusion, errors }));
} finally {
  await browser.close();
}
