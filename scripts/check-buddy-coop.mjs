import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { localCreationKey } from "../tests/credentials.ts";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const endpoint = "http://127.0.0.1:8817";
const out = "dist-validation/buddy-coop";
fs.mkdirSync(out, { recursive: true });
const response = await fetch(`${endpoint}/rooms`, {
  method: "POST",
  headers: { "X-Room-Creation-Key": localCreationKey() },
  body: JSON.stringify({ name: "バディ外観の隔離検査", listed: false }),
});
expect(response.status).toBe(200);
const { code } = await response.json();
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const contexts = [],
  pages = [],
  results = [],
  errors = [];
const tap = async (p, selector) => {
  await p.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await p.locator(selector).click();
};
const snap = (p) => p.evaluate(() => window.swarmBuddyReview.snapshot());
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    contexts.push(ctx);
    await ctx.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "協力バディ検証"),
    );
    const p = await ctx.newPage();
    pages.push(p);
    p.setDefaultTimeout(60000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${origin}/?coop=1&buddyReview=1`, { timeout: 120000 });
    await p.locator("#room-join").waitFor();
    console.log(`部屋参加画面 ${width}`);
    await tap(p, ".coop-advanced summary");
    await p.locator("#endpoint").fill(endpoint);
    await p.locator("#endpoint").dispatchEvent("change");
    await p.locator("#room-id").fill(code);
    await tap(p, "#room-join");
    await p.locator("#begin").waitFor({ timeout: 120000 });
    await p.evaluate(() => {
      window.swarmBuddyReview.set("tatara", "auto", true);
      window.swarmBuddyReview.panel.hidden = true;
    });
  }
  const [a, b] = pages;
  await expect(a.locator("#begin")).toBeEnabled({ timeout: 120000 });
  await tap(a, "#begin");
  for (const p of pages) {
    await expect(p.locator("#controls")).toBeVisible({ timeout: 120000 });
    await expect
      .poll(
        async () => (await snap(p)).entries.filter((e) => e.loaded).length,
        { timeout: 60000 },
      )
      .toBe(2);
  }
  const initial = await Promise.all(pages.map(snap));
  expect(initial[0].run).toBe(initial[1].run);
  expect(initial[0].localId).not.toBe(initial[1].localId);
  expect(initial[0].entries.map((e) => e.owner).sort()).toEqual(
    initial[1].entries.map((e) => e.owner).sort(),
  );
  results.push({ type: "real-ws-two-owners", snapshots: initial });
  console.log("実WS・2所有者を確認");
  for (const p of pages)
    await p.locator(".operation-cue").waitFor({ state: "detached" });
  for (let i = 0; i < pages.length; i++)
    await pages[i].screenshot({ path: `${out}/two-${i}.png` });
  const previous = initial[0].players.find((p) => p.id === initial[0].localId);
  await a.bringToFront();
  await a.keyboard.down("KeyD");
  await expect
    .poll(
      async () =>
        (await snap(b)).players.find((p) => p.id === initial[0].localId)?.x,
      { timeout: 10000 },
    )
    .toBeGreaterThan(previous.x + 0.8);
  await a.keyboard.up("KeyD");
  results.push({ type: "remote-owner-movement", snapshot: await snap(b) });
  // 同一IDへ復帰する既存の通常導線を通す。外観選択は開発用なので復帰後再指定。
  await a.reload();
  await expect(
    a.getByRole("button", { name: "進行中の部隊へ戻る" }),
  ).toBeVisible();
  await a.getByRole("button", { name: "進行中の部隊へ戻る" }).click();
  await expect(a.locator("#controls")).toBeVisible({ timeout: 120000 });
  await a.evaluate(() => window.swarmBuddyReview.set("oriha", "auto", true));
  await expect
    .poll(async () => (await snap(a)).entries.filter((e) => e.loaded).length, {
      timeout: 60000,
    })
    .toBe(2);
  const restored = await snap(a);
  expect(restored.localId).toBe(initial[0].localId);
  expect(restored.players).toHaveLength(2);
  expect(new Set(restored.entries.map((e) => e.key)).size).toBe(2);
  results.push({ type: "reload-reconnect", snapshot: restored });
  console.log("同一ID再接続・重複なし");
  // なし/1体/2体を同じ実戦で比較。CPU描画送信時間でありGPU所要時間ではない。
  for (const [kind, peers] of [
    ["none", false],
    ["tatara", false],
    ["tatara", true],
  ]) {
    await a.evaluate(
      (args) => {
        window.swarmBuddyReview.set(...args);
        window.swarmBuddyReview.samples.length = 0;
      },
      [kind, "auto", peers],
    );
    await expect
      .poll(async () => (await snap(a)).entries.filter((e) => e.loaded).length)
      .toBe(kind === "none" ? 0 : peers ? 2 : 1);
    await expect
      .poll(async () => (await snap(a)).samples.length, { timeout: 15000 })
      .toBeGreaterThanOrEqual(40);
    results.push({
      type: "real-time-cpu",
      kind,
      peers,
      snapshot: await snap(a),
    });
  }
  const fixture = await fetch(`${endpoint}/fixtures/${code}/harrow-dash`, {
    method: "POST",
  });
  expect(fixture.status).toBe(200);
  for (let i = 0; i < pages.length; i++)
    await pages[i].screenshot({ path: `${out}/harrow-warning-${i}.png` });
  results.push({
    type: "harrow-fixture-setup-only",
    visualVerified: false,
    snapshots: await Promise.all(pages.map(snap)),
  });
  // 通常の離脱で自分の全表示を解放し、味方から退出者の外観だけを除く。
  await tap(a, "#pause");
  await tap(a, "#pause-leave");
  await tap(a, "#pause-quit");
  await expect.poll(async () => (await snap(a)).entries.length).toBe(0);
  await expect.poll(async () => (await snap(b)).entries.length).toBe(1);
  results.push({
    type: "normal-coop-leave",
    snapshots: await Promise.all(pages.map(snap)),
  });
  await a.evaluate(() => window.swarmBuddyReview.dispose());
  expect(await a.evaluate(() => !!window.swarmBuddyReview)).toBe(false);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ conditions: results.length, errors }));
} catch (e) {
  for (let i = 0; i < pages.length; i++) {
    await pages[i]
      .screenshot({ path: `${out}/failure-${i}.png` })
      .catch(() => {});
    console.log((await pages[i].locator("body").innerText()).slice(0, 700));
  }
  throw e;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
  );
  for (const ctx of contexts) await ctx.close();
  await browser.close();
}
