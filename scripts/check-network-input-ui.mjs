import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Real entry pages/Controls/Worker; only RAF delivery is delayed.
const baseline = process.env.SWARM_INPUT_BASELINE === "1";
const out =
  process.env.SWARM_INPUT_UI_OUTPUT ??
  "dist-validation/coop-comfort-20261030/input-ui";
const modes = (process.env.SWARM_INPUT_UI_MODES ?? "front,legacy").split(",");
assert.ok(modes.every((m) => ["front", "legacy"].includes(m)));
fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8793";
const files = [
  "src/client/front-app.ts",
  "src/main.ts",
  "src/client/front-network.ts",
  "src/client/network.ts",
  "src/client/network-input-loop.ts",
  "src/client/input.ts",
  "scripts/check-network-input-ui.mjs",
];
const hashes = () =>
  Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    ]),
  );
const result = {
  baseline,
  method:
    "Actual entry pages and real local Worker; disposable profiles with a player-name preference only; normal joins/buttons/keyboard/mouse. 1000ms synthetic RAF delivery delay only. Baseline serves prior production build; modified run serves current Vite sources.",
  sourceBefore: hashes(),
  runs: [],
  errors: [],
  passed: false,
};
if (baseline)
  result.buildRevision = JSON.parse(
    fs.readFileSync("dist/asset-download-manifest.json", "utf8"),
  ).revision;
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Local credential unavailable");
const browser = await chromium.launch({
  channel: "chrome",
  // Use real tab focus; disable Playwright's forced-focus emulation below.
  headless: false,
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
try {
  for (const mode of modes) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    page.setDefaultTimeout(65000);
    page.on("pageerror", (e) =>
      result.errors.push({
        mode,
        error: e.message.replace(/[a-f0-9]{32,64}/gi, "[redacted]"),
      }),
    );
    await page.addInitScript(() => {
      // Returning-player fixture in an otherwise blank, disposable profile.
      // Registration UI is outside this input scheduling regression.
      localStorage.setItem("swarm-front-player-name-v1", "入力検査隊員");
      const probe = (window.__inputProbe = {
        sent: [],
        holdUntil: 0,
        heldCallbacks: 0,
        marks: {},
        socket: null,
      });
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        raf((time) => {
          const delay = probe.holdUntil - performance.now();
          if (delay > 0) {
            probe.heldCallbacks++;
            setTimeout(() => raf(callback), delay);
          } else callback(time);
        });
      const send = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          const m = JSON.parse(data);
          if (m.type === "input") {
            probe.socket = this;
            probe.sent.push({
              ms: performance.now(),
              seq: m.input.seq,
              mx: m.input.mx,
              mz: m.input.mz,
              fire: m.input.fire,
              reload: m.input.reload,
              dodge: m.input.dodge,
              swap: m.input.swap,
            });
          }
        } catch {}
        return send.call(this, data);
      };
    });
    const response = await fetch(endpoint + "/rooms", {
      method: "POST",
      headers: {
        "X-Room-Creation-Key": key,
        "X-Test-Client": createHash("sha256")
          .update("input-ui-" + mode + "-" + Date.now())
          .digest("hex"),
      },
      body: JSON.stringify({
        name: "隔離入力周期検査",
        listed: false,
        ...(mode === "front" ? { ruleset: "front-v1", mode: "survival" } : {}),
      }),
    });
    assert.equal(response.status, 200);
    const room = await response.json();
    console.log(mode + ": 通常の参加画面を開く");
    await page.goto(
      mode === "front"
        ? origin + "/front.html?frontRoom=" + room.roomId
        : origin + "/?coop=1",
    );
    const entry = page.locator(".title-entry-start");
    if (await entry.isVisible()) await entry.click();
    await page.locator("#room-id").waitFor({ state: "visible" });
    await page.locator(".coop-advanced summary").click();
    await page.locator("#endpoint").fill(endpoint);
    await page.locator("#room-id").fill(room.roomId);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForFunction(() => !document.querySelector(".split-shutter"));
    await page.locator("#room-join").click();
    if (mode === "front") {
      await page
        .getByRole("button", { name: "準備完了", exact: true })
        .waitFor({ state: "visible" });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      await page.waitForFunction(
        () => !document.querySelector(".split-shutter"),
      );
      await page.getByRole("button", { name: "準備完了", exact: true }).click();
      await expect(page.locator("#front-start")).toBeEnabled({
        timeout: 65000,
      });
      await page.locator("#front-start").click();
      await page
        .locator(".rebuild-card[data-card]")
        .first()
        .waitFor({ state: "visible" });
      await page.locator(".rebuild-card[data-card]").first().click();
    } else {
      const name = page.getByRole("textbox", { name: "部隊で表示する名前" });
      await expect(name.or(page.locator("#begin"))).toBeVisible({
        timeout: 65000,
      });
      if (await name.isVisible()) {
        await name.fill("入力検査隊員");
        await page.getByRole("button", { name: "この名前で登録" }).click();
      }
      await expect(page.locator("#begin")).toBeEnabled({ timeout: 65000 });
      await page.locator("#begin").click();
    }
    await page.locator("#controls").waitFor({ state: "visible" });
    const skip = page.getByRole("button", {
      name: "スキップして戦闘へ",
      exact: true,
    });
    if (await skip.isVisible()) await skip.click();
    await page.bringToFront();
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(() => !document.hidden && document.hasFocus()),
      true,
    );
    await page.keyboard.down("KeyW");
    await page.mouse.move(420, 200);
    await page.mouse.down();
    await page.waitForFunction(() =>
      window.__inputProbe.sent.some((s) => s.mz === 1 && s.fire),
    );
    console.log(mode + ": 移動・射撃を確認、RAFだけ1000ms保留");
    await page.evaluate(() => {
      const p = window.__inputProbe;
      p.marks.holdStart = performance.now();
      p.holdUntil = p.marks.holdStart + 1000;
    });
    await page.waitForTimeout(250);
    await page.keyboard.up("KeyW");
    await page.mouse.up();
    const releaseAt = await page.evaluate(
      () => (window.__inputProbe.marks.release = performance.now()),
    );
    await page.waitForTimeout(1050);
    const measured = await page.evaluate(() => {
      const p = window.__inputProbe;
      return { sent: p.sent, marks: p.marks, heldCallbacks: p.heldCallbacks };
    });
    const during = measured.sent.filter(
      (s) =>
        s.ms > measured.marks.holdStart + 80 &&
        s.ms < measured.marks.holdStart + 900,
    );
    const release = measured.sent.find(
      (s) => s.ms >= releaseAt && s.mz === 0 && s.mx === 0 && !s.fire,
    );
    assert.ok(release, "Release input never sent");
    assert.ok(measured.heldCallbacks > 0, "RAF delay was not exercised");
    const releaseDelayMs = release.ms - releaseAt;
    if (baseline) {
      assert.ok(
        during.length <= 1,
        "Baseline no longer reproduces missing RAF input",
      );
      assert.ok(releaseDelayMs > 500, "Baseline release was not delayed");
    } else {
      assert.ok(
        during.length >= 12,
        "Input loop did not continue through RAF hold",
      );
      assert.ok(releaseDelayMs < 200, "Release waited for drawing");
    }
    const run = {
      mode,
      duringRafHold: during.length,
      releaseDelayMs,
      heldCallbacks: measured.heldCallbacks,
      samples: measured.sent,
      pauses: [],
    };
    result.runs.push(run);
    await page.evaluate(() => document.exitPointerLock?.());
    await page.locator("#pause").click();
    const pauseAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(300);
    const paused = await page.evaluate(
      (at) => window.__inputProbe.sent.filter((s) => s.ms > at + 80),
      pauseAt,
    );
    if (!baseline)
      assert.equal(paused.length, 0, "Inputs continued while paused");
    run.pauses.push({ kind: "menu", sentAfter80Ms: paused.length });
    await page
      .locator(mode === "front" ? "#front-resume" : "#pause-resume")
      .click();
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 390, height: 844 });
    const portraitAt = await page.evaluate(() => performance.now());
    await page.waitForTimeout(300);
    const portrait = await page.evaluate(
      (at) => window.__inputProbe.sent.filter((s) => s.ms > at + 80),
      portraitAt,
    );
    if (!baseline)
      assert.equal(
        portrait.length,
        0,
        "Inputs continued behind portrait guidance",
      );
    run.pauses.push({ kind: "portrait", sentAfter80Ms: portrait.length });
    await page.setViewportSize({ width: 844, height: 390 });
    await page
      .locator(mode === "front" ? "#front-resume" : "#pause-resume")
      .click();
    await page.waitForTimeout(200);
    if (!baseline) {
      const disconnectedAt = await page.evaluate(() => {
        const p = window.__inputProbe;
        p.oldSocket = p.socket;
        p.marks.disconnected = performance.now();
        p.socket.close(1000, "isolated reconnect check");
        return p.marks.disconnected;
      });
      await page.waitForTimeout(100);
      await page.keyboard.press("KeyQ");
      await page.waitForFunction(() => {
        const p = window.__inputProbe;
        return (
          p.socket !== p.oldSocket && p.sent.at(-1)?.ms > p.marks.disconnected
        );
      });
      const resumedAt = await page.evaluate(() => performance.now());
      await page.waitForTimeout(1050);
      const resumed = await page.evaluate(
        (at) => window.__inputProbe.sent.filter((s) => s.ms > at),
        resumedAt,
      );
      assert.ok(
        resumed.length >= 15 && resumed.length <= 22,
        "Reconnect changed input frequency",
      );
      assert.ok(
        resumed.every(
          (s) =>
            !s.swap &&
            !s.dodge &&
            !s.reload &&
            !s.fire &&
            s.mx === 0 &&
            s.mz === 0,
        ),
        "Old/offline controls replayed after reconnect",
      );
      run.reconnect = {
        disconnectedAt,
        resumedAt,
        sampleCount: resumed.length,
        noReplayedActions: true,
      };
      const away = await context.newPage();
      const awayCdp = await context.newCDPSession(away);
      await awayCdp.send("Emulation.setFocusEmulationEnabled", {
        enabled: false,
      });
      await away.goto("about:blank");
      await away.bringToFront();
      const lostFocus = await page.evaluate(() => !document.hasFocus());
      if (lostFocus) {
        const blurredAt = await page.evaluate(() => performance.now());
        await page.waitForTimeout(300);
        const hidden = await page.evaluate(
          (at) => window.__inputProbe.sent.filter((s) => s.ms > at + 80),
          blurredAt,
        );
        assert.equal(hidden.length, 0, "Input continued after focus loss");
        run.pauses.push({
          kind: "focus-loss",
          verified: true,
          sentAfter80Ms: hidden.length,
        });
      } else {
        // Do not override document.hasFocus or claim this as a product pass.
        run.pauses.push({
          kind: "focus-loss",
          verified: false,
          reason:
            "Playwright forced focus remained active despite the separate CDP session disabling its own focus emulation; native tab focus is unverified.",
        });
      }
      await away.close();
      await page.bringToFront();
      if (mode === "front" && (await page.locator("#front-resume").isVisible()))
        await page.locator("#front-resume").click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: path.join(out, mode + ".png") });
    await context.close();
    console.log(
      mode +
        ": 検査完了 " +
        JSON.stringify({ during: during.length, releaseDelayMs }),
    );
  }
  assert.deepEqual(result.errors, []);
  result.sourceAfter = hashes();
  result.sourcesStable =
    JSON.stringify(result.sourceBefore) === JSON.stringify(result.sourceAfter);
  assert.ok(result.sourcesStable);
  result.nativeFocusVerified =
    !baseline &&
    result.runs.every((r) =>
      r.pauses.some((p) => p.kind === "focus-loss" && p.verified),
    );
  result.passed = true;
} catch (error) {
  result.failure = String(error).replace(/[a-f0-9]{32,64}/gi, "[redacted]");
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({ path: path.join(out, "failure.png") })
        .catch(() => {});
      result.failureUi = (
        await page
          .locator("body")
          .innerText()
          .catch(() => "")
      )
        .slice(0, 2500)
        .replace(/[a-f0-9]{32,64}/gi, "[redacted]");
    }
  throw error;
} finally {
  await browser.close();
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(result, null, 2),
  );
}
