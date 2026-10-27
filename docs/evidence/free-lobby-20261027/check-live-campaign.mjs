// 公開版の画面を取得し、隔離Workerの合成部屋へ通常の一覧から参加する。
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const origin = "http://127.0.0.1:5186";
const endpoint = "http://127.0.0.1:8798";
const out = "dist-validation/free-lobby/live-ui";
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);
mkdirSync(out, { recursive: true });
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": key },
  body: JSON.stringify({ name: "検証用フリー部隊", listed: true }),
});
assert.equal(response.status, 200);
const entry = await response.json();
const host = new WebSocket(
  `${endpoint.replace("http", "ws")}/rooms/${entry.code}`,
);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error("検証部屋の応答待ち")), 10000);
  host.onopen = () =>
    host.send(JSON.stringify({ type: "hello", name: "検証部屋主" }));
  host.onmessage = (event) => {
    const m = JSON.parse(String(event.data));
    if (m.type === "welcome") {
      clearTimeout(timer);
      assert.equal(m.listed, true);
      resolve();
    }
  };
  host.onerror = () => {
    clearTimeout(timer);
    reject(Error("検証部屋の接続失敗"));
  };
});
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  serviceWorkers: "block",
  permissions: ["clipboard-read", "clipboard-write"],
});
await context.addInitScript(() =>
  localStorage.setItem("swarm-front-player-name-v1", "検証参加者"),
);
const page = await context.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
try {
  await page.goto(`${origin}/?coop=1`, { waitUntil: "domcontentloaded" });
  await page.locator(".room-browser").waitFor();
  await page.locator(".coop-advanced summary").click();
  await page.locator("#endpoint").fill(endpoint);
  await page.locator("#endpoint").dispatchEvent("change");
  await page.locator(".coop-advanced summary").click();
  await page.locator('[data-room-access="public"]').click();
  const join = page.locator(`[data-room-join="${entry.roomId}"]`);
  for (let n = 0; n < 20 && !(await join.count()); n++) {
    await page.locator("#room-refresh:not(:disabled)").click();
    await page.waitForTimeout(250);
  }
  await join.waitFor();
  await join.click();
  await page.locator(":light(#room-code)").waitFor();
  const transition = page.locator(".split-shutter, .menu-route-shutter");
  await transition.waitFor({ state: "visible", timeout: 1500 }).catch(() => {});
  await transition.waitFor({ state: "detached" });
  await page.waitForFunction(
    () =>
      document.querySelector(".room-access-label")?.dataset.access === "public",
  );
  assert.equal(
    await page.locator(":light(.room-access-label)").innerText(),
    "フリーマッチング",
  );
  assert.match(
    await page.locator(":light(.squad-member.empty)").first().innerText(),
    /部屋一覧/,
  );
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    await page.setViewportSize({ width, height });
    const boxes = await page.locator(":light(.lobby)").evaluate((el) => {
      return [".room-access-label", "#copy", "#share", "#leave-lobby"].map(
        (selector) => {
          const r = el.querySelector(selector).getBoundingClientRect();
          return {
            selector,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        },
      );
    });
    for (const box of boxes)
      assert(
        box.left >= 0 &&
          box.right <= width &&
          box.top >= 0 &&
          box.bottom <= height,
        JSON.stringify(box),
      );
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        assert(
          Math.max(a.left, b.left) >= Math.min(a.right, b.right) ||
            Math.max(a.top, b.top) >= Math.min(a.bottom, b.bottom),
        );
    await page.screenshot({ path: `${out}/campaign-free-${width}.png` });
    results.push({ mode: "campaign", listed: true, width, height, boxes });
  }
  const password = await page.locator(":light(#room-code)").innerText();
  assert.equal(password, entry.roomId);
  await page.locator(":light(#copy)").click();
  await page.waitForFunction(
    async (expected) => (await navigator.clipboard.readText()) === expected,
    password,
  );
  assert.deepEqual(errors, []);
  await page.locator(":light(#leave-lobby)").click();
  writeFileSync(
    `${out}/campaign.json`,
    JSON.stringify(
      { results, join: "公開一覧から隔離部屋へ参加", errors },
      null,
      2,
    ) + "\n",
  );
  console.log("進撃の公開一覧から参加し、公開版ロビーを2画面サイズで確認");
} finally {
  await context.close();
  await browser.close();
  host.close();
}
