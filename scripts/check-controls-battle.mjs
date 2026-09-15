import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://127.0.0.1:5186",
  tag = process.argv[3] ?? "dev";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const entry of ["", "?playtest=1"]) {
    const page = await browser.newPage({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
        serviceWorkers: "block",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(60000);
    await page.goto(base + "/" + entry);
    await page.locator("#solo").waitFor();
    if (await page.locator("#landscape-start").isVisible())
      await page.locator("#landscape-start").click();
    await page.locator("#solo").click();
    if (entry) {
      await page.locator("#pt-confirm").click();
      await page.locator("#pt-start").click();
      await page.locator("#pt-enter").click();
      if (await page.locator("#pt-tutorial-skip").count())
        await page.locator("#pt-tutorial-skip").click();
    } else await page.locator("#launch").click();
    await page.locator("#pause").click();
    await page.locator(entry ? "#pt-pause-layout" : "#pause-layout").click();
    await page.locator("#layout-reset").click();
    const snapshot = () =>
      page.evaluate(() => {
        const d = window.__playtest ?? window.__swarm;
        return d?.world
          ? { time: d.world.time, hp: d.world.players[0].hp, run: d.world.run }
          : null;
      });
    const before = await snapshot();
    await page.locator("#layout-opacity").fill("0.55");
    // Real pointer dragging must move the same button and remain within the viewport.
    const move = page.locator("[data-layout-button=move]"),
      box = await move.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
    await page.mouse.up();
    assert.ok((await move.boundingBox()).x > box.x + 10);
    await page.locator("#layout-training").click();
    const range = page.frameLocator(".training-frame");
    await range.locator("#training-start").click();
    await page.waitForTimeout(300);
    await range.locator("#training-exit").click();
    await page.locator(".training-frame").waitFor({ state: "detached" });
    const after = await snapshot();
    if (before) assert.deepEqual(after, before);
    await page.locator("#layout-save").click();
    await page.locator(entry ? "#pt-resume" : "#pause-resume").click();
    assert.equal(
      await page.locator("#fire").evaluate((e) => getComputedStyle(e).opacity),
      "0.55",
    );
    await page.locator("#pause").click();
    await page.locator(entry ? "#pt-pause-layout" : "#pause-layout").click();
    await page.locator("#layout-opacity").fill("0.9");
    await page.locator("#layout-cancel").click();
    await page.locator(entry ? "#pt-resume" : "#pause-resume").click();
    assert.equal(
      await page.locator("#fire").evaluate((e) => getComputedStyle(e).opacity),
      "0.55",
    );
    await page.screenshot({
      path: `dist-validation/controls-training/${tag}-${entry ? "playtest" : "main"}-battle.png`,
    });
    assert.deepEqual(errors, []);
    results.push({ entry, before, after, errors });
    await page.close();
  }
  fs.writeFileSync(
    `dist-validation/controls-training/${tag}-battle.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
