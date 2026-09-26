import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const phase = process.argv.includes("--baseline") ? "before" : "after";
const out = `dist-validation/first-ten-minutes/${phase}-victory`;
fs.mkdirSync(out, { recursive: true });
const record = {
  startedAt: new Date().toISOString(),
  head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  humanParticipants: 0,
  fixture: false,
  defaultEquipment: true,
  viewport: { width: 844, height: 390 },
  samples: [],
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
const page = await browser.newPage({
  viewport: record.viewport,
  serviceWorkers: "block",
});
page.setDefaultTimeout(60000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator("#solo").click();
  await page.locator("#player-name").fill("通常入力検証");
  await page.locator("#player-name-form button[type=submit]").click();
  await page.locator("#pt-confirm").click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click();
  await page.locator("#pt-tutorial-skip").click();
  // State reads are cloned diagnostics; only normal input events affect combat.
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
    if (await page.locator("#pt-intro-skip").isVisible())
      await page.locator("#pt-intro-skip").click();
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
  await page.screenshot({ path: `${out}/victory.png` });
  await page.locator("#pt-end-collection").click();
  if (await page.locator("#pt-confirm").isVisible())
    await page.locator("#pt-confirm").click();
  await page.locator("#pt-normal-reward").click();
  await page.screenshot({ path: `${out}/result.png` });
  const reward = await page.evaluate(
    () => window.__playtest.save.result.weapons[0].id,
  );
  await page.locator("#pt-result-retry").click();
  await page.locator('[data-gear-slot="1"]').click();
  await page.locator(`[data-row="${reward}"] [data-detail]`).click();
  await page.locator("#pt-home").click();
  await page.reload();
  await page.locator("#solo").click();
  await page.locator("#pt-start").click();
  await page.locator("#pt-enter").click();
  assert.equal(
    await page.evaluate(() => window.__playtest.world.players[0].weapons[1].id),
    reward,
  );
  await page.screenshot({ path: `${out}/redeploy.png` });
  assert.deepEqual(errors, []);
  record.equippedReward = reward;
  record.passed = true;
  console.log("PASS normal input victory, rewards, equip, reload and redeploy");
} catch (e) {
  record.failure = String(e.stack || e);
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  process.exitCode = 1;
  console.error(e);
} finally {
  record.pageErrors = errors;
  record.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${out}/checks.json`, JSON.stringify(record, null, 2));
  await browser.close();
  await server.close();
}
