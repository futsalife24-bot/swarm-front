import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

// The owner creates a private room through the real production Turnstile.
// Joining that room uses the ordinary invitation UI, which needs no CAPTCHA.
const room = process.env.SWARM_CLOSE_PUBLIC_ROOM;
assert.match(room ?? "", /^\d{3}$/);
const out =
  process.env.SWARM_CLOSE_UI_OUTPUT ??
  "dist-validation/coop-comfort-close-20261113/public-coop-normal-host";
mkdirSync(out, { recursive: true });
const result = { passed: false, errors: [], checks: [] };
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
page.on("pageerror", (e) => result.errors.push(e.message));
try {
  await page.goto("https://swarm-front.melosalife-24.workers.dev/front?coop=1");
  const opening = page.locator(".title-entry-start");
  await page.waitForFunction(
    () =>
      document.querySelector(".title-entry-start") ||
      document.querySelector("#room-id"),
  );
  if (await opening.isVisible()) await opening.click();
  await page.locator("#room-id").fill(room);
  await page.locator("#room-join").click();
  await page.locator(".front-lobby").waitFor();
  await page.locator("#front-edit-loadout").click();
  await page.locator(".front-departure-deck").waitFor();
  await page.waitForTimeout(900);
  await page.locator("#front-save-pool").click();
  await page.locator(".front-lobby").waitFor();
  result.checks.push("本人の通常認証済み非公開部屋へ招待で入室・準備完了");
  console.log("ゲスト準備完了。通常Chromeのホスト出撃を待機");
  await page.locator("[data-card]").first().waitFor();
  await page.waitForTimeout(900);
  await page.locator("[data-card]").first().click();
  await page.locator("#controls").waitFor({ state: "visible" });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(2000);
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: out + "/coop.png" });
  result.checks.push("公開2人協力のカード選択・戦闘起動・ゲスト移動");
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.failure = String(e.stack ?? e).replaceAll(room, "[自室ID]");
  process.exitCode = 1;
} finally {
  writeFileSync(out + "/results.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
  await context.close();
  await browser.close();
}
