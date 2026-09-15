import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/terrain-surface";
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({
  server: { port: 5497, strictPort: true, hmr: false },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [],
  rows = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:5497/e2e/map-detail-fixture.html");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { Renderer } = await import("/src/client/render.ts"),
      g = await import("/src/shared/game.ts"),
      m = await import("/src/shared/stages.ts"),
      t = await import("/src/shared/terrain.ts");
    const canvas = document.createElement("canvas"),
      damage = document.createElement("div");
    damage.id = "damage";
    document.body.replaceChildren(canvas, damage);
    document.body.style.margin = "0";
    window.qa = { T, view: new Renderer(canvas), g, m, t };
  });
  for (const quality of [1, 0.65])
    for (let index = 0; index < 6; index++) {
      await page.evaluate(
        ({ quality, index }) => {
          const { view, g, m, t } = window.qa,
            w = g.createWorld(
              "surface",
              42,
              m.STAGES.find((s) => s.map === index).id,
            ),
            p = g.addPlayer(w, "p");
          w.phase = "battle";
          p.x = index === 4 ? -7 : index === 3 ? -20 : 0;
          p.z = index === 5 ? 70 : -28;
          p.y = t.supportHeight(p.x, p.z, m.MAPS[index].blocks);
          view.quality = quality;
          view.resize();
          view.mapAssets.setQuality(quality);
          Object.assign(window.qa, { w, p });
          view.render(w, "p", 1, 0, -0.2);
        },
        { quality, index },
      );
      await page.waitForFunction(
        (index) => window.qa.view.mapAssets.status[index].state === "ready",
        index,
        { timeout: 90000 },
      );
      const report = await page.evaluate((index) => {
        const { view, w, m, t, g, T } = window.qa,
          map = m.MAPS[index];
        view.render(w, "p", 1, 0, -0.2);
        view.scene.updateMatrixWorld(true);
        const floors = [];
        view.mapAssets.groups[index].traverse((o) => {
          if (
            o.isMesh &&
            /^(road_asphalt|meadow_ground|granular_snow|earth)$/.test(o.name)
          )
            floors.push(o);
        });
        const ray = new T.Raycaster(),
          bad = [],
          missing = [];
        let samples = 0,
          maxError = 0,
          movement = 0;
        for (let x = -93; x <= 93; x += 3)
          for (let z = -103; z <= 103; z += 3) {
            if (
              map.blocks.some(
                (b) =>
                  Math.abs(x - b.x) < b.w / 2 + 1 &&
                  Math.abs(z - b.z) < b.d / 2 + 1,
              )
            )
              continue;
            const h = t.groundHeight(x, z, map.blocks);
            ray.set(
              new T.Vector3(x, index === 5 ? h + 1 : 150, z),
              new T.Vector3(0, -1, 0),
            );
            const hit = ray.intersectObjects(floors, false)[0];
            if (!hit) {
              if (index !== 5) missing.push([x, z]);
              continue;
            }
            const error = Math.abs(hit.point.y - h);
            samples++;
            maxError = Math.max(maxError, error);
            if (error > 0.08) bad.push([x, z, h, hit.point.y]);
            const p = { x, z, y: h };
            g.move(p, 0.12, 0.09, 0.3, map.blocks);
            if (
              Math.abs(p.y - t.supportHeight(p.x, p.z, map.blocks, p.y, 0.3)) >
              0.001
            )
              throw Error("Feet mismatch");
            movement++;
          }
        const mat = new T.Matrix4();
        mat.makeRotationX(-Math.PI / 2);
        mat.scale(new T.Vector3(7, 7, 1));
        mat.setPosition(window.qa.p.x, 0.1, window.qa.p.z - 7);
        view.rings.setMatrixAt(0, mat);
        view.rings.count = 1;
        view.rings.instanceMatrix.needsUpdate = true;
        view.renderer.render(view.scene, view.camera);
        return {
          index,
          quality: view.quality,
          samples,
          movement,
          maxError,
          bad: bad.slice(0, 12),
          missing: missing.slice(0, 12),
          relocated:
            view.mapAssets.groups[index].children[0].userData
              .backgroundTerrain ?? [],
        };
      }, index);
      rows.push(report);
      console.log(JSON.stringify(report));
      await page.screenshot({
        path: `${dir}/surface-${quality}-${index}.png`,
        timeout: 90000,
      });
      await page.evaluate(() => {
        const { view, T } = window.qa,
          camera = new T.OrthographicCamera(-150, 150, 85, -85, 1, 600);
        camera.position.set(0, 300, 0);
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
        view.renderer.render(view.scene, camera);
      });
      await page.screenshot({
        path: `${dir}/overview-${quality}-${index}.png`,
        timeout: 90000,
      });
    }
  fs.writeFileSync(
    `${dir}/browser.json`,
    JSON.stringify({ rows, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  for (const r of rows) {
    assert.deepEqual(r.bad, [], JSON.stringify(r));
    assert.deepEqual(r.missing, []);
    assert.ok(r.samples > 0);
  }
} finally {
  await browser.close();
  await server.close();
}
