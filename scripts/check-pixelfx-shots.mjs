import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";

await mkdir("output/pixelfx-battle", { recursive: true });
await mkdir("docs/evidence/pixelfx-battle-20261103", { recursive: true });
const bundle = await build({
  entryPoints: ["scripts/pixelfx-shot-preview.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  loader: { ".png": "dataurl" },
  write: false,
});
const script = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#151b20;color:white;font:16px sans-serif}.panels{display:flex;gap:4px}.panel{width:400px}.panel p{margin:8px}canvas{width:400px;height:300px}</style><div class="panels"><div class="panel"><p>発砲</p><canvas></canvas></div><div class="panel"><p>着弾</p><canvas></canvas></div><div class="panel"><p>酸</p><canvas></canvas></div></div><script>${script}</script>`;
const path = resolve("output/pixelfx-battle/shots.html");
await writeFile(path, html);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1212, height: 360 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path).href);
  await page.waitForFunction(() => window.shotFxReady === true, null, {
    timeout: 30000,
  });
  const states = [];
  for (const time of [0.02, 0.05]) {
    const result = await page.evaluate((t) => window.sampleShotFx(t), time);
    assert.ok(result.every((item) => item.exists && item.mapped));
    states.push({ time, result });
    await page.screenshot({
      path: `docs/evidence/pixelfx-battle-20261103/shots-${Math.round(time * 100)}.png`,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "docs/evidence/pixelfx-battle-20261103/shots.json",
    JSON.stringify({ states, errors }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ states, errors }));
} finally {
  await browser.close();
}
