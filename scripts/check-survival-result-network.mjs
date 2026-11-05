// 実ローカルWorker/WS/製品UI。終了直前の準備だけ既存テストfixtureを使用。
import { chromium, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials.ts";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const api = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const out =
  process.argv[2] ?? "dist-validation/survival-result-rewards/network";
if (new URL(api).hostname !== "127.0.0.1") throw Error("ローカル専用");
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
    const response = await fetch(`${api}/rooms`, {
      method: "POST",
      headers: { "X-Room-Creation-Key": localCreationKey() },
      body: JSON.stringify({
        ruleset: "front-v1",
        mode: "survival",
        name: "報酬結果の隔離確認",
        listed: false,
      }),
    });
    expect(response.status).toBe(200);
    const { code } = await response.json();
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
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
    await page.goto(`${origin}/front?coop=1`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    if (await page.locator(".title-entry-start").count())
      await tap(".title-entry-start");
    await page.locator(".room-browser").waitFor();
    const details = page.locator("details:has(#endpoint)");
    if ((await details.count()) && !(await details.getAttribute("open")))
      await details.locator("summary").click();
    await page.locator("#endpoint").fill(api);
    await page.locator("#room-id").fill(code);
    await tap("#room-join");
    await page.locator(".front-prep").waitFor();
    await tap("#front-launch");
    await expect(page.locator("#front-start")).toBeEnabled({ timeout: 120000 });
    await tap("#front-start");
    await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
    await tap("[data-card]:first-of-type");
    await expect(page.locator("#controls")).toBeVisible();
    const fixture = await fetch(`${api}/fixtures/${code}/front-growth-result`, {
      method: "POST",
    });
    expect(fixture.status).toBe(200);
    await expect(
      page.getByRole("heading", { name: "獲得報酬", exact: true }),
    ).toBeVisible();
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await expect(page.locator("#ui [data-row]")).toHaveCount(3);
    const snapshot = await (
      await fetch(`${api}/fixtures/${code}/snapshot`)
    ).json();
    const expectedIds = snapshot.world.rewards[snapshot.world.players[0].id]
      .map((w) => w.id)
      .sort();
    const displayedIds = await page
      .locator("#ui [data-row]")
      .evaluateAll((rows) => rows.map((r) => r.dataset.row).sort());
    expect(displayedIds).toEqual(expectedIds);
    const saved = () =>
      page.evaluate(() => {
        const save = JSON.parse(
          localStorage.getItem("swarm-front-shared-progress-v3"),
        );
        return {
          coins: save.coins,
          ids: [...save.inventory, ...save.pending].map((w) => w.id).sort(),
        };
      });
    const before = await saved();
    expect(expectedIds.every((id) => before.ids.includes(id))).toBe(true);
    await page.screenshot({ path: `${out}/${width}-result.png` });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "切断した部隊へ復帰", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "獲得報酬", exact: true }),
    ).toBeVisible({ timeout: 120000 });
    await page.locator(".operation-cue").waitFor({ state: "detached" });
    await expect(page.locator("#ui [data-row]")).toHaveCount(3);
    expect(
      await page
        .locator("#ui [data-row]")
        .evaluateAll((rows) => rows.map((r) => r.dataset.row).sort()),
    ).toEqual(expectedIds);
    expect(await saved()).toEqual(before);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${out}/${width}-reconnected.png` });
    results.push({
      width,
      height,
      weapons: expectedIds.length,
      reconnectPreserved: true,
      noDuplicateRewards: true,
      errors,
    });
    await page.close();
    console.log(`${width}: 実WSの結果と再接続に合格`);
  }
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
