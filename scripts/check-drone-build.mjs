import { preview } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = "dist-validation/drone-capture/build-layout";
fs.mkdirSync(out, { recursive: true });
const server = await preview({
  preview: { host: "127.0.0.1", port: 5404, strictPort: true },
});
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "撮影検証"),
  );
  await page.goto(
    "http://127.0.0.1:5404/?drone=1&clean=1&droneRadius=0&droneHeight=48&droneSpeed=0",
  );
  await page.locator("#solo").click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click({ timeout: 120000 });
  await page.locator("#pt-tutorial-skip").click({ timeout: 60000 });
  await page.locator("#pause").click();
  await page.locator(".drone-tools summary").click();
  const results = [];
  for (const [width, height] of [
    [844, 390],
    [667, 375],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const rows = await page
      .locator(".drone-ranges label")
      .evaluateAll((labels) =>
        labels.map((label) => ({
          text: label.querySelector("span").textContent,
          display: getComputedStyle(label).display,
          textHeight: label.querySelector("span").getBoundingClientRect()
            .height,
        })),
      );
    const panel = await page
      .locator(".menu-dialog-body")
      .evaluate((el) => ({ height: el.clientHeight, scroll: el.scrollHeight }));
    await page.screenshot({ path: `${out}/${width}-pause.png` });
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(row.display, "grid", row.text);
      assert.ok(row.textHeight <= 28, JSON.stringify(row));
    }
    assert.ok(panel.scroll <= panel.height + 1, JSON.stringify(panel));
    results.push({ width, height, rows, panel });
  }
  await page.locator("#pt-resume").click();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
