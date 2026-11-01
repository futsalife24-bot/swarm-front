import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const out = "dist-validation/lag-root-cause-20261101/pause-hit-test.json";
const server = await createServer({ server: { host: "127.0.0.1", port: 5318, strictPort: true }, cacheDir: "dist-validation/lag-root-cause-20261101/vite-pause-cache" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [width, height, hasTouch] of [[844, 390, true], [640, 360, true], [844, 390, false]]) {
    if (process.argv.includes("--settings-only") && !hasTouch) continue;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch, serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    try {
      if (hasTouch) {
        await page.goto("http://127.0.0.1:5318/front.html");
        if (await page.locator(".title-entry-start").isVisible())
          await page.locator(".title-entry-start").click();
        await page.locator(":light(#home-settings)").click();
        const toggle = page.locator("#front-setting-network-trace");
        await toggle.waitFor({ state: "visible" });
        await page.waitForFunction(() => !document.querySelector(".split-shutter,.menu-route-shutter"));
        const beforeToggle = await toggle.textContent();
        const handler = await toggle.evaluate((element) => typeof element.onclick);
        await toggle.click();
        const afterOn = await toggle.textContent();
        const storageOn = await page.evaluate(() => localStorage.getItem("swarm-network-diagnostics-v1"));
        const statusOn = await page.locator("#front-settings-status").textContent();
        await toggle.click();
        const afterOff = await toggle.textContent();
        const storageOff = await page.evaluate(() => localStorage.getItem("swarm-network-diagnostics-v1"));
        const settings = { beforeToggle, afterOn, afterOff, storageOn, storageOff, handler, statusOn, status: await page.locator("#front-settings-status").textContent() };
        results.push({ width, height, hasTouch, settings });
        console.log(JSON.stringify({ width, height, settings }));
        if (process.argv.includes("--settings-only")) continue;
      }
      await page.goto("http://127.0.0.1:5318/front.html?solo=1");
      await page.locator(":light(#front-launch)").waitFor();
      await page.waitForFunction(() => !document.querySelector(".split-shutter,.menu-route-shutter"));
      await page.locator(":light(#front-launch)").click();
      await page.locator(":light([data-card])").first().waitFor({ timeout: 70000 });
      await page.waitForFunction(() => !document.querySelector(".split-shutter,.menu-route-shutter"));
      await page.locator(":light([data-card])").first().click();
      await page.locator("#pause").waitFor({ state: "visible" });
      const before = await page.evaluate(() => {
        const pause = document.querySelector("#pause");
        const look = document.querySelector("#look");
        const controls = document.querySelector("#controls");
        const box = pause.getBoundingClientRect();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const style = (element) => ({ z: getComputedStyle(element).zIndex, position: getComputedStyle(element).position, pointer: getComputedStyle(element).pointerEvents, opacity: getComputedStyle(element).opacity, rect: element.getBoundingClientRect().toJSON() });
        return { pause: style(pause), look: style(look), controls: style(controls), hit: document.elementsFromPoint(x, y).slice(0, 6).map((element) => `${element.tagName}#${element.id}`) };
      });
      let click;
      try { await page.locator("#pause").click({ timeout: 3000 }); click = "ok"; }
      catch (error) { click = String(error).slice(0, 250); }
      const result = { width, height, hasTouch, before, click, paused: await page.locator(".front-pause").isVisible(), settingsButton: await page.locator("#front-settings").isVisible() };
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) {
      console.log(JSON.stringify({ width, height, error: String(error).slice(0, 250), state: await page.evaluate(() => ({ screen: document.body.dataset.screen, ui: document.querySelector("#ui")?.textContent?.slice(0, 350), pauseHidden: document.querySelector("#pause")?.hidden })) }));
      throw error;
    } finally {
      await context.close();
    }
  }
  await mkdir("dist-validation/lag-root-cause-20261101", { recursive: true });
  await writeFile(out, JSON.stringify({ head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), results }, null, 2));
  for (const result of results) {
    if (result.settings) {
      assert.match(result.settings.beforeToggle ?? "", /オフ/);
      assert.match(result.settings.afterOn ?? "", /オン/);
      assert.match(result.settings.afterOff ?? "", /オフ/);
      assert.equal(result.settings.storageOn, "1");
      assert.equal(result.settings.storageOff, "0");
    } else {
      assert.equal(result.click, "ok");
      assert.equal(result.paused, true);
      assert.equal(result.settingsButton, true);
    }
  }
  console.log(JSON.stringify({ evidence: out }));
} finally {
  await browser.close();
  await server.close();
}
