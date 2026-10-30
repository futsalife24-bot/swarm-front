import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186",
  upstream = "http://127.0.0.1:8793";
const out =
  process.env.SWARM_RECOVERY_OUTPUT ??
  "dist-validation/coop-comfort-20261031/recovery-ui";
mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);
const result = {
  method:
    "実Workerと通常UIで出撃。初回接続の戦況JSON末尾へ空白を追加し、意味を変えず製品の分割器で分割。各片を750msずつ遅らせる合成輸送障害。実携帯回線の再現ではない。",
  passed: false,
  errors: [],
};
const browser = await chromium.launch({ channel: "chrome" });
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    localStorage.setItem("swarm-front-player-name-v1", "回復検査隊員");
    const probe = (window.__recovery = {
      connections: 0,
      welcomes: [],
      hellos: [],
      injected: 0,
      closes: [],
      closeRequests: [],
      accepted: [],
    });
    const Original = WebSocket;
    window.WebSocket = class extends Original {
      _handler = null;
      constructor(...args) {
        if (!String(args[0]).startsWith("ws://127.0.0.1:8793/rooms/"))
          return new Original(...args);
        super(...args);
        const connection = ++probe.connections;
        let due = 0;
        this.addEventListener("close", (e) =>
          probe.closes.push({
            connection,
            ms: performance.now(),
            code: e.code,
          }),
        );
        this.addEventListener("message", (e) => {
          const m = JSON.parse(e.data);
          if (m.type === "welcome")
            probe.welcomes.push({
              connection,
              id: m.id,
              ms: performance.now(),
            });
          if (connection === 1 && m.type === "state" && window.__chunkEncode) {
            const parts = window.__chunkEncode(
              e.data + " ".repeat(70000),
              m.stateId,
            );
            if (!parts) throw Error("検査用分割を作れません");
            probe.injected++;
            probe.firstInjectedAt ??= performance.now();
            for (const data of parts) {
              const wait = Math.max(performance.now(), due);
              due = wait + 750;
              setTimeout(() => {
                if (this.readyState === 1)
                  this._handler?.call(
                    this,
                    new MessageEvent("message", { data }),
                  );
              }, wait - performance.now());
            }
          } else {
            if (m.type === "state")
              probe.accepted.push({
                connection,
                ms: performance.now(),
                time: m.world.time,
                run: m.world.run,
              });
            this._handler?.call(this, e);
          }
        });
      }
      set onmessage(fn) {
        this._handler = fn;
      }
      get onmessage() {
        return this._handler;
      }
      close(code, reason) {
        probe.closeRequests.push({ ms: performance.now(), code, reason });
        return super.close(code, reason);
      }
      send(data) {
        const m = JSON.parse(data);
        if (m.type === "hello")
          probe.hellos.push({
            connection: probe.connections,
            hasToken: !!m.token,
          });
        return super.send(data);
      }
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(65000);
  page.on("pageerror", (e) => result.errors.push(e.message));
  const response = await fetch(upstream + "/rooms", {
    method: "POST",
    headers: {
      "X-Room-Creation-Key": key,
      "X-Test-Client": createHash("sha256")
        .update("recovery-" + Date.now())
        .digest("hex"),
    },
    body: JSON.stringify({
      name: "隔離回復検査",
      listed: false,
      ruleset: "front-v1",
      mode: "survival",
    }),
  });
  assert.equal(response.status, 200);
  const room = await response.json();
  await page.goto(origin + "/front.html?frontRoom=" + room.roomId);
  if (await page.locator(".title-entry-start").isVisible())
    await page.locator(".title-entry-start").click();
  await page.locator("#room-id").waitFor();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(upstream);
  await page.locator("#room-id").fill(room.roomId);
  await page.evaluate(async () => {
    window.__chunkEncode = (
      await import("/src/shared/state-chunks.ts")
    ).encodeStateChunks;
  });
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
    timeout: 65000,
  });
  await page.locator(":light(#front-start)").click();
  await page.locator(":light(.rebuild-card[data-card])").first().waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator(":light(.rebuild-card[data-card])").first().click();
  await page.locator("#controls").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    /往復 \d+ms/.test(document.querySelector(".battle-fps")?.textContent ?? ""),
  );
  await page.waitForTimeout(2000);
  const probe = await page.evaluate(() => window.__recovery);
  assert.equal(probe.connections, 2);
  assert(probe.injected >= 1);
  assert.equal(probe.welcomes.length, 2);
  assert.equal(probe.welcomes[0].id, probe.welcomes[1].id);
  assert(probe.hellos[1].hasToken);
  assert(probe.accepted.some((s) => s.connection === 2 && s.time >= 0));
  const requested = probe.closeRequests.find(
    (c) => c.reason === "戦況データを再取得します",
  );
  assert(requested && requested.code === 1000);
  const recoveryRequestMs = requested.ms - probe.firstInjectedAt;
  assert(recoveryRequestMs >= 1900 && recoveryRequestMs < 5000);
  const firstRecoveredStateMs = probe.accepted[0].ms - probe.firstInjectedAt;
  assert.equal(probe.closes[0]?.code, 1000);
  assert(firstRecoveredStateMs < 5000);
  result.recovery = {
    connections: probe.connections,
    injected: probe.injected,
    samePlayer: true,
    tokenReused: true,
    closeCode: probe.closes[0]?.code,
    requestedCloseCode: requested.code,
    recoveryRequestMs,
    firstRecoveredStateMs,
    reconnectedWorlds: probe.accepted.length,
    welcomeToRecoveryMs: probe.welcomes[1].ms - probe.welcomes[0].ms,
  };
  result.labels = [];
  for (const width of [844, 640]) {
    await page.setViewportSize({ width, height: 390 });
    await page.waitForTimeout(1200);
    const label = page.locator(".battle-fps");
    const box = await label.boundingBox();
    assert(
      box &&
        box.x >= 0 &&
        box.x + box.width <= width &&
        box.y + box.height <= 390,
    );
    result.labels.push({ width, text: await label.innerText(), box });
    await page.screenshot({ path: `${out}/coop-${width}.png` });
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.failure = String(e);
  process.exitCode = 1;
  if (page) {
    await page.screenshot({ path: out + "/failure.png" });
    result.screen = (await page.locator("body").innerText()).replace(
      /[a-f0-9]{32,64}/gi,
      "[redacted]",
    );
  }
} finally {
  writeFileSync(out + "/results.json", JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify(result));
