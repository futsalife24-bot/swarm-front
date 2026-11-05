import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin =
  process.env.ORIGIN ?? "https://swarm-front.melosalife-24.workers.dev";
const out = process.argv[2] ?? "dist-validation/foundry-explosion/public";
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
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "公開版の起動確認"),
    );
    const response = await page.goto(origin + "/?coop=1", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    expect(response.status()).toBe(200);
    await expect(page.locator("#room-join")).toBeVisible({ timeout: 120000 });
    await expect(page.locator(".room-browser")).toContainText("協力プレイ");
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${out}/${width}-entry.png` });
    results.push({
      width,
      height,
      page: "coop-entry",
      status: response.status(),
      errors,
      noRoomCreated: true,
    });
    await page.close();
    console.log(`${width}: 公開版の起動・参加画面に合格`);
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
