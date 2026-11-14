import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// 製品の画面（front.html）で、詳細診断オン → 押しっぱなし → 一時停止 →
// 「診断を保存」までを実ブラウザで通す。ローカル専用。本番・本人のセーブは使わない。
const site = process.env.SWARM_FIRE_SITE ?? "http://127.0.0.1:5196";
const endpoint = process.env.SWARM_FIRE_ENDPOINT ?? "http://127.0.0.1:8797";
const out =
  process.env.SWARM_FIRE_UI_OUTPUT ??
  "dist-validation/fire-cadence-20261114/product-ui";
const holdMs = Number(process.env.SWARM_FIRE_HOLD_MS ?? 12000);
assert.equal(new URL(site).hostname, "127.0.0.1");
assert.equal(new URL(endpoint).hostname, "127.0.0.1");
mkdirSync(out, { recursive: true });
const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"$/m.exec(
  readFileSync(".dev.vars", "utf8"),
)?.[1];
assert(key);
const browser = await chromium.launch({
  channel: "chrome",
  args: [
    "--use-angle=d3d11",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const result = { passed: false, errors: [], checks: [], downloads: [] },
  contexts = [];
async function page(name) {
  const c = await browser.newContext({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
    hasTouch: true,
    acceptDownloads: true,
  });
  contexts.push(c);
  await c.addInitScript(
    (name) => localStorage.setItem("swarm-front-player-name-v1", name),
    name,
  );
  const p = await c.newPage();
  p.setDefaultTimeout(120000);
  p.on("pageerror", (e) => result.errors.push(`${name}: ${e.message}`));
  return p;
}
async function opening(p) {
  await p.waitForFunction(
    () =>
      document.querySelector(".title-entry-start") ||
      document.querySelector("#room-id") ||
      document.querySelector("#front-launch"),
  );
  const start = p.locator(".title-entry-start");
  if (await start.isVisible()) await start.click();
}
/** 画面中央を押し続ける（マウスの左ボタン）。製品のControlsがfireを立てる。 */
async function holdFire(p) {
  await p.locator("#controls").waitFor({ state: "visible" });
  await p.waitForTimeout(800);
  await p.mouse.move(422, 160);
  await p.mouse.down();
  await p.waitForTimeout(holdMs);
  await p.mouse.up();
}
async function save(p, label) {
  await p.keyboard.press("Escape");
  const button = p.locator("#front-diagnostics");
  await button.waitFor();
  const [download] = await Promise.all([
    p.waitForEvent("download"),
    button.click(),
  ]);
  const file = path.join(out, `${label}.json`);
  await download.saveAs(file);
  const report = JSON.parse(readFileSync(file, "utf8"));
  const trace = report.observations?.fireCadence;
  assert.ok(trace, `${label}: 連射の記録がありません`);
  assert.ok(trace.presses.some((row) => row[1] === 1));
  assert.ok(trace.shots.length > 20, `${label}: 射撃 ${trace.shots.length}`);
  assert.ok(
    trace.shots.filter((row) => row[4]).length > 20,
    `${label}: 表示の記録が不足`,
  );
  // 照準・移動・識別情報を保存しない。
  assert.doesNotMatch(
    JSON.stringify(report),
    /"(yaw|pitch|token|code|roomId|name)"/,
  );
  result.downloads.push({
    label,
    file,
    buttonText: await button.innerText(),
    shots: trace.shots.length,
    displayed: trace.shots.filter((row) => row[4]).length,
    sounded: trace.shots.filter((row) => row[6]).length,
    ticks: trace.ticks.length,
  });
}
try {
  const solo = await page("連射診断ソロ");
  await solo.goto(site + "/front.html?solo=1&networkDiagnostics=1");
  await opening(solo);
  await solo.locator("#front-launch").click();
  await solo.locator("[data-card]").first().click();
  await holdFire(solo);
  await solo.screenshot({ path: out + "/solo.png" });
  await save(solo, "solo");
  result.checks.push("製品ソロ：押しっぱなし・一時停止・「診断を保存」");
  await solo.close();

  const peers = [];
  for (const name of ["連射診断ホスト", "連射診断ゲスト"]) {
    const p = await page(name);
    peers.push(p);
    await p.goto(site + "/front.html?coop=1&networkDiagnostics=1");
    await opening(p);
    await p.locator("css:light=#room-id").waitFor();
    await p.locator("css:light=.coop-advanced summary").click();
    await p.locator("css:light=#endpoint").fill(endpoint);
  }
  const [host, guest] = peers;
  await host.locator("css:light=#creation-key").fill(key);
  await host.locator("css:light=#room-name").fill("連射診断の隔離検査");
  await host.locator("css:light=#launch").click();
  await host.locator("css:light=.front-lobby").waitFor();
  await host.waitForFunction(() =>
    /^\d{3}$/.test(
      document.querySelector("#front-room-password")?.textContent?.trim() ?? "",
    ),
  );
  const id = (
    await host.locator("css:light=#front-room-password").innerText()
  ).trim();
  await guest.locator("css:light=#room-id").fill(id);
  await guest.locator("css:light=#room-join").click();
  await guest.locator("css:light=.front-lobby").waitFor();
  await host.waitForFunction(
    () => document.querySelectorAll("[data-fx-member]").length === 2,
  );
  for (const p of peers) {
    // 画面遷移直後の押下は既存の入力保護で捨てられるため、開くまで押し直す。
    for (let attempt = 0; attempt < 5; attempt++) {
      await p.waitForTimeout(900);
      if (await p.locator("css:light=.front-departure-deck").isVisible()) break;
      await p.locator("css:light=#front-edit-loadout").click();
    }
    await p.locator("css:light=.front-departure-deck").waitFor();
    await p.waitForTimeout(900);
    await p.locator("css:light=#front-save-pool").click();
    await p.locator("css:light=.front-lobby").waitFor();
  }
  await host.waitForFunction(
    () => !document.querySelector("#front-start")?.disabled,
  );
  await host.waitForTimeout(900);
  await host.locator("css:light=#front-start").click();
  for (const p of peers) {
    await p.locator("css:light=[data-card]").first().waitFor();
    await p.waitForTimeout(900);
    await p.locator("css:light=[data-card]").first().click();
  }
  await holdFire(host);
  await host.screenshot({ path: out + "/coop-host.png" });
  await save(host, "coop-host");
  result.checks.push("製品協力2人：ホストの押しっぱなし・「通信診断を保存」");
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.failure = String(e.stack ?? e);
  for (const [i, c] of contexts.entries())
    for (const p of c.pages())
      await p
        .screenshot({ path: `${out}/failure-${i}.png` })
        .catch(() => {});
  process.exitCode = 1;
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
  writeFileSync(out + "/results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
