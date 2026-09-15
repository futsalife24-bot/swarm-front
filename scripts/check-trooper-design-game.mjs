import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://127.0.0.1:5314",
  label = base.includes("5314") ? "dev" : "built";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const results = [];
  for (const [width, height] of [
    [844, 390],
    [1280, 720],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height },
        serviceWorkers: "block",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (
        m.text().includes("Standard Trooper unavailable") ||
        m.text().includes("mergeGeometries() failed")
      )
        errors.push(m.text());
    });
    await page.clock.install();
    await page.goto(base);
    await page.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await page.locator("#launch").click();
    if (label === "dev")
      await page.waitForFunction(() => window.__swarm?.trooper?.loaded, null, {
        timeout: 90000,
      });
    else await page.waitForTimeout(2500);
    // A generous future deadline avoids remote control latency racing pauseAt.
    await page.clock.pauseAt(
      new Date((await page.evaluate(() => Date.now())) + 3000),
    );
    await page.screenshot({
      path: `dist-validation/trooper-design/${label}-${width}-idle.png`,
    });
    const ammo = async () =>
      parseInt(await page.locator(".ammo-line b").innerText());
    const startAmmo = await ammo();
    await page.keyboard.down("KeyW");
    await page.clock.runFor(220);
    await page.keyboard.up("KeyW");
    await page.clock.runFor(200);
    await page.mouse.move(width * 0.5, height * 0.5);
    await page.mouse.down();
    await page.clock.runFor(190);
    await page.mouse.up();
    const firstAmmo = await ammo();
    assert.ok(firstAmmo < startAmmo);
    await page.keyboard.press("KeyR");
    await page.clock.runFor(180);
    await page.screenshot({
      path: `dist-validation/trooper-design/${label}-${width}-reload.png`,
    });
    await page.clock.runFor(2200);
    await page.keyboard.press("KeyQ");
    await page.clock.runFor(150);
    await page.screenshot({
      path: `dist-validation/trooper-design/${label}-${width}-switch.png`,
    });
    await page.clock.runFor(500);
    const secondStart = await ammo();
    await page.mouse.down();
    await page.clock.runFor(190);
    await page.mouse.up();
    const secondAmmo = await ammo();
    assert.ok(secondAmmo < secondStart);
    await page.keyboard.down("KeyD");
    await page.keyboard.press("Space");
    await page.clock.runFor(150);
    await page.screenshot({
      path: `dist-validation/trooper-design/${label}-${width}-roll.png`,
    });
    await page.clock.runFor(300);
    await page.keyboard.up("KeyD");
    await page.screenshot({
      path: `dist-validation/trooper-design/${label}-${width}-recovered.png`,
    });
    const debug =
      label === "dev"
        ? await page.evaluate(() => ({
            trooper: __swarm.trooper,
            p: __swarm.world.players[0],
          }))
        : null;
    if (debug) {
      assert.equal(debug.trooper.bones, 57);
      assert.equal(debug.p.evade, 0);
      assert.equal(debug.trooper.weapons[1], "RightHandWeaponSocket");
    }
    assert.deepEqual(errors, []);
    results.push({
      width,
      height,
      startAmmo,
      firstAmmo,
      secondStart,
      secondAmmo,
      debug,
      errors,
    });
    writeFileSync(
      `dist-validation/trooper-design/${label}-game-checks.json`,
      JSON.stringify(results, null, 2),
    );
    console.log("PASS", label, width);
    await page.close();
  }
  writeFileSync(
    `dist-validation/trooper-design/${label}-game-checks.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(
    "PASS",
    label,
    "two landscape sizes: movement, fire, reload, switch, dodge and recovery",
  );
} finally {
  await browser.close();
}
