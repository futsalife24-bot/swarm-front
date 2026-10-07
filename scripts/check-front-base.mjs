import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { recordMenuMotion } from "./menu-motion-recorder.mjs";
const origin = process.env.BASE_ORIGIN || "http://127.0.0.1:5186";
const out = process.env.BASE_OUTPUT || "dist-validation/base-decks";
const serviceWorkers =
  process.env.BASE_SERVICE_WORKERS === "allow" ? "allow" : "block";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
const recordings = [];
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
    [1220, 413],
  ]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion,
        serviceWorkers,
      });
      const errors = [];
      const consoleErrors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      if (serviceWorkers === "allow") {
        // 既存PWAの登録入口は従来版。新規の隔離コンテキストだけで確認する。
        await p.goto(origin + "/", { waitUntil: "domcontentloaded" });
        await p.locator("#home-tutorial").waitFor();
        await p.evaluate(async () => {
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) =>
              setTimeout(() => reject(Error("SW readiness timeout")), 60000),
            ),
          ]);
        });
      }
      await p.goto(origin + "/front.html", { waitUntil: "domcontentloaded" });
      await p.locator("#open-armory").click();
      await p.locator(".base-tile").first().waitFor();
      const stopVideo =
        process.env.BASE_RECORD_VIDEO === "1"
          ? await recordMenuMotion(
              p,
              `${out}/motion-${width}-${reducedMotion}.mp4`,
              width,
              height,
            )
          : async () => {};
      recordings.push(stopVideo);
      assert.equal(await p.locator(".base-tile").count(), 22);
      const active = await p.evaluate(() =>
        localStorage.getItem("swarm-front-upgrade-loadout-v1"),
      );
      await p.locator('[data-help="fuse"]').tap();
      assert.match(
        await p.locator("#base-detail").innerText(),
        /チェインノヴァ/,
      );
      const fusionRecipeBefore = await p.locator(".base-recipe").innerText();
      await p.locator('[data-pool="fuse"]').tap();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-pressed"),
        "false",
      );
      await p.locator("#base-name").fill("融合・爆発デッキ");
      await p.locator("#base-store").tap();
      assert.match(
        await p.locator("#front-pool-status").innerText(),
        /保存しました/,
      );
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-upgrade-loadout-v1"),
        ),
        active,
      );
      await p.locator("#base-fusions").tap();
      assert.equal(await p.locator(".base-tile").count(), 9);
      assert.match(await p.locator("#base-detail").innerText(), /最大段階/);
      await p.locator('[data-add-recipe="fusion-collapse"]').tap();
      assert.match(
        await p.locator(".base-recipe").innerText(),
        /素材2種を候補に選択済み/,
      );
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-upgrade-loadout-v1"),
        ),
        active,
      );
      await p.locator("#base-load").tap();
      await p.locator(".base-confirm [data-cancel]").tap();
      await p.locator("#base-load").tap();
      await p.locator(".base-confirm [data-confirm]").tap();
      await p.locator("#front-save-pool").tap();
      assert.match(
        await p.locator("#front-pool-status").innerText(),
        /セットしました/,
      );
      await p.locator("#base-upgrades").tap();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-pressed"),
        "false",
      );
      // 「?」の閲覧で選択・保存が変わらず、画像が読み込まれる。
      await p.locator('[data-help="fuse"]').tap();
      await p.screenshot({ path: `${out}/base-${width}-${reducedMotion}.png` });
      await p.locator("#base-fusions").tap();
      await p.screenshot({
        path: `${out}/fusion-${width}-${reducedMotion}.png`,
      });
      const metrics = await p.evaluate(() => {
        const box = (e) => {
          const r = e.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          panel: box(document.querySelector(".front-base")),
          grid: box(document.querySelector("#base-grid")),
          detail: box(document.querySelector("#base-detail")),
          actions: [
            ...document.querySelectorAll(
              ".base-header button,.base-deck-bar button",
            ),
          ].map(box),
          broken: [...document.images]
            .filter(
              (i) =>
                i.closest(".front-base") && (!i.complete || !i.naturalWidth),
            )
            .map((i) => i.src),
        };
      });
      assert.equal(metrics.overflow, false);
      assert.deepEqual(metrics.broken, []);
      assert.ok(
        metrics.actions.every(
          (r) => r.x >= 0 && r.right <= width && r.y >= 0 && r.bottom <= height,
        ),
      );
      assert.ok(metrics.grid.height >= 90 && metrics.detail.height >= 90);
      await stopVideo();
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.locator("#open-armory").click();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-pressed"),
        "false",
      );
      assert.match(
        await p.locator("#base-slot").innerText(),
        /融合・爆発デッキ/,
      );
      await p.locator("#base-back").tap();
      await p.locator("#coop").tap();
      const coop = await p.evaluate(() => ({
        screen: document.body.dataset.screen,
        panel: document
          .querySelector(".room-browser")
          .getBoundingClientRect()
          .toJSON(),
        browse: document
          .querySelector(".room-browse")
          .getBoundingClientRect()
          .toJSON(),
      }));
      assert.equal(coop.screen, "rooms");
      assert.ok(coop.panel.width > width * 0.8);
      assert.ok(coop.browse.width > 160);
      await p.screenshot({ path: `${out}/coop-${width}-${reducedMotion}.png` });
      assert.deepEqual(errors, []);
      assert.deepEqual(consoleErrors, []);
      const serviceWorkerControlled = await p.evaluate(
        () => !!navigator.serviceWorker.controller,
      );
      if (serviceWorkers === "allow")
        assert.equal(serviceWorkerControlled, true);
      results.push({
        width,
        height,
        reducedMotion,
        metrics,
        coop,
        errors,
        consoleErrors,
        serviceWorkerControlled,
        fusionRecipeBefore,
      });
      await p.close();
    }
  }
} finally {
  for (const stop of recordings) await stop();
  await browser.close();
  fs.writeFileSync(`${out}/base-checks.json`, JSON.stringify(results, null, 2));
}
console.log(
  `${results.length}条件: デッキ保存・反映・再読込、融合素材、タッチ相当、画面寸法、例外なし`,
);
