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
      const imageReadiness = [];
      const waitForBaseImages = async (stage) => {
        const pending = await p
          .locator(".front-base img")
          .evaluateAll((images) =>
            images.filter((image) => !image.complete).map((image) => image.src),
          );
        const started = Date.now();
        await p.waitForFunction(() =>
          [...document.querySelectorAll(".front-base img")].every(
            (image) => image.complete,
          ),
        );
        imageReadiness.push({ stage, pending, waitedMs: Date.now() - started });
      };
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("requestfailed", (r) =>
        console.error("通信失敗", r.url(), r.failure()?.errorText),
      );
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
      // この既存検査は発見済みのレシピでデッキ編集を検証。未発見はcheck-fusion-discoveryで確認。
      await p.evaluate(() =>
        localStorage.setItem(
          "swarm-front-fusion-discovery-v1",
          JSON.stringify({
            version: 1,
            ids: [
              "fusion-collapse",
              "fusion-skewer",
              "fusion-counter",
              "fusion-bastion",
              "fusion-magazine",
              "fusion-overdrive",
              "fusion-aegis",
              "fusion-collector",
              "fusion-reactor",
            ],
          }),
        ),
      );
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
      assert.equal(await p.locator("[data-help],.base-help").count(), 0);
      assert.equal(await p.locator('#base-grid [role="checkbox"]').count(), 22);
      const initialStorage = await p.evaluate(() =>
        localStorage.getItem("swarm-front-upgrade-loadout-v1"),
      );
      const selection = () =>
        p
          .locator("[data-pool]")
          .evaluateAll((es) =>
            es.map((e) => [e.dataset.pool, e.getAttribute("aria-checked")]),
          );
      const beforeInspect = await selection();
      // アイコン・名前・系統・余白は閲覧だけ。チェックの上下にも切替領域を広げない。
      for (const selector of [
        '[data-inspect="fuse"] > :is(img,.front-atlas-icon)',
        '[data-inspect="fuse"] strong',
        '[data-inspect="fuse"] small',
      ]) {
        await p.locator(selector).tap();
        assert.match(await p.locator("#base-detail-name").innerText(), /導火/);
        assert.deepEqual(await selection(), beforeInspect);
      }
      const inspectBox = await p.locator('[data-inspect="fuse"]').boundingBox();
      await p.touchscreen.tap(
        inspectBox.x + inspectBox.width - 2,
        inspectBox.y + inspectBox.height - 2,
      );
      const checkBox = await p.locator('[data-pool="fuse"]').boundingBox();
      assert.equal(checkBox.width, 20);
      assert.equal(checkBox.height, 20);
      await p.touchscreen.tap(checkBox.x + checkBox.width / 2, checkBox.y - 4);
      assert.deepEqual(
        await selection(),
        beforeInspect,
        "チェック枠の上の余白は閲覧のみ",
      );
      await p.touchscreen.tap(
        checkBox.x + checkBox.width / 2,
        checkBox.y + checkBox.height + 4,
      );
      await p.locator('[data-inspect="fuse"]').focus();
      await p.keyboard.press("Space");
      await p.keyboard.press("Enter");
      assert.deepEqual(await selection(), beforeInspect);
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-upgrade-loadout-v1"),
        ),
        initialStorage,
      );
      await p.locator("#base-back").tap();
      await p.screenshot({
        path: `${out}/inspect-return-${width}-${reducedMotion}.png`,
      });
      assert.equal(
        await p.locator(".base-confirm").count(),
        0,
        String(await p.locator("#front-pool-status").allTextContents()),
      );
      await p.locator("#open-armory").waitFor();
      assert.equal(await p.locator(".base-confirm").count(), 0);
      await p.locator("#open-armory").tap();
      await p.locator('[data-pool="fuse"]').focus();
      assert.match(await p.locator("#base-detail-name").innerText(), /導火/);
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "true",
      );
      await p.keyboard.press("Space");
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "false",
      );
      await p.locator('[data-inspect="fuse"] strong').tap();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "false",
      );
      await p.locator("#base-back").tap();
      assert.equal(
        await p.locator("#base-confirm-title").innerText(),
        "編集中の変更があります",
      );
      assert.equal(
        await p.locator("[data-cancel]").innerText(),
        "編集を続ける",
      );
      assert.equal(
        await p.locator("[data-confirm]").innerText(),
        "変更を破棄して戻る",
      );
      assert.ok(
        await p
          .locator("[data-cancel]")
          .evaluate((e) => e === document.activeElement),
      );
      const dialogBox = await p.locator(".base-confirm").boundingBox();
      assert.ok(
        dialogBox.x >= 0 &&
          dialogBox.y >= 0 &&
          dialogBox.x + dialogBox.width <= width &&
          dialogBox.y + dialogBox.height <= height,
      );
      await p.screenshot({ path: `${out}/exit-${width}-${reducedMotion}.png` });
      await p.locator("[data-cancel]").tap();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "false",
      );
      await p.locator("#base-back").tap();
      await p.keyboard.press("Escape");
      await p.locator(".base-confirm").waitFor({ state: "detached" });
      assert.equal(await p.locator(".base-confirm").count(), 0);
      assert.ok(
        await p
          .locator("#base-back")
          .evaluate((e) => e === document.activeElement),
      );
      await p.locator("#base-back").tap();
      await p.locator("[data-confirm]").tap();
      await p.locator("#open-armory").click();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "true",
      );
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-upgrade-loadout-v1"),
        ),
        initialStorage,
      );
      const locked = p.locator('#base-grid [aria-disabled="true"]').first();
      if (await locked.count()) {
        const checked = await locked.getAttribute("aria-checked");
        // aria-disabledでも説明閲覧は可能。実入力を送り選択が変わらないことを検証。
        await locked.tap({ force: true });
        assert.equal(await locked.getAttribute("aria-checked"), checked);
        assert.match(
          await p.locator("#base-detail").innerText(),
          /クリアで解放/,
        );
      }
      assert.equal(await p.locator(".base-initial,[data-initial]").count(), 0);
      assert.doesNotMatch(
        await p.locator("#base-grid").innerText(),
        /開幕候補/,
      );
      const openingSpace = await p.locator("#base-grid").evaluate((grid) => {
        const r = grid.getBoundingClientRect();
        return {
          top: r.top,
          height: r.height,
          fullyVisible: [...grid.querySelectorAll(".base-tile")].filter((e) => {
            const b = e.getBoundingClientRect();
            return b.top >= r.top && b.bottom <= r.bottom + 1;
          }).length,
        };
      });
      for (const id of ["blast-core", "armor-piercer", "afterimage-mine"]) {
        await p.locator(`[data-pool="${id}"]`).tap();
        assert.equal(
          await p.locator(`[data-pool="${id}"]`).getAttribute("aria-checked"),
          "false",
        );
      }
      const active = await p.evaluate(() =>
        localStorage.getItem("swarm-front-upgrade-loadout-v1"),
      );
      await p.locator('[data-pool="fuse"]').focus();
      assert.match(
        await p.locator("#base-detail").innerText(),
        /チェインノヴァ/,
      );
      const fusionRecipeBefore = await p.locator(".base-recipe").innerText();
      await p.locator('[data-pool="fuse"]').tap();
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
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
      for (const id of ["blast-core", "armor-piercer", "afterimage-mine"]) {
        assert.equal(
          await p.locator(`[data-pool="${id}"]`).getAttribute("aria-checked"),
          "false",
        );
      }
      assert.equal(
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "false",
      );
      // フォーカスで説明を閲覧しても選択・保存が変わらず、画像が読み込まれる。
      await p.locator('[data-pool="fuse"]').focus();
      await waitForBaseImages("upgrades");
      const checkboxes = await p.locator(".base-checkbox").evaluateAll((es) =>
        es.map((e) => {
          const b = e.getBoundingClientRect(),
            icon = e
              .closest(".base-tile")
              .querySelector(".base-tile-pick > :is(img,.front-atlas-icon)")
              .getBoundingClientRect();
          return {
            width: b.width,
            height: b.height,
            left: b.left,
            iconLeft: icon.left,
          };
        }),
      );
      assert.ok(
        checkboxes.every(
          (b) => b.width >= 20 && b.height >= 20 && b.left < b.iconLeft,
        ),
      );
      await p.screenshot({ path: `${out}/base-${width}-${reducedMotion}.png` });
      await p.locator("#base-fusions").tap();
      await waitForBaseImages("fusions");
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
        await p.locator('[data-pool="fuse"]').getAttribute("aria-checked"),
        "false",
      );
      assert.match(
        await p.locator("#base-slot").innerText(),
        /融合・爆発デッキ/,
      );
      // 名前は出撃候補とは別保存。出撃へ反映しても未保存名の破棄確認を残す。
      await p.locator("#base-name").fill("まだ保存していない名前");
      await p.locator("#front-save-pool").tap();
      await p.locator("#base-back").tap();
      await p.locator(".base-confirm").waitFor();
      await p.locator(".base-confirm [data-cancel]").tap();
      await p.locator("#base-load").tap();
      await p.locator(".base-confirm").waitFor();
      await p.locator(".base-confirm [data-cancel]").tap();
      assert.equal(
        await p.locator("#base-name").inputValue(),
        "まだ保存していない名前",
      );
      const savedName = () =>
        p.evaluate(
          () =>
            JSON.parse(localStorage.getItem("swarm-front-upgrade-decks-v1"))
              .slots[0].name,
        );
      assert.equal(await savedName(), "融合・爆発デッキ");
      await p.locator("#base-store").tap();
      await p.locator(".base-confirm [data-cancel]").tap();
      assert.equal(await savedName(), "融合・爆発デッキ");
      await p.locator("#base-store").tap();
      await p.locator(".base-confirm [data-confirm]").tap();
      assert.equal(await savedName(), "まだ保存していない名前");
      await p.locator("#base-back").tap();
      assert.equal(await p.locator(".base-confirm").count(), 0);
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
        openingSpace,
        metrics,
        coop,
        errors,
        consoleErrors,
        imageReadiness,
        serviceWorkerControlled,
        unsavedNameGuard: "set → back/load/cancel retain → deck save clears",
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
