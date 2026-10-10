import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186";
const endpoint = "http://127.0.0.1:8789";
const out =
  process.env.INPUT_RESUME_OUTPUT ||
  "dist-validation/claude-balance/input-resume";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key);
const response = await fetch(endpoint + "/rooms", {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
  body: JSON.stringify({
    name: "入力中断の検証",
    listed: false,
    ruleset: "front-v1",
    mode: "survival",
  }),
});
assert.equal(response.status, 200);
const { code } = await response.json();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const errors = [];
const continued = process.env.INPUT_SCENARIO === "continue";
try {
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/front.html", { waitUntil: "domcontentloaded" });
  await page.locator("#coop").waitFor();
  await page.evaluate(async () => {
    const { FrontNetwork } = await import("/src/client/front-network.ts");
    const connect = FrontNetwork.prototype.connect;
    FrontNetwork.prototype.connect = function (...args) {
      window.inputProbe = { net: this, sent: [], states: [], hold: false };
      const onWorld = this.onWorld;
      this.onWorld = (world, first) => {
        const p = world.players.find((p) => p.id === this.id);
        window.inputProbe.states.push({
          time: world.time,
          evade: p?.evade,
          evadeCd: p?.evadeCd,
          x: p?.x,
          z: p?.z,
        });
        onWorld(world, first);
      };
      const result = connect.apply(this, args);
      const ws = this.ws,
        send = ws.send.bind(ws);
      ws.send = (text) => {
        const m = JSON.parse(text);
        if (m.type === "input") window.inputProbe.sent.push(m.input);
        return send(text);
      };
      // Inject only outbound-buffer pressure. All actual messages and world states use the real Worker.
      const original = Object.getOwnPropertyDescriptor(
        WebSocket.prototype,
        "bufferedAmount",
      ).get;
      Object.defineProperty(ws, "bufferedAmount", {
        configurable: true,
        get: () => (window.inputProbe.hold ? 5000 : original.call(ws)),
      });
      return result;
    };
  });
  await page.locator("#coop").click();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(endpoint);
  await page.locator("#room-id").fill(code);
  await page.locator("#room-join").click();
  await page.locator("#front-launch").click({ timeout: 90000 });
  await page.locator("#front-start").click({ timeout: 90000 });
  await page.locator("[data-card]").first().click({ timeout: 90000 });
  await page.locator("#pause").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForFunction(() => window.inputProbe.sent.length > 2);
  await page.evaluate(() => {
    window.inputProbe.hold = true;
    window.inputProbe.sent = [];
    window.inputProbe.states = [];
  });
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => window.inputProbe.net.pendingInput?.dodge === true,
  );
  const queued = await page.evaluate(() => ({
    ...window.inputProbe.net.pendingInput,
  }));
  if (!continued) await page.locator("#pause").click();
  const paused = await page.evaluate(() => ({
    pending: window.inputProbe.net.pendingInput ?? null,
    sent: window.inputProbe.sent.length,
  }));
  await page.screenshot({ path: out + "/paused.png" });
  await page.evaluate(() => {
    window.inputProbe.hold = false;
    window.inputProbe.sent = [];
    window.inputProbe.states = [];
  });
  if (!continued) await page.locator("#front-resume").click();
  await page.waitForFunction(
    () =>
      window.inputProbe.sent.length >= 5 &&
      window.inputProbe.states.length >= 5,
  );
  const resumed = await page.evaluate(() => ({
    sent: window.inputProbe.sent,
    states: window.inputProbe.states,
  }));
  const staleSent = resumed.sent.some((i) => i.dodge);
  const serverDodged = resumed.states.some((p) => p.evade > 0 || p.evadeCd > 0);
  let stoppedMovement = null;
  if (!continued && !serverDodged) {
    await page.keyboard.down("w");
    await page.waitForFunction(() =>
      window.inputProbe.sent.some((i) => i.mz !== 0),
    );
    await page.locator("#pause").click();
    await page.keyboard.up("w");
    await page.evaluate(() => {
      window.inputProbe.states = [];
      window.inputProbe.sent = [];
    });
    // Observe real server state for two seconds; input expiry must stop held movement.
    await page.waitForFunction(() => {
      const states = window.inputProbe.states;
      return states.length > 1 && states.at(-1).time - states[0].time >= 2;
    });
    stoppedMovement = await page.evaluate(() => {
      const states = window.inputProbe.states;
      const tail = states.filter((s) => s.time >= states[0].time + 0.5);
      return {
        states,
        sentWhilePaused: window.inputProbe.sent,
        maxDrift: Math.max(
          ...tail.map((s) => Math.hypot(s.x - tail[0].x, s.z - tail[0].z)),
        ),
      };
    });
    assert.ok(stoppedMovement.maxDrift < 0.01);
    assert.deepEqual(stoppedMovement.sentWhilePaused, []);
  }
  const result = {
    scenario: continued ? "continue" : "pause",
    queued,
    paused,
    resumed,
    staleSent,
    serverDodged,
    stoppedMovement,
    errors,
    scope: "実Chrome UI＋実Worker、送信buffer圧だけ試験注入",
  };
  fs.writeFileSync(out + "/result.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ staleSent, serverDodged, errors }));
  assert.equal(staleSent, continued || process.env.INPUT_EXPECT_STALE === "1");
  assert.equal(
    serverDodged,
    continued || process.env.INPUT_EXPECT_STALE === "1",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
