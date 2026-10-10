import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const origin = process.env.VOICE_ORIGIN || "http://127.0.0.1:5358";
const out =
  process.env.VOICE_OUTPUT ||
  "assets-src/voice-soldier-v2/young-soldier/browser-verification.json";
const expected = JSON.parse(
  fs.readFileSync(
    "assets-src/voice-soldier-v2/young-soldier/manifest.json",
    "utf8",
  ),
).clips;
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const errors = [];
const fetched = new Map();
page.on("response", (response) => {
  if (response.url().includes("/assets/audio/voice-young-soldier-v1/"))
    fetched.set(
      response.url(),
      response
        .body()
        .then((bytes) => ({
          status: response.status(),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        })),
    );
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") errors.push(e.text());
});
const results = [];
try {
  await page.goto(origin + "/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator("#home-settings").click({ timeout: 60000 });
  await page
    .getByRole("button", { name: "サウンドテスト", exact: true })
    .click();
  const select = page.getByLabel("試聴する音声");
  const media = page.getByLabel("音声試聴");
  assert.equal(
    await select.locator('optgroup[label="兵士ボイス"] option').count(),
    11,
  );
  for (const clip of expected) {
    await select.selectOption("voice:" + clip.id);
    await page.waitForFunction(
      (id) => {
        const a = document.querySelector('audio[aria-label="音声試聴"]');
        return a?.dataset.track === "voice:" + id && a.ended && !a.error;
      },
      clip.id,
      { timeout: 12000 },
    );
    const result = await media.evaluate((a) => ({
      src: a.currentSrc,
      duration: a.duration,
      currentTime: a.currentTime,
      ended: a.ended,
      error: a.error?.code ?? null,
    }));
    const source =
      origin + "/assets/audio/voice-young-soldier-v1/" + clip.id + ".wav";
    const observed = await fetched.get(source);
    assert.equal(observed?.status, 200);
    const delivered = await page.request.get(source + "?verify=" + Date.now());
    const network = {
      status: delivered.status(),
      sha256: createHash("sha256")
        .update(await delivered.body())
        .digest("hex"),
    };
    assert.equal(network.status, 200);
    assert.equal(network.sha256, clip.sha256);
    assert(Math.abs(result.duration - clip.seconds) < 0.001);
    results.push({ id: clip.id, source, network, ...result });
  }
  await page.screenshot({ path: out.replace(/\.json$/, ".png") });
  await page.goto(origin + "/front", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.locator("#home-settings").click({ timeout: 60000 });
  // Battle playback uses the real Sound/WebAudio implementation and actual world events.
  const battle = await page.evaluate(async () => {
    const { Sound } = await import("/src/client/audio.ts");
    const { createWorld, addPlayer, start } =
      await import("/src/shared/game.ts");
    const { STARTERS } = await import("/src/shared/defs.ts");
    const sound = new Sound();
    await sound.preload();
    await sound.unlock();
    await sound.decoding;
    const w = createWorld("young-voice-check");
    const p = addPlayer(
      w,
      "voice-player",
      structuredClone(STARTERS.slice(0, 2)),
    );
    start(w);
    w.enemies = [];
    sound.update(w, p.id, 0, true);
    w.time = 3;
    // Approaching warnings are deterministic; attack callouts intentionally have a 15% lottery.
    w.enemies.push({
      id: 999999,
      kind: "boss",
      hp: 100,
      active: true,
      x: p.x,
      z: p.z,
    });
    sound.update(w, p.id, 0, true);
    const speech = sound.speech;
    const loaded = [...sound.buffers.keys()].filter((k) =>
      k.startsWith("voice:"),
    );
    const result = {
      loaded,
      activeSpeech: !!speech,
      duration: speech?.buffer?.duration,
      contextState: sound.context?.state,
    };
    sound.stop();
    result.stopped = !sound.speech;
    return result;
  });
  assert.equal(battle.loaded.length, 11);
  assert.equal(battle.activeSpeech, true);
  assert.equal(battle.contextState, "running");
  assert.equal(battle.stopped, true);
  const analyticsCors = errors.some(
    (e) =>
      e.includes(
        "project-hub.melosalife-24.workers.dev/api/analytics/collect/swarm-front",
      ) && e.includes("CORS"),
  );
  const unexpectedErrors = errors.filter(
    (e) =>
      !(
        analyticsCors &&
        (e.includes(
          "project-hub.melosalife-24.workers.dev/api/analytics/collect/swarm-front",
        ) ||
          e === "Failed to load resource: net::ERR_FAILED")
      ),
  );
  assert.equal(unexpectedErrors.length, 0, JSON.stringify(errors));
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        origin,
        platform: "Windows Chrome",
        pass: true,
        soundTest: results,
        battleFixture: battle,
        errors,
        limitations:
          "実Sound/WebAudioと実worldイベントの有限確認。人の聴感・全戦闘・実機性能の保証ではない",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ pass: true, clips: results.length, battle, errors }),
  );
} finally {
  await browser.close();
}
