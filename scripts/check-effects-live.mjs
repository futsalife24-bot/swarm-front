import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const url = "https://swarm-front.melosalife-24.workers.dev";
const dir = "dist-validation/effects-live";
mkdirSync(dir, { recursive: true });
const expected = readFileSync("dist/index.html", "utf8").match(
  /src="([^"]+\.js)"/,
)[1];
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [640, 280],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const response = await page.goto(url);
      assert.equal(response.status(), 200);
      const script = await page
        .locator('script[type="module"]')
        .getAttribute("src");
      assert.equal(script, expected);
      // Disposable browser storage only: verify the published app accepts each new affix.
      const inventory = [
        ["rifle", "reserve"],
        ["shotgun", "repel"],
        ["rocket", "chain"],
      ].map(([kind, effect]) => ({
        id: "check-" + kind,
        kind,
        effect,
        rarity: 1,
        power: 1,
      }));
      await page.evaluate(
        (inventory) =>
          localStorage.setItem(
            "swarm-front-save-v1",
            JSON.stringify({
              version: 1,
              inventory,
              equipped: [inventory[0].id, inventory[1].id],
              volume: 0,
              sensitivity: 1,
              quality: 0.65,
              receipts: [],
            }),
          ),
        inventory,
      );
      await page.reload();
      await page.locator("#open-armory").click();
      for (const [kind, effect, text] of [
        ["rifle", "reserve", "25%"],
        ["shotgun", "repel", "最大3m"],
        ["rocket", "chain", "再誘爆はありません"],
      ]) {
        await page.locator(`[data-armory-select="check-${kind}"]`).click();
        await page.locator(`[data-effect-help="${effect}"]`).click();
        assert((await page.getByRole("dialog").innerText()).includes(text));
        await page.screenshot({ path: `${dir}/${width}-${effect}.png` });
        await page.getByRole("button", { name: "閉じる", exact: true }).click();
      }
      await page.locator('[data-armory-select="check-shotgun"]').click();
      await page.locator('[data-kind-help="shotgun"]').click();
      assert((await page.getByRole("dialog").innerText()).includes("最大3体"));
      await page.keyboard.press("Escape");
      await page.locator("#armory-gear").click();
      assert.equal(await page.locator(".reload-help").count(), 0);
      await page.screenshot({ path: `${dir}/${width}-gear.png` });
      await page.locator("#launch").click();
      await page.locator(".hud-rail").waitFor();
      await page.keyboard.press("KeyQ");
      await page.waitForTimeout(350);
      assert(
        (await page.locator(".weapon-hud > span").innerText()).includes("2/2"),
      );
      await page.screenshot({ path: `${dir}/${width}-battle.png` });
      const health = await page.request.get(url + "/api/health");
      assert.equal(health.status(), 200);
      assert.equal((await health.json()).ok, true);
      assert.deepEqual(errors, []);
      results.push({
        width,
        height,
        script,
        helpVerified: true,
        innatePierceHelp: true,
        soloStarted: true,
        swapped: true,
        health: 200,
        errors,
      });
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    `${dir}/result.json`,
    JSON.stringify({ url, time: new Date().toISOString(), results }, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
