import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const dir = process.env.MAP_QUALITY_DIR || "dist-validation/map-detail/verified";
mkdirSync(dir, { recursive: true });
const server = await createServer({
  optimizeDeps: { noDiscovery: true },
  server: { hmr: false, port: 5494, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const rows = [],
  errors = [],
  ui = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5494/e2e/map-detail-fixture.html");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    const { Renderer } = await import("/src/client/render.ts");
    const g = await import("/src/shared/game.ts"),
      m = await import("/src/shared/stages.ts"),
      t = await import("/src/shared/terrain.ts");
    const canvas = document.createElement("canvas"),
      damage = document.createElement("div");
    damage.id = "damage";
    document.body.replaceChildren(canvas, damage);
    document.body.style.margin = "0";
    window.qa = { view: new Renderer(canvas), g, m, t, T };
  });
  for (const quality of [1, 0.65])
    for (let index = 0; index < 6; index++) {
      await page.evaluate(
        ({ quality, index }) => {
          const { view, g, m, t } = window.qa;
          view.quality = quality;
          view.resize();
          view.mapAssets.setQuality(quality);
          const w = g.createWorld(
              "detail",
              42,
              m.STAGES.find((s) => s.map === index).id,
            ),
            p = g.addPlayer(w, "p");
          w.phase = "battle";
          [p.x, p.z] = [
            [-8, 20],
            [10, -8],
            [0, 20],
            [-18, 12],
            [-5, 15],
            [0, 75],
          ][index];
          p.y = t.supportHeight(p.x, p.z, m.MAPS[index].blocks);
          Object.assign(window.qa, { w, p });
          view.render(w, "p", 1, 0, -0.12);
        },
        { quality, index },
      );
      await page.waitForFunction(
        (index) => window.qa.view.mapAssets.status[index].state === "ready",
        index,
        { timeout: 90000 },
      );
      const result = await page.evaluate(
        async ({ quality, index }) => {
          const { view, w, m, t, T } = window.qa,
            map = m.MAPS[index];
          // RAF wall intervals include browser presentation; CPU submissions are not called FPS.
          const frames = [];
          let previous;
          for (let frame = 0; frame < 25; frame++) {
            const now = await new Promise(requestAnimationFrame);
            view.render(w, "p", 1 / 60, 0, -0.12);
            if (frame > 5) frames.push(now - previous);
            previous = now;
          }
          frames.sort((a, b) => a - b);
          let low = 0,
            high = 0,
            vertices = 0,
            bytes = 0,
            detailedTiles = 0,
            totalTiles = 0;
          const floors = [];
          view.mapAssets.groups[index].traverse((o) => {
            if (!o.isMesh) return;
            const detail = o.userData.mapDetail;
            if (detail) {
              low += detail.lowTriangles;
              high += detail.highTriangles;
              totalTiles += detail.tiles;
              detailedTiles += o.tiles.filter((t) => t.detailed).length;
              vertices += o.geometry.getAttribute("position").count;
              for (const a of Object.values(o.geometry.attributes))
                bytes += a.array.byteLength;
              bytes += o.geometry.index?.array.byteLength ?? 0;
            }
            if (
              /^(road_asphalt|meadow_ground|granular_snow|earth)$/.test(o.name)
            )
              floors.push(o);
          });
          const ray = new T.Raycaster(),
            surfaceErrors = [];
          for (let x = -85; x < 86; x += 10)
            for (let z = -95; z < 96; z += 10) {
              const h = t.groundHeight(x, z, map.blocks);
              if (
                h < 0.25 ||
                map.blocks.some(
                  (b) =>
                    Math.abs(x - b.x) < b.w / 2 + 1 &&
                    Math.abs(z - b.z) < b.d / 2 + 1,
                )
              )
                continue;
              ray.set(new T.Vector3(x, h + 1, z), new T.Vector3(0, -1, 0));
              const hit = ray.intersectObjects(floors, false)[0];
              if (hit) surfaceErrors.push(Math.abs(hit.point.y - h));
            }
          return {
            index,
            quality,
            triangles: view.renderer.info.render.triangles,
            calls: view.renderer.info.render.calls,
            low,
            high,
            vertices,
            geometryBytes: bytes,
            detailedTiles,
            totalTiles,
            surfaceSamples: surfaceErrors.length,
            maxSurfaceError: Math.max(...surfaceErrors),
            rafMedianMs: frames[Math.floor(frames.length / 2)],
            rafP95Ms: frames.at(-1),
            residentMaps: view.mapAssets.groups.filter((g) => g.children.length)
              .length,
            multiDraw: view.renderer.extensions.has("WEBGL_multi_draw"),
            detailed:
              view.mapAssets.groups[index].children[0].userData.detailed,
          };
        },
        { quality, index },
      );
      assert.equal(result.high, result.low * (quality === 1 ? 4 : 1));
      assert.equal(result.detailed, quality === 1);
      assert.equal(result.residentMaps, 1);
      assert.ok(result.surfaceSamples >= 20);
      assert.ok(result.maxSurfaceError < 0.08);
      rows.push(result);
      await page.screenshot({
        path: `${dir}/${quality}-map-${index}.png`,
        timeout: 90000,
      });
    }
  await page.close();
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 844, height: 390 },
  ]) {
    const p = await browser.newPage({
      viewport,
      hasTouch: viewport.width === 844,
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5494");
    await p.locator("#home-settings").click();
    await p.locator("#quality").selectOption("0.65");
    await p.reload();
    await p.locator("#home-settings").click();
    assert.equal(await p.locator("#quality").inputValue(), "0.65");
    await p.screenshot({ path: `${dir}/settings-${viewport.width}.png` });
    await p.reload();
    await p.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await p.locator("#stage-select").selectOption("5");
    await p.locator("#launch").click();
    await p.waitForFunction(
      () => window.__swarm?.mapAssets[1].state === "ready",
      {},
      { timeout: 90000 },
    );
    await p.locator("#pause").click();
    assert.equal(await p.locator("#pause-quality").inputValue(), "0.65");
    await p.locator("#pause-quality").selectOption("1");
    await p.locator("#pause-resume").click();
    await p.waitForFunction(
      () => window.__swarm?.mapAssets[1].state === "ready",
      {},
      { timeout: 90000 },
    );
    await p.locator("#pause").click();
    assert.equal(await p.locator("#pause-quality").inputValue(), "1");
    await p.locator("#pause-quality").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${dir}/pause-${viewport.width}.png` });
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem("swarm-front-save-v1")).quality,
      ),
      1,
    );
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.locator("#pause-quality").selectOption("0.65");
    await p.locator("#pause-resume").click();
    await p.waitForFunction(
      () => window.__swarm?.mapAssets[1].state === "ready",
      {},
      { timeout: 90000 },
    );
    ui.push({
      width: viewport.width,
      savedAfterReload: true,
      pauseSwitchBothWays: true,
      overflow: false,
    });
    await p.close();
  }
  writeFileSync(
    `${dir}/checks.json`,
    JSON.stringify({ rows, ui, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ rows, ui, errors }));
} finally {
  await browser.close();
  await server.close();
}

