import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5205/";
const out = process.argv[3] || "docs/evidence/voice-fix4-20261115/local";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const c = await browser.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
await c.addInitScript(() => {
  // 旧設定alwaysが残る端末でも字幕を復活させない。
  localStorage.setItem("swarm-front-control-captions-v1", "always");
  window.voiceStarts = [];
  window.voiceStops = [];
  window.voiceLive = new Set();
  window.maxVoiceLive = 0;
  window.clicks = [];
  document.addEventListener(
    "click",
    (e) =>
      window.clicks.push({
        id:
          e.target.id ||
          e.target.closest("[data-operation]")?.dataset.operation,
        at: performance.now(),
      }),
    true,
  );
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.stop = function (...args) {
    if (window.voiceLive.delete(this))
      window.voiceStops.push(performance.now());
    return stop.apply(this, args);
  };
  window.captionAppearances = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.duration > 1) {
      window.voiceLive.add(this);
      window.maxVoiceLive = Math.max(
        window.maxVoiceLive,
        window.voiceLive.size,
      );
      this.addEventListener("ended", () => window.voiceLive.delete(this), {
        once: true,
      });
      window.voiceStarts.push({
        duration: this.buffer.duration,
        rate: this.playbackRate.value,
        at: performance.now(),
      });
    }
    return start.apply(this, args);
  };
  new MutationObserver(() => {
    for (const n of document.querySelectorAll(".control-caption"))
      window.captionAppearances.push(n.textContent);
  }).observe(document, { childList: true, subtree: true });
});
const p = await c.newPage();
p.setDefaultTimeout(15000);
const r = { base, checks: [], errors: [] };
p.on("pageerror", (e) => r.errors.push(e.message));
const q = (s) => p.locator("css:light=" + s);
const settle = () => p.waitForTimeout(1000);
async function home(delay = 0) {
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.getByText("TAP START", { exact: true }).waitFor();
  if (delay) await p.waitForTimeout(delay);
  assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
  await p.getByText("TAP START", { exact: true }).click();
  await q("#home-settings").waitFor();
  await q(".title-entry").waitFor({ state: "detached" });
  await p.waitForTimeout(150);
}
async function voice() {
  await q("#home-settings").click();
  await settle();
  assert.equal(
    await p.getByRole("button", { name: "管制AIの字幕", exact: true }).count(),
    0,
  );
  await p.getByRole("button", { name: "管制AIボイス", exact: true }).click();
  await q(".cv-row").first().waitFor();
  await settle();
  assert.equal(await q(".cv-captions, [data-control-captions]").count(), 0);
  assert.equal(
    await p.getByRole("combobox", { name: "管制AIの字幕" }).count(),
    0,
  );
}
async function noCaptions() {
  assert.equal(await q(".control-caption").count(), 0);
  assert.deepEqual(await p.evaluate(() => window.captionAppearances), []);
}
try {
  await home(1600);
  await voice();
  assert.equal(await q('[data-cv-action="delete"]').count(), 0);
  assert.equal(await q('[data-voice="none"] b').innerText(), "ボイスなし");
  for (const v of ["hiromi", "yoko"])
    assert.ok(
      await q(`[data-voice="${v}"] [data-cv-action="preview"]`).isDisabled(),
    );
  assert.ok(await q('[data-voice="yoko"] input').isDisabled());
  assert.equal(
    await q('[data-voice="yoko"] [data-cv-action="download"]').count(),
    0,
  );
  await noCaptions();
  r.checks.push("未DLは無音、字幕設定と導線なし、ヨウコの全操作不可");
  await q('[data-voice="none"] input').check();
  await home();
  assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
  await voice();
  assert.ok(await q('[data-voice="none"] input').isChecked());
  await q('[data-voice="hiromi"] [data-cv-action="download"]').click();
  await q('[data-voice="hiromi"][data-state="ready"]').waitFor({
    timeout: 30000,
  });
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  await p
    .getByText("ヒロミのサンプルを再生しています。", { exact: true })
    .waitFor();
  assert.ok((await p.evaluate(() => window.voiceStarts)).length > 0);
  assert.ok(await q('[data-voice="none"] input').isChecked());
  await noCaptions();
  assert.equal(
    await p.getByRole("combobox", { name: "管制AIの再生速度" }).inputValue(),
    "1",
  );
  await p
    .getByRole("combobox", { name: "管制AIの再生速度" })
    .selectOption("1.3");
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  await p.waitForTimeout(100);
  assert.ok(
    Math.abs((await p.evaluate(() => window.voiceStarts)).at(-1).rate - 1.3) <
      1e-6,
  );
  r.checks.push("通常が既定、1.3倍速を試聴へ適用");
  r.previewDurations = await p.evaluate(() => window.voiceStarts);
  r.checks.push("保存済みの日本語サンプル試聴、ボイスなし選択保持、字幕なし");
  for (const size of [
    { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    await p.setViewportSize(size);
    await settle();
    const d = await q(".cv-dialog .menu-dialog-body").evaluate((n) => ({
      width: n.clientWidth,
      scroll: n.scrollWidth,
    }));
    assert.ok(d.scroll <= d.width + 1, JSON.stringify(d));
    await p.screenshot({ path: `${out}/settings-${size.width}.png` });
  }
  await p.setViewportSize({ width: 844, height: 390 });
  await home();
  assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
  await noCaptions();
  r.checks.push(
    "パック保存済みでもボイスなしは無音、再読込保持、横2サイズはみ出しなし",
  );
  await voice();
  await q('[data-voice="hiromi"] input').check();
  await home(1600);
  await p.waitForTimeout(600);
  assert.ok(
    Math.abs((await p.evaluate(() => window.voiceStarts)).at(-1).rate - 1.3) <
      1e-6,
  );
  await voice();
  assert.equal(
    await p.getByRole("combobox", { name: "管制AIの再生速度" }).inputValue(),
    "1.3",
  );
  r.checks.push("再読込後も速度保持、通常発話も1.3倍速");
  await q(".cv-dialog .dialog-close").click();
  while (await q("dialog[open] .dialog-close").count()) {
    await q("dialog[open] .dialog-close").last().click();
    await p.waitForTimeout(50);
  }
  await p.waitForTimeout(600);
  const rapidStart = await p.evaluate(() => performance.now());
  await q("#solo").click();
  if (await q("#player-name").count()) {
    await q("#player-name").fill("音声検証");
    await p
      .getByRole("button", { name: "この名前で登録", exact: true })
      .click();
    await home();
    await q("#solo").click();
  }
  await p.waitForTimeout(600);
  await q('[data-operation="advance"]').click();
  await p.waitForTimeout(600);
  if (await q("#pt-confirm").count()) await q("#pt-confirm").click();
  await p.waitForTimeout(400);
  r.rapid = await p.evaluate(() => ({
    voices: window.voiceStarts,
    stops: window.voiceStops,
    maxLive: window.maxVoiceLive,
    clicks: window.clicks,
  }));
  assert.equal(r.rapid.maxLive, 1);
  assert.ok(r.rapid.voices.length >= 2);
  r.rapid.lastStartAfterClickMs =
    r.rapid.voices.at(-1).at - r.rapid.clicks.at(-1).at;
  assert.ok(
    r.rapid.lastStartAfterClickMs >= 0 && r.rapid.lastStartAfterClickMs < 500,
  );
  r.checks.push("タイトルから作戦選択・進撃へ連続操作、最新台詞を再生");
  await home();
  assert.ok((await p.evaluate(() => window.voiceStarts)).length > 0);
  await noCaptions();
  r.checks.push(
    "TAP START前の発話なし、入力後の既存タイトル発話維持、旧alwaysでも字幕なし",
  );
  if (process.argv.includes("--training")) {
    await q("#home-tutorial").click();
    await settle();
    await q("#tutorial-training").click();
    const f = p.frameLocator("iframe.training-frame");
    await f.locator("#training-start").click();
    await p.waitForTimeout(150);
    await p.waitForFunction(
      () =>
        document.querySelector("iframe.training-frame")?.contentWindow
          .voiceStarts.length > 0,
    );
    r.trainingVoices = await f
      .locator("body")
      .evaluate(() => window.voiceStarts);
    assert.ok(Math.abs(r.trainingVoices.at(-1).rate - 1.3) < 1e-6);
    assert.equal(await f.locator(".control-caption").count(), 0);
    const guide = await f.locator("body").innerText();
    assert.ok(guide.includes("移動") || guide.includes("基礎訓練"));
    await p.screenshot({ path: `${out}/training-guide.png` });
    r.checks.push("基礎訓練の初回案内を保持、訓練iframeにも字幕なし");
  }
  r.saved = await p.evaluate(() =>
    Object.fromEntries(
      [
        "swarm-front-control-voice-enabled-v1",
        "swarm-front-control-voice-v1",
        "swarm-front-control-voice-rate-v1",
        "swarm-front-control-captions-v1",
      ].map((k) => [k, localStorage.getItem(k)]),
    ),
  );
  assert.equal(r.saved["swarm-front-control-captions-v1"], "always");
  assert.equal(r.saved["swarm-front-control-voice-v1"], "hiromi");
  assert.deepEqual(r.errors, []);
} catch (e) {
  r.failure = e.message;
  await p.screenshot({ path: `${out}/failure.png` });
  throw e;
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(r, null, 2));
  await browser.close();
}
console.log(JSON.stringify(r, null, 2));
