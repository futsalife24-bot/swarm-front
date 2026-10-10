import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = "https://swarm-front.melosalife-24.workers.dev";
const out = "dist-validation/menu-polish-release";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ])
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion,
        serviceWorkers: "allow",
      });
      const p = await context.newPage(),
        errors = [],
        consoleErrors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      // The legacy entry registers the existing PWA worker; /front alone does not.
      await p.goto(base + "/");
      await p.locator("#home-tutorial").waitFor();
      await p.evaluate(async () => {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(Error("SW readiness timeout")), 60000),
          ),
        ]);
      });
      await p.goto(base + "/front");
      await p.locator("#home-tutorial").click();
      await p.locator("#front-dialog-back").waitFor();
      assert.equal(
        await p.locator("#front-dialog-back .menu-fx-layer").count(),
        0,
      );
      await p.screenshot({
        path: `${out}/public-${width}-${reducedMotion}-guide.png`,
      });
      await p.locator("#front-dialog-back").click();
      await p.locator("#solo").click();
      const before = await p.locator('[data-front-slot="0"] b').innerText();
      const storageBefore = await p.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      );
      await p.locator("[data-front-weapon-row]").nth(2).click();
      assert.notEqual(
        await p.locator('[data-front-slot="0"] b').innerText(),
        before,
      );
      assert.equal(await p.locator(".menu-fx-equip,.menu-fx-trace").count(), 0);
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-shared-progress-v3"),
        ),
        storageBefore,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await p.screenshot({
        path: `${out}/public-${width}-${reducedMotion}-prep.png`,
      });
      await p.goto(base + "/");
      await p.locator("#home-settings").click();
      await p.locator("[data-sound-test]").click();
      await p.waitForFunction(
        () =>
          document
            .querySelector(".media-dialog audio")
            ?.src.startsWith("blob:"),
        {},
        { timeout: 60000 },
      );
      await p.locator("[data-play]").click();
      await p.waitForFunction(
        () =>
          !document.querySelector(".media-dialog audio").paused &&
          !document.querySelector(".media-playing-light").hidden,
      );
      assert.equal(await p.locator(".media-playing-light i").count(), 3);
      const meterAnimations = await p
        .locator(".media-playing-light")
        .evaluate(
          (e) =>
            e
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        );
      assert.equal(meterAnimations, reducedMotion === "reduce" ? 0 : 3);
      await p.screenshot({
        path: `${out}/public-${width}-${reducedMotion}-meter.png`,
      });
      await p.locator("[data-pause]").click();
      await p.locator(".media-playing-light").waitFor({ state: "hidden" });
      await p.locator(".media-dialog .dialog-close").click();
      await p.locator(".media-dialog").waitFor({ state: "detached" });
      await p.locator("dialog[open] .dialog-close").click();
      await p.waitForFunction(
        () => !document.querySelector(".menu-fx-layer:not(.menu-fx-terrain)"),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(consoleErrors, []);
      results.push({
        width,
        height,
        reducedMotion,
        serviceWorkerControlled: await p.evaluate(
          () => !!navigator.serviceWorker.controller,
        ),
        frontDraftCue: 0,
        meterAnimations,
        errors,
        consoleErrors,
      });
      await context.close();
    }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/public-ui.json`, JSON.stringify(results, null, 2));
}
console.log(
  JSON.stringify({
    pass: true,
    cases: results.length,
    errors: 0,
    consoleErrors: 0,
  }),
);
