import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.CAVE_SITE || "http://127.0.0.1:5186";
const out =
  process.env.CAVE_OUTPUT ||
  "dist-validation/cave-foundry-release-20261007/cave-browser";
mkdirSync(out, { recursive: true });
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
    const context = await browser.newContext({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const errors = [];
    const consoleErrors = [];
    const failedRequests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("requestfailed", (r) =>
      failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
    );
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    for (const stage of [10, 16]) {
      assert.equal((await page.goto(base + "/")).status(), 200);
      if (base.startsWith("http://127.0.0.1:")) {
        await page.locator("#solo").waitFor();
        await page.evaluate(async () => {
          const m = await import("/src/client/progression-save.ts");
          const s = m.freshProgress("normal");
          s.tutorials = [
            "growth",
            "accessories",
            "gear",
            "armory",
            "base",
            "combat",
          ];
          for (let i = 1; i <= 25; i++)
            s.missions[`${i}:normal`] = [true, true, true];
          localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
          localStorage.removeItem("swarm-front-battle-checkpoint-v1");
        });
        await page.reload();
      }
      await page.locator("#solo").click();
      if (await page.locator("#player-name").isVisible()) {
        await page.locator("#player-name").fill("洞窟検証");
        await page.locator("#player-name-form button[type=submit]").click();
      }
      await page
        .locator("#pt-stage")
        .selectOption(String(stage), { force: true });
      await page.locator("#pt-start").click();
      await page.locator("#pt-enter").click({ timeout: 65000 });
      try {
        await page
          .locator("#hud")
          .waitFor({ state: "visible", timeout: 65000 });
      } catch (error) {
        writeFileSync(
          `${out}/failure.txt`,
          (await page.locator("body").innerText()) +
            "\n" +
            JSON.stringify(errors),
        );
        await page.screenshot({ path: `${out}/failure.png` });
        throw error;
      }
      await page.waitForTimeout(3500);
      const hud = await page.locator("#hud").innerText();
      assert.match(hud, new RegExp(`ST ${stage}\\b`));
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      assert.equal(overflow, false);
      await page.screenshot({ path: `${out}/${width}-st${stage}.png` });
      results.push({
        width,
        height,
        stage,
        hud,
        overflow,
        errors: [...errors],
        consoleErrors: [...consoleErrors],
        failedRequests: [...failedRequests],
        scope:
          "ローカル進行fixtureからソロ開始・洞窟描画、増援の実撃破映像ではない",
      });
    }
    assert.deepEqual(errors, []);
    const analyticsUrl =
      "https://project-hub.melosalife-24.workers.dev/api/analytics/collect/swarm-front";
    const knownLocalAnalyticsOnly =
      base.startsWith("http://127.0.0.1:") &&
      failedRequests.length > 0 &&
      failedRequests.every(
        (r) =>
          r.url === analyticsUrl ||
          (r.error === "net::ERR_ABORTED" &&
            r.url === base + "/assets/audio/bgm-v1/title.mp3"),
      ) &&
      consoleErrors.every(
        (e) =>
          e.includes(analyticsUrl) ||
          e === "Failed to load resource: net::ERR_FAILED",
      );
    assert.ok(
      consoleErrors.length === 0 || knownLocalAnalyticsOnly,
      JSON.stringify({ consoleErrors, failedRequests }),
    );
    await context.close();
  }
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify({ pass: true, base, results }, null, 2),
  );
  console.log(
    "洞窟ST10/ST16・844/640幅: 描画、HUD、横溢れなし、page error 0。ローカルanalytics CORSは別記録。",
  );
} finally {
  await browser.close();
}
