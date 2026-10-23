import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

// 本人のプロファイル・保存を使わず、製品Controlsを隔離DOMで検証する。
const out = "dist-validation/play-polish-20261022/input-browser";
fs.mkdirSync(out, { recursive: true });
const inputPage = (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;background:#102030;color:white}#controls{position:fixed;inset:0;touch-action:none}
    #controls>div{position:absolute;top:150px;width:90px;height:90px;background:#345;border:1px solid white}
    #move{left:30px}#fire{left:500px}#dodge{left:650px}#look{left:250px}</style>
    <div id="world"></div><div id="controls"><div id="move"><span>移動</span></div>
    <div id="look">照準</div><div id="fire">射撃</div><div id="dodge">回避</div><button id="jump" hidden>ジャンプ</button></div>
    <script type="module">import { Controls } from '/src/client/input.ts';
    document.querySelector('#look').requestPointerLock=undefined;
    window.controls=new Controls();controls.enabled=true;</script>`);
};
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "入力検証ページ",
      configureServer(s) {
        s.middlewares.use("/__polish-input", inputPage);
      },
    },
  ],
});
let browser;
const results = { cases: [], errors: [], passed: false };
try {
  await server.listen();
  browser = await chromium.launch({ channel: "chrome" });
  results.browser = browser.version();
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + "__polish-input");
  await page.waitForFunction(() => window.controls);
  const read = () => page.evaluate(() => controls.read());
  await page.mouse.move(290, 190);
  await page.mouse.down({ button: "left" });
  assert.equal((await read()).fire, true);
  await page.mouse.down({ button: "right" });
  assert.equal((await read()).fire, true);
  await page.mouse.up({ button: "left" });
  assert.equal(
    (await read()).fire,
    false,
    "右ボタン保持中でも左の解放で射撃終了",
  );
  await page.mouse.up({ button: "right" });
  results.cases.push("実マウス左右同時押しと左の先行解放");
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    window.pointerLog = [];
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
    ])
      window.addEventListener(type, (e) =>
        pointerLog.push({
          type,
          id: e.pointerId,
          target: e.target.id,
          x: e.clientX,
          y: e.clientY,
        }),
      );
  });
  const send = async (type, touchPoints) => {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
  };
  const point = (id, x, y = 190) => ({ id, x, y });
  await send("touchStart", [point(1, 70)]);
  await send("touchMove", [point(1, 100)]);
  await send("touchStart", [point(1, 100), point(2, 540), point(3, 690)]);
  let state = await read();
  results.touchStart = { state, events: await page.evaluate(() => pointerLog) };
  assert.equal(state.mx, 0.6);
  assert.equal(state.fire, true);
  assert.equal(state.dodge, true);
  await send("touchEnd", [point(3, 690)]);
  assert.equal((await read()).dodge, false);
  await send("touchMove", [point(1, 200, 350), point(2, 540)]);
  assert.equal((await read()).mx, 1);
  await send("touchEnd", [point(1, 200, 350)]);
  state = await read();
  assert.equal(state.mx, 0);
  assert.equal(state.fire, true);
  await send("touchCancel", []);
  assert.equal((await read()).fire, false);
  results.cases.push("CDP三点タッチ・範囲外移動・個別解放・取消");
  await send("touchStart", [point(1, 70), point(2, 540)]);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  state = await read();
  assert.equal(state.mx, 0);
  assert.equal(state.fire, false);
  await send("touchEnd", []);
  results.cases.push("合成blurで保持入力解除");
  await page.screenshot({ path: out + "/controls.png" });
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack ?? error);
  console.error(results.failure);
  throw error;
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser?.close();
  await server.close();
}
console.log(JSON.stringify(results));
