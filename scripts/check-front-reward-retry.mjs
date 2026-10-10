import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const out =
  process.env.REWARD_OUTPUT || "dist-validation/claude-balance/reward-ui";
const width = Number(process.env.REWARD_WIDTH || 844);
const origin = process.env.REWARD_ORIGIN || "http://127.0.0.1:5186";
const published = process.env.REWARD_PUBLIC === "1";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const failed of process.env.REWARD_HISTORY === "1" ? ["history"] : ["progress", "campaign"]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 640 ? 360 : 390 },
    });
    const errors = [];
    const consoleErrors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.rewardFailureKey === key) throw Error("試験用の保存失敗");
        return set.call(this, key, value);
      };
    });
    await page.goto(origin + (published ? "/front" : "/front.html"), {
      waitUntil: "domcontentloaded",
    });
    await page.locator("#solo").click();
    await page.locator("#front-launch").click();
    await page.locator("[data-card]").first().click({ timeout: 90000 });
    await page.evaluate((failed) => {
      // 既存保存キーを使い、本人と分離した検証プロフィールだけに失敗を注入。
      if (failed === "history") {
        localStorage.setItem("swarm-front-rebuild-v1", JSON.stringify({
          version: 1, wins: 0, runs: 0, credits: 0,
          unlocks: ["blast-core", "armor-piercer", "afterimage-mine"],
          receipts: [], dailyWins: [], dailyFloor: "",
          receiptFloor: Date.now() + 86400000,
        }));
        return;
      }
      window.rewardFailureKey =
        failed === "progress"
          ? "swarm-front-rebuild-v1"
          : "swarm-front-shared-progress-v3";
    }, failed);
    // 実ソロ戦闘で無操作の敗北を待つ。world/HP/時間/結果は書き換えない。
    if (failed === "history") {
      await page.getByText("功績：保存履歴より古い結果のため対象外", { exact: false })
        .waitFor({ state: "visible", timeout: 180000 });
      const after = await page.locator("#ui").innerText();
      const credits = await page.evaluate(() => JSON.parse(localStorage.getItem("swarm-front-rebuild-v1")).credits);
      assert.equal(credits, 0);
      assert.equal(await page.locator("#front-retry-save").count(), 0);
      assert.deepEqual(errors, []);
      if (published) assert.deepEqual(consoleErrors, []);
      await page.screenshot({ path: `${out}/history.png` });
      results.push({ failed, after, credits, errors, consoleErrors });
      await page.close();
      continue;
    }
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
    if (published) assert.deepEqual(consoleErrors, []);
    results.push({ failed, before, after, credits, errors, consoleErrors });
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
