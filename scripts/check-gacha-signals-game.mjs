// 実ゲームの演出確認UIで、採用演出と取得なしの操作を確認する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

const out = path.resolve("docs/evidence/gacha-signals-20261115/game-ui");
const adopted = [
  "1", "2", "3", "4", "9", "10", "response", "signature",
  "heartbeat", "multilock", "sonic", "reverse", "reverseSeal",
  "lamp", "landing", "delayed", "skeleton",
];
const selected = ["response", "signature", "heartbeat", "lamp", "sonic", "delayed", "skeleton"];
const buddy = new Set(["response", "signature", "heartbeat"]);
const errors = [], apiWrites = [], rows = [];
fs.mkdirSync(out, { recursive: true });

const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "gacha-signals-qa-page",
    configureServer(vite) {
      vite.middlewares.use("/qa-signals", (_req, res) => {
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.end('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="host"></main></body></html>');
      });
    },
  }],
});
let browser;
try {
  console.log("確認UI: Vite起動中");
  await server.listen();
  console.log("確認UI: Vite起動済み");
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ channel: "chrome", args: ["--mute-audio"] });
  const context = await browser.newContext({ serviceWorkers: "block" });
  for (const [index, id] of selected.entries()) for (const count of [1, 10]) {
    console.log(`確認UI: ${id}/${count} 開始`);
    // 14回に抑え、単発と10連を二つの横画面サイズへ割り当てる。
    const [width, height] = count === 1 ? [844, 390] : [640, 360];
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(request.method()))
        apiWrites.push({ method: request.method(), path: url.pathname });
    });
    try {
      await page.goto(`http://127.0.0.1:${port}/qa-signals`, { waitUntil: "domcontentloaded" });
      console.log(`確認UI: ${id}/${count} HTML読込`);
      await page.evaluate(async () => {
        const { mountSupplyPreview } = await import("/src/client/supply-preview.ts");
        window.gachaPreview = mountSupplyPreview(document.getElementById("host"), () => 0);
      });
      console.log(`確認UI: ${id}/${count} mount完了`);
      const options = await page.locator("[data-supply-preview-select] option").evaluateAll(
        (nodes) => nodes.map((node) => node.value),
      );
      assert.deepEqual(options, adopted, "確認UIの候補に不採用5〜8が混入");
      const before = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      await page.selectOption("[data-supply-preview-count]", String(count));
      await page.selectOption("[data-supply-preview-select]", id);
      await page.locator("[data-supply-preview-play]").click();
      console.log(`確認UI: ${id}/${count} 再生操作`);
      const overlay = page.locator(".gx-root:not([hidden])");
      await overlay.waitFor();
      await page.waitForFunction(() => {
        const root = document.querySelector(".gx-root:not([hidden])");
        return !!root?.dataset.signalPlan;
      });
      const state = await page.evaluate(async ({ id, count }) => {
        const { selectedSupplyPreview } = await import("/src/client/supply-preview-data.ts");
        const { validatePlan, phaseOf } = await import("/supply-reveal/effect-selection.js");
        const { tierOf } = await import("/supply-reveal/core.js");
        const plan = JSON.parse(document.querySelector(".gx-root:not([hidden])").dataset.signalPlan);
        const source = selectedSupplyPreview(["response", "signature", "heartbeat"].includes(id) ? 10 : 1, count);
        const tiers = source.map(tierOf);
        const chosen = /^\d+$/.test(id) ? Number(id) : id;
        return {
          plan,
          chosen,
          phase: phaseOf(chosen),
          lowerBound: validatePlan({ tiers, multi: count === 10, initialTiers: plan.initialTiers }, plan),
          previewText: document.querySelector("[data-supply-preview-note]")?.textContent,
          rootVisible: !document.querySelector(".gx-root").hidden,
        };
      }, { id, count });
      assert.equal(state.plan.phases[state.phase], state.chosen);
      assert.ok(state.lowerBound && state.rootVisible, `${id}/${count}: 結果下限と表示が不一致`);
      assert.equal(state.previewText, "再生中です。");
      await page.screenshot({ path: path.join(out, `${id}-${count}-${width}-play.png`) });
      console.log(`確認UI: ${id}/${count} 表示画像保存`);
      await page.locator(".gx-root [data-act='skip']").click();
      const close = page.locator(".gx-actions [data-id='close']");
      let confirmations = 0, pointer = 0, keyboard = 0;
      for (let attempt = 0; attempt < 20 && !(await close.isVisible()); attempt++) {
        await page.waitForTimeout(500);
        if (await close.isVisible()) break;
        if ((index + (count === 10 ? 1 : 0) + attempt) % 2 === 0) {
          await page.evaluate(() => document.activeElement?.blur());
          await page.keyboard.press("Enter");
          keyboard++;
        } else {
          await overlay.click({ position: { x: width / 2, y: height / 2 } });
          pointer++;
        }
        confirmations++;
      }
      assert.ok(await close.isVisible(), `${id}/${count}: 獲得確認後の結果一覧に到達しません`);
      assert.ok(confirmations > 0, `${id}/${count}: 獲得確認を飛ばしました`);
      await page.screenshot({ path: path.join(out, `${id}-${count}-${width}-final.png`) });
      await close.click();
      await page.waitForFunction(() => !document.querySelector(".gx-root"));
      const after = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      assert.equal(after, before, `${id}/${count}: localStorageが変化`);
      assert.equal(await page.locator("[data-supply-preview-play]").isEnabled(), true);
      rows.push({ id, count, width, height, phases: state.plan.phases, targets: state.plan.targets,
        confirmations, pointer, keyboard, localStorageUnchanged: true });
    } finally {
      await page.evaluate(() => window.gachaPreview?.destroy()).catch(() => {});
      await page.close();
    }
  }
  assert.equal(apiWrites.length, 0, "補給APIへの書込を検出");
  assert.deepEqual(errors, [], "画面例外を検出");
  const report = { checked: rows.length, options: adopted, rows, apiWrites, errors };
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checked: rows.length, apiWrites: apiWrites.length, errors }));
} finally {
  await browser?.close();
  await server.close();
}
