import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "dist-validation/mobile-start-audio";
mkdirSync(out, { recursive: true });
writeFileSync(
  out + "/harness.html",
  '<!doctype html><html><body><button id="start">再生</button></body></html>',
);
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: { entries: ["index.html", "front.html"] },
  server: { host: "127.0.0.1", port: 5197, strictPort: true },
  define: { __AUTO_CHANGELOG__: "[]" },
});
await server.listen();
const base = "http://127.0.0.1:5197";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const result = {
  browser: browser.version(),
  preboot: [],
  orientation: [],
  audio: {},
  errors: [],
};
try {
  const pre = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
    serviceWorkers: "block",
  });
  await pre.route("https://**/*", (r) => r.abort());
  const page = await pre.newPage();
  for (const path of ["/", "/front.html"]) {
    await page.goto(base + path, { waitUntil: "load" });
    assert(await page.locator("#landscape-guide").isVisible());
    assert.match(
      await page.locator("#landscape-guide").textContent(),
      /端末を横向き/,
    );
    const box = await page.locator("#portrait").boundingBox();
    assert(box.width === 390 && box.height === 844);
    await page.screenshot({
      path:
        "dist-validation/mobile-start-audio/preboot-" +
        (path === "/" ? "index" : "front") +
        ".png",
    });
    result.preboot.push({ path, guide: true, box });
  }
  console.log("PREBOOT PASS");
  await pre.close();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => result.errors.push(e.message));
  await p.route("https://**/*", (r) => r.abort());
  await p.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new Error("unsupported"));
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: () => Promise.reject(new Error("unsupported")),
    });
  });
  for (const path of ["/", "/front.html"]) {
    await p.goto(base + path, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => document.querySelector("#ui").inert);
    assert(await p.locator("#landscape-guide").isVisible());
    await p.locator("#landscape-start").tap();
    await p.waitForFunction(() =>
      document
        .querySelector("#landscape-status")
        .textContent.includes("端末を横向き"),
    );
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForFunction(() => !document.querySelector("#ui").inert);
    assert.equal(await p.locator("#portrait").isVisible(), false);
    const entry = p.locator(".title-entry-start");
    if (await entry.isVisible()) {
      await entry.tap();
      await p.locator("dialog.title-entry").waitFor({ state: "detached" });
    }
    await p.locator("#solo").waitFor({ state: "visible" });
    await p.screenshot({
      path:
        "dist-validation/mobile-start-audio/landscape-" +
        (path === "/" ? "index" : "front") +
        ".png",
    });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(() => document.querySelector("#ui").inert);
    assert(await p.locator("#landscape-guide").isVisible());
    result.orientation.push({
      path,
      portrait: true,
      unsupportedFallback: true,
      landscapeMenu: true,
      returnedPortrait: true,
    });
  }
  console.log("ORIENTATION PASS");
  await ctx.close();
  const audio = await browser.newContext({ serviceWorkers: "block" });
  const a = await audio.newPage();
  a.on("pageerror", (e) => result.errors.push(e.message));
  await a.goto(base + "/dist-validation/mobile-start-audio/harness.html");
  await a.evaluate(async () => {
    // Ignore all writes to HTMLMediaElement.volume, reproducing the relevant iOS restriction.
    const volume = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "volume",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "volume", {
      configurable: true,
      get: volume.get,
      set() {},
    });
    const original = AudioContext.prototype.createGain;
    window.gainContexts = [];
    AudioContext.prototype.createGain = function () {
      const node = original.call(this);
      const connect = node.connect.bind(node);
      const ctx = this;
      node.connect = function (dest, ...args) {
        if (dest === ctx.destination) {
          const meter = ctx.createAnalyser();
          meter.fftSize = 2048;
          connect(meter);
          meter.connect(dest);
          window.gainContexts.push({ ctx, node, meter });
          return dest;
        }
        return connect(dest, ...args);
      };
      return node;
    };
    const { backgroundMusic } = await import("/src/client/bgm.ts");
    window.bgm = backgroundMusic();
    window.bgm.volume = 1;
    window.bgm.setScreen("title");
    document.querySelector("#start").onclick = () => window.bgm.unlock();
  });
  console.log("AUDIO READY");
  await a.locator("#start").click();
  await a.waitForFunction(
    () =>
      window.gainContexts.length === 1 &&
      document.querySelector("audio").currentTime > 0.1,
  );
  result.audio = await a.evaluate(async () => {
    const player = document.querySelector("audio");
    const graph = window.gainContexts[0];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const sample = async (level) => {
      window.bgm.volume = level;
      player.pause();
      player.currentTime = 8;
      await new Promise((r) =>
        player.addEventListener("seeked", r, { once: true }),
      );
      await player.play();
      await sleep(150);
      const data = new Float32Array(graph.meter.fftSize);
      let square = 0,
        total = 0;
      for (let i = 0; i < 20; i++) {
        graph.meter.getFloatTimeDomainData(data);
        for (const n of data) {
          square += n * n;
          total++;
        }
        await sleep(10);
      }
      player.pause();
      return Math.sqrt(square / total);
    };
    const full = await sample(1),
      quarter = await sample(0.25),
      mute = await sample(0),
      restored = await sample(1);
    window.bgm.volume = 1;
    window.bgm.setScreen("gear");
    document.querySelector("#start").click();
    await sleep(250);
    const track = player.dataset.track;
    return {
      full,
      quarter,
      mute,
      restored,
      ratio: quarter / full,
      restoreRatio: restored / full,
      elementVolume: player.volume,
      contexts: window.gainContexts.length,
      track,
      contextState: graph.ctx.state,
      mp3: player.src.endsWith(".mp3"),
    };
  });
  assert(result.audio.full > 0.001);
  assert(result.audio.ratio > 0.2 && result.audio.ratio < 0.3);
  assert(result.audio.mute < 1e-6);
  assert(result.audio.restoreRatio > 0.9 && result.audio.restoreRatio < 1.1);
  assert.equal(result.audio.contexts, 1);
  assert.equal(result.audio.track, "prepare");
  assert(result.audio.mp3);
  await a.evaluate(async () => {
    const { mountMediaMenu } = await import("/src/client/media-menu.ts");
    const owner = document.createElement("dialog");
    owner.innerHTML = '<div class="menu-dialog-body"></div>';
    document.body.append(owner);
    owner.showModal();
    mountMediaMenu(owner, () => 1);
  });
  await a.locator("[data-sound-test]").click();
  await a.waitForFunction(
    () =>
      window.gainContexts.length === 2 &&
      document.querySelector(".media-dialog audio")?.src.startsWith("blob:"),
  );
  await a.locator(".media-dialog [data-play]").click();
  await a.waitForFunction(
    () =>
      window.gainContexts[1].ctx.state === "running" &&
      !document.querySelector(".media-dialog audio").paused,
  );
  await a.evaluate(() => window.gainContexts[1].ctx.suspend());
  await a.locator(".media-dialog [data-play]").click();
  await a.waitForFunction(() => window.gainContexts[1].ctx.state === "running");
  await a.locator(".media-dialog .dialog-close").click();
  await a.waitForFunction(
    () =>
      window.gainContexts[1].ctx.state === "closed" &&
      !document.querySelector(".media-dialog"),
  );
  await a.locator("[data-sound-test]").click();
  await a.waitForFunction(
    () =>
      window.gainContexts.length === 3 &&
      document.querySelector(".media-dialog audio")?.src.startsWith("blob:"),
  );
  await a.locator(".media-dialog [data-play]").click();
  await a.waitForFunction(
    () =>
      window.gainContexts[2].ctx.state === "running" &&
      !document.querySelector(".media-dialog audio").paused,
  );
  result.preview = {
    resumeAfterSuspension: true,
    firstGraphClosed: true,
    reopenedWithNewGraph: true,
  };
  await a.locator(".media-dialog .dialog-close").click();
  await a.waitForFunction(() => window.gainContexts[2].ctx.state === "closed");
  await audio.close();
  assert.deepEqual(result.errors, []);
  writeFileSync(
    "dist-validation/mobile-start-audio/results.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  await server.close();
}
