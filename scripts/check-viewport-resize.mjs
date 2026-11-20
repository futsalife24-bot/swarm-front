import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "ts",
    contents: `import {Renderer} from './src/client/render'; window.createViewportRenderer=(canvas)=>new Renderer(canvas);`,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  outfile: "viewport.js",
  loader: { ".png": "dataurl", ".css": "empty" },
  define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.DEV": "false" },
  logLevel: "silent",
});
const javascript = bundle.outputFiles.find((file) =>
  file.path.endsWith(".js"),
).text;
const root = process.cwd();
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/mobile-ui.css"><canvas id="world"></canvas><div id="damage"></div>',
    );
    return;
  }
  const file = path.resolve(root, "." + req.url);
  if (!file.startsWith(root + path.sep) || !existsSync(file))
    return res.writeHead(404).end();
  res.setHeader("Content-Type", "text/css");
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(5198, "127.0.0.1", resolve));
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
const output = "dist-validation/viewport-resize";
mkdirSync(output, { recursive: true });
try {
  for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("http://127.0.0.1:5198/", {
        timeout: 120000,
      });
      await page.addScriptTag({ content: javascript });
      await page.evaluate(() => {
        window.__viewportView = window.createViewportRenderer(
          document.querySelector("#world"),
        );
      });
      for (const [width, height] of [
        [844, 390],
        [1280, 720],
        [1920, 1080],
      ]) {
        await page.setViewportSize({ width, height });
        const rows = await page.evaluate(() => {
          const view = window.__viewportView;
          const snapshot = () => {
            const canvas = view.renderer.domElement;
            const rect = canvas.getBoundingClientRect();
            const viewport = view.renderer.getViewport({
              copy(value) {
                Object.assign(this, value);
                return this;
              },
            });
            return {
              inner: [innerWidth, innerHeight],
              css: [rect.x, rect.y, rect.width, rect.height],
              buffer: [canvas.width, canvas.height],
              viewport: [viewport.x, viewport.y, viewport.z, viewport.w],
              aspect: view.camera.aspect,
              center: [
                document.documentElement.style.getPropertyValue(
                  "--view-center-x",
                ),
                document.documentElement.style.getPropertyValue(
                  "--view-center-y",
                ),
              ],
            };
          };
          view.quality = 1;
          view.resize();
          const fullQuality = snapshot();
          view.quality = 0.65;
          view.resize();
          const lowerQuality = snapshot();
          return { fullQuality, lowerQuality };
        });
        for (const row of Object.values(rows)) {
          assert.deepEqual(row.inner, [width, height]);
          assert.deepEqual(row.css, [0, 0, width, height]);
          assert.deepEqual(row.viewport, [0, 0, width, height]);
          assert.equal(row.aspect, width / height);
          assert.deepEqual(row.center, [`${width / 2}px`, `${height / 2}px`]);
        }
        const pixelRatio = Math.min(dpr, 1.5);
        assert.deepEqual(rows.fullQuality.buffer, [
          Math.floor(width * pixelRatio),
          Math.floor(height * pixelRatio),
        ]);
        assert.deepEqual(rows.lowerQuality.buffer, [
          Math.floor(width * pixelRatio * 0.65),
          Math.floor(height * pixelRatio * 0.65),
        ]);
        results.push({ width, height, dpr, ...rows });
        if ((width === 844 && dpr === 1) || (width === 1920 && dpr === 3)) {
          await page.evaluate(() => {
            const view = window.__viewportView;
            view.renderer.render(view.scene, view.camera);
          });
          await page.screenshot({
            path: `${output}/${width}x${height}-dpr${dpr}.png`,
          });
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ cases: results.length, output }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
