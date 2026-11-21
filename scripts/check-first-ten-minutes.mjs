import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { startLocalJourneyHarness } from "./local-journey-harness.mjs";

const baseline = process.argv.includes("--baseline");
const narrow = process.argv.includes("--narrow");
const phase = baseline ? "before" : "after";
const out = `dist-validation/first-ten-minutes/${phase}${narrow ? "-narrow" : ""}`;
fs.mkdirSync(out, { recursive: true });

const startedMs = Date.now();
const milestones = [];
const milestone = (name, detail = {}) => {
  const item = {
    name,
    at: new Date().toISOString(),
    elapsedMs: Date.now() - startedMs,
    source: "autopilot",
    ...detail,
  };
  milestones.push(item);
  console.log(`MILESTONE ${name} ${item.at} +${item.elapsedMs}ms`);
};

const source = "src/client/playtest-app.ts";
const results = {
  phase,
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceHash: createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex"),
  humanParticipants: 0,
  supplyEndpoint: "local Worker proxied by the same-origin Vite server",
  victory:
    "ST1/ST2/ST3 results use real persistence through a synthetic result; they are not combat or human comprehension tests.",
  milestones,
  cases: [],
  passed: false,
};

const STAGE_OPEN = {
  0: ["solo", "coop", "supplyBox", "tutorial", "settings", "sortiePrep", "title"],
  1: [
    "solo",
    "coop",
    "supplyBox",
    "tutorial",
    "settings",
    "sortiePrep",
    "title",
    "base",
    "enemyReport",
    "weapons",
    "buddy",
    "supply",
  ],
  2: [
    "solo",
    "coop",
    "supplyBox",
    "tutorial",
    "settings",
    "sortiePrep",
    "title",
    "base",
    "enemyReport",
    "weapons",
    "buddy",
    "supply",
    "weekly",
    "growth",
  ],
  3: [
    "solo",
    "coop",
    "base",
    "enemyReport",
    "supplyBox",
    "weekly",
    "dailyDefense",
    "tutorial",
    "tutorialWeaponUpgradeGuide",
    "settings",
    "settingsDeveloper",
    "sortiePrep",
    "title",
    "weapons",
    "buddy",
    "supply",
    "growth",
    "accessories",
    "survivalCards",
    "workshop",
    "weaponWorkshopButton",
  ],
};
const STAGE_CLOSED = {
  0: [
    "base",
    "weapons",
    "buddy",
    "supply",
    "weekly",
    "dailyDefense",
    "growth",
    "accessories",
    "survivalCards",
    "workshop",
    "settingsDeveloper",
    "tutorialWeaponUpgradeGuide",
    "weaponWorkshopButton",
  ],
  1: [
    "weekly",
    "dailyDefense",
    "accessories",
    "survivalCards",
    "workshop",
    "settingsDeveloper",
    "tutorialWeaponUpgradeGuide",
    "weaponWorkshopButton",
  ],
  2: [
    "dailyDefense",
    "accessories",
    "survivalCards",
    "workshop",
    "settingsDeveloper",
    "tutorialWeaponUpgradeGuide",
    "weaponWorkshopButton",
  ],
  3: [],
};

