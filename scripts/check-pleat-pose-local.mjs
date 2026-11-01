import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:5187",
  upstream = "http://127.0.0.1:8795";
const out = "docs/evidence/pleat-pose-wire-20261101";
mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);
const result = {
  scope:
    "隔離Worker・空Chrome・通常の部屋参加/出撃後に生存戦の包囲出現fixtureを使用。実機・実回線・旧端末画面ではない。",
  errors: [],
  passed: false,
};
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem("swarm-front-player-name-v1", "姿勢通信検査");
    window.__pleatProbe = {
      hello: false,
      welcome: false,
      rendered: 0,
      pleats: 0,
      enemies: 0,
    };
    const Original = WebSocket;
    window.WebSocket = class extends Original {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (e) => {
          try {
            const m = JSON.parse(e.data);
            if (m.type === "welcome")
              window.__pleatProbe.welcome = m.pleatPose === 1;
          } catch {}
        });
      }
      send(data) {
        try {
          const m = JSON.parse(data);
          if (m.type === "hello") window.__pleatProbe.hello = m.pleatPose === 1;
        } catch {}
        return super.send(data);
      }
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => result.errors.push(e.message));
  const response = await fetch(upstream + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": key,
      "X-Test-Client": createHash("sha256")
        .update("pleat-ui-" + Date.now())
        .digest("hex"),
    },
    body: JSON.stringify({
      name: "隔離姿勢検査",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  assert.equal(response.status, 200);
  const room = await response.json();
  await page.goto(
    origin + "/front.html?networkDiagnostics=1&frontRoom=" + room.roomId,
  );
  await page.locator("#room-id").waitFor();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(upstream);
  await page.locator("#room-id").fill(room.roomId);
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator(":light(#room-join)").click();
  await page.getByRole("button", { name: "準備完了", exact: true }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.getByRole("button", { name: "準備完了", exact: true }).click();
  await expect(page.locator(":light(#front-start)")).toBeEnabled({
    timeout: 90000,
  });
  await page.locator(":light(#front-start)").click();
  await page.locator(":light(.rebuild-card[data-card])").first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator(":light(.rebuild-card[data-card])").first().click();
  await page.locator("#controls").waitFor({ state: "visible" });
  await page.evaluate(async () => {
    const { Renderer } = await import("/src/client/render.ts");
    const original = Renderer.prototype.render;
    Renderer.prototype.render = function (w, ...args) {
      const value = original.call(this, w, ...args);
      const pleats =
        w?.enemies.filter(
          (e) =>
            e.kind === "crawler" &&
            e.pleat &&
            !e.pleat.feet &&
            Number.isFinite(e.pleat.body.y),
        ) ?? [];
      if (pleats.length)
        Object.assign(window.__pleatProbe, {
          rendered: window.__pleatProbe.rendered + 1,
          pleats: pleats.length,
          enemies: w.enemies.length,
        });
      return value;
    };
  });
  const fixture = await fetch(
    `${upstream}/fixtures/${room.code ?? room.roomId}/front-survival-wave`,
    { method: "POST" },
  );
  assert.equal(fixture.status, 200);
  await page.waitForFunction(
    () =>
      window.__pleatProbe.enemies >= 8 && window.__pleatProbe.rendered >= 10,
  );
  for (const width of [844, 640]) {
    await page.setViewportSize({ width, height: 390 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/ui-${width}.png` });
  }
  result.probe = await page.evaluate(() => window.__pleatProbe);
  assert(result.probe.hello && result.probe.welcome && result.probe.pleats > 0);
  assert.deepEqual(result.errors, []);
  result.passed = true;
} finally {
  await browser.close();
  writeFileSync(`${out}/ui.json`, JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result));
