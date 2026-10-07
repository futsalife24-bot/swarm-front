import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.MENU_ORIGIN || "http://127.0.0.1:5347";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw Error("Fixtures require localhost");
const out = "dist-validation/menu-effects";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const results = [];
let current;
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const p = await browser.newPage({
      viewport: { width: 844, height: 390 },
      reducedMotion,
      serviceWorkers: "block",
    });
    current = p;
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(origin);
    await p.locator("#solo").waitFor();
    await p.evaluate(async () => {
      const m = await import("/src/client/progression-save.ts");
      const s = m.freshProgress("normal");
      Object.assign(s, {
        coins: 4000,
        powder: 130,
        points: 120,
        materials: 2,
        unlocked: ["hp", "aim", "move", "swap"],
        tutorials: ["growth", "accessories", "gear", "armory", "base"],
        encounters: { crawler: "solo", ant: "coop" },
      });
      s.accessories = [0, 1, 2].map((i) => ({
        id: "effect-" + i,
        kind: "pickup",
        rarity: 1,
        locked: false,
        testData: false,
      }));
      localStorage.setItem(m.newSaveKey("normal"), JSON.stringify(s));
      localStorage.setItem("swarm-front-player-name-v1", "演出検証");
    });
    await p.reload();
    const saved = () =>
      p.evaluate(() =>
        JSON.parse(localStorage.getItem("swarm-front-shared-progress-v3")),
      );
    await p.locator("#solo").click();
    assert.equal(await p.locator(".menu-fx-terrain").count(), 1);
    const before = await saved();
    await p.locator('[data-row="v2-starter-rocket"] [data-detail]').click();
    assert.equal((await saved()).soldiers[0].equipped[0], "v2-starter-rocket");
    assert.equal(
      await p.locator('[data-gear-slot="0"] .menu-fx-trace').count(),
      reducedMotion === "reduce" ? 0 : 1,
    );
    assert.equal((await saved()).inventory.length, before.inventory.length);
    await p.screenshot({ path: `${out}/gear-${reducedMotion}.png` });
    await p.waitForTimeout(850);
    assert.equal(await p.locator(".menu-fx-equip,.menu-fx-trace").count(), 0);
    // Failed save cannot display the success cue, and retry still saves normally.
    await p.evaluate(() => {
      window.fxSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === "swarm-front-shared-progress-v3")
          throw Error("fixture write failure");
        return window.fxSetItem.call(this, k, v);
      };
    });
    await p.locator('[data-row="v2-starter-rifle"] [data-detail]').click();
    assert.equal((await saved()).soldiers[0].equipped[0], "v2-starter-rocket");
    assert.equal(await p.locator(".menu-fx-equip").count(), 0);
    await p.evaluate(() => {
      Storage.prototype.setItem = window.fxSetItem;
    });
    await p.locator("#pt-save-retry").click();
    assert.equal((await saved()).soldiers[0].equipped[0], "v2-starter-rifle");
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-accessories").click();
    await p.locator("#pt-target-craft").click();
    assert.equal((await saved()).powder, 100);
    assert.equal((await saved()).accessories.length, 4);
    assert.equal(
      await p.locator(".menu-fx-particles").count(),
      reducedMotion === "reduce" ? 0 : 1,
    );
    const preSynthesis = await saved();
    await p.locator("#pt-synthesis").click();
    await p.locator("#pt-cancel").click();
    assert.deepEqual(await saved(), preSynthesis);
    await p.locator("#pt-synthesis").click();
    await p.locator("#pt-confirm").click();
    assert.ok((await saved()).accessories.some((a) => a.rarity === 2));
    await p.locator("#pt-base").click();
    await p.locator("#pt-base-growth").click();
    await p.locator(".radar-hp").click();
    await p.locator('[data-growth-skill="hp"][data-growth-level="2"]').click();
    assert.equal((await saved()).soldiers[0].levels.hp, 0);
    assert.notEqual(
      await p.locator(".radar-draft").getAttribute("points"),
      await p.locator(".radar-saved").getAttribute("points"),
    );
    await p.locator("#pt-allocate").click();
    await p.locator("#pt-cancel").click();
    assert.equal((await saved()).soldiers[0].levels.hp, 0);
    await p.locator("#pt-allocate").click();
    await p.locator("#pt-confirm").click();
    assert.equal((await saved()).soldiers[0].levels.hp, 2);
    await p.locator("#pt-home").click();
    await p.locator("#home-tutorial").click();
    await p.locator("#tutorial-tab-1").click();
    assert.equal(await p.locator("#tutorial-panel-1").isVisible(), true);
    await p.locator(".dialog-close").click();
    await p.locator("#changelog").click();
    assert.equal(
      await p.locator(".menu-fx-new").textContent(),
      reducedMotion === "reduce" ? "新着" : "新着◇#",
    );
    await p.locator(".dialog-close").click();
    await p.locator("#home-settings").click();
    await p.locator('[data-preference="volume"]').fill("0.5");
    assert.match(
      await p.locator(".settings-status").innerText(),
      /設定を保存しました/,
    );
    await p.locator("[data-sound-test]").click();
    await p.waitForFunction(
      () =>
        document.querySelector(".media-dialog audio").src.startsWith("blob:"),
      {},
      { timeout: 60000 },
    );
    await p.locator("[data-play]").click();
    await p.waitForFunction(
      () => !document.querySelector(".media-dialog audio").paused,
    );
    await p.locator("[data-pause]").click();
    assert.equal(
      await p.locator(".media-dialog audio").evaluate((e) => e.paused),
      true,
    );
    await p.locator(".media-dialog .dialog-close").click();
    await p.locator(".media-dialog").waitFor({ state: "detached" });
    await p.locator(".dialog-close").click();
    await p.locator("#open-bestiary").click();
    await p
      .locator('.enemy-viewport[data-asset="ready"]')
      .waitFor({ timeout: 45000 });
    await p.locator('[data-enemy="ant"]').click();
    await p
      .locator('.enemy-viewport[data-asset="ready"]')
      .waitFor({ timeout: 45000 });
    assert.equal(
      await p.locator(".enemy-viewport").evaluate((e) => e.style.filter),
      "brightness(0)",
    );
    assert.equal(await p.locator(".menu-fx-mosaic").count(), 0);
    await p.locator("#report-close").click();
    await p.waitForTimeout(850);
    const animations = await p.evaluate(
      () =>
        document
          .getAnimations()
          .filter((a) =>
            a.effect?.target?.closest(
              ".menu-fx-layer,.media-status,.growth-radar",
            ),
          ).length,
    );
    assert.equal(animations, 0);
    let changeDuringMotion = false;
    let actualHiddenCleanup = false;
    if (reducedMotion === "no-preference") {
      await p.locator("#solo").click();
      await p.locator('[data-row="v2-starter-rocket"] [data-detail]').click();
      assert.equal(await p.locator(".menu-fx-trace").count(), 1);
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.waitForFunction(
        () =>
          document.querySelectorAll(".menu-fx-equip,.menu-fx-trace").length ===
          0,
      );
      changeDuringMotion = true;
      await p.emulateMedia({ reducedMotion: "no-preference" });
      await p.locator('[data-row="v2-starter-rifle"] [data-detail]').click();
      assert.equal(await p.locator(".menu-fx-trace").count(), 1);
      const other = await browser.newPage();
      await other.bringToFront();
      if (await p.evaluate(() => document.hidden)) {
        await p.waitForFunction(
          () =>
            document.querySelectorAll(".menu-fx-equip,.menu-fx-trace")
              .length === 0,
          {},
          { timeout: 15000 },
        );
        actualHiddenCleanup = true;
      }
      await other.close();
      await p.bringToFront();
    }
    await p.goto(origin + "/front");
    await p.locator("#solo").click();
    const frontSaved = await saved();
    const originalSlot = await p.locator('[data-front-slot="0"] b').innerText();
    await p.locator('[data-row="v2-starter-rocket"] [data-detail]').click();
    assert.notEqual(
      await p.locator('[data-front-slot="0"] b').innerText(),
      originalSlot,
    );
    assert.deepEqual(await saved(), frontSaved);
    assert.equal(await p.locator(".menu-fx-equip,.menu-fx-trace").count(), 0);
    await p.reload();
    await p.locator("#solo").click();
    assert.equal(
      await p.locator('[data-front-slot="0"] b').innerText(),
      originalSlot,
    );
    assert.equal(await p.locator(".menu-fx-equip,.menu-fx-trace").count(), 0);
    await p.screenshot({ path: `${out}/front-draft-${reducedMotion}.png` });
    assert.deepEqual(errors, []);
    results.push({
      frontDraftWithoutSavedCue: true,
      changeDuringMotion,
      actualHiddenCleanup,
      visibilityLimit: actualHiddenCleanup
        ? null
        : "Headless tabs stayed visible; real visibility cleanup not verified",
      reducedMotion,
      equipmentAndRetry: true,
      craftingAndSynthesis: true,
      growthDraftCancelCommit: true,
      guide: true,
      history: true,
      settings: true,
      soundPause: true,
      coopSilhouetteProtected: true,
      effectsAfterClose: animations,
      errors,
    });
    await p.close();
  }
  fs.writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} catch (error) {
  if (current && !current.isClosed()) {
    fs.writeFileSync(
      `${out}/failure.json`,
      JSON.stringify(
        await current.evaluate(() => ({
          screen: document.body.dataset.screen,
          audio: document
            .querySelector(".media-dialog audio")
            ?.getAttribute("src"),
          status: document.querySelector(".media-status")?.textContent,
          hidden: document.hidden,
          text: document.body.innerText.slice(-1800),
        })),
        null,
        2,
      ),
    );
    await current.screenshot({ path: `${out}/failure.png` });
  }
  throw error;
} finally {
  await browser.close();
}
