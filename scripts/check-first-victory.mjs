import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { startLocalJourneyHarness } from "./local-journey-harness.mjs";

const phase = process.argv.includes("--baseline") ? "before" : "after";
const out = `dist-validation/first-ten-minutes/${phase}-victory`;
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

const record = {
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  humanParticipants: 0,
  supplyEndpoint: "local Worker proxied by the same-origin Vite server",
  milestones,
  viewport: { width: 844, height: 390 },
  samples: [],
  passed: false,
};

const STAGE_OPEN = {
  0: ["solo", "coop", "supplyBox", "tutorial", "settings", "sortiePrep", "title"],
  1: ["solo", "coop", "supplyBox", "tutorial", "settings", "sortiePrep", "title", "base", "enemyReport", "weapons", "buddy", "supply"],
  2: ["solo", "coop", "supplyBox", "tutorial", "settings", "sortiePrep", "title", "base", "enemyReport", "weapons", "buddy", "supply", "weekly", "growth"],
  3: ["solo", "coop", "base", "enemyReport", "supplyBox", "weekly", "dailyDefense", "tutorial", "tutorialWeaponUpgradeGuide", "settings", "settingsDeveloper", "sortiePrep", "title", "weapons", "buddy", "supply", "growth", "accessories", "survivalCards", "workshop", "weaponWorkshopButton"],
};
const STAGE_CLOSED = {
  0: ["base", "weapons", "buddy", "supply", "weekly", "dailyDefense", "growth", "accessories", "survivalCards", "workshop", "settingsDeveloper", "tutorialWeaponUpgradeGuide", "weaponWorkshopButton"],
  1: ["weekly", "dailyDefense", "accessories", "survivalCards", "workshop", "settingsDeveloper", "tutorialWeaponUpgradeGuide", "weaponWorkshopButton"],
  2: ["dailyDefense", "accessories", "survivalCards", "workshop", "settingsDeveloper", "tutorialWeaponUpgradeGuide", "weaponWorkshopButton"],
  3: [],
};

