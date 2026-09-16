import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8797";
const out = "dist-validation/lobby-invite";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key);
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
});
assert.ok(response.ok);
const { code } = await response.json();
const browser = await chromium.launch({ channel: "chrome" });
const errors = [],
  results = [];
try {
  const host = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  host.on("pageerror", (e) => errors.push(e.message));
  await host.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "招待確認"),
  );
  await host.goto(`${origin}/#${code}`);
  await host.locator(".coop-advanced summary").click();
  await host.locator("#endpoint").fill(endpoint);
  await host.locator("#launch").click();
  await host.locator("#room-code").waitFor();
  const id = await host.locator("#room-code").textContent();
  await host.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (text) => {
        window.copied = text;
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });
  await host
    .getByRole("button", { name: "部屋IDをコピー", exact: true })
    .click();
  assert.equal(await host.evaluate(() => window.copied), id);
  await host.locator("#share").click();
  const invite = await host.evaluate(() => window.copied);
  assert.equal(new URL(invite).hash, `#${code}`);
  for (const width of [667, 844, 1280]) {
    await host.setViewportSize({ width, height: 390 });
    const bounds = await host.evaluate(() => {
      const rect = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      };
      return {
        id: rect("#room-code"),
        copy: rect("#copy"),
        share: rect("#share"),
        title: rect(".lobby-header > div"),
        exit: rect("#leave-lobby"),
      };
    });
    assert.ok(
      bounds.copy.x >= bounds.id.right && bounds.copy.x - bounds.id.right < 10,
    );
    assert.ok(bounds.share.x >= bounds.title.right + 8);
    assert.ok(bounds.share.right < bounds.exit.x && bounds.exit.right <= width);
    await host.screenshot({ path: `${out}/lobby-${width}.png` });
    results.push({ width, bounds });
  }
  const guest = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.addInitScript(() => {
    localStorage.setItem("swarm-front-player-name-v1", "参加確認");
    Object.defineProperty(window, "launchQueue", {
      value: {
        setConsumer(fn) {
          window.deliverLaunch = fn;
        },
      },
    });
  });
  await guest.goto(`${origin}/?coop=1`);
  await guest.locator("#room-id").waitFor();
  guest.once("dialog", (d) => d.dismiss());
  await guest.evaluate(
    (url) => window.deliverLaunch({ targetURL: url }),
    invite,
  );
  assert.equal(await guest.locator("#room-id").count(), 1);
  guest.once("dialog", (d) => d.accept());
  await guest
    .evaluate((url) => window.deliverLaunch({ targetURL: url }), invite)
    .catch((e) => {
      if (!e.message.includes("context was destroyed")) throw e;
    });
  await guest.getByRole("button", { name: "招待ルームに参加" }).waitFor();
  await guest.goto(`${origin}/?coop=1`);
  await guest.locator(".coop-advanced summary").click();
  await guest.locator("#endpoint").fill(endpoint);
  await guest.locator("#room-id").fill(invite);
  await guest.locator("#room-join").click();
  await guest.locator("#room-code").waitFor();
  assert.equal(await guest.locator("#room-code").textContent(), id);
  await guest.locator("#leave-lobby").click();
  await guest.goto(`${origin}/?coop=1`);
  await guest.locator(".coop-advanced summary").click();
  await guest.locator("#endpoint").fill(endpoint);
  await guest.locator("#room-id").fill(id);
  await guest.locator("#room-join").click();
  await guest.locator("#room-code").waitFor();
  assert.equal(await guest.locator("#room-code").textContent(), id);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        results,
        errors,
        copyId: true,
        shareFallback: true,
        realLinkJoin: true,
        realIdJoin: true,
        simulatedLaunchAcceptCancel: true,
        osLinkCapture: "not tested",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: ID copy, invite share fallback, 3 landscape widths, real link/ID joins, simulated launch accept/cancel",
  );
} finally {
  await browser.close();
}
