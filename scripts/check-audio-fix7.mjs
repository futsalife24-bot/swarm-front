import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:5217/";
const out = process.argv[3] || "docs/evidence/audio-fix7-20261115/before";
const before = process.argv.includes("--before");
await mkdir(out, { recursive: true });
// Playwright通常起動はfocusを模擬して全タブをvisibleにする。
// 独立した空プロファイルの実ChromeへnoDefaultsで接続して実タブ切替を測る。
const profile = await mkdtemp(join(tmpdir(), "swarm-audio-fix7-chrome-"));
const chrome = spawn(
  join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  [
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let browser;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const [port] = (
      await readFile(join(profile, "DevToolsActivePort"), "utf8")
    ).split("\n");
    browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${Number(port)}`,
      {
        noDefaults: true,
        timeout: 1000,
      },
    );
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
assert.ok(browser, "検証用Chromeへ接続できない");
const context = browser.contexts()[0];
await context.addInitScript(() => {
  window.audioProbe = { contexts: [], media: [], events: [], starts: [] };
  const probe = window.audioProbe;
  const NativeContext = window.AudioContext;
  window.AudioContext = class extends NativeContext {
    constructor(...args) {
      super(...args);
      probe.contexts.push(this);
      this.addEventListener("statechange", () =>
        probe.events.push({
          event: "statechange",
          state: this.state,
          at: performance.now(),
        }),
      );
    }
    createMediaElementSource(media) {
      const source = super.createMediaElementSource(media);
      const analyser = this.createAnalyser();
      source.connect(analyser);
      probe.media.push({ media, context: this, analyser });
      return source;
    }
  };
  for (const event of [
    "visibilitychange",
    "pageshow",
    "focus",
    "blur",
    "pointerdown",
    "click",
    "keydown",
  ]) {
    (event === "visibilitychange" ||
    ["pointerdown", "click", "keydown"].includes(event)
      ? document
      : window
    ).addEventListener(
      event,
      () =>
        probe.events.push({
          event,
          hidden: document.hidden,
          at: performance.now(),
        }),
      true,
    );
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    probe.starts.push({
      src: this.src,
      rate: this.playbackRate,
      pitch: this.preservesPitch,
      at: performance.now(),
    });
    return play.apply(this, args);
  };
});
const page = await context.newPage();
await page.setViewportSize({ width: 844, height: 390 });
page.setDefaultTimeout(60000);
const result = {
  base,
  browser: browser.version(),
  before,
  checks: [],
  errors: [],
};
page.on("pageerror", (e) => result.errors.push(e.message));
const q = (s) => page.locator("css:light=" + s);
const snapshot = () =>
  page.evaluate(() => ({
    hidden: document.hidden,
    contexts: window.audioProbe.contexts.map((c) => ({
      state: c.state,
      time: c.currentTime,
    })),
    media: window.audioProbe.media.map(({ media, context, analyser }) => {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return {
        src: media.src,
        track: media.dataset.track,
        paused: media.paused,
        time: media.currentTime,
        state: context.state,
        rms: Math.sqrt(
          samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
        ),
      };
    }),
    starts: window.audioProbe.starts,
    events: window.audioProbe.events,
  }));
try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.getByText("TAP START", { exact: true }).click({ timeout: 120000 });
  await q("#home-settings").click();
  await page.waitForTimeout(1000);
  await page.waitForFunction(
    () => !!document.querySelector("[data-control-voice]")?.onclick,
  );
  await q("[data-control-voice]").click();
  await q(".cv-dialog").waitFor();
  await page.waitForTimeout(1000);
  console.log("管制AI設定の初期化完了");
  const download = q('[data-voice="hiromi"] [data-cv-action="download"]');
  await download.click();
  await q('[data-voice="hiromi"][data-state="ready"]').waitFor();
  console.log("音声パック保存完了");
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  await page.waitForTimeout(350);
  result.initial = await snapshot();
  console.log("初回音声を計測");
  assert.ok(result.initial.contexts.length >= 2);
  assert.ok(
    result.initial.media.some((m) => m.src.startsWith("blob:") && m.rms > 0),
  );
  // 通常の切替と、OS中断を模した実AudioContext.suspend()を分けて計測する。
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(250);
  result.hidden = await snapshot();
  result.nativeHiddenObserved = result.hidden.hidden;
  await page.bringToFront();
  await page.waitForTimeout(350);
  result.plainReturn = await snapshot();
  await other.bringToFront();
  await page.waitForTimeout(200);
  await page.evaluate(() =>
    Promise.all(window.audioProbe.contexts.map((c) => c.suspend())),
  );
  result.suspended = await snapshot();
  await page.bringToFront();
  await page.waitForTimeout(400);
  result.interruptedReturn = await snapshot();
  const recovered = result.interruptedReturn.contexts.every(
    (c) => c.state === "running",
  );
  assert.equal(recovered, !before);
  if (!before) {
    assert.ok(
      result.interruptedReturn.contexts.every(
        (c, i) => c.time > result.suspended.contexts[i].time + 0.1,
      ),
    );
    assert.ok(
      result.interruptedReturn.media.some(
        (m) => m.track === "title" && !m.paused && m.rms > 0,
      ),
    );
  }
  result.checks.push(
    before
      ? "中断を注入した復帰で両AudioContextがsuspendedのまま残ることを再現"
      : "中断を注入した実タブ復帰で両AudioContextが自動再開",
  );
  // 画面遷移を伴わない最初のタップ（見出し）でも復旧するか。
  await page.evaluate(() =>
    Promise.all(window.audioProbe.contexts.map((c) => c.suspend())),
  );
  await q(".cv-intro").click();
  await page.waitForTimeout(250);
  result.firstTap = await snapshot();
  assert.ok(result.firstTap.contexts.every((c) => c.state === "running"));
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  await page.waitForTimeout(300);
  result.voiceAfterReturn = await snapshot();
  assert.ok(
    result.voiceAfterReturn.media.some(
      (m) => m.src.startsWith("blob:") && !m.paused && m.rms > 0,
    ),
  );
  result.checks.push("画面遷移なしのタップと次の試聴で音声出力を確認");
  await page.screenshot({ path: out + "/settings.png" });
  await q(".cv-dialog .dialog-close").click();
  while (await q("dialog[open] .dialog-close").count()) {
    await q("dialog[open] .dialog-close").last().click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(600);
  await q("#solo").click();
  if (await q("#player-name").count()) {
    await q("#player-name").fill("音声検証");
    await page
      .getByRole("button", { name: "この名前で登録", exact: true })
      .click();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByText("TAP START", { exact: true }).click();
    await q("#solo").click();
  }
  await q('[data-operation="advance"]').waitFor();
  await page.waitForTimeout(600);
  await page.evaluate(() =>
    Promise.all(window.audioProbe.contexts.map((c) => c.suspend())),
  );
  await q('[data-operation="advance"]').click();
  await page.waitForTimeout(400);
  result.advanceButton = await snapshot();
  assert.ok(result.advanceButton.contexts.every((c) => c.state === "running"));
  result.checks.push(
    "本人の観察に沿い進撃選択ボタンでも中断から復旧することを確認",
  );
  await page.screenshot({ path: out + "/advance.png" });
  assert.deepEqual(result.errors, []);
  result.ok = true;
} catch (e) {
  result.failure = String(e.stack || e);
  result.dialogs = await page.evaluate(() =>
    [...document.querySelectorAll("dialog")].map((d) => ({
      className: d.className,
      open: d.open,
      text: d.textContent.slice(0, 400),
    })),
  );
  await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(out + "/result.json", JSON.stringify(result, null, 2));
  const closeSession = await context.newCDPSession(page);
  await closeSession.send("Browser.close").catch(() => {});
  await browser.close();
  if (chrome.exitCode === null)
    await new Promise((resolve) => chrome.once("exit", resolve));
  assert.ok(
    resolve(profile).startsWith(
      resolve(tmpdir()) + sep + "swarm-audio-fix7-chrome-",
    ),
  );
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
console.log(
  JSON.stringify({
    ok: result.ok,
    checks: result.checks,
    failure: result.failure,
  }),
);
