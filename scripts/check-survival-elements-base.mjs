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
      await settle();
      const visibleCards = await page.locator("#base-grid").evaluate((grid) => {
        const area = grid.getBoundingClientRect();
        return [...grid.children].filter((card) => {
          const r = card.getBoundingClientRect();
          return r.top >= area.top && r.bottom <= area.bottom;
        }).length;
      });
      expect(visibleCards).toBeGreaterThanOrEqual(width === 844 ? 9 : 6);
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
          new RegExp(`${id}-v1-thumb\\.webp$`),
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
      await expect(
        page.locator("#base-detail img.sc-illustration"),
      ).toHaveAttribute("src", /fire-rounds-v1\.webp$/);
      const controlBefore = await page
        .locator(".base-exclude-control")
        .boundingBox();
      await page.locator(".base-detail-scroll").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const controlAfter = await page
        .locator(".base-exclude-control")
        .boundingBox();
      expect(controlAfter).toEqual(controlBefore);
      expect(controlAfter.height).toBeGreaterThanOrEqual(40);
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
      await tap("#base-fusions");
      await tap('[data-inspect="fusion-reactor"]');
      await expect(page.locator("#base-detail")).toContainText("未発見の融合");
      await expect(page.locator("#base-detail img")).toHaveCount(0);
      // 発見済みの見た目だけを隔離保存で準備。実際の融合獲得の検証ではない。
      await page.evaluate(() =>
        localStorage.setItem(
          "swarm-front-fusion-discovery-v1",
          JSON.stringify({ version: 1, ids: ["fusion-reactor"] }),
        ),
      );
      await page.reload();
      await page.locator(".front-base").waitFor();
      await tap("#base-fusions");
      await tap('[data-inspect="fusion-reactor"]');
      await expect(
        page.locator("#base-detail img.sc-illustration"),
      ).toHaveAttribute("src", /fusion-reactor-v1\.webp$/);
      await page
        .locator("#base-detail img")
        .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
      await expect(page.locator("#base-detail")).toContainText(
        "ヒートリアクター",
      );
      const otherMotion = await page
        .locator('#base-grid .sc-card:not([data-inspecting="true"])')
        .evaluateAll(
          (cards) =>
            cards.flatMap((card) => card.getAnimations({ subtree: true }))
              .length,
        );
      expect(otherMotion).toBe(0);
      await page.screenshot({
        path: `${out}/${width}-fusion.png`,
        animations: "disabled",
      });
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
        visibleCards,
        fixedExclusionControl: true,
        discoveredFusionArt: true,
        unknownFusionHidden: true,
        unselectedFusionStatic: true,
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
