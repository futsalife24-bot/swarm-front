import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const out = "docs/evidence/support-resume-20261110";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [],
  errors = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://127.0.0.1:5198/front.html", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.locator(".title-entry-start").click();
    await page.locator("#solo").click();
    await page.locator('[data-operation="survival"]').click();
    await page.locator("#front-base").click();
    const details = page.locator(".panel").filter({ hasText: "生存カード" }).first();
    await details.waitFor({ state: "visible" });
    assert.match(await details.innerText(), /生存カード/);
    const measurements = await page.evaluate(() => {
      const dialog = [...document.querySelectorAll(".panel")].find((d) =>
        d.textContent?.includes("生存カード"),
      );
      const button = dialog?.querySelector("#base-back");
      const r = button?.getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        back: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
      };
    });
    assert.equal(measurements.horizontalOverflow, false);
    assert.ok(
      measurements.back &&
        measurements.back.y >= 0 &&
        measurements.back.y + measurements.back.height <= height,
    );
    await page.screenshot({ path: `${out}/survival-cards-${width}.png` });
    results.push({ width, height, ...measurements });
    await page.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/ui.json`,
    JSON.stringify(
      {
        artificial: false,
        scope:
          "ローカル生存カード画面のみ、動きを減らす標準設定。受領/攻略E2Eではない",
        results,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
