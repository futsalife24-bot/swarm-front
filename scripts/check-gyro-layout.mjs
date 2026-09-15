import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 915, height: 412 },
    hasTouch: true,
    isMobile: true,
  });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    Object.defineProperty(DeviceMotionEvent, "requestPermission", {
      value: async () => window.__permission ?? "granted",
    }),
  );
  await page.goto("http://127.0.0.1:5186");
  await page.locator("#home-settings").click();
  await page.locator("#gyro-sense").fill("2.5");
  await page.locator("#sense").fill("3");
  await page.locator("#fire-sense").fill("2");
  await page.evaluate(() => (window.__permission = "denied"));
  await page.locator("#gyro").click();
  assert.match(
    await page.locator("#gyro-status").innerText(),
    /許可されませんでした/,
  );
  assert.equal(
    await page.locator("#gyro").getAttribute("aria-checked"),
    "false",
  );
  await page.evaluate(() => (window.__permission = "granted"));
  await page.locator("#gyro").click();
  assert.equal(
    await page.locator("#gyro").getAttribute("aria-checked"),
    "true",
  );
  await page.reload();
  await page.locator("#home-settings").click();
  assert.equal(await page.locator("#gyro-sense").inputValue(), "2.5");
  await page.screenshot({ path: "dist-validation/gyro-layout-home.png" });
  await page.locator(".dialog-close").click();
  await page.locator("#solo").click();
  await page.locator("#launch").click();
  await page.locator("#pause").click();
  assert.equal(await page.locator("#pause-gyro-sense").inputValue(), "2.5");
  await page.locator("#pause-gyro-sense").fill("1.5");
  assert.equal(await page.locator("#pause-sense").inputValue(), "3");
  assert.equal(await page.locator("#pause-fire-sense").inputValue(), "2");
  const layouts = [];
  for (const size of [
    { width: 915, height: 412 },
    { width: 812, height: 375 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    const layout = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".pause-card .setting-row")];
      const controls = rows.map((r) => {
        const b = r
          .querySelector("input,select,button")
          .getBoundingClientRect();
        return { x: b.x, width: b.width };
      });
      const card = document.querySelector(".pause-card");
      return { controls, overflow: card.scrollWidth > card.clientWidth };
    });
    assert.ok(
      layout.controls.every((c) => Math.abs(c.x - layout.controls[0].x) < 1),
    );
    assert.ok(!layout.overflow);
    layouts.push({ size, ...layout });
    await page.screenshot({
      path: `dist-validation/gyro-layout-${size.width}.png`,
    });
  }
  await page.locator("#pause-leave").click();
  await page.locator("#pause-quit").click();
  // Exercise the actual Controls event handler in an isolated DOM, with exact timestamps.
  await page.goto("http://127.0.0.1:5186");
  const motion = await page.evaluate(async () => {
    const { Controls } = await import("/src/client/input.ts");
    const c = new Controls();
    c.enabled = true;
    c.gyroEnabled = true;
    c.gyroSensitivity = 2;
    let time = 1000;
    const emit = (alpha, beta, gamma = 0) => {
      const event = new DeviceMotionEvent("devicemotion", {
        rotationRate: { alpha, beta, gamma },
      });
      Object.defineProperty(event, "timeStamp", { value: (time += 20) });
      window.dispatchEvent(event);
    };
    const outcomes = [];
    for (const [angle, up, right] of [
      [0, [1, 0], [0, -1]],
      [90, [0, -1], [-1, 0]],
      [180, [-1, 0], [0, 1]],
      [270, [0, 1], [1, 0]],
    ]) {
      Object.defineProperty(screen.orientation, "angle", {
        configurable: true,
        value: angle,
      });
      emit(0, 0);
      for (const [r, u] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        c.input.yaw = 0;
        c.input.pitch = 0;
        emit((up[0] * u + right[0] * r) * 20, (up[1] * u + right[1] * r) * 20);
        outcomes.push({ angle, r, u, yaw: c.input.yaw, pitch: c.input.pitch });
      }
    }
    c.input.yaw = 0;
    c.input.pitch = 0;
    emit(0, 0, 100);
    const roll = { yaw: c.input.yaw, pitch: c.input.pitch };
    c.enabled = false;
    emit(100, 100);
    const paused = { yaw: c.input.yaw, pitch: c.input.pitch };
    c.enabled = true;
    c.gyroEnabled = false;
    emit(100, 100);
    const off = { yaw: c.input.yaw, pitch: c.input.pitch };
    return { outcomes, roll, paused, off };
  });
  for (const o of motion.outcomes) {
    assert.ok(
      Math.abs(o.yaw - (o.r * 0.8 * Math.PI) / 180) < 1e-8,
      JSON.stringify(o),
    );
    assert.ok(
      Math.abs(o.pitch - (o.u * 0.8 * Math.PI) / 180) < 1e-8,
      JSON.stringify(o),
    );
  }
  for (const key of ["roll", "paused", "off"])
    assert.deepEqual(motion[key], { yaw: 0, pitch: 0 });
  assert.deepEqual(errors, []);
  writeFileSync(
    "dist-validation/gyro-layout-check.json",
    JSON.stringify({ pass: true, layouts, motion, errors }, null, 2),
  );
  console.log(
    "PASS: layout 3 sizes, settings persistence/independence, permission, 32 actual Controls directions, roll/pause/off",
  );
  await page.goto("about:blank");
} finally {
  await browser.close();
}
