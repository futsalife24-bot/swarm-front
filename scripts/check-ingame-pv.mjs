// Settings → 「PVを見る」 plays the in-game PV: source, bytes, size, duration and playback.
// Usage: PV_ORIGIN=http://127.0.0.1:5402 PV_OUT=docs/evidence/<dir> node scripts/check-ingame-pv.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const origin = process.env.PV_ORIGIN || "http://127.0.0.1:5402";
const out = process.env.PV_OUT || "docs/evidence/ingame-pv-v13-20261019";
const label = process.env.PV_LABEL || "local";
const expected = createHash("sha256")
  .update(fs.readFileSync("public/assets/video/swarm-front-pv-v13.mp4"))
  .digest("hex");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
const errors = [];
const requests = [];
page.on("response", (r) => {
  if (r.url().includes("/assets/video/"))
    requests.push({ url: r.url(), status: r.status() });
});
// The player plays one complete Blob: hash exactly what it holds.
const fetchedFile = () =>
  page.evaluate(async () => {
    const v = document.querySelector('video[aria-label="SWARM FRONT PV"]');
    const bytes = await (await fetch(v.currentSrc)).arrayBuffer();
    const sha = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    return {
      blob: v.currentSrc.startsWith("blob:"),
      bytes: bytes.byteLength,
      sha256: sha,
    };
  });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => e.type() === "error" && errors.push(e.text()));
try {
  await page.goto(origin + "/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  // The title screen comes first.
  const start = page.locator(".title-entry-start");
  await start.waitFor({ timeout: 60000 }).catch(() => {});
  if (await start.isVisible()) await start.click();
  await page.locator("#home-settings").click({ timeout: 60000 });
  // A click during the settings dialog's opening motion is swallowed.
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "PVを見る", exact: true }).click();
  const video = page.locator('video[aria-label="SWARM FRONT PV"]');
  await page.waitForFunction(
    () =>
      (document.querySelector('video[aria-label="SWARM FRONT PV"]')
        ?.readyState ?? 0) >= 1,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500); // the PV dialog's opening motion, likewise
  await page.locator(".pv-dialog [data-play]").click();
  await page
    .waitForFunction(
      () =>
        (document.querySelector('video[aria-label="SWARM FRONT PV"]')
          ?.currentTime ?? 0) > 1.5,
      null,
      { timeout: 30000 },
    )
    .catch(async (e) => {
      const why = await page.evaluate(() => {
        const v = document.querySelector('video[aria-label="SWARM FRONT PV"]');
        return {
          status: document.querySelector(".pv-dialog .media-status")
            ?.textContent,
          paused: v?.paused,
          t: v?.currentTime,
          rs: v?.readyState,
        };
      });
      throw new Error(
        `playback did not advance: ${JSON.stringify(why)} ${e.message}`,
      );
    });
  const meta = await video.evaluate((v) => ({
    track: v.dataset.track,
    width: v.videoWidth,
    height: v.videoHeight,
    duration: v.duration,
    currentTime: v.currentTime,
    paused: v.paused,
    error: v.error?.code ?? null,
  }));
  const file = await fetchedFile();
  await page.screenshot({
    path: path.join(out, `${label}-844x390.jpg`),
    type: "jpeg",
    quality: 85,
  });
  const result = {
    at: new Date().toISOString(),
    origin,
    ...meta,
    requests,
    file,
    expectedSha256: expected,
    errors,
  };
  assert.equal(meta.track, "pv-v13");
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1080);
  assert.ok(Math.abs(meta.duration - 30) < 0.1);
  assert.equal(meta.error, null);
  assert.ok(
    requests.some(
      (r) =>
        r.status === 200 &&
        r.url.endsWith("/assets/video/swarm-front-pv-v13.mp4"),
    ),
  );
  assert.ok(!requests.some((r) => r.url.includes("pv-v10")));
  assert.equal(file.sha256, expected);
  result.pass = true;
  fs.writeFileSync(
    path.join(out, `${label}.json`),
    JSON.stringify(result, null, 1),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
