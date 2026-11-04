// 進撃3突破相当の隔離保存だけを準備し、属性カードの通常操作を確認する。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const out = process.argv[2] ?? "dist-validation/survival-elements-production";
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
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).tap();
    };
    try {
      await page.goto(`${origin}/?base=1`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.getByRole("button", { name: "確定", exact: true }).tap();
      await page.locator(".pt-base-menu").waitFor();
      // 実ユーザーの保存や進撃の攻略を代替しない、端末内だけの準備。
      await page.evaluate(() => {
        const key = "swarm-front-shared-progress-v3",
          save = JSON.parse(localStorage.getItem(key));
        save.missions["3:normal"] = [true, false, false];
        localStorage.setItem(key, JSON.stringify(save));
      });
      await page.goto(`${origin}/front?cards=1`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".front-base").waitFor();
      await expect(
        page.locator(
          "#base-grid input,#base-grid [role=checkbox],#base-grid small",
        ),
      ).toHaveCount(0);
      for (const [id, name] of [
        ["fire-rounds", "火炎弾"],
        ["frost-rounds", "氷結弾"],
        ["chain-lightning", "連鎖雷"],
      ]) {
        await tap(`[data-inspect="${id}"]`);
        await expect(page.locator("#base-detail")).toContainText(name);
        await expect(page.locator("#base-exclude")).toBeEnabled();
        await expect(page.locator("#base-exclude")).not.toBeChecked();
        const card = page.locator(`.sc-card:has([data-inspect="${id}"])`);
        await expect(card).toHaveAttribute("data-type", "weapon");
        await expect(card).toHaveAttribute("data-kind", "normal");
        await expect(card.locator("img")).toHaveAttribute(
          "src",
          new RegExp(`${id}\\.svg$`),
        );
        await expect
          .poll(() =>
            card
              .locator("img")
              .evaluate((img) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true);
      }
      await expect(page.locator("#base-count")).toContainText("抽選 17/17種");
      await tap('[data-inspect="fire-rounds"]');
      await tap(".base-exclude-control");
      await expect(page.locator("#base-exclude")).toBeChecked();
      await tap("#front-save-pool");
      await expect(page.locator("#front-pool-status")).toContainText(
        "保存しました",
      );
      await page.reload();
      await page.locator(".front-base").waitFor();
      await tap('[data-inspect="fire-rounds"]');
      await expect(page.locator("#base-exclude")).toBeChecked();
      await expect(page.locator(".sc-exclusion-chains")).toHaveCount(1);
      await expect(page.locator("#base-count")).toContainText("抽選 16/17種");
      await page.waitForFunction(() =>
        [...document.querySelectorAll("#base-grid img,#base-detail img")].every(
          (img) => {
            const r = img.getBoundingClientRect(),
              area = img
                .closest("#base-grid,#base-detail")
                .getBoundingClientRect();
            return (
              r.bottom <= Math.max(0, area.top) ||
              r.top >= Math.min(innerHeight, area.bottom) ||
              !r.width ||
              (img.complete && img.naturalWidth > 0)
            );
          },
        ),
      );
      await page.screenshot({
        path: `${out}/${width}-elements.png`,
        animations: "disabled",
      });
      await page.locator("#base-exclude").focus();
      await page.keyboard.press("Space");
      await tap("#front-save-pool");
      await page.reload();
      await page.locator(".front-base").waitFor();
      await expect(page.locator(".sc-exclusion-chains")).toHaveCount(0);
      await expect(page.locator("#base-count")).toContainText("抽選 17/17種");
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        reducedMotion,
        unlockedElements: 3,
        normalWeaponType: true,
        artLoaded: true,
        excludeSaveReload: true,
        removeSaveReload: true,
        noGridCheckboxOrSummary: true,
        errors,
      });
      console.log(`${width}x${height}: 属性3枚・画像・除外保存/解除 合格`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
}
