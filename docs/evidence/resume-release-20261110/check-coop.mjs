// Published Worker smoke: normal UI and Turnstile only. Never persist room IDs or tokens.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const origin = "https://swarm-front.melosalife-24.workers.dev";
const output = "dist-validation/resume-release-20261110/check-coop.json";
const socketPrefix = origin.replace(/^http/, "ws") + "/rooms/";
const result = {
  origin,
  checkedAt: new Date().toISOString(),
  status: "unverified",
  stage: "launch",
  clients: [],
};
mkdirSync("dist-validation/resume-release-20261110", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const contexts = [];

async function openClient(label) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(60000);
  const metrics = {
    label,
    received: 0,
    state: 0,
    stateDelta: 0,
    stateChunk: 0,
    tupleV2: 0,
    maxFrameBytes: 0,
    socketCloses: 0,
    pageErrors: 0,
  };
  page.on("pageerror", () => metrics.pageErrors++);
  page.on("websocket", (socket) => {
    if (!socket.url().startsWith(socketPrefix)) return;
    socket.on("framereceived", ({ payload }) => {
      // Parse only the message type and size. Never store a frame or welcome token.
      const frame = typeof payload === "string" ? payload : payload.toString();
      metrics.received++;
      metrics.maxFrameBytes = Math.max(
        metrics.maxFrameBytes,
        Buffer.byteLength(frame),
      );
      try {
        const message = JSON.parse(frame);
        if (message.type === "state") metrics.state++;
        if (message.type === "stateDelta") metrics.stateDelta++;
        if (message.type === "stateChunk") metrics.stateChunk++;
        if (message.stateEncoding === "tuples-v2") metrics.tupleV2++;
      } catch {
        // The product client owns decoding; this smoke records sizes only.
      }
    });
    socket.on("close", () => metrics.socketCloses++);
  });
  await page.goto(origin + "/front.html?coop=1", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#room-id").waitFor();
  return { page, metrics };
}

async function leaveNormally(page) {
  if (page.isClosed()) return;
  if (await page.locator("#pause").isVisible().catch(() => false))
    await page.locator("#pause").click({ timeout: 5000 }).catch(() => {});
  if (await page.locator("#front-leave").isVisible().catch(() => false)) {
    await page.locator("#front-leave").click({ timeout: 5000 }).catch(() => {});
    if (await page.locator("#front-leave-confirm").isVisible().catch(() => false))
      await page.locator("#front-leave-confirm").click({ timeout: 5000 }).catch(() => {});
  }
}

try {
  const host = await openClient("host");
  const guest = await openClient("guest");
  result.clients = [host.metrics, guest.metrics];
  result.stage = "turnstile";
  await host.page.locator("#room-name").fill("公開確認" + Date.now().toString(36));
  assert.equal(await host.page.locator("#creation-key").inputValue(), "");
  // Wait for the normal widget callback's response field. Only a boolean leaves the page.
  await host.page.waitForFunction(
    () => {
      const field = document.querySelector(
        'input[name="cf-turnstile-response"]',
      );
      return field instanceof HTMLInputElement && field.value.length > 0;
    },
    null,
    { timeout: 75000 },
  );
  result.stage = "create";
  await host.page.locator("#launch").click();
  await host.page.locator(".front-lobby").waitFor();
  const roomId = await host.page.locator("#front-room-password").innerText();
  assert.match(roomId, /^\d{3}$/);
  result.stage = "join";
  await guest.page.locator("#room-id").fill(roomId);
  await guest.page.locator("#room-join").click();
  await guest.page.locator(".front-lobby").waitFor();
  for (const client of [host, guest]) {
    await client.page.locator("#front-launch").click();
    await client.page.locator(".front-lobby").waitFor();
  }
  result.stage = "start";
  await host.page.locator("#front-start").waitFor({ state: "visible" });
  await host.page.locator("#front-start").click();
  for (const client of [host, guest]) {
    await client.page.waitForFunction(
      () =>
        !document.querySelector("#controls")?.hasAttribute("hidden") ||
        !!document.querySelector("[data-card]"),
      null,
      { timeout: 45000 },
    );
    const card = client.page.locator("[data-card]").first();
    if (await card.isVisible().catch(() => false)) await card.click();
    await client.page.locator("#controls").waitFor({ timeout: 45000 });
  }
  result.stage = "traffic";
  await Promise.all(
    [host, guest].map((client) =>
      client.page.waitForFunction(
        () => document.body.dataset.screen === "battle",
        null,
        { timeout: 15000 },
      ),
    ),
  );
  await host.page.waitForTimeout(3000);
  for (const { metrics } of [host, guest]) {
    assert.ok(metrics.received > 2);
    assert.ok(metrics.state + metrics.stateDelta + metrics.stateChunk > 0);
    assert.ok(metrics.tupleV2 > 0);
    assert.ok(metrics.maxFrameBytes <= 65536);
    assert.equal(metrics.socketCloses, 0);
    assert.equal(metrics.pageErrors, 0);
  }
  // Leaving closes the sockets by design, so preserve the battle-only sample.
  result.clients = result.clients.map((metrics) => ({ ...metrics }));
  result.stage = "leave";
  for (const client of [guest, host]) {
    await client.page.locator("#pause").click();
    await client.page.locator("#front-leave").click();
    await client.page.locator("#front-leave-confirm").click();
    await client.page.locator("#solo").waitFor();
  }
  result.status = "passed";
  result.stage = "complete";
} catch (error) {
  result.status = ["traffic", "leave"].includes(result.stage)
    ? "failed"
    : "unverified";
  result.reason = `${result.stage}_not_confirmed`;
  result.errorName = error instanceof Error ? error.name : "unknown";
} finally {
  // Cleanup is best effort after an incomplete run; it never upgrades a result.
  if (result.stage !== "complete")
    result.clients = result.clients.map((metrics) => ({ ...metrics }));
  for (const context of contexts) {
    for (const page of context.pages())
      await leaveNormally(page).catch(() => {});
    await context.close().catch(() => {});
  }
  await browser.close().catch(() => {});
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
