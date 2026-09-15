import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "dist-validation/trooper-kling";
const b = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const report = [];
try {
  for (const [base, width, height] of [
    ["http://127.0.0.1:5314", 844, 390],
    ["http://127.0.0.1:5367", 1280, 720],
  ]) {
    const p = await b.newPage({
        viewport: { width, height },
        serviceWorkers: "block",
      }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const settle = async (ms) => {
      let until = Date.now() + ms;
      while (Date.now() < until) {
        for (const id of ["pt-tutorial-skip", "pt-intro-skip"])
          if (await p.locator("#" + id).isVisible()) {
            await p.locator("#" + id).focus();
            await p.keyboard.press("Enter");
            until = Math.max(until, Date.now() + ms);
          }
        await p.waitForTimeout(120);
      }
    };
    await p.addInitScript(() =>
      localStorage.setItem("swarm-front-player-name-v1", "Motion QA"),
    );
    await p.goto(base);
    await p.getByRole("button", { name: /ソロで出撃準備/ }).click();
    await p.getByRole("button", { name: "確定", exact: true }).click();
    await p.locator("#pt-start").click();
    await p.locator("#pt-enter").waitFor({ timeout: 90000 });
    await p.locator("#pt-enter").click();
    await settle(1800);
    const label = width === 844 ? "dev" : "built";
    await p.screenshot({ path: `${dir}/campaign-${label}-idle.jpg` });
    const shoot = async () => {
      await p.mouse.move(width * 0.6, height * 0.45);
      await p.mouse.down();
      await p.waitForTimeout(260);
      await p.mouse.up();
      await settle(220);
    };
    await shoot();
    await p.keyboard.down("KeyD");
    await settle(400);
    await p.keyboard.up("KeyD");
    await p.keyboard.press("KeyR");
    await settle(2100);
    await p.keyboard.press("KeyQ");
    await settle(1400);
    await shoot();
    const ammo = await p.locator(".ammo-line b").innerText();
    assert.ok(parseInt(ammo) < 7, "SG ammunition consumed after switching");
    await p.screenshot({ path: `${dir}/campaign-${label}-shotgun.jpg` });
    const state =
      label === "dev"
        ? await p.evaluate(() => ({
            trooper: __playtest.trooper,
            player: __playtest.world.players[0],
          }))
        : null;
    if (state) {
      assert.equal(state.trooper.bones, 57);
      assert.equal(state.player.slot, 1);
      assert.ok(state.player.ammo[1] < 7);
    }
    assert.deepEqual(errors, []);
    report.push({ base, width, height, ammo, state, errors });
    fs.writeFileSync(dir + "/campaign.json", JSON.stringify(report, null, 2));
    await p.close();
    console.log("PASS", label, "campaign launch/move/fire/reload/switch");
  }
} finally {
  await b.close();
}
