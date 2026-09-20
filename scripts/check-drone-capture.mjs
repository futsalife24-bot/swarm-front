import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/drone-capture";
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { hmr: false, port: 5402, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  if (!process.env.DRONE_NORMAL_ONLY) {
    const page = await browser.newPage({
      viewport: { width: 844, height: 390 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:5402/e2e/structure-fixture.html?drone=1&clean=1&droneSpeed=0",
    );
    await page.evaluate(async () => {
      const { Renderer } = await import("/src/client/render.ts");
      const { prepareBattle } = await import("/src/client/battle-loading.ts");
      const g = await import("/src/shared/game.ts");
      document.body.innerHTML =
        '<canvas id="world"></canvas><div id="damage"></div>';
      const view = new Renderer(document.getElementById("world"));
      const w = g.createWorld("drone-visual", 42, 1);
      const p = g.addPlayer(w, "p");
      p.x = 0;
      p.z = 0;
      w.phase = "battle";
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI) / 12;
        g.spawn(
          w,
          i % 2 ? "ant" : "crawler",
          Math.sin(angle) * (12 + (i % 3) * 3),
          Math.cos(angle) * (12 + (i % 3) * 3),
        );
      }
      await prepareBattle(view, w, "p", () => false);
      window.fixture = { view, w };
    });
    for (const [width, height] of [
      [844, 390],
      [667, 375],
    ]) {
      await page.setViewportSize({ width, height });
      for (const mode of ["normal", "oblique", "top"]) {
        const data = await page.evaluate((mode) => {
          const { view, w } = window.fixture;
          const before = JSON.stringify(w);
          view.drone.enabled = mode !== "normal";
          view.drone.settings.radius = mode === "top" ? 0 : 24;
          view.drone.settings.height = mode === "top" ? 48 : 32;
          view.drone.settings.yaw = 0;
          for (let i = 0; i < 5; i++)
            view.render(w, "p", 1 / 30, 0, 0, undefined, false);
          return {
            camera: view.camera.position.toArray(),
            quaternion: view.camera.quaternion.toArray(),
            unchanged: JSON.stringify(w) === before,
            enemies: w.enemies.length,
            playerVisible: view.players.get("p").visible,
          };
        }, mode);
        assert.equal(data.unchanged, true);
        assert.equal(data.enemies, 24);
        assert.ok(data.playerVisible);
        assert.ok(data.camera[1] > (mode === "normal" ? 0 : 30));
        await page.screenshot({ path: `${out}/${width}-${mode}.png` });
        results.push({ width, height, mode, ...data });
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      `${out}/fixture-results.json`,
      JSON.stringify(
        {
          results,
          errors,
          note: "Deliberately staged ring for camera QA; does not alter actual enemy spawn rules.",
        },
        null,
        2,
      ),
    );
    await page.close();
    // Actual app: verify pause controls, keyboard camera movement and unchanged saved layout.
    const game = await browser.newPage({
      viewport: { width: 667, height: 375 },
      hasTouch: true,
      serviceWorkers: "block",
    });
    await game.addInitScript(() => {
      localStorage.setItem("swarm-front-player-name-v1", "撮影検証");
      window.uiErrors = [];
      window.addEventListener("error", (e) => window.uiErrors.push(e.message));
    });
    const appErrors = [];
    game.on("pageerror", (e) => appErrors.push(e.message));
    await game.goto("http://127.0.0.1:5402/?drone=1&clean=1&droneSpeed=0");
    await game.locator("#solo").click();
    await game.getByRole("button", { name: "確定", exact: true }).click();
    await game.locator("#pt-start").click();
    await game.locator("#pt-enter").click({ timeout: 120000 });
    await game.locator("#pt-tutorial-skip").click({ timeout: 60000 });
    await game.waitForTimeout(1000);
    const before = await game.evaluate(() => ({
      camera: window.__playtest.camera,
      layout: localStorage.getItem("swarm-front-controls-v1"),
    }));
    await game.keyboard.down("KeyI");
    await game.waitForTimeout(400);
    await game.keyboard.up("KeyI");
    const after = await game.evaluate(() => window.__playtest.camera);
    assert.ok(after.position[1] > before.camera.position[1]);
    await game.locator("#pause").click();
    await game.locator(".drone-tools summary").click();
    await game.waitForTimeout(300);
    const panelSize = await game
      .locator(".menu-dialog-body")
      .evaluate((el) => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    assert.ok(
      panelSize.scroll <= panelSize.height + 1,
      JSON.stringify(panelSize),
    );
    await game.screenshot({ path: `${out}/667-pause-controls.png` });
    await game
      .getByRole("slider", { name: "撮影カメラ 高さ", exact: true })
      .fill("48");
    await game.locator("[data-drone-top]").click();
    await game.locator("#pt-resume").click();
    await game.waitForTimeout(500);
    await game.screenshot({ path: `${out}/667-actual-top.png` });
    const actual = await game.evaluate(() => ({
      camera: window.__playtest.camera,
      layout: localStorage.getItem("swarm-front-controls-v1"),
      hud: getComputedStyle(document.getElementById("hud")).visibility,
      uiErrors: window.uiErrors,
    }));
    assert.equal(actual.layout, before.layout);
    assert.equal(actual.hud, "hidden");
    assert.ok(actual.camera.position[1] >= 48);
    assert.deepEqual(appErrors, []);
    assert.deepEqual(actual.uiErrors, []);
    fs.writeFileSync(
      `${out}/app-results.json`,
      JSON.stringify({ before, after, actual, errors: appErrors }, null, 2),
    );
    await game.close();
  }
  const normal = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  await normal.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "撮影検証"),
  );
  const normalErrors = [];
  normal.on("pageerror", (e) => normalErrors.push(e.message));
  await normal.goto("http://127.0.0.1:5402/");
  await normal.locator("#solo").click();
  await normal.getByRole("button", { name: "確定", exact: true }).click();
  await normal.locator("#pt-start").click();
  await normal.locator("#pt-enter").click({ timeout: 120000 });
  await normal.locator("#pt-tutorial-skip").click({ timeout: 60000 });
  const normalResults = [];
  for (const [width, height] of [
    [844, 390],
    [667, 375],
  ]) {
    await normal.setViewportSize({ width, height });
    await normal.waitForTimeout(300);
    const data = await normal.evaluate(() => ({
      camera: window.__playtest.camera,
      hud: getComputedStyle(document.getElementById("hud")).visibility,
    }));
    assert.ok(data.camera.position[1] < 8);
    assert.equal(data.hud, "visible");
    await normal.screenshot({ path: `${out}/${width}-no-flag.png` });
    await normal.locator("#pause").click();
    assert.equal(await normal.locator(".drone-tools").count(), 0);
    await normal.screenshot({ path: `${out}/${width}-no-flag-pause.png` });
    await normal.locator("#pt-resume").click();
    normalResults.push({ width, height, ...data });
  }
  assert.deepEqual(normalErrors, []);
  fs.writeFileSync(
    `${out}/normal-results.json`,
    JSON.stringify({ results: normalResults, errors: normalErrors }, null, 2),
  );
  await normal.close();
} finally {
  await browser.close();
  await server.close();
}
