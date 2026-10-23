import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const origin = new URL(process.argv[2]);
assert.ok(
  origin.protocol === "https:" &&
    /^swarm-front-orientation-mock\.[a-z0-9-]+\.workers\.dev$/.test(
      origin.hostname,
    ),
);
const out = "dist-validation/orientation-live";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage(),
    errors = [],
    forbidden = [],
    failed = [],
    sockets = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on("websocket", (s) => sockets.push(s.url()));
  await page.route("**/*", (route) => {
    const r = route.request(),
      url = new URL(r.url());
    if (
      url.origin === origin.origin &&
      ["GET", "HEAD"].includes(r.method()) &&
      !/^\/api(?:\/|$)/.test(url.pathname)
    )
      return route.continue();
    forbidden.push(`${r.method()} ${r.url()}`);
    return route.abort();
  });
  const state = () => page.evaluate(() => window.__orientationMock);
  await page.goto(origin.href);
  await expect(page.locator("#mock-catalog")).toBeVisible();
  await page.screenshot({ path: `${out}/home-390.png` });
  await page.locator("#mock-catalog").click();
  await page.locator('[data-scene="battle-training"]').click();
  await expect
    .poll(async () => (await state()).battle.loaded, { timeout: 60000 })
    .toBe(true);
  const before = (await state()).battle;
  const cdp = await context.newCDPSession(page),
    fire = await page.locator("#fire").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 },
    ],
  });
  await expect
    .poll(async () => (await state()).battle.enemyHp, { timeout: 20000 })
    .toBeLessThan(before.enemyHp);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await state()).battle.touches).toBe(0);
  await expect.poll(async () => (await state()).battle.fov).toBe(65);
  const after = (await state()).battle;
  assert.equal(after.run, before.run);
  assert.equal(after.input.fire, false);
  assert.equal(after.queued, 0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.screenshot({ path: `${out}/training-844.png` });
  await page.locator("#pause").click();
  await page.locator("[data-menu-layout]").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#layout-mode")).toContainText("縦");
  await page.locator("#layout-opacity").press("Home");
  await page.locator("#layout-save").click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("swarm-front-orientation-mock-v1:layout-portrait"),
  );
  assert.ok(saved.includes('"opacity":0.4'));
  await page.screenshot({ path: `${out}/layout-390.png` });
  await page.locator("#layout-back").click();
  if (await page.locator("[data-discard]").isVisible())
    await page.locator("[data-discard]").click();
  await page.locator("#mock-catalog").click();
  await page.locator('[data-scene="battle-boss"]').click();
  await expect
    .poll(async () => (await state()).battle.enemyModels, { timeout: 60000 })
    .toContain("harrow");
  await page.screenshot({ path: `${out}/boss-390.png` });
  const storage = await page.evaluate(async () => ({
    keys: Object.keys(localStorage),
    sw: (await navigator.serviceWorker.getRegistrations()).length,
    cache: await caches.keys(),
  }));
  assert.ok(
    storage.keys.every((k) => k.startsWith("swarm-front-orientation-mock-v1:")),
  );
  assert.equal(storage.sw, 0);
  assert.deepEqual(storage.cache, []);
  assert.deepEqual(
    { errors, forbidden, failed, sockets },
    { errors: [], forbidden: [], failed: [], sockets: [] },
  );
  writeFileSync(
    `${out}/live.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        origin: origin.origin,
        before,
        after,
        saved,
        storage,
        errors,
        forbidden,
        failed,
        sockets,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      origin: origin.origin,
      checks:
        "published menus, real fire, rotation cancellation, saved portrait layout, loaded boss",
      errors: 0,
    }),
  );
} finally {
  await browser.close();
}
