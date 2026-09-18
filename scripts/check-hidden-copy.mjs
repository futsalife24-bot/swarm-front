import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/hidden-copy";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const records = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const check = async (name) => {
      const text = await page.locator("body").innerText();
      assert.doesNotMatch(text, /広告|視聴/);
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
      records.push({ width, height, name, adCopy: false });
    };
    await page.route(
      /\/src\/client\/playtest-app\.ts(?:\?.*)?$/,
      async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body:
            (await response.text()) +
            '\nwindow.__downFixture=()=>{world=createWorld("copy-check");addPlayer(world,"solo");initSolo(world,1,"normal",false,soldier(save).levels);screen="battle";defeatChoice();};',
        });
      },
    );
    await page.goto("http://127.0.0.1:5347/");
    await page.locator("#solo").click();
    await page.locator("#player-name").fill("表示確認");
    await page.locator("#player-name-form button[type=submit]").click();
    await check("intro");
    await page.locator("#pt-confirm").click();
    await check("gear");
    await page.locator("#pt-mission-info").click();
    await check("mission");
    await page.locator(".dialog-close").click();
    await page.evaluate(async () => {
      const m = await import("/src/client/progression-save.ts");
      let s = m.loadProgress("normal");
      s = m.grantResult(
        s,
        {
          run: "hidden-copy-fixture",
          stage: 1,
          difficulty: "normal",
          win: true,
          time: 80,
          kills: 32,
          missions: [true, true, true],
          weapons: [],
          collected: 0,
        },
        () => 0.2,
      );
      s = m.prepareChoice(s, () => 0.1);
      m.persistProgress(s);
    });
    await page.reload();
    await page.waitForFunction(() => window.__playtest?.save);
    await page.locator("#pt-normal-reward").waitFor();
    await check("reward");
    assert.equal(await page.locator("#pt-ad-reward").count(), 0);
    const before = await page.evaluate(() => window.__playtest.save);
    await page.locator("#pt-normal-reward").click();
    await page.locator("#pt-result-home").waitFor();
    await check("result");
    const after = await page.evaluate(() => window.__playtest.save);
    assert.equal(after.result.choice, "normal");
    assert.equal(after.coins, before.coins);
    assert.equal(after.inventory.length, before.inventory.length);
    await page.reload();
    await page.waitForFunction(() => window.__playtest?.save);
    const restored = await page.evaluate(() => window.__playtest.save);
    assert.equal(restored.coins, after.coins);
    assert.equal(restored.result.choice, "normal");
    await page.evaluate(() => window.__downFixture());
    await page.locator("#pt-defeat").waitFor();
    assert.equal(await page.locator("#pt-revive").count(), 0);
    await check("down");
    await page.locator("#pt-defeat").click();
    await page.locator("#pt-result-home").waitFor();
    await check("defeat");
    assert.deepEqual(errors, []);
    await page.close();
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(records, null, 2));
  console.log(
    "PASS",
    records.length,
    "screens; normal reward and reload preserve balances",
  );
} finally {
  await browser.close();
}
