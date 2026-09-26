// Fresh local-only contexts. Synthetic victory is explicitly separate from combat play.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const baseline = process.argv.includes("--baseline");
const narrow = process.argv.includes("--narrow");
const phase = baseline ? "before" : "after";
const out = `dist-validation/first-ten-minutes/${phase}${narrow ? "-narrow" : ""}`;
fs.mkdirSync(out, { recursive: true });
const source = "src/client/playtest-app.ts";
const results = {
  phase,
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceHash: createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex"),
  humanParticipants: 0,
  victory:
    "Synthetic result through real persistence; not a combat or human comprehension test.",
  cases: [],
  passed: false,
};
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
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
    page.on("pageerror", (e) => errors.push(e.message));
    const capture = async (name) => {
      await page.screenshot({ path: `${out}/${width}-${name}.png` });
      const item = { name, text: await page.locator("body").innerText() };
      screens.push(item);
      fs.writeFileSync(
        `${out}/${width}-screens.json`,
        JSON.stringify(screens, null, 2),
      );
    };
    const state = () => page.evaluate(() => window.__playtest);
    const dismissEncounters = async () => {
      const skip = page.locator("#pt-intro-skip");
      if (await skip.isVisible()) await skip.click({ timeout: 2000 });
    };
    await page.goto(server.resolvedUrls.local[0]);
    await page.locator("#solo").waitFor();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      null,
    );
    await capture("title");
    await page.locator("#solo").tap();
    await page.locator("#player-name").fill("初回検証");
    await page.locator("#player-name-form button[type=submit]").tap();
    await capture("initialize");
    await page.locator("#pt-cancel").tap();
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-shared-progress-v3"),
      ),
      null,
    );
    await page.locator("#solo").tap();
    await page.locator("#pt-confirm").tap();
    const initial = (await state()).save;
    await capture("gear");
    if (!baseline)
      assert.match(
        await page.locator(".gear-footer .status").innerText(),
        /装備1.*一覧タップで入替/,
      );
    await page.locator("#pt-mission-info").tap();
    await capture("mission");
    await page.locator(".dialog-close").tap();
    await page.locator("#pt-home").tap();
    await page.locator("#solo").tap();
    assert.deepEqual(
      (await state()).save,
      initial,
      "Back navigation must not change equipment/progress",
    );
    await page.locator("#pt-start").tap();
    await page.locator("#pt-enter").tap();
    await page.locator("#pt-tutorial-skip").waitFor();
    await capture("combat-guide");
    if (!baseline) {
      const text = await page.locator("dialog").innerText();
      assert.match(text, /全WAVE.*クリア/);
      assert.match(text, /タッチ.*左スティック.*右側.*射撃/);
      assert.match(text, /PC.*WASD.*右ドラッグ.*左クリック/);
    }
    const held = (await state()).world.time;
    await page.waitForTimeout(350);
    assert.equal(
      (await state()).world.time,
      held,
      "Reading the guide pauses combat",
    );
    await page.locator("#pt-tutorial-skip").tap();
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      await dismissEncounters();
      const s = await state();
      if (s.world.time > 2 && !s.modalCount && !s.encounterActive) break;
      await page.waitForTimeout(150);
    }
    assert((await state()).world.time > 2);
    await capture("battle");
    // Real browser multitouch: move, look and fire concurrently, then cancel.
    const cdp = await page.context().newCDPSession(page);
    const point = async (selector, id) => {
      const b = await page.locator(selector).boundingBox();
      assert(b && b.width >= 30 && b.height >= 30, `${selector} touch target`);
      return { id, x: b.x + b.width / 2, y: b.y + b.height / 2 };
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
    // A new enemy may enter view between the input check and the pause tap.
    const pauseDeadline = Date.now() + 30000;
    while (!(await state()).paused && Date.now() < pauseDeadline) {
      await dismissEncounters();
      try {
        await page.locator("#pause").tap({ timeout: 500 });
      } catch (e) {
        if (e.name !== "TimeoutError") throw e;
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
    // Isolated synthetic win to reach reward UI identically at both widths.
    const reward = await page.evaluate(async () => {
      const m = await import("/src/client/progression-save.ts");
      const { makeWeapon } = await import("/src/shared/progression.ts");
      const s = m.loadProgress("normal");
      const id = "first-ten-minutes-fixture-reward";
      const input = {
        run: window.__playtest.world.run,
        stage: 1,
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
            s.serial,
          ),
        ],
      };
      const next = m.prepareChoice(
        m.grantResult(s, input, () => 0.5),
        () => 0.5,
      );
      m.persistProgress(next);
      return { id, input };
    });
    await page.reload();
    await page.locator("#pt-normal-reward").waitFor();
    await capture("reward");
    await page.locator("#pt-normal-reward").tap();
    await capture("result");
    if (!baseline) {
      assert.match(
        await page.locator("#pt-result-retry").innerText(),
        /装備.*再出撃/,
      );
      assert.match(
        await page.locator("#pt-result-retry").getAttribute("class"),
        /primary/,
      );
    }
    const won = (await state()).save;
    await page.locator("#pt-result-retry").tap();
    await page.locator('[data-gear-slot="1"]').tap();
    if (!baseline)
      assert.match(
        await page.locator(".gear-footer .status").innerText(),
        /装備2.*一覧タップで入替/,
      );
    const beforeEquip = (await state()).save;
    await page.locator(`[data-row="${reward.id}"] [data-detail]`).tap();
    const equipped = (await state()).save;
    assert.equal(equipped.soldiers[0].equipped[1], reward.id);
    assert.equal(equipped.inventory.length, won.inventory.length);
    assert.equal(equipped.coins, won.coins);
    assert.deepEqual(equipped.receipts, won.receipts);
    assert.equal(
      equipped.soldiers[0].equipped[0],
      beforeEquip.soldiers[0].equipped[0],
    );
    await capture("equipped");
    const layout = await page.evaluate(() => {
      const list = document.querySelector(".gear-weapon-list");
      const button = document
        .querySelector("#pt-start")
        .getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        horizontal: list.scrollWidth - list.clientWidth,
        rowHeights: [...list.querySelectorAll("[data-row]")].map(
          (e) => e.getBoundingClientRect().height,
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
    assert(layout.rowHeights.every((h) => h === 30));
    if (width >= 844) assert(layout.horizontal <= 1);
    assert(
      layout.start.x >= 0 &&
        layout.start.right <= width &&
        layout.start.bottom <= height &&
        layout.start.height >= 30,
    );
    if (width < 844) {
      const lockBefore = await page
        .locator("[data-lock]")
        .first()
        .boundingBox();
      await page.locator(".gear-weapon-list").evaluate((e) => {
        e.scrollLeft = e.scrollWidth;
      });
      const lockAfter = await page.locator("[data-lock]").first().boundingBox();
      assert.equal(lockAfter.x, lockBefore.x);
      const columns = await page
        .locator(".pt-stat-inner")
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().x));
      assert(columns.every((x) => Math.abs(x - columns[0]) <= 1));
      await capture("scrolled");
    }
    // CSS inset emulation, not a physical notched device test.
    await page.addStyleTag({
      content:
        ":root { --safe-left: 24px; --safe-right: 24px; --safe-top: 8px; --safe-bottom: 8px; }",
    });
    await capture("safe-insets");
    const safe = await page.locator(".panel").boundingBox();
    assert(safe.x >= 24 && safe.x + safe.width <= width - 24);
    await page.locator("#pt-home").tap();
    await page.reload();
    await page.locator("#solo").tap();
    assert.equal((await state()).save.soldiers[0].equipped[1], reward.id);
    await page.locator("#pt-start").tap();
    await page.locator("#pt-enter").tap();
    assert.equal((await state()).world.players[0].weapons[1].id, reward.id);
    assert.equal(await page.locator("#pt-tutorial-skip").count(), 0);
    await capture("redeployed");
    assert.deepEqual(errors, []);
    results.cases.push({
      width,
      height,
      screens: screens.map((s) => s.name),
      touch: true,
      back: true,
      safeInsetEmulation: true,
      equipPersisted: true,
      rewardCount: won.inventory.length - initial.inventory.length,
      pageErrors: errors,
      layout,
    });
    console.log(`${phase} ${width}x${height}: PASS`);
    await page.close();
  }
  results.passed = true;
} catch (e) {
  results.failure = String(e.stack || e);
  if (page && !page.isClosed())
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
  console.error(e);
} finally {
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
