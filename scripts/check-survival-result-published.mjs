// 配布コードの通常ソロ操作のみ。時間・HP・報酬・配信JSを改変しない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5197";
const out =
  process.argv[2] ?? "dist-validation/survival-result-rewards/published";
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
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: width === 844 ? "no-preference" : "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(60000);
    const tap = async (selector) => {
      await page
        .locator(".split-shutter,.menu-route-shutter")
        .waitFor({ state: "detached" });
      await page.locator(selector).tap();
    };
    await page.goto(`${origin}/front`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await tap(".title-entry-start");
    await tap("#solo");
    await tap('[data-operation="survival"]');
    await tap("#front-launch");
    await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    console.log(`${width}: 実戦へ入り、敵の攻撃による終了を待機`);
    await expect(
      page.getByRole("heading", { name: "獲得報酬", exact: true }),
    ).toBeVisible({ timeout: 240000 });
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await expect(page.locator("#ui")).toContainText("戦闘終了");
    await expect(page.locator("#ui")).toContainText("保存済");
    await expect(page.locator("#front-retry-save")).toHaveCount(0);
    await page.screenshot({ path: `${out}/${width}-defeat.png` });
    const text = await page.locator("#ui").innerText();
    expect(errors).toEqual([]);
    await tap("#front-leave");
    await expect(page.locator("#solo")).toBeVisible();
    results.push({
      width,
      height,
      normalSolo: true,
      noStateOrCodeFixture: true,
      resultText: text,
      errors,
    });
    await page.close();
    console.log(`${width}: 配布コードの戦闘終了・獲得報酬に合格`);
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
