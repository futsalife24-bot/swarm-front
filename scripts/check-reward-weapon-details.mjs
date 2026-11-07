// Local result/save fixture. This verifies the real UI, not a completed battle.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.REWARD_ORIGIN || "http://127.0.0.1:5198";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw Error("Local fixture only");
const out = "dist-validation/reward-weapon-details";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER_CHANNEL ?? "chrome",
  args: ["--use-angle=d3d11"],
});
const records = [];
let activePage;
try {
  for (const [width, height] of [
    [844, 390],
    [640, 360],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
      reducedMotion: "reduce",
    });
    activePage = page;
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(60000);
    await page.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "武器詳細検証"),
    );
    await page.route(
      /\/src\/client\/playtest-app.ts(?:\?.*)?$/,
      async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body:
            (await response.text()) +
            `
window.rewardDetailFixture = async () => {
  const { freshProgress } = await import('/src/client/progression-save.ts');
  mode = 'normal'; save = freshProgress('normal');
  save.tutorials = ['gear','armory','base','battle'];
  const items = Object.keys(WEAPONS).map((kind, i) => makeWeapon('detail-' + kind, kind, i % 5, { power: 20, reload: -10, range: 10, rate: 20 }, false, save.serial++, 'none'));
  save.inventory.push(...items);
  save.result = { run:'detail-fixture', stage:1, difficulty:'normal', win:true, time:307, kills:176, missions:[true,false,true], first:false, coins:70, firstCoins:0, weapons:items, bonus:[], collected:items.length, choice:'normal', collectionDone:true };
  persistProgress(save); result();
  return items.map(w => ({ id:w.id, kind:w.kind, name:WEAPONS[w.kind].name }));
};`,
        });
      },
    );
    console.log(`${width}: loading result fixture`);
    await page.goto(origin + "/?solo=1", {
      waitUntil: "commit",
      timeout: 120000,
    });
    await page.waitForFunction(
      () => typeof window.rewardDetailFixture === "function",
      null,
      { timeout: 120000 },
    );
    const items = await page.evaluate(() => window.rewardDetailFixture());
    console.log(`${width}: result rendered, ${items.length} weapons`);
    await page.locator("#pt-result-home").waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, points) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const point = async (loc) => {
      await loc.scrollIntoViewIfNeeded();
      const r = await loc.boundingBox();
      return {
        x: r.x + Math.min(r.width / 2, 75),
        y: r.y + r.height / 2,
        id: 1,
      };
    };
    const dismiss = async () => {
      await page.locator(".menu-dialog[open] .dialog-close").click();
      await page.locator(".menu-dialog").waitFor({ state: "detached" });
    };
    const rawBefore = await page.evaluate(() =>
      localStorage.getItem("swarm-front-shared-progress-v3"),
    );
    for (const item of items) {
      const name = page.locator(`[data-detail="${item.id}"]`);
      const p = await point(name);
      await touch("touchStart", [p]);
      await page.waitForTimeout(600);
      await page.locator(".menu-dialog[open]").waitFor();
      await touch("touchEnd", []);
      assert.equal(await page.locator(".menu-dialog").count(), 1);
      assert.ok(
        (await page.locator("#menu-dialog-title").innerText()).includes(
          item.name,
        ),
      );
      assert.equal(await page.locator("#pt-comparison tr").count(), 6);
      await page.locator("#pt-weapon-preview canvas").waitFor();
      console.log(`${width}: ${item.kind} detail and model verified`);
      if (item.kind === "kick")
        await page.screenshot({ path: `${out}/${width}-detail.png` });
      await dismiss();
      assert.equal(
        await name.evaluate((el) => el === document.activeElement),
        true,
      );
    }
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      rawBefore,
    );
    const name = page.locator(`[data-detail="${items[0].id}"]`);
    await name.scrollIntoViewIfNeeded();
    await name.tap();
    await page.locator(".menu-dialog[open]").waitFor();
    await dismiss();
    await name.press("Enter");
    await page.locator(".menu-dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".menu-dialog").waitFor({ state: "detached" });
    await name.press("Space");
    await page.locator(".menu-dialog[open]").waitFor();
    await dismiss();
    const p = await point(name);
    await touch("touchStart", [p]);
    await touch("touchMove", [{ ...p, y: p.y - 45 }]);
    await page.waitForTimeout(650);
    await touch("touchEnd", []);
    assert.equal(await page.locator(".menu-dialog").count(), 0);
    await name.scrollIntoViewIfNeeded();
    const cancelPoint = await point(name);
    await touch("touchStart", [cancelPoint]);
    await touch("touchCancel", []);
    await page.waitForTimeout(650);
    assert.equal(await page.locator(".menu-dialog").count(), 0);
    const lock = page.locator(`[data-lock="${items[0].id}"]`);
    assert.equal(await lock.getAttribute("aria-pressed"), "false");
    await lock.tap();
    assert.equal(await lock.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(".menu-dialog").count(), 0);
    await lock.tap();
    assert.equal(await lock.getAttribute("aria-pressed"), "false");
    await page.screenshot({ path: `${out}/${width}-result.png` });
    // Re-render through actual sort controls, then verify newly bound name.
    await page.locator(".pt-view-menu summary").click();
    await page
      .locator('[data-list-choice="sort"][data-value="rarity"]')
      .click();
    await page.locator("#pt-view-close").click();
    const again = await point(name);
    await touch("touchStart", [again]);
    await page.waitForTimeout(600);
    await page.locator(".menu-dialog[open]").waitFor();
    await touch("touchEnd", []);
    await dismiss();
    await page.locator("#pt-result-home").click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator(".menu-dialog").count(), 0);
    assert.deepEqual(errors, []);
    records.push({
      width,
      height,
      allWeaponDetails: items.length,
      previewModels: items.length,
      nativeTouchHold: true,
      cancelAndScroll: true,
      tapKeyboard: true,
      lock: true,
      redraw: true,
      readOnly: true,
      errors,
    });
    fs.writeFileSync(`${out}/results.json`, JSON.stringify(records, null, 2));
    await page.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage
      .screenshot({ path: `${out}/failure.png`, timeout: 10000 })
      .catch(() => {});
    fs.writeFileSync(
      `${out}/failure.json`,
      JSON.stringify(
        {
          message: String(error),
          url: activePage.url(),
          text: await activePage
            .locator("body")
            .innerText({ timeout: 5000 })
            .catch(() => ""),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify(records));
