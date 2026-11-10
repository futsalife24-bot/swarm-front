import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

const site = process.env.REPORT_SITE || "http://127.0.0.1:5208";
const output = "dist-validation/catena-report-20261111";
// A fresh browser context uses only a specimen encounter record. This save
// mirrors freshProgress("normal") and never touches the user's browser data.
const inventory = ["rifle", "shotgun", "rocket"].map((kind, acquired) => ({
  id: `v2-starter-${kind}`,
  kind,
  rarity: 0,
  power: 1,
  effect: "none",
  format: 2,
  variance: { power: 0, reload: 0, range: 0, rate: 0 },
  testData: false,
  acquired,
}));
const save = {
  version: 2,
  mode: "normal",
  inventory,
  pending: [],
  locks: [],
  soldiers: [
    {
      id: "standard",
      name: "STANDARD TROOPER",
      levels: { hp: 0, aim: 0, move: 0, swap: 0 },
      equipped: inventory.slice(0, 2).map((weapon) => weapon.id),
    },
  ],
  selectedSoldier: "standard",
  unlocked: [],
  materials: 0,
  points: 0,
  coins: 0,
  powder: 0,
  accessories: [],
  missions: {},
  branch: false,
  encounters: { worm: "solo" },
  tutorials: [],
  receipts: [],
  serial: 3,
};
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const checks = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    await context.addInitScript((value) => {
      localStorage.setItem(
        "swarm-front-shared-progress-v3",
        JSON.stringify(value),
      );
    }, save);
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.name));
    try {
      await page.goto(`${site}/front.html`, {
        waitUntil: "domcontentloaded",
      });
      await page.locator(".title-entry-start").click();
      await page.locator(".title-entry").waitFor({ state: "detached" });
      await page.locator("#open-bestiary").click();
      const dialog = page.getByRole("dialog");
      await dialog.locator('[data-enemy="worm"]').waitFor();
      await page.waitForTimeout(750);
      await dialog.locator('[data-enemy="worm"]').click();
      const viewport = dialog.locator(".enemy-viewport");
      assert.equal(
        await dialog
          .locator('[data-enemy="worm"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await viewport
        .locator("canvas")
        .waitFor({ state: "attached", timeout: 8000 })
        .catch(async () => {
          console.error(
            JSON.stringify({
              asset: await viewport.getAttribute("data-asset"),
              article: await dialog.locator("article").innerText(),
              errors,
            }),
          );
          throw new Error("3D canvas was not attached");
        });
      await page.waitForFunction(
        () =>
          document.querySelector(".enemy-viewport")?.dataset.asset === "ready",
      );
      const description = await dialog.locator("article").innerText();
      assert.match(description, /十四|14/);
      assert.match(description, /跳/);
      const box = await viewport.boundingBox();
      assert.ok(box && box.width > 100 && box.height > 100);
      await page.waitForTimeout(1200);
      await viewport.screenshot({ path: `${output}/idle-${width}.png` });
      await dialog.locator('[data-motion="attack"]').click();
      assert.equal(await viewport.getAttribute("data-motion"), "attack");
      // Wall time is not simulation time if animation frames are slow. Keep a
      // short sequence and classify warning, flight and landing from pixels.
      const started = Date.now();
      for (const second of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
        await page.waitForTimeout(
          Math.max(0, started + second * 1000 - Date.now()),
        );
        await viewport.screenshot({
          path: `${output}/attack-${width}-${second}.png`,
        });
      }
      let film;
      if (width === 1280) {
        await dialog.locator(".report-film-open").click();
        const movie = page.locator("dialog.report-film-dialog video");
        await page.waitForFunction(
          () =>
            (document.querySelector("dialog.report-film-dialog video")
              ?.readyState ?? 0) >= 2,
          null,
          { timeout: 30000 },
        );
        film = await movie.evaluate((video) => ({
          duration: video.duration,
          source: video.dataset.source,
        }));
        assert.ok(film.duration >= 10 && film.duration <= 12);
        assert.match(film.source, /worm-20261111\.mp4\?v=c712e47513cc/);
        await page.waitForFunction(
          () =>
            (document.querySelector("dialog.report-film-dialog video")
              ?.currentTime ?? 0) > 0.5,
          null,
          { timeout: 8000 },
        );
        await page.locator("dialog.report-film-dialog").screenshot({
          path: `${output}/film-${width}.png`,
        });
      }
      assert.deepEqual(errors, []);
      checks.push({
        width,
        height,
        asset: "ready",
        motion: "attack",
        box,
        film,
        errors,
      });
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    `${output}/checks.json`,
    JSON.stringify({ site, checks }, null, 2),
  );
  console.log(JSON.stringify({ site, checks }));
} finally {
  await browser.close();
}
