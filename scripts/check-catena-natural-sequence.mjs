// Capture one real-Renderer takeoff-to-landing sequence from the local fixture.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const out = "dist-validation/catena-omega/natural-sequence";
mkdirSync(out, { recursive: true });
const vite = await createServer({
  configFile: false,
  cacheDir: "docs/evidence/catena-resume-20261110/tmp/natural-vite-cache",
  optimizeDeps: { noDiscovery: true },
  server: { host: "127.0.0.1", port: 5197, strictPort: true },
});
let browser,
  page,
  stage = "vite";
const requests = { failed: [], glb: [] };
try {
  await vite.listen();
  console.log("vite-ready");
  stage = "browser";
  browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("requestfailed", (request) =>
    requests.failed.push({
      file: request.url().split("/").at(-1),
      reason: request.failure()?.errorText,
    }),
  );
  page.on("response", (response) => {
    if (response.url().endsWith(".glb"))
      requests.glb.push({
        file: response.url().split("/").at(-1),
        status: response.status(),
      });
  });
  stage = "navigation";
  await page.goto(
    "http://127.0.0.1:5197/scripts/catena-omega-preview.html?game=1",
    { timeout: 120000, waitUntil: "commit" },
  );
  console.log("page-committed");
  stage = "GLB/Renderer";
  await page.waitForFunction(() => window.__omega, null, { timeout: 240000 });
  console.log("fixture-ready");
  stage = "frames";
  const times = [1.6, 2.3, 2.75, 3.05, 3.35, 3.7, 4.1, 4.45];
  const frames = [];
  for (const [index, time] of times.entries()) {
    const frame = await page.evaluate((at) => window.__omega.frame(at), time);
    const name = `${String(index).padStart(2, "0")}-${time.toFixed(2)}.png`;
    writeFileSync(
      `${out}/${name}`,
      Buffer.from(frame.png.split(",")[1], "base64"),
    );
    const gaps = frame.nodes
      .slice(1)
      .map((node, i) =>
        Math.hypot(
          node.x - frame.nodes[i].x,
          node.y - frame.nodes[i].y,
          node.z - frame.nodes[i].z,
        ),
      );
    frames.push({
      name,
      time,
      phase: frame.phase ?? "landed",
      pads: frame.pads,
      hp: frame.hp,
      maxGap: Math.max(...gaps),
      minHeight: Math.min(...frame.nodes.map((n) => n.y)),
      maxHeight: Math.max(...frame.nodes.map((n) => n.y)),
    });
  }
  assert.equal(errors.length, 0);
  assert.equal(frames[1].pads, 15);
  assert.equal(frames.at(-1).pads, 0);
  assert.ok(frames.at(-1).hp < frames[0].hp);
  writeFileSync(
    `${out}/sequence.json`,
    JSON.stringify({ frames, errors }, null, 2),
  );
  console.log(JSON.stringify({ frames, errors }));
} catch (error) {
  console.error(
    JSON.stringify({
      stage,
      requests,
      readyState: await page
        ?.evaluate(() => document.readyState)
        .catch(() => "unavailable"),
    }),
  );
  throw error;
} finally {
  await browser?.close();
  await vite.close();
}
