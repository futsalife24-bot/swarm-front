// 終了直前だけ隔離した状態を準備。時間短縮fixtureを実プレイの証拠にしない。
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const baseline = process.env.BASELINE === "1";
const out = process.argv[2] ?? "dist-validation/survival-result-rewards";
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
    for (const scenario of process.env.SCENARIO
      ? [process.env.SCENARIO]
      : ["return", "defeat", "short", "save-failure"]) {
      const page = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        serviceWorkers: "block",
        reducedMotion: width === 844 ? "no-preference" : "reduce",
      });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(
        /\/src\/client\/front-app.ts(?:\?.*)?$/,
        async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body:
              (await response.text()) +
              `
window.resultFixture = (scenario) => {
  if (!localRun) throw Error("ソロ戦闘が必要です");
  localRun.world.time = scenario === "long" ? 1800 : scenario === "short" ? 20 : 125;
  localRun.world.players[0].kills = 31;
  localRun.treasureCoins = { [id]: 10 };
  if (scenario === "save-failure") {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "swarm-front-shared-progress-v3") throw Error("試験用保存失敗");
      return original.call(this, key, value);
    };
    window.restoreResultStorage = () => { Storage.prototype.setItem = original; };
  }
  if (scenario === "defeat" || scenario === "short") localRun.world.players[0].hp = 0;
  else returnFrontRun(localRun);
};`,
          });
        },
      );
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
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      await page.evaluate((s) => window.resultFixture(s), scenario);
      await page.locator("#front-leave").waitFor();
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      if (scenario === "save-failure") {
        await expect(page.locator("#front-retry-save")).toBeVisible();
        await page.screenshot({
          path: `${out}/${width}-${scenario}-before.png`,
        });
        await page.evaluate(() => window.restoreResultStorage());
        await tap("#front-retry-save");
        await expect(page.locator("#front-retry-save")).toHaveCount(0);
      }
      await expect(page.locator("#ui")).toContainText("攻略コイン");
      await expect(page.locator("#ui")).toContainText(
        scenario === "long" ? "+310" : scenario === "short" ? "+10" : "+30",
      );
      if (!baseline) {
        await expect(
          page.getByRole("heading", { name: "獲得報酬", exact: true }),
        ).toBeVisible();
        await expect(page.locator("#ui [data-row]")).toHaveCount(
          scenario === "long" ? 30 : scenario === "short" ? 0 : 3,
        );
        if (width >= 844)
          expect(
            await page
              .locator("#ui .pt-stat-scroll")
              .evaluateAll((cells) =>
                cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1),
              ),
          ).toBe(true);
        if (scenario === "long")
          await page.locator("#ui [data-row]").last().scrollIntoViewIfNeeded();
      }
      const layout = await page.locator("#front-leave").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          visible:
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            r.left >= 0 &&
            r.right <= innerWidth,
          panelScroll: el.closest("section").scrollHeight,
        };
      });
      expect(layout.visible).toBe(true);
      await page.screenshot({ path: `${out}/${width}-${scenario}.png` });
      const rewardText = await page.locator("#ui").innerText();
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        scenario,
        baseline,
        layout,
        rewardText,
        errors,
      });
      await tap("#front-leave");
      await expect(page.locator("#solo")).toBeVisible();
      await page.close();
      console.log(`${width} ${scenario}: 合格`);
    }
  }
} finally {
  fs.writeFileSync(
    `${out}/${baseline ? "baseline" : "results"}.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
console.log(`${results.length}条件: 生存終了と保存状態を確認`);
