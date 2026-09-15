import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186",
  endpoint = "http://127.0.0.1:8789";
const out = "dist-validation/audit-corrections/rematch";
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
assert.ok(key, "Missing local creation credential");
const created = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
});
assert.ok(created.ok, `Room creation ${created.status}`);
const { code } = await created.json();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const errors = [],
  rounds = [],
  socketEvents = [],
  pages = [];
const session = (p) =>
  p.evaluate(() => sessionStorage.getItem("swarm-front-session"));
async function ready() {
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () => document.querySelectorAll(".member-status.is-ready").length === 2,
        {},
        { timeout: 90000 },
      ),
    ),
  );
  await pages[0].locator("#begin:not(:disabled)").waitFor({ timeout: 90000 });
}
async function battle() {
  await pages[0].locator("#begin").click();
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () =>
          window.__swarm?.screen === "battle" && window.__swarm.trooper.loaded,
        {},
        { timeout: 90000 },
      ),
    ),
  );
  const worlds = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => ({
        run: window.__swarm.world.run,
        id: window.__swarm.id,
        players: window.__swarm.world.players.map((p) => p.id),
      })),
    ),
  );
  assert.equal(worlds[0].run, worlds[1].run);
  assert.equal(worlds[0].players.length, 2);
  return worlds;
}
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      serviceWorkers: "block",
    });
    const p = await context.newPage();
    pages.push(p);
    p.setDefaultTimeout(25000);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("websocket", (ws) => {
      if (!new URL(ws.url()).pathname.startsWith("/rooms/")) return;
      socketEvents.push({ player: i, event: "open" });
      ws.on("close", () => socketEvents.push({ player: i, event: "close" }));
    });
    await p.addInitScript(
      (name) => localStorage.setItem("swarm-front-player-name-v1", name),
      `再出撃隊員${i + 1}`,
    );
    await p.goto(`${origin}/#${code}`);
    await p.locator(".coop-advanced summary").click();
    await p.locator("#endpoint").fill(endpoint);
    await p.locator("#launch").click();
    await p.locator(".lobby").waitFor();
  }
  await ready();
  const initialSessions = await Promise.all(pages.map(session));
  let previous = await battle();
  for (const outcome of ["victory", "defeat"]) {
    const fixture = await fetch(
      `${endpoint}/fixtures/${code}/terminal-${outcome}`,
      { method: "POST" },
    );
    assert.ok(fixture.ok, `Fixture ${fixture.status}`);
    await Promise.all(pages.map((p) => p.locator("#regear").waitFor()));
    for (const [i, p] of pages.entries()) {
      assert.ok((await p.locator("#regear").innerText()).includes("同じ部隊"));
      await p.screenshot({ path: `${out}/${outcome}-result-${i}.png` });
      await p.locator("#regear").click();
      await p.locator(".lobby").waitFor();
    }
    await ready();
    const returnedSessions = await Promise.all(pages.map(session));
    assert.deepEqual(
      returnedSessions,
      initialSessions,
      "Same tab identity and room retained",
    );
    const message = `${outcome}後も同じ部隊で再出撃`;
    const sender = outcome === "victory" ? 0 : 1;
    await pages[sender].locator("#chat-input").fill(message);
    await pages[sender].locator("#chat-form button").click();
    await pages[1 - sender].waitForFunction(
      (text) => document.querySelector("#chat-log")?.textContent.includes(text),
      message,
    );
    await pages[0].screenshot({ path: `${out}/${outcome}-lobby.png` });
    const next = await battle();
    assert.notEqual(next[0].run, previous[0].run);
    assert.deepEqual(
      next.map((w) => w.id),
      previous.map((w) => w.id),
    );
    rounds.push({
      outcome,
      previous,
      next,
      sameSession: true,
      chatDelivered: true,
    });
    previous = next;
  }
  assert.deepEqual(errors, []);
  assert.equal(socketEvents.filter((e) => e.event === "open").length, 2);
  assert.equal(socketEvents.filter((e) => e.event === "close").length, 0);
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        fixture:
          "Only mission completion shortened via isolated server/testing.ts; real Worker sockets, room, run, players and browser UI retained. No communication mocks.",
        rounds,
        socketEvents,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: victory and defeat -> same squad lobby -> ready -> distinct run, identity/session/chat/socket retained",
  );
} catch (e) {
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: `${out}/failure-${i}.png` });
    console.log(await p.locator("body").innerText());
  }
  console.log(errors);
  throw e;
} finally {
  await browser.close();
}
