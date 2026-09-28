import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "dist-validation/boss-names";
mkdirSync(out, { recursive: true });
const { createServer } = await import("vite");
const server = await createServer({ server: { port: 5359 } });
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [844, 390],
    [667, 300],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      serviceWorkers: "block",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/src/client/playtest-app.ts*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body:
          (await response.text()) +
          "\nwindow.__setEncounters=e=>{if(!save){save=initializeProgress(mode);home();}save.encounters=e;};",
      });
    });
    await page.goto("http://127.0.0.1:5359");
    await page.locator("#open-bestiary").waitFor();
    for (const encounters of [
      { boss: "solo", worm: "solo" },
      { boss: "solo" },
      { worm: "solo" },
      { boss: "coop", worm: "solo" },
      { boss: "solo", worm: "coop" },
      {},
    ]) {
      await page.evaluate((e) => window.__setEncounters(e), encounters);
      await page.locator("#open-bestiary").click();
      const dialog = page.locator("dialog.bestiary[open]");
      assert.equal(await dialog.locator("[data-enemy]").count(), 9);
      assert.match(
        await dialog.locator("nav .report-scroll-guide").innerText(),
        /^9種/,
      );
      assert.equal(await dialog.locator("[data-worm]").count(), 0);
      for (const key of ["boss", "worm"]) {
        const expected = key === "boss" ? "FOUNDRY ZERO" : "CATENA",
          state = encounters[key];
        const row = dialog.locator(`[data-enemy="${key}"]`);
        assert.equal(
          await row.locator("strong").innerText(),
          state === "solo" ? expected : "？？？",
        );
        await row.click();
        assert.equal(await row.getAttribute("aria-pressed"), "true");
        assert.equal(
          await dialog.locator("article h3").innerText(),
          state === "solo" ? expected : "？？？",
        );
        assert.equal(
          await dialog.locator("article h4").count(),
          state === "solo" ? 2 : 0,
        );
        if (state) {
          await page.waitForFunction(
            () =>
              document.querySelector(".enemy-viewport")?.dataset.asset ===
              "ready",
            {},
            { timeout: 60000 },
          );
          assert.equal(
            await dialog
              .locator(".enemy-viewport")
              .evaluate((e) => e.style.filter),
            state === "coop" ? "brightness(0)" : "",
          );
        } else
          assert.equal(
            await dialog.locator(".enemy-viewport").getAttribute("data-asset"),
            "locked",
          );
        if (encounters.boss === "solo" && encounters.worm === "solo") {
          await dialog.locator('[data-motion="attack"]').click();
          assert.equal(
            await dialog.locator(".enemy-viewport").getAttribute("data-motion"),
            "attack",
          );
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${out}/${key}-${width}.png` });
          await dialog.locator(".report-film-open").click();
          assert.equal(
            await page.locator("#report-film-title").innerText(),
            `${expected} — 会敵ムービー`,
          );
          assert.ok(
            (
              await page
                .locator(".report-film-dialog video")
                .getAttribute("data-source")
            ).endsWith(`/${key}.mp4`),
          );
          await page.locator(".report-film-dialog").evaluate((e) => e.close());
        }
        const fit = await dialog.evaluate((e) => {
          const r = e.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            client: e.clientWidth,
            scroll: e.scrollWidth,
          };
        });
        assert.ok(
          fit.top >= -1 &&
            fit.bottom <= height + 1 &&
            fit.scroll <= fit.client + 1,
          JSON.stringify(fit),
        );
        results.push({
          width,
          height,
          key,
          state: state ?? "unseen",
          name: state === "solo" ? expected : "？？？",
          fit,
        });
      }
      await dialog.locator("#report-close").click();
      await page.locator("dialog.bestiary").waitFor({ state: "detached" });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  writeFileSync(
    `${out}/ui-results.json`,
    JSON.stringify({ results, errors: [] }, null, 2),
  );
  console.log(
    `PASS ${results.length} report cases; separate models, access, motion, film names and horizontal layout`,
  );
} finally {
  await browser.close();
  await server.close();
}