const harness = await startLocalJourneyHarness("first-ten");
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11", "--mute-audio"],
});
let page;
try {
  for (const [width, height] of narrow
    ? [[640, 360]]
    : [
        [844, 390],
        [640, 360],
      ]) {
    page = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      serviceWorkers: "block",
    });
    page.setDefaultTimeout(60000);
    const errors = [],
      screens = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const capture = async (name) => {
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
      const item = {
        name,
        text: await page.evaluate(() => document.body.innerText),
      };
      screens.push(item);
      fs.writeFileSync(
        `${out}/${width}-screens.json`,
        JSON.stringify(screens, null, 2),
      );
    };
    const state = () => page.evaluate(() => window.__playtest);
    const solo = () => page.locator("#solo:visible").last();
    const selectStage = async (index) => {
      await page
        .locator(`[data-game-select-for="pt-stage"]:visible`)
        .last()
        .evaluate((element) => element.click());
      await page
        .locator(`dialog[open] [data-option-index="${index}"]`)
        .evaluate((element) => element.click());
    };
    const dismissTitle = async () => {
      const start = page.locator("dialog.title-entry[open] .title-entry-start");
      await start.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
      if (await start.isVisible()) {
        await start.click();
        await page.locator("dialog.title-entry").waitFor({ state: "detached" });
      }
      const landscape = page.locator("#landscape-start");
      if (await landscape.isVisible()) await landscape.tap();
    };
    const dismissBattleDialogs = async () => {
      const close = page.locator("dialog.menu-dialog[open] .dialog-close:visible").last();
      if (await close.count()) await close.evaluate((element) => element.click());
      const skip = page.locator("#pt-intro-skip:visible").last();
      if (await skip.count()) await skip.evaluate((element) => element.click());
    };
    const assertStage = async (label, expected, checkDom = true) => {
      const unlock = await page.evaluate(async () => {
        const { unlockState } = await import("/src/client/unlock-stage.ts");
        const flags = JSON.parse(
          localStorage.getItem("swarm-front-tutorial-v1") ?? "{}",
        );
        return unlockState(window.__playtest?.save ?? null, flags);
      });
      assert.equal(unlock.stage, expected, `${label}: stage`);
      for (const entry of STAGE_OPEN[expected])
        assert.equal(
          unlock.entries[entry].open,
          true,
          `${label}: ${entry} must be open`,
        );
      for (const entry of STAGE_CLOSED[expected])
        assert.equal(
          unlock.entries[entry].open,
          false,
          `${label}: ${entry} must be closed`,
        );
      if (expected === 1) {
        const points = (await state()).save?.points ?? 0;
        assert.equal(
          unlock.entries.growth.open,
          points > 0,
          `${label}: growth follows the usage record`,
        );
      }
      if (!checkDom) return unlock;
      const dom = await page.evaluate(() => {
        const open = (selector) => {
          const element = document.querySelector(selector);
          return (
            !!element &&
            !element.disabled &&
            element.getAttribute("aria-disabled") !== "true"
          );
        };
        const locked = (selector) => {
          const element = document.querySelector(selector);
          return (
            !!element &&
            (element.disabled || element.getAttribute("aria-disabled") === "true")
          );
        };
        return {
          solo: open("#solo"),
          coop: open("#coop"),
          supplyBox: open("#pt-supply-box"),
          tutorial: open("#home-tutorial"),
          settings: open("#home-settings"),
          baseOpen: open("#open-armory"),
          baseLocked: locked("#open-armory"),
          reportOpen: open("#open-bestiary"),
          reportLocked: locked("#open-bestiary"),
          weekly: open("#pt-weekly-missions"),
          daily: open("#pt-daily-defense"),
        };
      });
      assert(dom.solo && dom.coop && dom.supplyBox && dom.tutorial && dom.settings);
      if (expected === 0) {
        assert(dom.baseLocked && dom.reportLocked, `${label}: locked DOM`);
        assert(!dom.weekly && !dom.daily, `${label}: hidden DOM`);
      } else if (expected === 1) {
        assert(dom.baseOpen && dom.reportOpen, `${label}: opened DOM`);
        assert(!dom.weekly && !dom.daily, `${label}: hidden DOM`);
      } else if (expected === 2) {
        assert(dom.baseOpen && dom.weekly, `${label}: stage 2 DOM`);
        assert(!dom.daily, `${label}: stage 2 hidden DOM`);
      } else {
        assert(dom.baseOpen && dom.weekly && dom.daily, `${label}: stage 3 DOM`);
      }
      return unlock;
    };
    const syntheticClear = async (stageNumber) => {
      const reward = await page.evaluate(async (stage) => {
        const progression = await import("/src/client/progression-save.ts");
        const cloud = await import("/src/client/cloud-save.ts");
        const { makeWeapon } = await import("/src/shared/progression.ts");
        const current = progression.loadProgress("normal");
        const id = `first-ten-minutes-fixture-stage-${stage}`;
        const input = {
          run: crypto.randomUUID(),
          stage,
          difficulty: "normal",
          win: true,
          time: 110,
          kills: 32,
          missions: [true, true, true],
          collected: 1,
          weapons: [
            makeWeapon(
              id,
              "rifle",
              1,
              { power: 3, reload: 2, range: 1, rate: 1 },
              false,
              current.serial,
            ),
          ],
        };
        progression.persistProgress(
          progression.prepareChoice(
            progression.grantResult(current, input, () => 0.5),
            () => 0.5,
          ),
        );
        await cloud.syncCloud();
        return id;
      }, stageNumber);
      await page.reload({ waitUntil: "domcontentloaded" });
      await dismissTitle();
      await page.locator("#pt-normal-reward").waitFor();
      await capture(`stage-${stageNumber}-reward`);
      await page
        .locator("#pt-normal-reward")
        .evaluate((element) => element.click());
      await page.locator("#pt-result-retry").waitFor();
      return reward;
    };

    await page.goto(harness.origin, { waitUntil: "domcontentloaded" });
    await dismissTitle();
    await solo().waitFor();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      null,
    );
    await capture("title");
    await assertStage("title", 0);
    milestone("launch", { viewport: `${width}x${height}` });
    await solo().tap();
    await page.locator("#player-name").fill("初回検証");
    await page.locator("#player-name-form button[type=submit]").tap();
    await solo().tap();
    const advance = page.locator('[data-operation="advance"]:visible').last();
    await advance.waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    await advance.evaluate((element) => element.click());
    await page.locator("#pt-offer-training:visible").waitFor();
    assert.equal(await page.locator("#pt-confirm").count(), 0);
    await capture("training-offer");
    const training = page.frameLocator('iframe.training-frame[title="初陣訓練"]');
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await page.locator('iframe.training-frame[title="初陣訓練"]').count())
        break;
      const offer = page.locator("#pt-offer-training:visible").last();
      if (await offer.count()) await offer.evaluate((element) => element.click());
      await page.waitForTimeout(300);
    }
    await training.locator("#training-start").waitFor({ state: "visible" });
    await training.locator("#training-start").tap();
    milestone("training_started");
    for (let step = 0; step < 240; step++) {
      const finish = training.locator("#tutorial-finish:visible");
      if (await finish.count()) {
        await finish.evaluate((element) => element.click());
        break;
      }
      const next = training.locator("#tutorial-next:visible");
      if (await next.count()) {
        await next.evaluate((element) => element.click());
        await page.waitForTimeout(250);
        continue;
      }
      const skip = training.locator("#tutorial-skip:visible");
      if (await skip.count()) {
        await skip.evaluate((element) => element.click());
        await page.waitForTimeout(250);
        continue;
      }
      await page.waitForTimeout(500);
    }
    await page.locator("#pt-start:visible").waitFor();
    milestone("training_completed");
    const initial = (await state()).save;
    assert(initial, "training exit must return to the created progression");
    assert.notEqual(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      null,
    );
    await capture("gear");
    assert.match(
      await page.locator(".gear-footer .status").innerText(),
      /装備1.*一覧タップで入替/,
    );
    await page.goto(harness.origin, { waitUntil: "domcontentloaded" });
    await dismissTitle();
    await solo().tap();
    const secondAdvance = page.locator('[data-operation="advance"]:visible').last();
    await secondAdvance.waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    await secondAdvance.evaluate((element) => element.click());
    await page.locator("#pt-start:visible").waitFor();
    assert.deepEqual(
      (await state()).save,
      initial,
      "Back navigation must not change equipment/progress",
    );
    await assertStage("after-training", 0, false);

    const transferCode = await page.evaluate(async () => {
      const cloud = await import("/src/client/cloud-save.ts");
      return cloud.createCloudSave();
    });
    assert.match(transferCode, /^SF1-[a-f0-9]{32}-[a-f0-9]{64}$/);

    await page.locator("#pt-start").tap();
    await page.locator("#pt-enter").tap();
    milestone("st1_sortie");
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      await dismissBattleDialogs();
      const snapshot = await state();
      if (snapshot.world?.time > 2 && !snapshot.modalCount) break;
      await page.waitForTimeout(150);
    }
    assert((await state()).world.time > 2);
    await capture("battle");

    const cdp = await page.context().newCDPSession(page);
    const point = async (selector, id) => {
      await page.locator(selector).waitFor({ state: "visible", timeout: 120000 });
      const box = await page.locator(selector).boundingBox();
      if (!(box && box.width >= 30 && box.height >= 30)) {
        const diagnostics = await page.evaluate((target) => {
          const element = document.querySelector(target);
          const rect = element?.getBoundingClientRect();
          const playtest = window.__playtest;
          return {
            url: location.href,
            bodyScreen: document.body.dataset.screen,
            hudHidden: document.querySelector("#hud")?.hidden,
            controlsHidden: document.querySelector("#controls")?.hidden,
            openDialogs: document.querySelectorAll("dialog[open]").length,
            playtestScreen: playtest?.screen,
            worldTime: playtest?.world?.time,
            modalCount: playtest?.modalCount,
            targetRect: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          };
        }, selector);
        assert.fail(`${selector} touch target ${JSON.stringify(diagnostics)}`);
      }
      return { id, x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const move = await point("#move", 1),
      look = await point("#look", 2),
      fire = await point("#fire", 3);
    const beforeInput = (await state()).input;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [move, look, fire],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...move, y: move.y - 30 },
        { ...look, x: look.x + 24 },
        fire,
      ],
    });
    const during = (await state()).input;
    assert(
      during.mz > 0 && during.fire && during.yaw !== beforeInput.yaw,
      "Touch move/look/fire reach controls",
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    assert.equal((await state()).input.fire, false);
    assert.equal((await state()).input.mz, 0);
    await cdp.detach();

    const pauseDeadline = Date.now() + 30000;
    while (!(await state()).paused && Date.now() < pauseDeadline) {
      await dismissBattleDialogs();
      try {
        await page.locator("#pause").tap({ timeout: 500 });
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
      }
    }
    assert.equal((await state()).paused, true);
    const pauseTime = (await state()).world.time;
    await page.waitForTimeout(350);
    assert.equal((await state()).world.time, pauseTime);
    await page.locator("#pt-retire").tap();
    await page.locator("#pt-cancel").tap();
    assert.equal((await state()).screen, "battle");
    await capture("pause");

    const rewardId = await syntheticClear(1);
    await assertStage("stage-1-result", 1, false);
    milestone("st1_clear_synthetic", { source: "synthetic-persistence" });
    await page.waitForFunction(
      () =>
        document.querySelector("#pt-result-retry")?.textContent?.includes(
          "最初のバディを選ぶ",
        ),
      undefined,
      { timeout: 30000 },
    );
    await capture("result");
    assert.match(
      await page.locator("#pt-result-retry").innerText(),
      /最初のバディを選ぶ/,
    );
    await page.locator("#pt-result-retry").tap();
    await page.locator('[data-bd="starter-pick"][data-id="tatara"]').tap();
    await page.locator('[data-bd="starter-confirm"]').tap();
    milestone("first_buddy");
    await page.locator('[data-supply-draw="10"]').waitFor();
    await capture("supply");
    await page.waitForFunction(() => {
      const text = document.querySelector("[data-supply-count]")?.textContent ?? "";
      const match = /^(\d+)枚$/.exec(text);
      const button = document.querySelector('[data-supply-draw="10"]');
      return !!match && Number(match[1]) >= 10 && !!button && !button.disabled;
    });
    const supplyCountText =
      (await page.locator("[data-supply-count]").innerText()) ?? "";
    const supplyTickets = Number(/^(\d+)枚$/.exec(supplyCountText)?.[1]);
    assert(
      Number.isSafeInteger(supplyTickets) && supplyTickets >= 10,
      `supply tickets must cover the first ten draw: ${supplyCountText}`,
    );
    assert.equal(await page.locator('[data-supply-draw="10"]').isEnabled(), true);
    await page.locator('[data-supply-draw="10"]').tap();
    await page.locator(".gx-root:not([hidden])").waitFor();
    await page.locator(".gx-skip").tap();
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await page.locator('.gx-actions [data-id="close"]').isVisible()) break;
      await page.locator(".gx-root:not([hidden])").evaluate((element) => {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          }),
        );
      });
      await page.waitForTimeout(200);
    }
    await page.locator('.gx-actions [data-id="close"]').waitFor({ state: "visible" });
    assert.equal(await page.locator(".gx-tile").count(), 10);
    await capture("supply-results");
    milestone("supply10_drawn");
    await page.locator('.gx-actions [data-id="close"]').tap();
    await page.locator(".gear-weapon-list:visible").waitFor();
    const acknowledged = (await state()).save;
    assert(
      acknowledged.receipts.some((receipt) => receipt.startsWith("supply:")),
      "first ten supply must be acknowledged and saved before the gear route",
    );
    milestone("supply10_acknowledged", { route: "gear" });
    await page.locator("#pt-start:visible").waitFor();

    await page.locator('[data-gear-slot="1"]').tap();
    assert.match(
      await page.locator(".gear-footer .status").innerText(),
      /装備2.*一覧タップで入替/,
    );
    const beforeEquip = (await state()).save;
    await page.locator(`[data-row="${rewardId}"] [data-detail]`).tap();
    const equipped = (await state()).save;
    assert.equal(equipped.soldiers[0].equipped[1], rewardId);
    assert.equal(
      equipped.soldiers[0].equipped[0],
      beforeEquip.soldiers[0].equipped[0],
    );
    assert(equipped.receipts.some((receipt) => receipt.startsWith("supply:")));
    await capture("equipped");
    milestone("equipment_changed");

    const layout = await page.evaluate(() => {
      const list = document.querySelector(".gear-weapon-list");
      const button = document.querySelector("#pt-start").getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        horizontal: list.scrollWidth - list.clientWidth,
        rowHeights: [...list.querySelectorAll("[data-row]")].map((element) =>
          element.getBoundingClientRect().height,
        ),
        start: {
          x: button.x,
          y: button.y,
          right: button.right,
          bottom: button.bottom,
          height: button.height,
        },
      };
    });
    assert(!layout.overflow);
    assert(layout.rowHeights.every((value) => value === 30));
    if (width >= 844) assert(layout.horizontal <= 1);
    assert(
      layout.start.x >= 0 &&
        layout.start.right <= width &&
        layout.start.bottom <= height &&
        layout.start.height >= 30,
    );
    if (width < 844) {
      const lockBefore = await page.locator("[data-lock]").first().boundingBox();
      await page.locator(".gear-weapon-list").evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const lockAfter = await page.locator("[data-lock]").first().boundingBox();
      assert.equal(lockAfter.x, lockBefore.x);
      const columns = await page
        .locator(".pt-stat-inner")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().x),
        );
      assert(columns.every((value) => Math.abs(value - columns[0]) <= 1));
      await capture("scrolled");
    }
    await page.addStyleTag({
      content:
        ":root { --safe-left: 24px; --safe-right: 24px; --safe-top: 8px; --safe-bottom: 8px; }",
    });
    await capture("safe-insets");
    const safe = await page.locator(".panel").boundingBox();
    assert(safe.x >= 24 && safe.x + safe.width <= width - 24);

    await selectStage(1);
    await page.locator("#pt-start").tap();
    await page.locator("#pt-enter").tap();
    milestone("st2_sortie");
    await syntheticClear(2);
    await assertStage("stage-2-result", 2, false);
    milestone("st2_clear_synthetic", { source: "synthetic-persistence" });
    await capture("stage-2-result");

    await page.locator("#pt-result-retry").tap();
    await page.locator("#pt-start:visible").waitFor();
    await selectStage(2);
    await page.locator("#pt-start").tap();
    await page.locator("#pt-enter").tap();
    milestone("st3_sortie");
    await syntheticClear(3);
    await assertStage("stage-3-result", 3, false);
    milestone("st3_clear_synthetic", { source: "synthetic-persistence" });
    await capture("stage-3-result");

    await page.goto(harness.origin, { waitUntil: "domcontentloaded" });
    await dismissTitle();
    await solo().waitFor();
    await assertStage("all-entrances-open", 3);
    assert.equal((await state()).save.soldiers[0].equipped[1], rewardId);
    await capture("all-open");
    milestone("all_entrances_open");
    assert.deepEqual(errors, []);
    results.cases.push({
      width,
      height,
      screens: screens.map((item) => item.name),
      touch: true,
      back: true,
      safeInsetEmulation: true,
      trainee: true,
      buddy: true,
      supply10LocalWorker: true,
      equipPersisted: true,
      stageAssertions: [0, 1, 2, 3],
      pageErrors: errors,
      layout,
    });
    console.log(`${phase} ${width}x${height}: PASS`);
    await page.close();
  }
  results.passed = true;
} catch (error) {
  results.failure = String(error.stack || error);
  if (page && !page.isClosed())
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
  console.error(error);
} finally {
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await harness.close();
}
