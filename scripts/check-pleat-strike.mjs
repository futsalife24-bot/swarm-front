// 隔離Workerの配置fixture以外は実戦闘・実WS・製品Rendererを使う。
import { chromium, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials.ts";
import fs from "node:fs";
const origin = "http://127.0.0.1:5186",
  api = "http://127.0.0.1:8807";
const out = "dist-validation/pleat-strike-browser";
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
    const room = await fetch(api + "/rooms", {
      method: "POST",
      headers: { "X-Room-Creation-Key": localCreationKey() },
      body: JSON.stringify({ name: "踏み込み検査", listed: false }),
    });
    expect(room.status).toBe(200);
    const { code } = await room.json();
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "踏み込み検査"),
    );
    await page.addLocatorHandler(page.locator("#pt-intro-skip"), async () =>
      page.locator("#pt-intro-skip").click(),
    );
    await page.route(/\/src\/client\/render\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst origStrikeRender=Renderer.prototype.render;Renderer.prototype.render=function(...a){window.strikeWorld=a[0];window.strikeView=this;window.strikeOwner=a[1];return origStrikeRender.apply(this,a)};",
      });
    });
    await page.route(/\/src\/client\/input\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst origStrikeRead=Controls.prototype.read;Controls.prototype.read=function(...a){const i=origStrikeRead.apply(this,a);if(window.strikeInput)Object.assign(i,window.strikeInput);return i};",
      });
    });
    const tap = async (selector) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(selector).click();
    };
    await page.goto(origin + "/?coop=1", { waitUntil: "domcontentloaded" });
    await page.locator("#room-join").waitFor();
    await tap(".coop-advanced summary");
    await page.locator("#endpoint").fill(api);
    await page.locator("#endpoint").dispatchEvent("change");
    await page.locator("#room-id").fill(code);
    await tap("#room-join");
    await expect(page.locator("#begin")).toBeEnabled({ timeout: 120000 });
    await tap("#begin");
    await expect(page.locator("#controls")).toBeVisible({ timeout: 120000 });
    for (const mode of ["still", "side"]) {
      await page.evaluate(
        () =>
          (window.strikeInput = {
            mx: 0,
            mz: 0,
            yaw: 0,
            pitch: 0,
            shoot: false,
          }),
      );
      const fixture = await fetch(`${api}/fixtures/${code}/pleat-strike`, {
        method: "POST",
      });
      expect(fixture.status).toBe(200);
      const { world } = await (
        await fetch(`${api}/fixtures/${code}/snapshot`)
      ).json();
      await page.waitForFunction(
        (run) => window.strikeWorld?.run === run,
        world.run,
      );
      await page.waitForFunction(
        () => window.strikeWorld?.enemies[0]?.wind > 0,
      );
      const before = await page.evaluate(() => ({
        time: window.strikeWorld.time,
        hp: window.strikeWorld.players.find((p) => p.id === window.strikeOwner)
          .hp,
      }));
      if (mode === "side")
        await page.evaluate(() => (window.strikeInput.mx = 1));
      else {
        await page.waitForFunction(() => {
          const e = window.strikeWorld?.enemies[0];
          return e?.wind > 0 && e.wind <= 0.35;
        });
        await page.screenshot({ path: `${out}/${width}-warning.png` });
      }
      await page.waitForFunction(
        (t) => window.strikeWorld.time >= t + 1.2,
        before.time,
      );
      const after = await page.evaluate(() => ({
        time: window.strikeWorld.time,
        hp: window.strikeWorld.players.find((p) => p.id === window.strikeOwner)
          .hp,
        enemies: window.strikeWorld.enemies.map((e) => ({
          x: e.x,
          z: e.z,
          wind: e.wind,
          cool: e.cool,
        })),
      }));
      const damage = before.hp - after.hp;
      if (mode === "still") expect(damage).toBeGreaterThan(0);
      else expect(damage).toBe(0);
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        mode,
        before,
        after,
        damage,
        errors: [...errors],
      });
      await page.screenshot({ path: `${out}/${width}-${mode}.png` });
      console.log(JSON.stringify({ width, mode, damage }));
    }
    await page.close();
  }
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
