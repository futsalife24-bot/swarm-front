import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5203/";
const out = process.argv[3] || "docs/evidence/voice-fix3-20261115/local";
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
  window.captionAppearances = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.duration > 1)
      window.voiceStarts.push(this.buffer.duration);
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
  await settle();
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
    await settle();
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
        "swarm-front-control-captions-v1",
      ].map((k) => [k, localStorage.getItem(k)]),
    ),
  );
  assert.equal(r.saved["swarm-front-control-captions-v1"], "always");
  assert.equal(r.saved["swarm-front-control-voice-v1"], "hiromi");
  assert.deepEqual(r.errors, []);
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify(r, null, 2));
  await browser.close();
}
console.log(JSON.stringify(r, null, 2));
