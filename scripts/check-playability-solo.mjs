import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] || "http://127.0.0.1:5347";
const width = Number(process.env.SOLO_WIDTH || 844),
  height = width === 640 ? 360 : 390;
const out = "dist-validation/playability-six/solo/" + width;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
async function picker(p, id, value) {
  const index = await p
    .locator("#" + id)
    .evaluate((s, v) => [...s.options].findIndex((o) => o.value === v), value);
  assert.ok(index >= 0);
  await p.locator(`[data-game-select-for="${id}"]`).click();
  await p.locator(`dialog[open] [data-option-index="${index}"]`).click();
  assert.equal(await p.locator("#" + id).inputValue(), value);
}
try {
  for (const entry of [""]) {
    const tag = "normal-unified";
    const p = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
    });
    p.setDefaultTimeout(60000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    try {
      await p.goto(base + "/" + entry);
      if (await p.locator("#landscape-start").isVisible())
        await p.locator("#landscape-start").click();
      await p.locator("#solo").click();
      await p.locator("#player-name").fill("検証隊員");
      await p.locator("#player-name-form button[type=submit]").click();
      await p.locator("#pt-confirm").click();
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-player-name-v1"),
        ),
        "検証隊員",
      );
      await picker(p, "pt-stage", "1");
      await picker(p, "pt-filter", "shotgun");
      await p.screenshot({ path: `${out}/${tag}-picker-result.png` });
      await picker(p, "pt-filter", "all");
      await p.locator("#pt-settings").click();
      await p.locator("#edit-player-name").click();
      await p.locator("#player-name").fill("変更隊員");
      await p.locator("#player-name-form button[type=submit]").click();
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-player-name-v1"),
        ),
        "変更隊員",
      );
      await p.locator("#pt-layout").click();
      await p.locator("#layout-reset").click();
      await p.locator("#layout-scope-count").selectOption("2");
      await p.screenshot({ path: `${out}/${tag}-two-scope-layout.png` });
      await p.locator("#layout-save").click();
      if (await p.locator("dialog[open] .dialog-close").count())
        await p.locator("dialog[open] .dialog-close").click();
      assert.equal(
        await p.evaluate(
          () =>
            JSON.parse(localStorage.getItem("swarm-front-controls-v1"))
              .secondScope,
        ),
        true,
      );
      await p.locator("#pt-start").click();
      await p.locator(".pt-loading").waitFor({ state: "visible" });
      await p.screenshot({ path: `${out}/${tag}-loading.png` });
      {
        await p.locator("#pt-enter").click();
        if (await p.locator("#pt-tutorial-skip").count())
          await p.locator("#pt-tutorial-skip").click();
      }
      await p.locator("#scope2").waitFor({ state: "visible" });
      await p.locator("#scope").tap();
      await p.waitForTimeout(150);
      assert.equal(
        await p.locator("#scope2").getAttribute("aria-pressed"),
        "true",
      );
      await p.locator("#scope2").tap();
      await p.waitForTimeout(150);
      assert.equal(
        await p.locator("#scope").getAttribute("aria-pressed"),
        "false",
      );
      const diagnostics = await p.evaluate(() => {
        const d = window.__swarm || window.__playtest;
        return {
          screen: d?.screen,
          trooper: d?.trooper,
          mapAssets: d?.mapAssets,
          loadReady: d?.loadReady,
          worldTime: d?.world?.time,
        };
      });
      await p.screenshot({ path: `${out}/${tag}-battle.png` });
      assert.equal(diagnostics.screen, "battle");
      await p.reload();
      await p.locator("#solo").click();
      await p.locator("#pt-start").waitFor();
      assert.equal(await p.locator("#player-name").count(), 0);
      assert.equal(
        await p.evaluate(() =>
          localStorage.getItem("swarm-front-player-name-v1"),
        ),
        "変更隊員",
      );
      await p.locator("#pt-settings").click();
      await p.locator("#pt-layout").click();
      assert.equal(await p.locator("#layout-scope-count").inputValue(), "2");
      assert.deepEqual(errors, []);
      results.push({ tag, diagnostics, errors, passed: true });
    } catch (e) {
      await p.screenshot({ path: `${out}/${tag}-failure.png` });
      results.push({
        tag,
        error: e.stack,
        body: await p.locator("body").innerText(),
        errors,
      });
      throw e;
    } finally {
      fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
      await p.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results));
