import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5206/";
const out = process.argv[3] || "docs/evidence/voice-fix6-20261115/local";
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
  window.voiceBlobs = new Map();
  const objectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = objectURL.call(this, blob);
    window.voiceBlobs.set(
      url,
      blob
        .arrayBuffer()
        .then((b) => crypto.subtle.digest("SHA-256", b))
        .then((b) =>
          [...new Uint8Array(b)]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join(""),
        ),
    );
    return url;
  };
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
  const pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function (...args) {
    if (window.voiceLive.delete(this))
      window.voiceStops.push(performance.now());
    return pause.apply(this, args);
  };
  window.captionAppearances = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (!this.src.startsWith("blob:")) return play.apply(this, args);
    window.voiceLive.add(this);
    window.maxVoiceLive = Math.max(window.maxVoiceLive, window.voiceLive.size);
    this.addEventListener("ended", () => window.voiceLive.delete(this), {
      once: true,
    });
    window.voiceStarts.push({
      src: this.src,
      rate: this.playbackRate,
      preservesPitch: this.preservesPitch,
      at: performance.now(),
    });
    return play.apply(this, args);
  };
  new MutationObserver(() => {
    for (const n of document.querySelectorAll(".control-caption"))
      window.captionAppearances.push(n.textContent);
  }).observe(document, { childList: true, subtree: true });
});
const p = await c.newPage();
p.setDefaultTimeout(60000);
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
  assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
  await voice();
  const rate = p.getByRole("combobox", { name: "管制AIの再生速度" });
  assert.deepEqual(
    await rate.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
    ["1", "1.1", "1.2", "1.3", "1.4", "1.5"],
  );
  assert.equal(await rate.inputValue(), "1");
  assert.ok(await q('[data-voice="yoko"] input').isDisabled());
  await q('[data-voice="hiromi"] [data-cv-action="download"]').click();
  await q('[data-voice="hiromi"][data-state="ready"]').waitFor();
  r.speeds = [];
  for (const value of ["1", "1.1", "1.2", "1.3", "1.4", "1.5"]) {
    await rate.selectOption(value);
    await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
    await p.waitForTimeout(120);
    const last = await p.evaluate(() => window.voiceStarts.at(-1));
    assert.equal(last.rate, Number(value));
    assert.equal(last.preservesPitch, true);
    r.speeds.push(last);
    await home();
    assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
    await voice();
    assert.equal(await rate.inputValue(), value);
  }
  r.checks.push(
    "6速度の実試聴・ピッチ保持指定・保存と再読込、DL済みタイトルは無音",
  );
  const pack = await readFile(
    "public/assets/voice-packs/control-voice-hiromi-v2.bin",
  );
  const len = pack.readUInt32LE(8),
    index = JSON.parse(pack.subarray(12, 12 + len));
  const clip = index.clips.find(
    (c) => c.key === "voice-control-hiromi-v1/home",
  );
  const expected = createHash("sha256")
    .update(
      pack.subarray(
        12 + len + clip.offset,
        12 + len + clip.offset + clip.length,
      ),
    )
    .digest("hex");
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  r.previewHash = await p.evaluate(() =>
    window.voiceBlobs.get(window.voiceStarts.at(-1).src),
  );
  assert.equal(r.previewHash, expected);
  r.checks.push("試聴は日本語homeクリップの実バイトと一致");
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
    await p.screenshot({ path: out + "/settings-" + size.width + ".png" });
  }
  await noCaptions();
  await q('[data-voice="none"] input').check();
  await home();
  assert.deepEqual(await p.evaluate(() => window.voiceStarts), []);
  await voice();
  assert.ok(await q('[data-voice="none"] input').isChecked());
  r.checks.push(
    "横2サイズ・ボイスなし保持・旧字幕alwaysでも字幕なし・ヨウコロック",
  );
  assert.deepEqual(r.errors, []);
} catch (e) {
  r.failure = e.message;
  r.failureDOM = await p.locator("body").innerText();
  await p.screenshot({ path: out + "/failure.png" });
  throw e;
} finally {
  await writeFile(out + "/result.json", JSON.stringify(r, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ checks: r.checks, errors: r.errors }));
