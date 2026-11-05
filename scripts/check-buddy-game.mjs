import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const origin = process.env.ORIGIN ?? "http://127.0.0.1:5196";
const lifecycleOnly = process.env.BUDDY_LIFECYCLE_ONLY === "1";
const out = lifecycleOnly
  ? "dist-validation/buddy-lifecycle"
  : "dist-validation/buddy-game";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  args: ["--use-angle=d3d11"],
});
const page = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
page.setDefaultTimeout(60000);
const errors = [];
const results = [];
page.on("pageerror", (e) => errors.push(e.message));
const tap = async (selector) => {
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator(selector).click();
};
const snapshot = () => page.evaluate(() => window.swarmBuddyReview.snapshot());
const tick = async (ms) => {
  await page.clock.runFor(ms);
  if (await page.locator("#pt-intro-skip").count()) {
    await page.clock.runFor(2000);
    await page.locator("#pt-intro-skip").click();
    await page.clock.runFor(100);
  }
};
try {
  // ゲームのperformance時計を初期化前から揃える。途中導入でdtが0になるのを避ける。
  await page.clock.install();
  await page.addInitScript(() =>
    localStorage.setItem("swarm-front-player-name-v1", "バディ検証"),
  );
  await page.goto(`${origin}/?buddyReview=1`, { timeout: 120000 });
  await page.locator(".title-entry-start").waitFor();
  await tap(".title-entry-start");
  await page.waitForFunction(() => !!window.swarmBuddyReview, {
    timeout: 120000,
  });
  await tap("#solo");
  await tap('[data-operation="advance"]');
  await tap("#pt-confirm");
  await page.locator("#pt-start").waitFor();
  await tap("#pt-start");
  await page
    .getByRole("button", { name: "タップで戦場へ" })
    .waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "タップで戦場へ" }).click();
  await page.locator("#pt-tutorial-skip").waitFor();
  await tap("#pt-tutorial-skip");
  await expect(page.locator("#controls")).toBeVisible({ timeout: 120000 });
  await page.locator(".operation-cue").waitFor({ state: "detached" });
  await page.clock.pauseAt(new Date(Date.now() + 200));
  console.log("進撃ソロ・出撃完了");
  await page.evaluate(() => (window.swarmBuddyReview.panel.hidden = true));
  for (const [width, height] of lifecycleOnly
    ? [[844, 390]]
    : [
        [844, 390],
        [640, 360],
      ]) {
    await page.setViewportSize({ width, height });
    for (const kind of lifecycleOnly
      ? ["none", "tatara"]
      : ["none", "tatara", "yosuga", "tobari", "oriha"]) {
      console.log(`${width} ${kind}`);
      await page.evaluate((k) => window.swarmBuddyReview.set(k), kind);
      await tick(100);
      if (kind !== "none") {
        await expect
          .poll(
            async () => {
              await tick(50);
              return (await snapshot()).entries[0]?.loaded;
            },
            { timeout: 30000 },
          )
          .toBe(true);
      }
      await page.screenshot({ path: `${out}/${width}-${kind}-auto.png` });
      results.push({ type: "solo", width, kind, snapshot: await snapshot() });
      if (kind === "none" || lifecycleOnly) continue;
      for (const clip of [
        "Idle",
        "Follow",
        "Display",
        ...(kind === "oriha" ? ["Coil"] : []),
      ]) {
        await page.evaluate(
          (c) => window.swarmBuddyReview.set(...c),
          [kind, clip],
        );
        await tick(800);
        const s = await snapshot();
        expect(s.entries[0].motion).toBe(
          kind === "tatara" && clip === "Display" ? "Palm" : clip,
        );
        expect(s.entries[0].visible).toBe(true);
        await page.screenshot({ path: `${out}/${width}-${kind}-${clip}.png` });
        results.push({ type: "clip", width, kind, clip, snapshot: s });
      }
    }
  }
  // 通常Controlsによる移動で自動Follow、停止後Idle。Worldは書き換えない。
  await page.evaluate(() => window.swarmBuddyReview.set("yosuga"));
  await tick(100);
  await expect
    .poll(async () => {
      await tick(50);
      return (await snapshot()).entries[0]?.loaded;
    })
    .toBe(true);
  await page.keyboard.down("KeyD");
  await tick(600);
  expect((await snapshot()).entries[0].motion).toBe("Follow");
  await page.keyboard.up("KeyD");
  await tick(1800);
  expect((await snapshot()).entries[0].motion).toBe("Idle");
  results.push({ type: "controls-follow-idle", snapshot: await snapshot() });
  await page.clock.resume();
  await tap("#pause");
  await tap("#pt-retire");
  await tap("#pt-confirm");
  await expect.poll(async () => (await snapshot()).entries.length).toBe(0);
  results.push({ type: "retire-clear", snapshot: await snapshot() });
  if (lifecycleOnly) {
    if (await page.locator("#pt-normal-reward").count())
      await tap("#pt-normal-reward");
    await tap("#pt-result-retry");
    await tap("#pt-start");
    await page.locator("#pt-enter").waitFor({ timeout: 120000 });
    await tap("#pt-enter");
    await expect
      .poll(
        async () => (await snapshot()).entries.filter((e) => e.loaded).length,
        { timeout: 60000 },
      )
      .toBe(1);
    results.push({ type: "new-run-reentry", snapshot: await snapshot() });
    await tap("#pause");
    await tap("#pt-retire");
    await tap("#pt-confirm");
    await expect.poll(async () => (await snapshot()).entries.length).toBe(0);
    results.push({ type: "second-retire-clear", snapshot: await snapshot() });
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ conditions: results.length, errors }));
} catch (e) {
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  console.log((await page.locator("body").innerText()).slice(0, 1200));
  throw e;
} finally {
  fs.writeFileSync(
    `${out}/results.json`,
    JSON.stringify({ browser: browser.version(), results, errors }, null, 2),
  );
  fs.writeFileSync(`${out}/errors.json`, JSON.stringify(errors, null, 2));
  await browser.close();
}
