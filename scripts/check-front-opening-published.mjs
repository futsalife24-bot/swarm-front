import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";

const origin =
  process.env.OPENING_ORIGIN || "https://swarm-front.melosalife-24.workers.dev";
const out =
  process.env.OPENING_OUTPUT || "dist-validation/random-opening/public-opening";
const pool = [
  "armor",
  "reload",
  "magazine",
  "magnet",
  "blast-radius",
  "opening-shot",
];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const [width, height, reducedMotion] of [
    [844, 390, "no-preference"],
    [640, 360, "reduce"],
  ]) {
    // 本人の保存とは別の新規コンテキスト。公開の協力ルームは作成しない。
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion,
    });
    const errors = [],
      consoleErrors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    await page.goto(origin + "/front", { waitUntil: "domcontentloaded" });
    await page.locator("#open-armory").click();
    assert.equal(await page.locator(".base-initial,[data-initial]").count(), 0);
    const selected = await page
      .locator('[data-pool][aria-checked="true"]')
      .evaluateAll((es) => es.map((e) => e.dataset.pool));
    for (const id of selected.filter((id) => !pool.includes(id)))
      await page.locator(`[data-pool="${id}"]`).click();
    await page.locator("#front-save-pool").click();
    assert.match(
      await page.locator("#front-pool-status").innerText(),
      /セットしました/,
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#open-armory").click();
    const restored = await page
      .locator('[data-pool][aria-checked="true"]')
      .evaluateAll((es) => es.map((e) => e.dataset.pool));
    assert.deepEqual([...restored].sort(), [...pool].sort());
    await page.locator("#base-back").click();
    await page.locator("#solo").click();
    await page.locator("#front-launch").click();
    await page.locator(".rebuild-card").first().waitFor({ timeout: 65000 });
    const offered = await page
      .locator(".rebuild-card")
      .evaluateAll((es) => es.map((e) => e.dataset.card));
    assert.equal(offered.length, 3);
    assert.equal(new Set(offered).size, 3);
    assert.ok(offered.every((id) => pool.includes(id)));
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".rebuild-card img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    await page
      .locator(".rebuild-card")
      .last()
      .evaluate(async (el) => {
        await Promise.all(el.getAnimations().map((a) => a.finished));
      });
    const cards = await page
      .locator(".rebuild-card")
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
    assert.ok(
      cards.every(
        (r) =>
          r.left >= 0 && r.top >= 0 && r.right <= width && r.bottom <= height,
      ),
    );
    await page.screenshot({ path: `${out}/opening-${width}.png` });
    await page.locator(".rebuild-card").first().click();
    await page.locator("#controls").waitFor();
    await page.locator("#pause").click();
    await page
      .locator(`.front-upgrade-details [data-upgrade="${offered[0]}"]`)
      .waitFor();
    await page.screenshot({ path: `${out}/acquired-${width}.png` });
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    results.push({
      width,
      height,
      reducedMotion,
      pool: restored,
      offered,
      selected: offered[0],
      cards,
      errors,
      consoleErrors,
    });
    await page.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    `${out}/checks.json`,
    JSON.stringify({ origin, results }, null, 2),
  );
}
console.log(
  `${results.length}条件: 選択6種の保存/再読込 → 候補内のランダム3択 → 取得反映、page/console error 0`,
);
