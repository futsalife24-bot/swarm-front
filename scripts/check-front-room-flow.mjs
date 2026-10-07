import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8789",
  out = "dist-validation/base-decks/rooms";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Local setup required");
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
    const pages = [],
      errors = [];
    for (let i = 0; i < 2; i++) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        serviceWorkers: "block",
      });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(origin + "/front.html", { waitUntil: "domcontentloaded" });
      await p.locator("#coop").tap();
      pages.push(p);
    }
    const [a, b] = pages,
      name = `画面検証${width}`;
    await a.locator("#room-name").fill(name);
    await a.locator("#front-room-mode").selectOption("defense");
    await a.locator(".coop-advanced summary").tap();
    await a.locator("#creation-key").fill(key);
    await a.locator(".coop-advanced summary").tap();
    await a.locator("#launch").tap();
    await a.locator("#front-launch").waitFor();
    await a.locator("#front-launch").tap();
    await a.locator(".front-lobby").waitFor();
    await b.locator("#room-refresh").tap();
    const row = b.locator(".room-list-row").filter({ hasText: name });
    await row.waitFor();
    await b.screenshot({ path: `${out}/listed-${width}.png` });
    await row.locator("button").tap();
    await b.locator("#front-launch").waitFor();
    await b.locator("#front-launch").tap();
    await b.locator(".front-lobby").waitFor();
    await a.waitForFunction(
      () =>
        document.querySelectorAll("[data-fx-member]").length === 2 &&
        !document.querySelector("#front-start").disabled,
      {},
      { timeout: 90000 },
    );
    await a.screenshot({ path: `${out}/lobby-${width}.png` });
    const metrics = await a.locator(".front-lobby").evaluate((el) => ({
      screen: document.body.dataset.screen,
      width: el.getBoundingClientRect().width,
      overflow: el.scrollWidth > el.clientWidth,
      members: el.querySelectorAll("[data-fx-member]").length,
    }));
    assert.equal(metrics.screen, "lobby");
    assert.ok(metrics.width > width * 0.8);
    assert.equal(metrics.overflow, false);
    assert.equal(metrics.members, 2);
    // 退出は通常UIで行い、公開部屋を残さない。
    for (const p of pages) {
      await p.locator("#front-leave").tap();
      await p.locator("#solo").waitFor();
      await p.close();
    }
    assert.deepEqual(errors, []);
    results.push({
      width,
      height,
      createdByUi: true,
      listedAndJoinedByUi: true,
      ready: 2,
      metrics,
      errors,
    });
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
}
console.log(
  `${results.length}条件: 部屋作成→公開一覧→参加→実2人準備→退出 成功`,
);
