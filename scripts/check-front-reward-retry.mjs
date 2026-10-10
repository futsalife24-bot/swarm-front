import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out = process.env.REWARD_OUTPUT || "dist-validation/claude-balance/reward-ui";
const width = Number(process.env.REWARD_WIDTH || 844);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const failed of ["progress", "campaign"]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 640 ? 360 : 390 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.rewardFailureKey === key) throw Error("試験用の保存失敗");
        return set.call(this, key, value);
      };
    });
    await page.goto("http://127.0.0.1:5186/front.html", {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#solo").click();
    await page.locator("#front-launch").click();
    await page.locator("[data-card]").first().click({ timeout: 90000 });
    await page.evaluate(async (failed) => {
      const { FRONT_PROGRESS_KEY } =
        await import("/src/client/front-progress.ts");
      const { newSaveKey } = await import("/src/client/progression-save.ts");
      window.rewardFailureKey =
        failed === "progress" ? FRONT_PROGRESS_KEY : newSaveKey("normal");
    }, failed);
    // 実ソロ戦闘で無操作の敗北を待つ。world/HP/時間/結果は書き換えない。
    await page
      .locator("#front-retry-save")
      .waitFor({ state: "visible", timeout: 180000 });
    const before = await page.locator("#ui").innerText();
    await page.screenshot({ path: `${out}/${failed}-before.png` });
    if (failed === "progress") assert.match(before, /攻略コイン \+\d+/);
    else assert.match(before, /功績 \+20/);
    await page.evaluate(() => {
      window.rewardFailureKey = "";
    });
    await page.locator("#front-retry-save").click();
    await page.locator("#front-retry-save").waitFor({ state: "hidden" });
    const after = await page.locator("#ui").innerText();
    assert.match(after, /功績 \+20 · 攻略コイン \+\d+/);
    const credits = await page.evaluate(
      () => JSON.parse(localStorage.getItem("swarm-front-rebuild-v1")).credits,
    );
    assert.equal(credits, 20);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/${failed}-after.png` });
    results.push({ failed, before, after, credits, errors });
    await page.close();
  }
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  console.log(
    JSON.stringify(
      results.map((r) => ({
        failed: r.failed,
        credits: r.credits,
        errors: r.errors,
      })),
    ),
  );
} finally {
  await browser.close();
}
