import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const base = process.argv[2] ?? "http://127.0.0.1:5186",
  tag = process.argv[3] ?? "dev";
const results = [];
try {
  for (const entry of ["", "?playtest=1"])
    for (const [width, height] of [
      [640, 360],
      [844, 390],
      [1280, 582],
    ]) {
      const page = await browser.newPage({
          viewport: { width, height },
          hasTouch: true,
          isMobile: true,
          serviceWorkers: "block",
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.setDefaultTimeout(15000);
      await page.goto(base + "/" + entry);
      await page.locator("#home-settings").waitFor();
      if (await page.locator("#landscape-start").isVisible())
        await page.locator("#landscape-start").click();
      await page.locator("#home-settings").click();
      assert.equal(await page.locator("[role=tab]").count(), 0);
      assert.ok(await page.locator("#settings-save").isVisible());
      const bounds = await page.evaluate(() => {
        const l = document
            .querySelector("#settings-preferences")
            .getBoundingClientRect(),
          r = document.querySelector("#settings-save").getBoundingClientRect();
        return {
          left: l.x,
          right: r.x,
          leftWidth: l.width,
          rightWidth: r.width,
          bottom: r.bottom,
          viewport: innerHeight,
        };
      });
      assert.ok(bounds.right > bounds.left + bounds.leftWidth);
      assert.ok(bounds.bottom <= height);
      const name = `${tag}-${entry ? "playtest" : "main"}-${width}`;
      await page.screenshot({
        path: `dist-validation/controls-training/${name}-settings.png`,
      });
      await page.locator(entry ? "#pt-layout" : "#layout-settings").click();
      await page.locator("#layout-reset").click();
      assert.ok(await page.locator(".layout-toolbar").evaluate(e=>e.getBoundingClientRect().bottom<=88));
      const fire = page.locator("[data-layout-button=fire]");
      assert.equal(
        await fire.evaluate((e) => getComputedStyle(e).borderRadius),
        "50%",
      );
      await page.locator("#layout-opacity").fill("0.45");
      await page.locator("#layout-selected").selectOption("reload");
      await page.locator("#layout-opacity").fill("0.95");
      await page.locator("#layout-selected").selectOption("fire");
      assert.equal(
        Number(await page.locator("#layout-opacity").inputValue()),
        0.45,
      );
      assert.equal(
        await fire.evaluate((e) => getComputedStyle(e).opacity),
        "0.45",
      );
      await page.screenshot({
        path: `dist-validation/controls-training/${name}-layout.png`,
      });
      const saveBefore = await page.evaluate(() =>
        JSON.stringify({ ...localStorage }),
      );
      await page.locator("#layout-training").click();
      const training = page.frameLocator(".training-frame");
      await training.locator("#training-start").click();
      assert.equal(
        await training
          .locator("#fire")
          .evaluate((e) => getComputedStyle(e).opacity),
        "0.45",
      );
      const beforeAmmo = await training.locator("#training-stats").innerText();
      const cdp = await page.context().newCDPSession(page);
      const rect = await training.locator("#fire").boundingBox();
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 },
        ],
      });
      await page.waitForTimeout(700);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const ammo = await training.locator("#training-stats").innerText();
      assert.notEqual(ammo, beforeAmmo);
      await page.screenshot({
        path: `dist-validation/controls-training/${name}-training.png`,
      });
      await training.locator("#training-exit").click();
      await page.locator(".training-frame").waitFor({ state: "detached" });
      assert.equal(
        Number(await page.locator("#layout-opacity").inputValue()),
        0.45,
      );
      assert.equal(
        await page.evaluate(() => JSON.stringify({ ...localStorage })),
        saveBefore,
      );
      await page.locator("#layout-save").click();
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("swarm-front-controls-v1")),
      );
      assert.equal(stored.buttons.fire.opacity, 0.45);
      assert.equal(stored.buttons.reload.opacity, 0.95);
      assert.deepEqual(errors, []);
      results.push({ entry, width, height, bounds, ammo, errors });
      await page.close();
    }
  fs.writeFileSync(
    `dist-validation/controls-training/${tag}-ui.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
