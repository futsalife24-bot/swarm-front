// 新規ブラウザー状態で検証。正常入室は隔離ローカルWorkerのみを使う。
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5186";
const production = process.env.PRODUCTION === "1";
const endpoint = production ? `${origin}/api` : "http://127.0.0.1:8807";
const out = process.argv[2] ?? "dist-validation/usability/feedback";
if (!production) assert.equal(new URL(origin).hostname, "127.0.0.1");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [],
  errors = [],
  hosts = [];
const settle = (p) =>
  p.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
const tap = async (p, selector) => {
  await settle(p);
  await p.locator(selector).click();
};
async function page(width = 844, height = 390) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  p.on("pageerror", (error) => errors.push(error.message));
  await p.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "操作検証"),
  );
  return p;
}
async function title(p) {
  await p.locator(".title-entry-start").waitFor();
  await tap(p, ".title-entry-start");
  await p.locator(".title-entry").waitFor({ state: "detached" });
}
async function makeRoom(front) {
  const key = /^ROOM_CREATION_KEY="([a-f0-9]{64})"/m.exec(
    fs.readFileSync(".dev.vars", "utf8"),
  )?.[1];
  assert.ok(key, "既存のローカル試験キーが必要です");
  const response = await fetch(`${endpoint}/rooms`, {
    method: "POST",
    headers: { "X-Room-Creation-Key": key },
    body: JSON.stringify({
      name: "参加検証",
      listed: false,
      ...(front ? { ruleset: "front-v1", mode: "survival" } : {}),
    }),
  });
  assert.equal(response.status, 200);
  const entry = await response.json();
  const ws = new WebSocket(
    `${endpoint.replace("http", "ws")}/rooms/${entry.code}${front ? "?ruleset=front-v1" : ""}`,
  );
  hosts.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("試験部屋の準備が時間切れ")),
      10000,
    );
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          type: "hello",
          ...(front
            ? { frontGrowth: 3, frontCatalog: 2, frontOpening: 2 }
            : {}),
        }),
      );
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(String(data));
      if (m.type === "welcome") {
        clearTimeout(timer);
        resolve();
      }
      if (m.type === "error") {
        clearTimeout(timer);
        reject(Error(m.reason));
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(Error("試験部屋へ接続不可"));
    };
  });
  return entry.roomId;
}
try {
  for (const front of [false, true]) {
    const roomId = production ? null : await makeRoom(front);
    for (const [width, height] of [
      [844, 390],
      [640, 360],
    ]) {
      const p = await page(width, height);
      await p.goto(`${origin}/${front ? "front" : ""}?coop=1`, {
        timeout: 120000,
      });
      await p.locator("#room-join").waitFor();
      if (!production) {
        await tap(p, ".coop-advanced summary");
        await p.locator("#endpoint").fill(endpoint);
        await p.locator("#endpoint").dispatchEvent("change");
        await tap(p, ".coop-advanced summary");
      }
      await p.locator("#room-id").fill("testtest");
      await tap(p, "#room-join");
      await expect(p.locator("#room-list-status")).toContainText("入力エラー");
      await expect(p.locator("#room-id")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(p.locator("#room-join")).toBeEnabled();
      let requests = 0,
        release;
      const gate = new Promise((r) => {
        release = r;
      });
      await p.route("**/rooms/FFFFFFFF*", async (route) => {
        requests++;
        await gate;
        await route.continue();
      });
      try {
        await p.locator("#room-id").fill("FFFFFFFF");
        await tap(p, "#room-join");
        await expect(p.locator("#room-join")).toBeDisabled();
        await expect(p.locator("#room-join")).toHaveText("確認中…");
        await expect(p.locator("#room-list-status")).toContainText(
          "確認しています",
        );
        await p.locator("#room-join-form").evaluate((el) => {
          el.requestSubmit();
          el.requestSubmit();
        });
        await expect.poll(() => requests).toBe(1);
      } finally {
        release();
      }
      await expect(p.locator("#room-list-status")).toContainText(
        "部屋が見つかりません",
      );
      await expect(p.locator("#room-join")).toBeEnabled();
      assert.equal(requests, 1);
      const fit = await p.locator("#room-list-status").evaluate((el) => {
        const r = el.getBoundingClientRect(),
          panel = el.closest(".panel").getBoundingClientRect();
        return {
          fits:
            r.left >= panel.left &&
            r.right <= panel.right &&
            r.bottom <= panel.bottom &&
            r.bottom <= innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.deepEqual(fit, { fits: true, overflow: false });
      await p.screenshot({
        path: `${out}/${front ? "survival" : "advance"}-${width}-missing-room.png`,
      });
      if (roomId && width === 844) {
        let welcomed = false;
        p.on("websocket", (ws) => {
          if (!new URL(ws.url()).pathname.startsWith("/rooms/")) return;
          ws.on("framereceived", ({ payload }) => {
            if (JSON.parse(payload.toString()).type === "welcome")
              welcomed = true;
          });
        });
        await p.locator("#room-id").fill(roomId.toLowerCase());
        await tap(p, "#room-join");
        await expect.poll(() => welcomed, { timeout: 15000 }).toBe(true);
        await expect(
          p.locator(front ? "#ui .front-prep, #ui .front-lobby" : "#ui .lobby"),
        ).toBeVisible();
        if (!front) {
          await tap(p, "#back");
          await tap(p, "#gear-settings");
          const before = await p.evaluate(() =>
            Object.fromEntries(
              Object.entries(localStorage).filter(([key]) =>
                /progress|armory/.test(key),
              ),
            ),
          );
          await p.locator("#quality").selectOption("0.65");
          await p.locator("#frame-rate").selectOption("30");
          assert.deepEqual(
            await p.evaluate(() =>
              Object.fromEntries(
                Object.entries(localStorage).filter(([key]) =>
                  /progress|armory/.test(key),
                ),
              ),
            ),
            before,
          );
          await p.goto(`${origin}/front`);
          await title(p);
          await tap(p, "#home-settings");
          await expect(p.locator("#front-setting-quality")).toHaveValue("0.65");
          await expect(p.locator("#front-setting-frameRate")).toHaveValue("30");
          results.push({
            check: "進撃協力も設定を共有",
            progressUnchanged: true,
          });
        }
      }
      results.push({
        check: "参加",
        mode: front ? "生存" : "進撃",
        width,
        height,
        requests,
        validJoin: !!roomId && width === 844,
        ...fit,
      });
      await p.context().close();
    }
  }

  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const p = await page(width, height);
    await p.goto(`${origin}/front`, { timeout: 120000 });
    await title(p);
    await tap(p, "#home-settings");
    await p.locator("#front-setting-quality").selectOption("0.65");
    await p.locator("#front-setting-frameRate").selectOption("30");
    await tap(p, "#front-settings-back");
    await tap(p, "#open-armory");
    await p.waitForURL(/\?base=1$/);
    await p.locator("#pt-confirm").waitFor();
    await tap(p, "#pt-confirm");
    await tap(p, "#pt-settings");
    await expect(p.locator('[data-preference="quality"]')).toHaveValue("0.65");
    await expect(p.locator('[data-preference="frameRate"]')).toHaveValue("30");
    const progress = await p.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([key]) =>
          /progress|armory/.test(key),
        ),
      ),
    );
    await p.locator('[data-preference="quality"]').selectOption("1");
    await p.locator('[data-preference="frameRate"]').selectOption("60");
    assert.deepEqual(
      await p.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(([key]) =>
            /progress|armory/.test(key),
          ),
        ),
      ),
      progress,
    );
    await p.reload();
    await tap(p, "#pt-settings");
    await expect(p.locator('[data-preference="quality"]')).toHaveValue("1");
    await expect(p.locator('[data-preference="frameRate"]')).toHaveValue("60");
    await p.goto(`${origin}/front`);
    await title(p);
    await tap(p, "#home-settings");
    await expect(p.locator("#front-setting-quality")).toHaveValue("1");
    await expect(p.locator("#front-setting-frameRate")).toHaveValue("60");
    await p.locator("#front-setting-quality").selectOption("0.65");
    await p.locator("#front-setting-frameRate").selectOption("30");
    await p.reload();
    await title(p);
    await tap(p, "#home-settings");
    await expect(p.locator("#front-setting-quality")).toHaveValue("0.65");
    await expect(p.locator("#front-setting-frameRate")).toHaveValue("30");
    await p.screenshot({ path: `${out}/${width}-shared-settings.png` });
    results.push({
      check: "設定の往復と再読み込み",
      width,
      height,
      progressUnchanged: true,
    });
    if (width === 844) {
      if (!production) {
        await p.evaluate(() => {
          const original = Storage.prototype.setItem;
          window.restoreSettingWrites = () => {
            Storage.prototype.setItem = original;
          };
          Storage.prototype.setItem = function (key, value) {
            if (key === "swarm-front-environment-preferences-v1")
              throw new Error("検査用の保存失敗");
            return original.call(this, key, value);
          };
        });
        await p.locator("#front-setting-quality").selectOption("1");
        await expect(p.locator("#front-setting-quality")).toHaveValue("0.65");
        await expect(p.locator("#front-settings-status")).toContainText(
          "保存できませんでした",
        );
        await p.evaluate(() => window.restoreSettingWrites());
        results.push({ check: "設定保存に失敗したら値を維持" });
      }
    }
    await p.context().close();
  }

  // JavaScriptの取得を保留して、アプリの起動前にも表示があることを確認する。
  for (const path of ["/?base=1", "/front?coop=1"]) {
    const p = await page();
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    await p.route(
      production ? "**/assets/*.js" : "**/src/**",
      async (route) => {
        if (route.request().resourceType() === "script") await gate;
        await route.continue();
      },
    );
    try {
      await p.goto(origin + path, { waitUntil: "commit" });
      await expect(p.locator("#boot-screen")).toBeVisible();
      await expect(p.locator("#boot-screen")).toContainText("読み込んでいます");
      assert.equal(
        await p.evaluate(
          () => getComputedStyle(document.documentElement).backgroundColor,
        ),
        "rgb(8, 14, 19)",
      );
      await p.screenshot({
        path: `${out}/${path.includes("front") ? "front" : "base"}-boot.png`,
      });
    } finally {
      release();
    }
    if (!path.includes("front")) await p.locator("#pt-confirm").waitFor();
    else await p.locator("#room-join").waitFor();
    await expect(p.locator("#boot-screen")).toHaveCount(0);
    results.push({ check: "起動前の読込表示", path, cleared: true });
    await p.context().close();
  }
  assert.deepEqual(errors, []);
} catch (error) {
  results.push({ failure: String(error), errors });
  for (const ctx of browser.contexts())
    for (const p of ctx.pages()) {
      await p.screenshot({ path: `${out}/failure.png` }).catch(() => {});
    }
  throw error;
} finally {
  for (const ws of hosts) ws.close();
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ passed: results.length, errors }));
