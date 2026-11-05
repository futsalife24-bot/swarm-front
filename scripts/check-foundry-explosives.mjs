// 実Worker/WS/製品描画と射撃操作。配置/装備/照準だけを隔離fixtureで準備する。
import { chromium, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials.ts";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const api = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const out = process.argv[2] ?? "dist-validation/foundry-explosion/browser";
if (new URL(api).hostname !== "127.0.0.1") throw Error("ローカル専用");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
let activePage;
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const response = await fetch(`${api}/rooms`, {
      method: "POST",
      headers: { "X-Room-Creation-Key": localCreationKey() },
      body: JSON.stringify({
        name: "FOUNDRY爆発判定の隔離検査",
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
    activePage = page;
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "爆発判定の隔離確認"),
    );
    const errors = [];
    let socketObserved = false;
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (ws) => {
      if (ws.url().includes(":8807/rooms/")) socketObserved = true;
    });
    page.setDefaultTimeout(60000);
    await page.route(/\/src\/client\/render\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst originalFoundryRender=Renderer.prototype.render;Renderer.prototype.render=function(...args){window.foundryWorld=args[0];return originalFoundryRender.apply(this,args);};",
      });
    });
    await page.route(/\/src\/client\/input\.ts(?:\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nconst originalFoundryRead=Controls.prototype.read;Controls.prototype.read=function(...args){if(window.foundryAim){this.input.yaw=0;this.input.pitch=0.4;}return originalFoundryRead.apply(this,args);};",
      });
    });
    const tap = async (selector) => {
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
      await page.locator(selector).click();
    };
    await page.goto(origin + "/?coop=1", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.locator("#room-join").waitFor();
    await tap(".coop-advanced summary");
    await page.locator("#endpoint").fill(api);
    await page.locator("#endpoint").dispatchEvent("change");
    await page.locator("#room-id").fill(code);
    await tap("#room-join");
    await page.locator("#begin").waitFor({ timeout: 20000 });
    await expect(page.locator("#begin")).toBeEnabled({ timeout: 120000 });
    await tap("#begin");
    await expect(page.locator("#controls")).toBeVisible({ timeout: 120000 });
    console.log(`${width}: 実WebSocketの戦闘へ参加`);
    for (const kind of ["rocket", "heavy", "grenade", "sticky"]) {
      const fixture = await fetch(
        `${api}/fixtures/${code}/foundry?form=explosive&weapon=${kind}`,
        { method: "POST" },
      );
      expect(fixture.status).toBe(200);
      const snapshot = await (
        await fetch(`${api}/fixtures/${code}/snapshot`)
      ).json();
      const boss = snapshot.world.enemies.find((e) => e.kind === "boss");
      await page.waitForFunction(
        (run) => window.foundryWorld?.run === run,
        snapshot.world.run,
      );
      await expect(page.locator("#controls")).toBeVisible();
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      await page.evaluate(() => (window.foundryAim = true));
      await page.bringToFront();
      const button =
        (await page.locator("#fire").boundingBox()) ??
        (await page.locator("#world").boundingBox());
      await page.mouse.move(
        button.x + button.width / 2,
        button.y + button.height / 2,
      );
      await page.mouse.down();
      try {
        await page.waitForFunction(
          ({ id, hp }) =>
            window.foundryWorld?.enemies.find((e) => e.id === id)?.hp < hp,
          { id: boss.id, hp: boss.hp },
          { timeout: 15000 },
        );
      } finally {
        await page.mouse.up();
      }
      const after = await (
        await fetch(`${api}/fixtures/${code}/snapshot`)
      ).json();
      const hp = after.world.enemies.find((e) => e.id === boss.id).hp;
      expect(hp).toBeLessThan(boss.hp);
      expect(socketObserved).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${out}/${width}-${kind}.png` });
      results.push({
        width,
        height,
        kind,
        beforeHp: boss.hp,
        afterHp: hp,
        damage: boss.hp - hp,
        realWebSocket: socketObserved,
        errors,
      });
      console.log(`${width} ${kind}: FOUNDRYのHP ${boss.hp} → ${hp}`);
    }
    await page.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    fs.writeFileSync(
      `${out}/failure.txt`,
      await activePage
        .locator("body")
        .innerText()
        .catch(() => "画面取得不可"),
    );
  }
  throw error;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
}
