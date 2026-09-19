import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const server = await createServer({
  server: { hmr: false, port: 5397, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5397/e2e/structure-fixture.html");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { Renderer } = await import("/src/client/render.ts"),
      g = await import("/src/shared/game.ts"),
      m = await import("/src/shared/stages.ts");
    const canvas = document.createElement("canvas"),
      damage = document.createElement("div");
    damage.id = "damage";
    document.body.replaceChildren(canvas, damage);
    document.body.style.margin = "0";
    window.qa = { T, g, m, view: new Renderer(canvas) };
  });
  const rows = [];
  for (let stage = 1; stage <= 20; stage++) {
    await page.evaluate((stage) => {
      const { g, view } = window.qa,
        w = g.createWorld("sizes-" + stage, 42, stage);
      g.addPlayer(w, "p");
      w.phase = "battle";
      ["ant", "crawler", "spider", "spitter", "hornet", "boss"].forEach(
        (kind, i) => g.spawn(w, kind, -16 + i * 6, 0),
      );
      w.enemyOrdinal = 31;
      g.spawn(w, "boss", -18, -18, "worm");
      window.qa.w = w;
      view.render(w, "p", 1, 0, 0);
    }, stage);
    await page.waitForFunction(
      () => {
        const { view, w, m } = window.qa;
        return (
          view.mapAssets.status[m.stageFor(w).map].state === "ready" &&
          [...view.foundryWorms.values()].every((s) => s.view)
        );
      },
      null,
      { timeout: 60000 },
    );
    const row = await page.evaluate((stage) => {
      const { view, w, T } = window.qa;
      view.render(w, "p", 0.05, 0, 0);
      const scale = new T.Vector3(),
        q = new T.Quaternion(),
        p = new T.Vector3(),
        matrix = new T.Matrix4();
      const enemies = w.enemies
        .filter((e) => !e.segments)
        .map((e) => {
          view.enemies.get(e.kind).getMatrixAt(0, matrix);
          matrix.decompose(p, q, scale);
          return { kind: e.kind, want: e.size * 1.5, actual: scale.x };
        });
      const worm = [...view.foundryWorms.values()].find((s) => s.view).view;
      const head = worm.units[0];
      head.getWorldPosition(p);
      return {
        stage,
        enemies,
        wormScale: worm.root.scale.x,
        headError: p.distanceTo(
          new T.Vector3(w.enemies[6].x, w.enemies[6].y, w.enemies[6].z),
        ),
      };
    }, stage);
    for (const e of row.enemies)
      assert.ok(Math.abs(e.want - e.actual) < 1e-5, JSON.stringify(e));
    assert.equal(row.wormScale, 3);
    assert.ok(row.headError < 1e-5, JSON.stringify(row));
    rows.push(row);
    if ([4, 6].includes(stage))
      await page.screenshot({
        path: `dist-validation/enemy-size/stage-${stage}.png`,
      });
  }
  fs.writeFileSync(
    "dist-validation/enemy-size/browser.json",
    JSON.stringify({ rows, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    "20 stages: instance scales, worm world position and assets passed",
  );
} finally {
  await browser.close();
  await server.close();
}
