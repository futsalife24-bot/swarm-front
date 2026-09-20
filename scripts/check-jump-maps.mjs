import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/jump-maps";
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { hmr: false, port: 5406, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 620 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultNavigationTimeout(120000);
  await page.goto(
    "http://127.0.0.1:5406/e2e/structure-fixture.html?drone=1&clean=1&droneSpeed=0",
  );
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    document.body.innerHTML =
      '<canvas id="world"></canvas><div id="damage"></div>';
    window.mapView = new Renderer(document.getElementById("world"));
  });
  for (const stage of process.env.JUMP_STAGES
    ? process.env.JUMP_STAGES.split(",").map(Number)
    : [1, 3, 5, 8, 11, 12, 2, 7, 13, 14, 10]) {
    const data = await page.evaluate(async (stage) => {
      const g = await import("/src/shared/game.ts");
      const { mapFor } = await import("/src/shared/stages.ts");
      const { prepareBattle } = await import("/src/client/battle-loading.ts");
      const view = window.mapView,
        w = g.createWorld("map-proof", 42, stage);
      const p = g.addPlayer(w, "p");
      w.phase = "battle";
      p.x = 0;
      p.z = 15;
      p.y = g.roofHeight(p.x, p.z, 0.55, mapFor(w).blocks);
      await prepareBattle(view, w, "p", () => false);
      view.drone.enabled = stage !== 10;
      view.drone.settings.radius = 58;
      view.drone.settings.height = 85;
      view.drone.settings.yaw = 0;
      for (let i = 0; i < 5; i++)
        view.render(w, "p", 1 / 30, 0, 0, undefined, false);
      window.mapWorld = w;
      return {
        stage,
        map: mapFor(w).name,
        blocks: mapFor(w).blocks.length,
        camera: view.camera.position.toArray(),
      };
    }, stage);
    await page.screenshot({ path: `${out}/stage-${stage}.png` });
    if (stage === 3) {
      await page.evaluate(() => {
        const view = window.mapView,
          w = window.mapWorld,
          p = w.players[0];
        p.x = 76;
        p.z = 5;
        p.y = 0;
        view.drone.settings.height = 16;
        view.drone.settings.radius = 18;
        view.drone.settings.yaw = -0.5;
        for (let n = 0; n < 20; n++)
          view.render(w, "p", 0.05, 0, 0, undefined, false);
      });
      await page.screenshot({ path: `${out}/annex-stairs.png` });
    }
    results.push(data);
    console.log(`map ${stage} ready`);
  }
  await page.close();
  const game = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  game.on("pageerror", (e) => errors.push(e.message));
  await game.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "ジャンプ検証"),
  );
  await game.goto("http://127.0.0.1:5406/");
  await game.locator("#solo").click();
  await game.getByRole("button", { name: "確定", exact: true }).click();
  await game.locator("#pt-start").click();
  await game.locator("#pt-enter").click({ timeout: 120000 });
  await game.locator("#pt-tutorial-skip").click({ timeout: 60000 });
  for (let n = 0; n < 150; n++) {
    if (await game.locator("#pt-intro-skip").isVisible())
      await game.locator("#pt-intro-skip").click();
    if (
      await game.evaluate(
        () =>
          window.__playtest.world.time > 5 &&
          !window.__playtest.encounterActive,
      )
    )
      break;
    await game.waitForTimeout(300);
  }
  for (const [width, height] of [
    [844, 390],
    [667, 375],
    [640, 280],
  ]) {
    await game.setViewportSize({ width, height });
    await game.waitForTimeout(300);
    await game.locator("#jump").waitFor({ state: "visible" });
    const button = await game.locator("#jump").boundingBox();
    const before = await game.evaluate(
      () => window.__playtest.world.players[0].y,
    );
    await game.keyboard.press("KeyF");
    await game.waitForFunction(
      (base) => window.__playtest.world.players[0].y > base + 0.2,
      before,
    );
    await game.screenshot({ path: `${out}/jump-${width}.png` });
    await game.waitForFunction(
      (base) => Math.abs(window.__playtest.world.players[0].y - base) < 0.01,
      before,
    );
    await game.locator("#jump").tap();
    await game.waitForFunction(
      (base) => window.__playtest.world.players[0].y > base + 0.2,
      before,
    );
    assert.ok(
      button &&
        button.x >= 0 &&
        button.y >= 0 &&
        button.x + button.width <= width &&
        button.y + button.height <= height,
    );
    results.push({ width, height, keyboard: true, touch: true, button });
    await game.waitForFunction(
      (base) => Math.abs(window.__playtest.world.players[0].y - base) < 0.01,
      before,
    );
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
  await server.close();
}
