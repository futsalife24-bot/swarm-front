import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const baseline = process.argv.includes("--baseline");
const out = `dist-validation/first-ten-minutes/${baseline ? "before" : "after"}-pointer`;
fs.mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
page.setDefaultTimeout(60000);
const result = { startedAt: new Date().toISOString(), baseline, passed: false };
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator("#solo").click();
  await page.locator("#player-name").fill("PC入力検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await page.locator("#pt-confirm").click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click();
  await page.locator("#pt-tutorial-skip").click();
  // A trusted left-button press uses the actual game's pointer-lock request.
  await page.mouse.move(450, 150);
  await page.mouse.down();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  result.lockAcquired = true;
  await page.locator("#pt-intro-skip").waitFor({ state: "visible" });
  await page.locator(".pt-cutscene-ready").waitFor();
  result.lockInDialog = await page.evaluate(
    () => document.pointerLockElement?.id ?? null,
  );
  await page.screenshot({ path: `${out}/encounter.png` });
  let clicked = false;
  try {
    await page.locator("#pt-intro-skip").click({ timeout: 2000 });
    clicked = true;
  } catch (e) {
    if (e.name !== "TimeoutError") throw e;
    result.clickFailure = e.message;
  }
  result.clicked = clicked;
  if (baseline) {
    assert(result.lockInDialog, "Reproduce the original locked pointer");
    assert.equal(clicked, false, "Reproduce the blocked visible skip button");
  } else {
    assert.equal(result.lockInDialog, null);
    assert.equal(clicked, true);
    await page.waitForFunction(
      () =>
        !window.__playtest.encounterActive &&
        window.__playtest.modalCount === 0,
    );
    const before = await page.evaluate(() => window.__playtest.world.time);
    await page.waitForFunction(
      (t) => window.__playtest.world.time > t + 0.1,
      before,
    );
    // Pause is another dialog on the same path; it must also release capture.
    await page.mouse.move(450, 150);
    await page.mouse.down();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    // Enter on the pause button also works while the pointer is captured.
    // Browser Escape consumes its first press to unlock, before DOM keydown.
    await page.locator("#pause").press("Enter");
    await page.locator("#pt-resume").waitFor();
    assert.equal(
      await page.evaluate(() => document.pointerLockElement?.id ?? null),
      null,
    );
    await page.locator("#pt-resume").click();
    result.pauseResume = true;
  }
  result.passed = true;
  console.log(
    baseline
      ? "REPRODUCED: locked pointer blocks encounter skip"
      : "PASS: encounter and pause release capture; normal clicks resume combat",
  );
} catch (e) {
  result.failure = String(e.stack || e);
  process.exitCode = 1;
  console.error(e);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
} finally {
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
