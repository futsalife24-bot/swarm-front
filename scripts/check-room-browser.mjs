import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.PERF_ORIGIN || "http://127.0.0.1:5196";
const endpoint = process.env.PERF_ENDPOINT || "http://127.0.0.1:8796";
const out = "dist-validation/coop-performance/rooms";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key);
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-angle=d3d11",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const traffic = [];
const pages = [],
  errors = [],
  proof = [];
async function page(name) {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("websocket", (ws) => {
    if (!new URL(ws.url()).pathname.startsWith("/rooms/")) return;
    ws.on("framesent", ({ payload }) => {
      const m = JSON.parse(payload.toString());
      traffic.push({
        name,
        at: performance.now(),
        direction: "send",
        type: m.type,
        ready: m.ready,
        generation: m.preparationGeneration,
      });
    });
    ws.on("framereceived", ({ payload }) => {
      const m = JSON.parse(payload.toString());
      if (["error", "notice"].includes(m.type))
        traffic.push({
          name,
          at: performance.now(),
          direction: "receive",
          type: m.type,
          reason: m.reason,
        });
    });
  });
  await p.addInitScript(
    (name) => localStorage.setItem("swarm-front-player-name-v1", name),
    name,
  );
  pages.push(p);
  return p;
}
async function entry(p) {
  await p.goto(origin + "/?coop=1");
  await p.locator(".coop-advanced summary").click();
  await p.locator("#endpoint").fill(endpoint);
  await p.locator("#endpoint").dispatchEvent("change");
  await p.waitForTimeout(250);
}
async function list() {
  const r = await fetch(endpoint + "/rooms");
  assert.ok(r.ok);
  return (await r.json()).rooms;
}
async function poll(fn) {
  for (let i = 0; i < 80; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Expected state did not arrive");
}
let privateSocket;
try {
  const host = await page("ホスト");
  await entry(host);
  await host.locator("#room-name").fill("<img onerror=alert(1)>");
  await host
    .locator("#creation-key")
    .evaluate((el, key) => (el.value = key), key);
  await host.locator("#launch").click();
  await host.locator("#room-code").waitFor();
  const roomId = await host.locator("#room-code").innerText();
  assert.match(roomId, /^[A-F0-9]{8}$/);
  await poll(async () =>
    (await list()).some((r) => r.roomId === roomId && r.players === 1),
  );
  const resolved = await (await fetch(`${endpoint}/rooms/${roomId}`)).json();
  const code = resolved.code;
  const guest = await page("一覧参加");
  await entry(guest);
  await guest.locator("#room-refresh").click();
  await guest.locator(`[data-room-join="${roomId}"]`).waitFor();
  assert.equal(await guest.locator("#room-list img").count(), 0);
  assert.ok(
    (await guest.locator("#room-list").innerText()).includes(
      "<img onerror=alert(1)>",
    ),
  );
  await guest.locator(".coop-advanced summary").click();
  for (const width of [667, 844, 1280]) {
    await guest.setViewportSize({ width, height: 390 });
    const layout = await guest.evaluate(() => {
      const a = document.querySelector("#room-join").getBoundingClientRect(),
        b = document.querySelector("#launch").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        joinBottom: a.bottom,
        createBottom: b.bottom,
        width: innerWidth,
        height: innerHeight,
      };
    });
    assert.ok(!layout.overflow);
    assert.ok(
      layout.joinBottom <= 390 && layout.createBottom <= 390,
      JSON.stringify(layout),
    );
    proof.push(layout);
    await guest.screenshot({ path: `${out}/entry-${width}.png` });
  }
  await guest.setViewportSize({ width: 844, height: 390 });
  await guest.locator(`[data-room-join="${roomId}"]`).click();
  await guest.locator(".lobby").waitFor();
  const third = await page("ID参加");
  await entry(third);
  await third.locator("#room-id").fill("INVALID!");
  await third.locator("#room-join").click();
  assert.ok(
    (await third.locator("#room-list-status").innerText()).includes("8文字"),
  );
  await third.locator("#room-id").fill(roomId.toLowerCase());
  await third.locator("#room-join").click();
  await third.locator(".lobby").waitFor();
  await poll(async () =>
    (await list()).some((r) => r.roomId === roomId && r.players === 3),
  );
  await host.waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 3,
  );
  await host.screenshot({ path: `${out}/lobby.png` });
  const privateResponse = await fetch(endpoint + "/rooms", {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
    body: JSON.stringify({ name: "招待のみ", listed: false }),
  });
  assert.ok(privateResponse.ok);
  const privateRoom = await privateResponse.json();
  privateSocket = new WebSocket(
    `${endpoint.replace("http", "ws")}/rooms/${privateRoom.code}`,
  );
  await new Promise((resolve, reject) => {
    privateSocket.onopen = () =>
      privateSocket.send(JSON.stringify({ type: "hello", name: "招待隊員" }));
    privateSocket.onmessage = (e) => {
      if (JSON.parse(String(e.data)).type === "welcome") resolve();
    };
    privateSocket.onerror = reject;
  });
  assert.ok(!(await list()).some((r) => r.roomId === privateRoom.roomId));
  assert.equal(
    (await fetch(`${endpoint}/rooms/${privateRoom.roomId}`)).status,
    200,
  );
  await host.locator("#begin:not(:disabled)").click();
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          window.__swarm?.screen === "battle" && window.__swarm.trooper.loaded,
      ),
    ),
  );
  await poll(async () => !(await list()).some((r) => r.roomId === roomId));
  const run = await host.evaluate(() => window.__swarm.world.run);
  await third.reload();
  await third.locator("#launch").click();
  await third.waitForFunction(
    () => window.__swarm?.screen === "battle" && window.__swarm.trooper.loaded,
  );
  assert.equal(await third.evaluate(() => window.__swarm.world.run), run);
  assert.equal(
    await third.evaluate(() =>
      window.__swarm.world.players.every((p) => p.weapons.length === 2),
    ),
    true,
  );
  assert.ok(
    (
      await fetch(`${endpoint}/fixtures/${code}/terminal-victory`, {
        method: "POST",
      })
    ).ok,
  );
  await Promise.all(pages.map((p) => p.locator("#regear").waitFor()));
  for (const p of pages) {
    await p.locator("#regear").click();
    await p.locator(".lobby").waitFor();
  }
  await host.waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 3,
  );
  await poll(async () =>
    (await list()).some((r) => r.roomId === roomId && r.players === 3),
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/report.json`,
    JSON.stringify(
      {
        passed: [
          "public creation UI",
          "8-character ID",
          "list join",
          "lowercase ID join",
          "invalid ID",
          "escaped room names",
          "private hidden but ID resolvable",
          "battle hidden",
          "same-run reload with full equipment",
          "victory and same-room return",
        ],
        layout: proof,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS room creation/list/ID/private/reconnect/victory and 3 landscape widths",
  );
} catch (e) {
  fs.writeFileSync(
    `${out}/traffic-failure.json`,
    JSON.stringify(traffic, null, 2),
  );
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: `${out}/failure-${i}.png` });
    console.error(await p.locator("#ui").innerText());
  }
  throw e;
} finally {
  privateSocket?.close();
  await browser.close();
}
