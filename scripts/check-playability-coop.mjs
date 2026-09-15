import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:5186";
const width = Number(process.env.COOP_WIDTH || 844);
const out = "dist-validation/playability-six/coop-" + width;
fs.mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  fs.readFileSync(".dev.vars", "utf8"),
)?.[1];
if (!key) throw Error("Missing local creation credential");
const response = await fetch("http://127.0.0.1:8787/rooms", {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
});
if (!response.ok) throw Error("Local room creation failed: " + response.status);
const { code } = await response.json();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const errors = [],
  results = [];
let pages = [];
try {
  const contexts = await Promise.all([
    browser.newContext({
      viewport: { width, height: width === 640 ? 360 : 390 },
      serviceWorkers: "block",
    }),
    browser.newContext({
      viewport: { width: 915, height: 412 },
      serviceWorkers: "block",
    }),
  ]);
  pages = await Promise.all(contexts.map((c) => c.newPage()));
  for (let i = 0; i < 2; i++) {
    const p = pages[i];
    p.setDefaultTimeout(20000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      (name) => localStorage.setItem("swarm-front-player-name-v1", name),
      ["メロニキ", "隊員テスト"][i],
    );
    await p.goto(origin + "/#" + code);
    await p.locator("#launch").click();
    await p.locator(".lobby").waitFor();
  }
  const [a, b] = pages;
  await a.waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 2,
    {},
    { timeout: 90000 },
  );
  await a.locator("#begin:not(:disabled)").waitFor({ timeout: 90000 });
  await a.locator("#chat-input").fill("<img src=x onerror=alert(1)> よろしく");
  await a.locator("#chat-form button").click();
  await b.waitForFunction(() =>
    document.querySelector("#chat-log")?.textContent.includes("よろしく"),
  );
  assert.equal(await b.locator("#chat-log img").count(), 0);
  await b.locator("#chat-input").fill("準備OK");
  await b.locator("#chat-form button").click();
  await a.waitForFunction(() =>
    document.querySelector("#chat-log")?.textContent.includes("準備OK"),
  );
  for (const [i, p] of pages.entries()) {
    const layout = await p.evaluate(() => {
      const r = (s) => {
        const a = document.querySelector(s).getBoundingClientRect();
        return {
          x: a.x,
          y: a.y,
          right: a.right,
          bottom: a.bottom,
          width: a.width,
          height: a.height,
        };
      };
      return {
        mission: r(".lobby-mission"),
        squad: r(".lobby-squad"),
        chat: r(".lobby-chat"),
        members: [...document.querySelectorAll(".squad-member")].map((e) => ({
          y: e.getBoundingClientRect().y,
          bottom: e.getBoundingClientRect().bottom,
        })),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.ok(
      layout.mission.right <= layout.squad.x + 1 &&
        layout.squad.right <= layout.chat.x + 1,
      JSON.stringify(layout),
    );
    assert.ok(
      layout.members.every(
        (m, j) => j === 0 || m.y >= layout.members[j - 1].bottom,
      ),
      JSON.stringify(layout),
    );
    assert.ok(!layout.overflow);
    results.push(layout);
    await p.screenshot({ path: `${out}/coop-${i}.png` });
  }
  // Repeated stage changes invalidate old readiness, including returning to the original.
  await a.locator('[data-game-select-for="lobby-stage"]').click();
  await a.locator(".game-select-options button").nth(1).click();
  await a.locator('[data-game-select-for="lobby-stage"]').click();
  await a.locator(".game-select-options button").first().click();
  await a.waitForFunction(
    () => document.querySelectorAll(".member-status.is-ready").length === 2,
    {},
    { timeout: 90000 },
  );
  await a.locator("#begin").click();
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
        players: window.__swarm.world.players.length,
        loaded: window.__swarm.trooper.loaded,
        map: window.__swarm.mapAssets,
      })),
    ),
  );
  assert.equal(worlds[0].run, worlds[1].run);
  assert.equal(worlds[0].players, 2);
  results.push({ worlds });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/coop.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    "Coop readiness, two browsers, chat escaping and three-column layout passed",
  );
} catch (e) {
  for (const [i, p] of pages.entries()) {
    await p.screenshot({ path: `${out}/coop-failure-${i}.png` });
    console.log(await p.locator("body").innerText());
    console.log(await p.locator(".member-status").allTextContents());
    console.log(await p.evaluate(() => window.__swarm?.mapAssets));
  }
  console.log(errors);
  throw e;
} finally {
  await browser.close();
}
