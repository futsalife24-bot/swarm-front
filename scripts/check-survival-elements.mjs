// 属性所持・高耐久標的の準備だけテストWorker。通常射撃→共有戦闘→実WS→製品描画を確認。
import { chromium, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials.ts";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const api = process.env.SWARM_TEST_SERVER_URL ?? "http://127.0.0.1:8807";
const out = process.argv[2] ?? "dist-validation/survival-elements-battle";
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
        listed: false,
        name: "属性の隔離検査",
      }),
    });
    expect(response.status).toBe(200);
    const { code } = await response.json();
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    const events = new Map();
    const wireSummary = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("websocket", (socket) =>
      socket.on("framereceived", ({ payload }) => {
        try {
          const visit = (value) => {
            if (!value || typeof value !== "object") return;
            if (
              ["burn", "freeze", "chain-lightning"].includes(value.frontEffect)
            )
              events.set(value.id, value);
            for (const nested of Object.values(value))
              if (typeof nested === "object") visit(nested);
          };
          const packet = JSON.parse(String(payload));
          wireSummary.push({
            type: packet.type,
            time: packet.world?.time,
            stateId: packet.stateId,
            base: packet.base,
            bytes: String(payload).length,
          });
          visit(packet);
        } catch {}
      }),
    );
    const settle = () =>
      page.waitForFunction(
        () => !document.querySelector(".split-shutter,.menu-route-shutter"),
      );
    const tap = async (selector) => {
      await settle();
      await page.locator(selector).tap();
    };
    try {
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
      await expect(page.locator("#front-start")).toBeEnabled({
        timeout: 120000,
      });
      await tap("#front-start");
      await page.locator("[data-card]").first().waitFor({ timeout: 120000 });
      await tap("[data-card]:first-of-type");
      await page.locator(".operation-cue").waitFor({ state: "visible" });
      await page.locator(".operation-cue").waitFor({ state: "detached" });
      await expect(page.locator("#controls")).toBeVisible();
      const fixture = await fetch(`${api}/fixtures/${code}/front-elements`, {
        method: "POST",
      });
      expect(fixture.status, await fixture.text()).toBe(200);
      await expect(
        page.locator('.front-upgrade-strip [data-size="S"]'),
      ).toHaveCount(4);
      // 画面内の射撃ボタンを長押し。照準や命中結果は書き換えない。
      const fire = page.locator("#fire");
      await expect(fire).toBeVisible();
      const r = await fire.boundingBox();
      let capture;
      if (process.env.CAPTURE_FRAMES === "1") {
        capture = await context.newCDPSession(page);
        let frame = 0;
        capture.on("Page.screencastFrame", async ({ data, sessionId }) => {
          if (frame < 80)
            fs.writeFileSync(
              `${out}/${width}-frame-${String(frame++).padStart(3, "0")}.png`,
              Buffer.from(data, "base64"),
            );
          await capture
            .send("Page.screencastFrameAck", { sessionId })
            .catch(() => {});
        });
        await capture.send("Page.startScreencast", {
          format: "png",
          maxWidth: width,
          maxHeight: height,
          everyNthFrame: 1,
        });
      }
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await page.mouse.down();
      await expect
        .poll(
          () =>
            [...events.values()].filter(
              (e) => e.frontEffect === "chain-lightning",
            ).length,
          { timeout: 12000, intervals: [20] },
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: `${out}/${width}-elements.png` });
      if (capture) {
        await capture.send("Page.stopScreencast");
        await capture.detach();
      }
      await page.mouse.up();
      const kinds = [
        ...new Set([...events.values()].map((e) => e.frontEffect)),
      ];
      expect(kinds).toEqual(
        expect.arrayContaining(["burn", "freeze", "chain-lightning"]),
      );
      await tap("#pause");
      await expect(page.locator('[data-upgrade="fire-rounds"]')).toBeVisible();
      await page.screenshot({ path: `${out}/${width}-owned.png` });
      expect(errors).toEqual([]);
      results.push({
        width,
        height,
        normalFireInput: true,
        eventKinds: kinds,
        events: events.size,
        errors,
      });
      console.log(`${width}x${height}: 通常射撃・属性3種・実WS・描画 合格`);
    } catch (error) {
      await page.mouse.up();
      await page.screenshot({ path: `${out}/${width}-failure.png` });
      const snapshot = await fetch(`${api}/fixtures/${code}/snapshot`).then(
        (r) => r.json(),
      );
      const w = snapshot.world;
      fs.writeFileSync(
        `${out}/${width}-failure.json`,
        JSON.stringify(
          {
            wireSummary,
            errors,
            events: [...events.values()],
            world: w && {
              time: w.time,
              events: w.events,
              players: w.players.map((p) => ({
                x: p.x,
                y: p.y,
                z: p.z,
                yaw: p.yaw,
                pitch: p.pitch,
                ammo: p.ammo,
              })),
              enemies: w.enemies.map((e) => ({
                id: e.id,
                x: e.x,
                y: e.y,
                z: e.z,
                hp: e.hp,
              })),
              front: w.front,
            },
          },
          null,
          2,
        ),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
}
