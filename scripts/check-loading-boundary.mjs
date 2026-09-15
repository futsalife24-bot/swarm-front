// Local-only real browser verification; asset requests are delayed/failed deliberately.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5186";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "local only",
);
const out = "dist-validation/playability-six/loading";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
const snapshot = (page) =>
  page.evaluate(() => {
    const d = window.__playtest;
    return {
      screen: d.screen,
      time: d.world?.time,
      phase: d.world?.phase,
      map: d.mapAssets[0],
      trooper: d.trooper,
    };
  });
async function launch(page) {
  await page.goto(base);
  if (await page.locator("#landscape-start").isVisible())
    await page.locator("#landscape-start").click();
  await page.locator("#solo").click();
  await page.locator("#player-name").fill("読込検証隊員");
  await page.locator("#player-name-form button[type=submit]").click();
  if (await page.locator("#pt-confirm").isVisible())
    await page.locator("#pt-confirm").click();
  await page.locator("#pt-start").click();
  await page.locator(".pt-loading").waitFor();
}
try {
  for (const scenario of ["delayed-map", "delayed-trooper", "failed-map"]) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let intercepted = 0;
    const asset =
      scenario === "delayed-trooper"
        ? "**/standard_trooper_v9.glb"
        : "**/assets/maps/map_0_v1.glb";
    await context.route(asset, async (route) => {
      intercepted++;
      if (scenario === "failed-map") await route.abort("failed");
      else {
        await gate;
        await route.continue();
      }
    });
    const result = { scenario };
    try {
      await launch(page);
      if (scenario.startsWith("delayed-")) {
        if (scenario === "delayed-map")
          await page.waitForFunction(
            () => window.__playtest.mapAssets[0].state === "loading",
          );
        const before = await snapshot(page);
        await page.waitForTimeout(3000);
        const held = await snapshot(page);
        assert.equal(held.screen, "loading");
        assert.equal(held.time, before.time);
        if (scenario === "delayed-map")
          assert.notEqual(held.map.state, "ready");
        else assert.equal(held.trooper.loaded, false);
        await page.screenshot({ path: `${out}/${scenario}-held.png` });
        release();
        await page.locator("#pt-enter").waitFor({ state: "visible" });
        const prepared = await snapshot(page);
        assert.equal(prepared.screen, "loading");
        assert.equal(prepared.time, 0);
        assert.equal(prepared.map.state, "ready");
        assert.equal(prepared.trooper.loaded, true);
        await page.locator("#pt-enter").click();
        if (await page.locator("#pt-tutorial-skip").isVisible())
          await page.locator("#pt-tutorial-skip").click();
        await page.waitForFunction(
          () => window.__playtest.screen === "battle",
          null,
          { timeout: 90000 },
        );
        const ready = await snapshot(page);
        assert.equal(ready.map.state, "ready");
        assert.equal(ready.trooper.loaded, true);
        result.before = before;
        result.held = held;
        result.prepared = prepared;
        result.ready = ready;
      } else {
        await page.locator("#pt-load-retry").waitFor();
        const failed = await snapshot(page);
        assert.equal(failed.screen, "loading");
        assert.equal(failed.map.state, "error");
        assert.match(
          await page.locator("#pt-load-error").innerText(),
          /読み込めません/,
        );
        await page.screenshot({ path: `${out}/${scenario}-error.png` });
        await page.locator("#pt-load-home").click();
        await page.locator("#solo").waitFor();
        const returned = await snapshot(page);
        assert.equal(returned.screen, "home");
        result.failed = failed;
        result.returned = returned;
      }
      assert.ok(intercepted > 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${scenario}-complete.png` });
      Object.assign(result, { intercepted, errors, passed: true });
    } catch (e) {
      Object.assign(result, {
        error: e.stack,
        errors,
        state: await snapshot(page),
        body: await page.locator("body").innerText(),
      });
      await page.screenshot({ path: `${out}/${scenario}-failure.png` });
      throw e;
    } finally {
      release();
      results.push(result);
      fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
