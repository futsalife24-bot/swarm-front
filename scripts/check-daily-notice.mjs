import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/daily-notice";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const checks = [],
  errors = [];
try {
  const p = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/api/cloud/**", async (route) => {
    const req = route.request();
    const response = await route.fetch({
      url: "http://127.0.0.1:8793" + new URL(req.url()).pathname,
      headers: {
        ...req.headers(),
        origin: "http://127.0.0.1:8793",
        host: "127.0.0.1:8793",
      },
    });
    await route.fulfill({ response });
  });
  await p.goto("http://127.0.0.1:5197");
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#solo").click();
  await p.locator("#player-name").fill("防衛案内検証");
  await p.locator("#player-name-form button[type=submit]").click();
  await p.locator("#pt-confirm").click();
  await p.locator("#pt-home").click();
  await p.locator("#pt-daily-defense").click();
  await p
    .getByText(
      "日替わり防衛にはクラウド保存が必要です。設定から有効にしてください。",
      { exact: true },
    )
    .waitFor();
  await p.locator("dialog .dialog-close").click();
  await p.locator("#home-settings").click();
  await p.locator("#pt-cloud-settings").click();
  await p.locator("#pt-cloud-create").click();
  await p.locator("#pt-cloud-show").waitFor();
  await p.locator("dialog .dialog-close").click();
  await p.locator("#pt-daily-defense").click();
  await p.locator("#pt-defense-prepare").click();
  await p.locator("#pt-enter").click();
  await p.waitForFunction(() => window.__playtest.world?.phase === "battle");
  await p.evaluate(() => window.__playtest.completeDefenseForTest(true));
  await p.locator("#pt-daily-home").waitFor();
  assert.equal(await p.locator(".pt-status").textContent(), "");
  await p.screenshot({ path: out + "/victory.png" });
  checks.push(
    "unconnected error → UI cloud enable → admission → victory without stale notice",
  );
  await p.evaluate(async () => {
    const c = await import("/src/client/cloud-save.ts");
    await c.syncCloud();
    const remote = await c.inspectCloud(c.transferCode());
    if (remote.save.dailyDefense.state !== "victory")
      throw Error("cloud result not saved");
    if (
      remote.save.dailyDefense.bonus !==
      window.__playtest.save.dailyDefense.bonus
    )
      throw Error("reward mismatch");
  });
  checks.push("victory and bonus persisted to actual local Worker");
  await p.locator("#pt-daily-home").click();
  await p.locator("#pt-daily-defense").click();
  await p
    .getByText("今日の防衛作戦は挑戦済みです。日本時間0時に更新されます。", {
      exact: true,
    })
    .waitFor();
  checks.push("new admission failure remains visible");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify({ pass: true, checks, errors }, null, 2),
  );
  console.log("PASS", checks);
} finally {
  await browser.close();
}
