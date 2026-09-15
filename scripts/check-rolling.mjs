import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const dir = "dist-validation/rolling";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [[1280, 720], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.install();
    await page.goto("http://127.0.0.1:5302");
    await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await page.locator("#launch").click();
    await page.waitForFunction(() => window.__swarm?.world?.players.length);
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.screenshot({ path: `${dir}/${width}-idle.png` });
    await page.keyboard.down("KeyD");
    await page.keyboard.down("Space");
    let start;
    for (let frame = 0; frame < 10; frame++) {
      await page.clock.runFor(20);
      start = await page.evaluate(() => window.__swarm.world.players[0]);
      if (start.evade > 0) break;
    }
    await page.keyboard.up("Space");
    assert.ok(start.evade > 0);
    await page.clock.runFor(100);
    await page.screenshot({ path: `${dir}/${width}-roll.png` });
    const middle = await page.evaluate(() => window.__swarm.world.players[0]);
    assert.ok(middle.evade > 0 && middle.evade < start.evade);
    await page.clock.runFor(300);
    await page.keyboard.up("KeyD");
    await page.screenshot({ path: `${dir}/${width}-recovered.png` });
    const end = await page.evaluate(() => window.__swarm.world.players[0]);
    assert.equal(end.evade, 0);
    assert.ok(end.x > start.x);
    assert.deepEqual(errors, []);
    results.push({ width, height, startEvade: start.evade, middleEvade: middle.evade, endEvade: end.evade, errors });
    await page.close();
  }
  writeFileSync(`${dir}/browser.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
