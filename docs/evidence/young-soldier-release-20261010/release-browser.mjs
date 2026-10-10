import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const base = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/soldier-voice-audit-20261010";
fs.mkdirSync(out, { recursive: true });
const clips = JSON.parse(
  fs.readFileSync(
    "assets-src/voice-soldier-v2/young-soldier/manifest.json",
    "utf8",
  ),
).clips;
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [],
  requests = [],
  previews = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") errors.push(e.text());
});
page.on("response", (r) => {
  if (r.url().includes("/voice-young-soldier-v1/"))
    requests.push({ url: r.url(), status: r.status() });
});
await page.addInitScript(
  (hashIds) => {
    window.__voicePlaybacks = [];
    const buffers = new WeakMap();
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (bytes, ...args) {
      const hash = crypto.subtle
        .digest("SHA-256", bytes.slice(0))
        .then((b) =>
          Array.from(new Uint8Array(b), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join(""),
        );
      return decode.call(this, bytes, ...args).then(async (buffer) => {
        const id = hashIds[await hash];
        if (id) buffers.set(buffer, id);
        return buffer;
      });
    };
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (...args) {
      const node = create.apply(this, args),
        start = node.start;
      node.start = function (...params) {
        const id = buffers.get(node.buffer);
        if (id)
          window.__voicePlaybacks.push({
            id,
            duration: node.buffer.duration,
            at: performance.now(),
          });
        return start.apply(node, params);
      };
      return node;
    };
  },
  Object.fromEntries(clips.map((c) => [c.sha256, c.id])),
);
try {
  await page.goto(base + "/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator("#home-settings").click({ timeout: 60000 });
  await page
    .getByRole("button", { name: "サウンドテスト", exact: true })
    .click();
  for (const c of clips) {
    await page.getByLabel("試聴する音声").selectOption("voice:" + c.id);
    await page.waitForFunction(
      (id) => {
        const a = document.querySelector('audio[aria-label="音声試聴"]');
        return a?.dataset.track === "voice:" + id && a.ended && !a.error;
      },
      c.id,
      { timeout: 12000 },
    );
    const a = await page
      .getByLabel("音声試聴")
      .evaluate((a) => ({
        ended: a.ended,
        duration: a.duration,
        error: a.error?.code ?? null,
      }));
    assert(Math.abs(a.duration - c.seconds) < 0.001);
    const res = await page.request.get(
      base +
        "/assets/audio/voice-young-soldier-v1/" +
        c.id +
        ".wav?verify=" +
        Date.now(),
    );
    assert.equal(res.status(), 200);
    assert.equal(
      createHash("sha256")
        .update(await res.body())
        .digest("hex"),
      c.sha256,
    );
    previews.push({ id: c.id, ...a, shaMatched: true });
  }
  await page.screenshot({ path: out + "/public-sound-test.png" });
  fs.writeFileSync(
    out + "/public-previews.json",
    JSON.stringify({ previews, errors }, null, 2),
  );
  await page.goto(base + "/front", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator("#solo").click({ timeout: 60000 });
  await page.locator("#front-launch").click();
  await page.locator("[data-card]").first().click({ timeout: 60000 });
  await page
    .locator(".rebuild-selection")
    .waitFor({ state: "detached", timeout: 15000 });
  await page.screenshot({ path: out + "/public-before-firing.png" });
  for (let attempt = 0; attempt < 5; attempt++) {
    await page
      .locator("#look")
      .hover({ position: { x: 100, y: 100 }, timeout: 3000 });
    await page.mouse.down();
    await page.waitForTimeout(3500);
    await page.mouse.up();
    await page.keyboard.press("r");
    await page.waitForTimeout(2500);
    if ((await page.evaluate(() => window.__voicePlaybacks)).length) break;
  }
  const battle = await page.evaluate(() => ({
    voices: window.__voicePlaybacks,
    screen: document.body.dataset.screen,
    hud: document.querySelector("#hud")?.textContent,
  }));
  await page.screenshot({ path: out + "/public-battle.png" });
  assert(battle.voices.length > 0, JSON.stringify(battle));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const result = {
    at: new Date().toISOString(),
    base,
    platform: "Windows Chrome",
    viewport: { width: 844, height: 390 },
    pass: true,
    previews,
    battle,
    requests,
    errors,
    limitations:
      "通常ソロの有限確認、長時間戦闘と実スマホ性能は未確認。WebAudioの取得SHA/再生開始を観測する検証用計装のみ、配信コード変更なし",
  };
  fs.writeFileSync(
    out + "/public-browser.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      pass: true,
      previews: previews.length,
      battle: battle.voices,
      errors,
    }),
  );
} finally {
  await browser.close();
}
