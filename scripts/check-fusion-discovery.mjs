import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = process.env.FUSION_OUTPUT || "docs/evidence/fusion-roll-20261010";
const origin = process.env.FUSION_ORIGIN || "http://127.0.0.1:5347";
const published = process.env.FUSION_PUBLIC === "1";
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
      const p = await browser.newPage({
        viewport: { width, height },
        hasTouch: true,
        reducedMotion,
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await p.goto(`${origin}/${published ? "front" : "front.html"}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await p.locator("#open-armory").click();
      await p.locator("#base-fusions").click();
      assert.equal(await p.locator("[data-add-recipe]").count(), 0);
      assert.match(
        await p.locator("#base-detail").innerText(),
        /チェインノヴァ＝？？ × ？？/,
      );
      assert.equal(
        await p.locator(".base-tile img,.base-tile .front-atlas-icon").count(),
        0,
      );
      await p.screenshot({
        path: `${out}/unknown-base-${width}-${reducedMotion}.png`,
      });
      await p.locator("#base-back").click();
      await p.locator("#solo").click();
      await p.locator("#front-launch").click();
      await p
        .locator("[data-card]")
        .first()
        .click({ timeout: 60000 })
        .catch(async (e) => {
          await p.screenshot({ path: `${out}/failure.png` });
          console.error(await p.locator("body").innerText());
          throw e;
        });
      await p.locator("#pause").click();
      assert.equal(
        (await p.locator(".front-evolution-progress").innerText()).match(
          /1枠空く/g,
        ).length,
        1,
      );
      assert.match(
        await p.locator(".front-evolution-progress").innerText(),
        /？？ × ？？/,
      );
      await p.screenshot({
        path: `${out}/pause-${width}-${reducedMotion}.png`,
      });
      const layout = await p.locator(".front-pause").evaluate((el) => ({
        width: el.clientWidth,
        scrollWidth: el.scrollWidth,
        height: el.clientHeight,
        scrollHeight: el.scrollHeight,
      }));
      assert.ok(layout.scrollWidth <= layout.width + 1);
      // 別出撃にも残る発見記録と基地の素材追加導線を、実モジュールで確認。
      await p.evaluate(async (isPublished) => {
        if (isPublished) {
          // 隔離された検証プロフィールの既知レシピfixture。利用者の保存には触れない。
          localStorage.setItem(
            "swarm-front-fusion-discovery-v1",
            JSON.stringify({ version: 1, ids: ["fusion-collapse"] }),
          );
          return;
        }
        const { recordFrontFusionDiscovery } =
          await import("/src/client/front-fusion-discovery.ts");
        const r = recordFrontFusionDiscovery(localStorage, {
          growthVersion: 3,
          levels: { "fusion-collapse": 1 },
        });
        if (r.error) throw Error(r.error);
      }, published);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.locator("#open-armory").click();
      await p.locator("#base-fusions").click();
      assert.match(await p.locator("#base-detail").innerText(), /導火/);
      assert.match(await p.locator("#base-detail").innerText(), /爆域拡張/);
      assert.equal(
        await p.locator('[data-add-recipe="fusion-collapse"]').count(),
        1,
      );
      await p.locator('[data-inspect="fusion-skewer"]').click();
      assert.match(await p.locator("#base-detail").innerText(), /？？ × ？？/);
      assert.equal(await p.locator("[data-add-recipe]").count(), 0);
      await p.locator('[data-inspect="fusion-collapse"]').click();
      await p.screenshot({
        path: `${out}/known-base-${width}-${reducedMotion}.png`,
      });
      assert.deepEqual(errors, []);
      results.push({
        width,
        height,
        reducedMotion,
        layout,
        errors,
        passed: true,
      });
      await p.close();
    }
  fs.writeFileSync(`${out}/ui-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
