import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const phase = process.argv[2] || "after";
const dir = `dist-validation/map-realism/${phase}`;
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({
  server: { port: 5498, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const errors = [],
  rows = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5498/e2e/map-detail-fixture.html");
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const g = await import("/src/shared/game.ts"),
      m = await import("/src/shared/stages.ts"),
      t = await import("/src/shared/terrain.ts");
    const canvas = document.createElement("canvas"),
      damage = document.createElement("div");
    damage.id = "damage";
    document.body.replaceChildren(canvas, damage);
    window.qa = { view: new Renderer(canvas), g, m, t };
  });
  for (const quality of [1, 0.65])
    for (let index = 0; index < 6; index++) {
      await page.evaluate(
        ({ index, quality }) => {
          const { view, g, m, t } = window.qa;
          view.quality = quality;
          view.resize();
          view.mapAssets.setQuality(quality);
          const w = g.createWorld(
              "realism",
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
        { index, quality },
      );
      await page.waitForFunction(
        (i) => window.qa.view.mapAssets.status[i].state === "ready",
        index,
        { timeout: 90000 },
      );
      for (const angle of [0, 1.7]) {
        const row = await page.evaluate(
          ({ index, quality, angle }) => {
            const { view, w } = window.qa;
            for (let i = 0; i < 3; i++)
              view.render(w, "p", 1 / 60, angle, -0.12);
            let low = 0,
              high = 0,
              vertices = 0,
              tiles = 0;
            view.mapAssets.groups[index].traverse((o) => {
              if (o.userData.mapDetail) {
                const d = o.userData.mapDetail;
                low += d.lowTriangles;
                high += d.highTriangles;
                tiles += d.tiles;
                vertices += o.geometry.attributes.position.count;
              }
            });
            return {
              index,
              quality,
              angle,
              low,
              high,
              vertices,
              tiles,
              triangles: view.renderer.info.render.triangles,
              calls: view.renderer.info.render.calls,
            };
          },
          { index, quality, angle },
        );
        rows.push(row);
        await page.screenshot({
          path: `${dir}/${quality}-map-${index}-${angle}.png`,
          timeout: 90000,
        });
      }
    }
  fs.writeFileSync(
    `${dir}/checks.json`,
    JSON.stringify({ rows, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  if (phase === "after") {
    const before = JSON.parse(
      fs.readFileSync("dist-validation/map-realism/before/checks.json"),
    ).rows;
    rows.forEach((r, i) => {
      // Whole-renderer counters include asynchronously loaded actors/scenery.
      // The immutable map LOD counts are the polygon budget, independent of IO.
      for (const key of ["low", "high", "tiles"])
        assert.equal(r[key], before[i][key], `${i} ${key}`);
      assert.ok(r.vertices <= before[i].vertices, `${i} vertex budget`);
    });
  }
  console.log(
    JSON.stringify({
      phase,
      views: rows.length,
      errors,
      geometryUnchanged: phase === "after",
    }),
  );
} finally {
  await browser.close();
  await server.close();
}
