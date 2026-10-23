import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/play-polish-20261022/harrow";
fs.mkdirSync(out, { recursive: true });
// 既存の開発用プレビューへ検証専用参照を加える。配布ソースは変更しない。
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "HARROW検証参照",
      transform(code, id) {
        if (id.replaceAll("\\", "/").endsWith("/scripts/harrow-preview.ts"))
          return (
            code +
            "\nwindow.polishProbe={renderer,seekSpin,draw,setCamera(){overview=false;groundCamera=true;},get world(){return w;}};"
          );
      },
    },
  ],
});
let browser;
const results = { passed: false, errors: [], views: [] };
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto(
    server.resolvedUrls.local[0] + "scripts/harrow-preview.html",
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () =>
      window.polishProbe &&
      document.querySelector("#status")?.textContent.includes("GLB loaded"),
    {},
    { timeout: 120000 },
  );
  for (const time of [0.6, 1.15, 1.675]) {
    await page.evaluate((time) => {
      polishProbe.seekSpin(time);
      polishProbe.setCamera();
      polishProbe.draw(0);
    }, time);
    await page
      .locator("aside")
      .evaluate((e) => (e.style.visibility = "hidden"));
    await page.screenshot({ path: out + "/spin-" + time + ".png" });
    results.views.push(
      await page.evaluate(() => ({
        status: JSON.parse(document.querySelector("#status").textContent),
        camera: polishProbe.renderer.camera.position.toArray(),
        worldTime: polishProbe.world.time,
      })),
    );
  }
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack ?? error);
  console.error(results.failure);
  throw error;
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser?.close();
  await server.close();
}
console.log(
  JSON.stringify({ passed: results.passed, views: results.views.length }),
);
