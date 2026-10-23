import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";

const out = "dist-validation/play-polish-20261023/mobile";
fs.mkdirSync(out, { recursive: true });
const imports = [
  ...fs
    .readFileSync("src/client/front-app.ts", "utf8")
    .matchAll(/^import "([^"]+\.css)";/gm),
]
  .map(
    (match) =>
      `import '${new URL(match[1], "file:///src/client/front-app.ts").pathname}';`,
  )
  .join("\n");
const html = fs
  .readFileSync("front.html", "utf8")
  .replaceAll("%BASE_URL%", "/")
  .replace(
    '<script type="module" src="/src/client/front-app.ts"></script>',
    `<script type="module">${imports}
  import {Controls} from '/src/client/input.ts';
  import {defaultLayout,placeControls,CONTROL_IDS} from '/src/client/layout.ts';
  document.querySelector('#controls').hidden=false;
  document.querySelector('#pause').hidden=false;
  document.querySelector('#revive').hidden=false;
  window.controls=new Controls();controls.enabled=true;
  window.place=(insets,secondScope)=>{
    for(const [key,value] of Object.entries(insets))document.documentElement.style.setProperty('--safe-'+key,value+'px');
    const layout=defaultLayout();layout.secondScope=secondScope;
    placeControls(layout);
    document.querySelector('#scope2').hidden=!secondScope;
    return CONTROL_IDS.filter(id=>!document.getElementById(id).hidden).map(id=>{
      const element=document.getElementById(id),rect=element.getBoundingClientRect();
      return {id,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height,
        hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.closest('#'+id)?.id===id};
    });
  };
  </script>`,
  );
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  cacheDir: out + "/vite-cache",
  server: {
    host: "127.0.0.1",
    port: 0,
    watch: { ignored: ["**/dist-validation/**"] },
  },
  plugins: [
    {
      name: "実操作配置の隔離検証",
      configureServer(instance) {
        instance.middlewares.use("/__polish-mobile", (_request, response) => {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(html);
        });
      },
    },
  ],
});
let browser;
const results = {
  passed: false,
  cases: [],
  layouts: [],
  errors: [],
  limitations: [
    "Chromeのタッチ模擬。実スマホではない",
    "安全領域はCSS変数への合成値。OS実表示ではない",
    "実製品のHTML/CSS/Controls/Layoutを使用する隔離ページ。戦闘HUD全体の検証ではない",
  ],
};
try {
  await server.listen();
  browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--window-position=-32000,-32000"],
  });
  results.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => results.errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0] + "__polish-mobile");
  await page.waitForFunction(() => window.place);
  for (const [width, height] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [932, 430],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    for (const insets of [
      { left: 0, right: 0, top: 0, bottom: 0 },
      { left: 44, right: 44, top: 0, bottom: 21 },
    ]) {
      for (const secondScope of [false, true]) {
        const rects = await page.evaluate(
          ({ insets, secondScope }) => place(insets, secondScope),
          { insets, secondScope },
        );
        const collisions = rects.flatMap((first, index) =>
          rects
            .slice(index + 1)
            .filter(
              (second) =>
                first.left < second.right &&
                first.right > second.left &&
                first.top < second.bottom &&
                first.bottom > second.top,
            )
            .map((second) => [first.id, second.id]),
        );
        results.layouts.push({
          width,
          height,
          insets,
          secondScope,
          rects,
          collisions,
        });
        assert.deepEqual(
          collisions,
          [],
          `操作領域の重なり: ${width}x${height}`,
        );
        for (const rect of rects) {
          assert(
            rect.left >= insets.left &&
              rect.right <= width - insets.right + 0.1 &&
              rect.top >= insets.top + 88 &&
              rect.bottom <= height - insets.bottom + 0.1,
            `安全領域外: ${rect.id}`,
          );
          assert(
            rect.width >= 44 && rect.height >= 44,
            `操作領域が44px未満: ${rect.id}`,
          );
          assert(rect.hit, `中央が操作できない: ${rect.id}`);
        }
      }
    }
    await page.screenshot({ path: `${out}/controls-${width}x${height}.png` });
  }
  results.cases.push(
    "5画面寸法×2安全領域×2スコープ設定の非重複・44px・中央hit-test",
  );
  await page.setViewportSize({ width: 844, height: 390 });
  const rects = await page.evaluate(() =>
    place({ left: 0, right: 0, top: 0, bottom: 0 }, false),
  );
  const point = (id, name, dx = 0, dy = 0) => {
    const rect = rects.find((rect) => rect.id === name);
    return {
      id,
      x: (rect.left + rect.right) / 2 + dx,
      y: (rect.top + rect.bottom) / 2 + dy,
    };
  };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await page.bringToFront();
  const send = async (type, touchPoints) => {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  const read = () => page.evaluate(() => controls.read());
  await send("touchStart", [
    point(1, "move"),
    point(2, "fire"),
    point(3, "jump"),
  ]);
  await send("touchMove", [
    point(1, "move", 35),
    point(2, "fire"),
    point(3, "jump"),
  ]);
  const simultaneous = await read();
  assert.equal(simultaneous.fire, true);
  assert.equal(simultaneous.jump, true);
  assert(simultaneous.mx > 0);
  await send("touchMove", [
    point(1, "move", 35),
    { id: 2, x: -30, y: 420 },
    point(3, "jump"),
  ]);
  assert.equal(
    (await read()).fire,
    true,
    "画面外へ動かしてもcapture中の射撃を維持",
  );
  await send("touchEnd", [{ id: 2, x: -30, y: 420 }]);
  assert.equal((await read()).fire, false);
  assert((await read()).mx > 0, "射撃を離しても移動は維持");
  await send("touchCancel", []);
  assert.equal((await read()).mx, 0);
  results.cases.push(
    "実配置で三点同時操作・画面外capture・射撃だけ解放・全取消",
  );
  await send("touchStart", [point(1, "move"), point(2, "fire")]);
  await send("touchMove", [point(1, "move", 35), point(2, "fire")]);
  results.focusBefore = await page.evaluate(() => ({
    hidden: document.hidden,
    focused: document.hasFocus(),
  }));
  assert.equal(results.focusBefore.focused, true);
  assert.equal((await read()).fire, true, "切替前は射撃を保持している");
  const [other] = await Promise.all([
    page.waitForEvent("popup"),
    page.evaluate(() => window.open("about:blank", "_blank")),
  ]);
  await other.goto("about:blank");
  await other.bringToFront();
  const otherCdp = await context.newCDPSession(other);
  await otherCdp.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  results.focusAway = await page.evaluate(() => ({
    hidden: document.hidden,
    focused: document.hasFocus(),
    state: controls.read(),
    touches: controls.touches.size,
  }));
  assert.equal(
    results.focusAway.focused,
    false,
    "実際に対象ページのフォーカスを失った",
  );
  await page.waitForFunction(
    () => !controls.read().fire && controls.touches.size === 0,
  );
  await page.bringToFront();
  await page.waitForFunction(() => document.hasFocus());
  assert.equal((await read()).mx, 0);
  await send("touchCancel", []);
  await send("touchStart", [point(4, "fire")]);
  assert.equal(
    (await read()).fire,
    true,
    "フォーカス復帰後の新しい指で射撃可能",
  );
  await send("touchEnd", []);
  results.cases.push("別タブへの実フォーカス移動で解除・復帰後の新規操作");
  await other.close();
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack ?? error);
  throw error;
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser?.close();
  await server.close();
}
console.log(
  JSON.stringify({
    passed: results.passed,
    cases: results.cases,
    layouts: results.layouts.length,
  }),
);
