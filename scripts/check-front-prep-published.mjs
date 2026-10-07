import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const base = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/base-decks/release/prep";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion,
        serviceWorkers: "allow",
      });
      const errors = [],
        consoleErrors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      await page.goto(base + "/front", { waitUntil: "domcontentloaded" });
      await page.locator("#solo").tap();
      await page.locator(".front-prep").waitFor();
      await page.evaluate(async () => {
        await Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        );
      });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: [
          ...document.querySelectorAll(".front-prep .menu-header button"),
        ].map((e) => {
          const r = e.getBoundingClientRect();
          return {
            text: e.textContent,
            width: r.width,
            height: r.height,
            inside:
              r.x >= 0 &&
              r.right <= innerWidth &&
              r.y >= 0 &&
              r.bottom <= innerHeight,
          };
        }),
      }));
      assert.equal(metrics.overflow, false);
      assert.ok(
        metrics.buttons.length === 3 &&
          metrics.buttons.every(
            (b) => b.width >= 44 && b.height >= 36 && b.inside,
          ),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(consoleErrors, []);
      await page.screenshot({
        path: `${out}/front-prep-${width}-${reducedMotion}.png`,
      });
      results.push({
        width,
        height,
        reducedMotion,
        metrics,
        errors,
        consoleErrors,
      });
      await page.close();
    }
  }
} finally {
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(
  `${results.length}条件: 最終padding適用後の公開/front準備画面、ボタン寸法・収まり・エラー0`,
);
