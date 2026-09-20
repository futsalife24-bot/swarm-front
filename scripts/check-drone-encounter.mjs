import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/drone-capture/encounter";
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { hmr: false, port: 5403, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 667, height: 375 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    "http://127.0.0.1:5403/e2e/structure-fixture.html?drone=1&clean=1&droneRadius=0&droneHeight=48&droneYaw=45&droneSpeed=0",
  );
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const { prepareBattle } = await import("/src/client/battle-loading.ts");
    const { encounterCamera } = await import("/src/client/encounter-camera.ts");
    const g = await import("/src/shared/game.ts");
    document.body.innerHTML =
      '<canvas id="world"></canvas><div id="damage"></div>';
    const view = new Renderer(document.getElementById("world"));
    const w = g.createWorld("drone-encounter", 42, 1);
    const p = g.addPlayer(w, "p");
    p.x = 0;
    p.z = 0;
    w.phase = "battle";
    g.spawn(w, "ant", 4, -5);
    await prepareBattle(view, w, "p", () => false);
    for (let i = 0; i < 5; i++) view.render(w, "p", 1 / 30, 0, 0, undefined, false);
    window.fixture = {
      view,
      w,
      encounterCamera,
      before: view.camera.clone(),
      world: JSON.stringify(w),
    };
  });
  const results = [];
  for (const heading of [0, 90, 180, 270]) {
    const row = await page.evaluate((heading) => {
      const { view, w, encounterCamera, before, world } = window.fixture;
      const focus = before.position.clone().set(4, 2, -5);
      const front = focus
        .clone()
        .set(
          Math.sin((heading * Math.PI) / 180),
          0,
          Math.cos((heading * Math.PI) / 180),
        );
      const sample = encounterCamera(before.clone(), focus, front, 10);
      const camera = sample(1);
      const right = focus
        .clone()
        .set(1, 0, 0)
        .applyQuaternion(camera.quaternion);
      const up = focus.clone().set(0, 1, 0).applyQuaternion(camera.quaternion);
      view.renderer.render(view.scene, camera);
      return {
        heading,
        rightY: right.y,
        upY: up.y,
        sharedUp: view.camera.up.toArray(),
        worldUnchanged: world === JSON.stringify(w),
      };
    }, heading);
    assert.ok(Math.abs(row.rightY) < 1e-7);
    assert.ok(row.upY > 0.9);
    assert.deepEqual(row.sharedUp, [0, 1, 0]);
    assert.ok(row.worldUnchanged);
    await page.screenshot({ path: `${out}/667-heading-${heading}.png` });
    results.push(row);
  }
  const restored = await page.evaluate(() => {
    const { view, w, before } = window.fixture;
    const rendered = view.render(w, "p", 1 / 30, 0, 0, undefined, false);
    return {
      rendered,
      angle: before.quaternion.angleTo(view.camera.quaternion),
      distance: before.position.distanceTo(view.camera.position),
    };
  });
  assert.equal(restored.rendered, true);
  assert.ok(restored.angle < 1e-7);
  assert.ok(restored.distance < 1e-7);
  await page.screenshot({ path: `${out}/667-return-top.png` });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        restored,
        errors,
        note: "Static QA world rendered with real Renderer, Three.js and encounterCamera; not the automatic gameplay trigger.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.close();
}
