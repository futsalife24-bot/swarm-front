import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:5200/",
  out = process.argv[3] || "docs/evidence/voice-fix2-20261115";
await mkdir(out, { recursive: true });
const b = await chromium.launch({ channel: "chrome", headless: true });
const c = await b.newContext({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
await c.addInitScript(() => {
  window.audioDurations = [];
  const f = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    window.audioDurations.push(this.buffer?.duration);
    return f.apply(this, a);
  };
});
const p = await c.newPage();
const r = { base, errors: [], checks: [] };
p.on("pageerror", (e) => r.errors.push(e.message));
const q = (s) => p.locator("css:light=" + s),
  settle = () => p.waitForTimeout(1100);
async function home(delay = 0) {
  await p.goto(base, { waitUntil: "domcontentloaded" });
  await p.getByText("TAP START", { exact: true }).waitFor();
  if (delay) {
    await p.waitForTimeout(delay);
    assert.equal(await q(".control-caption").count(), 0);
  }
  await p.getByText("TAP START", { exact: true }).click();
  await settle();
}
async function voice(link = false) {
  await q("#home-settings").click();
  await settle();
  await p
    .getByRole("button", {
      name: link ? "管制AIの字幕" : "管制AIボイス",
      exact: true,
    })
    .click();
  await settle();
  await q(".cv-row").first().waitFor();
}
async function caption(v) {
  await p
    .getByRole("combobox", { name: "管制AIの字幕", exact: true })
    .selectOption(v);
}
const hasSpeech = () =>
  p.evaluate(() => window.audioDurations.some((x) => x > 1));
try {
  await home(5000);
  await voice(true);
  assert.equal(
    await p
      .getByRole("combobox", { name: "管制AIの字幕", exact: true })
      .inputValue(),
    "never",
  );
  assert.equal(await q('[data-cv-action="delete"]').count(), 0);
  for (const voice of ["hiromi", "yoko"])
    assert.ok(
      await q(
        `[data-voice="${voice}"] [data-cv-action="preview"]`,
      ).isDisabled(),
    );
  assert.ok(await q('[data-voice="yoko"] input').isDisabled());
  await q('[data-voice="none"] input').check();
  await caption("never");
  await home();
  assert.equal(await q(".control-caption").count(), 0);
  assert.equal(await hasSpeech(), false);
  r.checks.push("ボイスなし＋表示しない・再読込保持");
  await voice();
  await q('[data-voice="hiromi"] [data-cv-action="download"]').click();
  await q('[data-voice="hiromi"][data-state="ready"]').waitFor({
    timeout: 30000,
  });
  await caption("always");
  await q('[data-voice="hiromi"] [data-cv-action="preview"]').click();
  await p
    .getByText("ヒロミのサンプルを再生しています。", { exact: true })
    .waitFor();
  await q('.control-caption[data-line="title"]').waitFor();
  assert.equal(await q('[data-voice="none"] input').isChecked(), true);
  assert.equal(await hasSpeech(), true);
  await p.screenshot({ path: out + "/preview-caption.png" });
  r.checks.push("試聴は選択を変えず字幕設定にも従う");
  await q('[data-voice="hiromi"] input').check();
  await caption("missing");
  await home(5000);
  await p.waitForTimeout(700);
  assert.equal(await q(".control-caption").count(), 0);
  assert.equal(await hasSpeech(), true);
  r.checks.push("音声あり＋音声がないときだけは字幕なし");
  await voice();
  await caption("always");
  await home(5000);
  await q(".control-caption").waitFor();
  assert.equal(await hasSpeech(), true);
  await p.screenshot({ path: out + "/title-audio.png" });
  r.checks.push("遅いTAP STARTでもタイトル音声と字幕が表示");
  await voice();
  await q('[data-voice="none"] input').check();
  await caption("missing");
  for (const size of [
    { width: 844, height: 390 },
    { width: 568, height: 320 },
  ]) {
    await p.setViewportSize(size);
    await settle();
    const d = await q(".cv-dialog .menu-dialog-body").evaluate((n) => ({
      scroll: n.scrollWidth,
      width: n.clientWidth,
    }));
    assert.ok(d.scroll <= d.width + 1);
    await p.screenshot({ path: `${out}/settings-${size.width}.png` });
  }
  await p.setViewportSize({ width: 844, height: 390 });
  await home();
  await q(".control-caption").waitFor();
  assert.equal(await hasSpeech(), false);
  r.checks.push("保存済みパックでもボイスなし＋音声なし時字幕・保存保持");
  r.saved = await p.evaluate(() =>
    Object.fromEntries(
      [
        "swarm-front-control-voice-enabled-v1",
        "swarm-front-control-captions-v1",
        "swarm-front-control-voice-v1",
      ].map((k) => [k, localStorage.getItem(k)]),
    ),
  );
  assert.equal(r.saved["swarm-front-control-voice-enabled-v1"], "false");
  assert.equal(r.saved["swarm-front-control-captions-v1"], "missing");
  assert.equal(r.saved["swarm-front-control-voice-v1"], "hiromi");
  assert.deepEqual(r.errors, []);
} finally {
  await writeFile(out + "/settings-result.json", JSON.stringify(r, null, 2));
  await b.close();
}
console.log(JSON.stringify(r, null, 2));
