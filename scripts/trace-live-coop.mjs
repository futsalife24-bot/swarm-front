// 本番の通常UIから作る非公開1人部屋だけを計測。認証の迂回・障害注入はしない。
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const base = "https://swarm-front.melosalife-24.workers.dev";
const durationMs =
  Math.min(180, Math.max(30, Number(process.argv[2] ?? 120))) * 1000;
const out = `dist-validation/lag-live-20261101/${Date.now()}`;
mkdirSync(out, { recursive: true });
const result = {
  startedAt: new Date().toISOString(),
  method:
    "公開クライアント・本番Worker・通常UIで新規作成する非公開1人部屋・空のPC Chrome・障害注入なし。スマホ実測ではない。",
  errors: [],
  samples: [],
  succeeded: false,
};
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "allow",
});
const page = await context.newPage();
page.setDefaultTimeout(70000);
const shutter = () =>
  page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
const cleanError = (e) =>
  String(e?.stack ?? e).replace(/[a-f0-9]{8,64}/gi, "[redacted]");
page.on("pageerror", (e) => result.errors.push(cleanError(e)));
await context.addInitScript(() => {
  localStorage.setItem("swarm-front-player-name-v1", "通信調査隊員");
  window.__liveTrace = { frames: [], longtasks: [], stages: [] };
  let previous,
    sampleAt = -Infinity;
  const frame = (now) => {
    const data = window.__liveTrace;
    if (
      previous !== undefined &&
      (now - previous > 50 || now - sampleAt >= 250)
    ) {
      data.frames.push({ at: now, ms: now - previous });
      sampleAt = now;
    }
    previous = now;
    if (data.frames.length > 4000) data.frames.shift();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__liveTrace.longtasks.push({ at: e.startTime, ms: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
});
try {
  await page.goto(`${base}/front?coop=1&networkDiagnostics=1`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  if (await page.locator(".title-entry-start").isVisible())
    await page.locator(".title-entry-start").click();
  await page.locator("#room-name").waitFor();
  await shutter();
  assert.equal(await page.locator("#room-visibility").inputValue(), "private");
  await page.locator("#room-name").fill("通信調査専用");
  result.clientBuild = await page.evaluate(
    () => window.swarmNetworkDiagnostics?.().build,
  );
  if (process.env.SWARM_LAG_ROOM) {
    assert(/^[A-Fa-f0-9]{8}$/.test(process.env.SWARM_LAG_ROOM));
    result.method =
      "本人提供の検証専用部屋へ通常UIで参加。公開クライアント・本番Worker・空PC Chrome・障害注入なし。スマホ実測ではない。";
    await page.locator("#room-id").fill(process.env.SWARM_LAG_ROOM);
    await page.locator("#room-join").click();
    console.log("本人提供の検証部屋へ参加開始");
  } else {
    // 通常のTurnstile完了を待つだけ。トークンの読み出し・作成・ログ保存はしない。
    await page.waitForFunction(
      () =>
        !!document.querySelector('input[name="cf-turnstile-response"]')?.value,
      null,
      { timeout: 30000 },
    );
    console.log("人間確認完了・非公開調査部屋を作成");
    await page.locator("#launch").click();
  }
  await page.getByRole("button", { name: "準備完了", exact: true }).waitFor();
  await shutter();
  await page.getByRole("button", { name: "準備完了", exact: true }).click();
  console.log("入室・準備完了。部隊長の出撃操作を待機");
  await page.waitForFunction(
    () =>
      document.querySelector(".rebuild-card[data-card]") ||
      (document.querySelector("#front-start") &&
        !document.querySelector("#front-start").disabled),
    null,
    { timeout: 180000 },
  );
  if (await page.locator("#front-start").isVisible()) {
    await shutter();
    await page.locator("#front-start").click();
  }
  const first = page
    .locator(":light(.rebuild-card[data-card]:not([disabled]))")
    .first();
  await first.waitFor();
  await shutter();
  await first.click();
  await page.locator("#controls").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__liveTrace.timeOrigin = performance.timeOrigin;
    window.__liveTrace.health = [];
    let busy = false;
    window.__liveHealth = setInterval(async () => {
      if (busy) return;
      busy = true;
      const at = performance.now();
      let status = 0;
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        await response.text();
        status = response.status;
      } catch {}
      window.__liveTrace.health.push({
        at,
        ms: performance.now() - at,
        status,
      });
      busy = false;
    }, 1000);
  });
  const box = await page.locator("#world").boundingBox();
  assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const started = Date.now();
  let sampleAt = 0,
    index = 0;
  const keys = ["KeyW", "KeyD", "KeyS", "KeyA"];
  console.log("本番協力の戦闘計測開始");
  while (Date.now() - started < durationMs) {
    const card = page
      .locator(":light(.rebuild-card[data-card]:not([disabled]))")
      .first();
    if (await card.isVisible()) {
      await page.mouse.up();
      await card.click();
      await page.waitForTimeout(400);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    }
    if (Date.now() - sampleAt > 5000) {
      result.samples.push(
        await page.evaluate(() => ({
          at: performance.now(),
          hidden: document.hidden,
          screen: document.body.dataset.screen,
          hud: document.querySelector(".battle-fps")?.textContent,
          diagnostics: window.swarmNetworkDiagnostics?.(),
        })),
      );
      sampleAt = Date.now();
      writeFileSync(`${out}/trace.json`, JSON.stringify(result));
    }
    // 協力中の強化選択待ちではcontrolsが隠れる。戦闘終了や切断と扱わない。
    if (!(await page.locator("#controls").isVisible())) {
      await page.waitForTimeout(250);
      continue;
    }
    const key = keys[index++ % 4];
    await page.keyboard.down(key);
    await page.waitForTimeout(1500);
    await page.keyboard.up(key);
  }
  await page.mouse.up();
  result.wallSeconds = (Date.now() - started) / 1000;
  result.client = await page.evaluate(() => window.__liveTrace);
  result.diagnostics = await page.evaluate(() =>
    window.swarmNetworkDiagnostics?.(),
  );
  await page.evaluate(() => clearInterval(window.__liveHealth));
  assert(result.diagnostics?.serverTrace?.length > 0, "本番サーバー診断が必要");
  await page.screenshot({ path: `${out}/battle.png` });
  result.succeeded = true;
} catch (e) {
  result.failure = cleanError(e);
  result.uiStatus = await page
    .locator("#turnstile-room-create")
    .innerText()
    .catch(() => "");
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  writeFileSync(`${out}/trace.json`, JSON.stringify(result));
}
console.log(
  JSON.stringify({
    out,
    succeeded: result.succeeded,
    clientBuild: result.clientBuild,
    wallSeconds: result.wallSeconds,
    failure: result.failure,
    errors: result.errors.length,
  }),
);