const harness = await startLocalJourneyHarness("victory");
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11", "--mute-audio"],
});
const errors = [];
let page;
try {
  page = await browser.newPage({
    viewport: record.viewport,
    serviceWorkers: "block",
  });
  page.setDefaultTimeout(60000);
  page.on("pageerror", (error) => errors.push(error.message));

  const state = () => page.evaluate(() => window.__playtest);
  const solo = () => page.locator("#solo:visible").last();
  const advance = () => page.locator('[data-operation="advance"]:visible').last();
  const dismissTitle = async () => {
    const start = page.locator("dialog.title-entry[open] .title-entry-start");
    await start.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    if (await start.isVisible()) {
      await start.click();
      await page.locator("dialog.title-entry").waitFor({ state: "detached" });
    }
    const landscape = page.locator("#landscape-start");
    if (await landscape.isVisible()) await landscape.click();
  };
  const advanceToGear = async () => {
    await advance().waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".split-shutter,.menu-route-shutter"),
    );
    await advance().click();
  };
  const dismissBattleDialogs = async () => {
    const close = page
      .locator("dialog.menu-dialog[open] .dialog-close:visible")
      .last();
    if (await close.count()) await close.evaluate((element) => element.click());
    for (const selector of ["#pt-tutorial-skip:visible", "#pt-intro-skip:visible"]) {
      const skip = page.locator(selector).last();
      if (await skip.count()) await skip.evaluate((element) => element.click());
    }
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

  await page.goto(harness.origin, { waitUntil: "domcontentloaded" });
  await dismissTitle();
  await solo().waitFor();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("swarm-front-shared-progress-v3"),
    ),
    null,
  );
  await page.screenshot({ path: `${out}/title.png` });
  await assertStage("title", 0);
  milestone("launch", { viewport: "844x390" });

  await solo().click();
  await page.locator("#player-name").fill("通常入力検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await solo().click();
  await advanceToGear();
  await page.locator("#pt-offer-training:visible").waitFor();
  assert.equal(await page.locator("#pt-confirm").count(), 0);
  milestone("training_offered");

  const training = page.frameLocator('iframe.training-frame[title="初陣訓練"]');
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await page.locator('iframe.training-frame[title="初陣訓練"]').count())
      break;
    const offer = page.locator("#pt-offer-training:visible").last();
    if (await offer.count()) await offer.click();
    await page.waitForTimeout(300);
  }
  await training.locator("#training-start").waitFor({ state: "visible" });
  await training.locator("#training-start").click();
  milestone("training_started");
  for (let step = 0; step < 240; step++) {
    const finish = training.locator("#tutorial-finish:visible");
    if (await finish.count()) {
      await finish.click();
      break;
    }
    const next = training.locator("#tutorial-next:visible");
    if (await next.count()) {
      await next.click();
      await page.waitForTimeout(250);
      continue;
    }
    const skip = training.locator("#tutorial-skip:visible");
    if (await skip.count()) {
      await skip.click();
      await page.waitForTimeout(250);
      continue;
    }
    await page.waitForTimeout(500);
  }
  await page.locator("#pt-start:visible").waitFor();
  const initial = (await state()).save;
  assert(initial, "training exit must return to the created progression");
  assert.notEqual(
    await page.evaluate(() =>
      localStorage.getItem("swarm-front-shared-progress-v3"),
    ),
    null,
  );
  await assertStage("after-training", 0, false);
  milestone("training_completed");

  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click();
  milestone("st1_sortie");
  await page.evaluate(async () => {
    const { pilot } = await import("/tests/bot.ts");
    window.firstVictoryPilot = setInterval(() => {
      const s = window.__playtest;
      if (s.screen !== "battle" || s.modalCount || s.encounterActive) return;
      const i = pilot(s.world, "solo");
      const yaw = Math.atan2(
        Math.sin(i.yaw - s.input.yaw),
        Math.cos(i.yaw - s.input.yaw),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerType: "mouse",
          buttons: 2,
          movementX: yaw / 0.003,
          movementY: -(i.pitch - s.input.pitch) / 0.0025,
        }),
      );
      for (const [code, on] of [
        ["KeyW", i.mz > 0.2],
        ["KeyS", i.mz < -0.2],
        ["KeyD", i.mx > 0.2],
        ["KeyA", i.mx < -0.2],
        ["Space", i.dodge],
      ])
        window.dispatchEvent(
          new KeyboardEvent(on ? "keydown" : "keyup", { code }),
        );
      document.querySelector("#world").dispatchEvent(
        new PointerEvent(i.fire ? "pointerdown" : "pointerup", {
          bubbles: true,
          pointerType: "mouse",
          button: 0,
        }),
      );
    }, 50);
  });

  const deadline = Date.now() + 600000;
  let nextSample = 0;
  let lastTime = -1,
    lastAdvance = Date.now();
  while (Date.now() < deadline) {
    await dismissBattleDialogs();
    const s = await page.evaluate(() => {
      const s = window.__playtest;
      return {
        screen: s.screen,
        time: s.world?.time,
        hp: s.world?.players[0].hp,
        kills: s.world?.totalKills,
        wave: s.world?.wave,
        phase: s.world?.phase,
        paused: s.paused,
        modalCount: s.modalCount,
        encounter: s.encounterActive,
        hidden: document.hidden,
        dialog: document.querySelector("dialog[open]")?.textContent,
      };
    });
    if (Date.now() > nextSample) {
      record.samples.push(s);
      console.log(JSON.stringify(s));
      nextSample = Date.now() + 15000;
    }
    if (s.screen === "collection") {
      record.victory = s;
      break;
    }
    if (s.time !== lastTime) {
      lastTime = s.time;
      lastAdvance = Date.now();
    }
    assert(
      Date.now() - lastAdvance < 30000,
      `Combat stalled: ${JSON.stringify({ ...s, errors })}`,
    );
    assert.notEqual(s.screen, "down", `Pilot defeated: ${JSON.stringify(s)}`);
    await page.waitForTimeout(250);
  }
  assert(record.victory, "Normal input pilot must reach collection");
  await page.evaluate(() => clearInterval(window.firstVictoryPilot));
  await assertStage("stage-1-clear", 1, false);
  milestone("first_victory", { screen: "collection" });
  await page.screenshot({ path: `${out}/victory.png` });

  await page.locator("#pt-end-collection").click();
  assert.equal(await page.locator("#pt-confirm").count(), 0);
  await page.locator("#pt-normal-reward").click();
  await page.screenshot({ path: `${out}/result.png` });
  const reward = await page.evaluate(
    () => window.__playtest.save.result.weapons[0].id,
  );
  await page.waitForFunction(() => {
    const original = document.querySelector("#pt-result-ftue-original");
    const retry = document.querySelector("#pt-result-retry");
    return (
      (original && !original.hidden) ||
      retry?.textContent?.includes("装備変更・再出撃")
    );
  });
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  const gearButton = page
    .locator("#pt-result-ftue-original:visible, #pt-result-retry:visible")
    .filter({ hasText: "装備変更・再出撃" })
    .last();
  await gearButton.waitFor();
  await gearButton.click();
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator('[data-gear-slot="1"]').waitFor();
  milestone("reward_claimed", { weapon: reward });

  await page.locator('[data-gear-slot="1"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-gear-slot="1"]')?.getAttribute("aria-pressed") ===
      "true",
  );
  await page
    .locator(`.gear-arsenal [data-row="${reward}"] [data-detail]:visible`)
    .last()
    .click();
  const equipped = (await state()).save;
  assert.equal(equipped.soldiers[0].equipped[1], reward);
  assert.equal(
    equipped.soldiers[0].equipped[0],
    initial.soldiers[0].equipped[0],
  );
  milestone("reward_equipped", { weapon: reward });

  const menuBack = page.locator("[data-menu-back]:visible").last();
  await menuBack.waitFor();
  await menuBack.click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissTitle();
  await solo().waitFor();
  await assertStage("reloaded-title", 1);
  milestone("reloaded");
  await solo().click();
  await advanceToGear();
  await page.waitForFunction(
    () => !document.querySelector(".split-shutter,.menu-route-shutter"),
  );
  await page.locator("#pt-start:visible").waitFor();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").waitFor({ timeout: 120000 });
  await page.locator("#pt-enter").click();
  assert.equal(
    await page.evaluate(() => window.__playtest.world.players[0].weapons[1].id),
    reward,
  );
  await assertStage("redeployed", 1, false);
  milestone("redeployed", { weapon: reward });
  await page.screenshot({ path: `${out}/redeploy.png` });
  assert.deepEqual(errors, []);
  record.equippedReward = reward;
  record.passed = true;
  console.log("PASS normal input victory, rewards, equip, reload and redeploy");
} catch (e) {
  record.failure = String(e.stack || e);
  if (page && !page.isClosed())
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
  console.error(e);
} finally {
  record.pageErrors = errors;
  record.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(record, null, 2));
  await browser.close();
  await harness.close();
}
