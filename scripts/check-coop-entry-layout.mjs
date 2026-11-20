import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const site =
  process.env.COOP_SITE ?? "https://swarm-front.melosalife-24.workers.dev";
const out = process.env.COOP_OUTPUT ?? "dist-validation/coop-ui-tidy";
const before = process.env.COOP_BEFORE === "1";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const width of [1280, 844]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1280 ? 720 : 390 },
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "画面確認"),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(site + "/front.html?coop=1");
    await page.waitForFunction(
      () =>
        document.querySelector(".title-entry-start") ||
        document.querySelector("#room-id"),
    );
    if (await page.locator(".title-entry-start").isVisible())
      await page.locator(".title-entry-start").click();
    await page.locator("#room-id").waitFor();
    // Preview the candidate stylesheet against the real, unmodified published widget.
    if (process.env.COOP_PREVIEW === "1")
      await page.addStyleTag({
        content: readFileSync("src/client/coop-lobby.css", "utf8"),
      });
    await page.waitForTimeout(4000);
    for (const access of ["private", "public"]) {
      await page.locator(`[data-room-access="${access}"]`).click();
      await page.waitForTimeout(1200);
      const measure = await page.evaluate(() => {
        const rect = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
          };
        };
        const overflow = [
          ...document.querySelectorAll(
            "#ui, .room-browser, .room-create, .room-create-fields",
          ),
        ].map((e) => ({
          selector: e.id || e.className,
          x: e.scrollWidth - e.clientWidth,
          y: e.scrollHeight - e.clientHeight,
        }));
        return {
          overflow,
          panel: rect(".room-browser"),
          create: rect("#launch"),
          join: rect("#room-join"),
          name: rect("#room-name"),
          id: rect("#room-id"),
          title: rect(".room-create h2"),
          browseTitle: rect("#room-browse-title"),
          advanced: rect(".coop-advanced"),
          widget: rect("#turnstile-room-create"),
          iframe: !!document.querySelector("#turnstile-room-create iframe"),
          widgetText: document.querySelector("#turnstile-room-create")
            .textContent,
          viewport: { width: innerWidth, height: innerHeight },
        };
      });
      results.push({ width, access, ...measure, errors });
      const filename = before
        ? `before-${width}-${access}.png`
        : `after-${width}-${access}.png`;
      await page.screenshot({ path: out + "/" + filename });
      if (!before) {
        assert(
          measure.overflow.every((o) => o.x <= 1 && o.y <= 1),
          JSON.stringify(measure.overflow),
        );
        assert(measure.advanced.bottom <= measure.viewport.height);
        assert(
          measure.create.bottom <= measure.advanced.y,
          "作成ボタンと開発用設定が重ならない",
        );
        assert(
          measure.widget.bottom <= measure.create.y,
          "認証欄と作成ボタンが重ならない",
        );
        assert(Math.abs(measure.title.y - measure.browseTitle.y) <= 1);
        if (access === "private") {
          assert(Math.abs(measure.name.y - measure.id.y) <= 1);
          assert(Math.abs(measure.name.width - measure.id.width) <= 1);
          assert(Math.abs(measure.create.y - measure.join.y) <= 1);
          assert(Math.abs(measure.create.height - measure.join.height) <= 1);
        }
        assert.deepEqual(errors, []);
      }
    }
    await context.close();
  }
} finally {
  writeFileSync(out + "/measurements.json", JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map(({ width, access, overflow, iframe }) => ({
      width,
      access,
      overflow,
      iframe,
    })),
  ),
);
