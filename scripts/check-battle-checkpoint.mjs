import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/battle-checkpoint";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const p = await browser.newPage({
  viewport: { width: 844, height: 390 },
  serviceWorkers: "block",
});
p.setDefaultTimeout(60000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const key = "swarm-front-battle-checkpoint-v1";
try {
  await p.goto("http://127.0.0.1:5197");
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#solo").click();
  await p.locator("#player-name").fill("復帰検証");
  await p.locator("#player-name-form button[type=submit]").click();
  await p.locator("#pt-confirm").click();
  await p.locator("#pt-start").click();
  await p.locator("#pt-enter").click();
  if (await p.locator("#pt-tutorial-skip").count())
    await p.locator("#pt-tutorial-skip").click();
  // Close any first encounter/tutorial using the ordinary controls.
  await p.waitForTimeout(1000);
  for (let i = 0; i < 5; i++) {
    const skip = p.getByRole("button", { name: /スキップ/ }).first();
    if (await skip.isVisible()) await skip.click();
    await p.waitForTimeout(200);
  }
  console.log(
    "BEFORE PAUSE",
    await p.evaluate(() => ({
      screen: window.__playtest.screen,
      paused: window.__playtest.paused,
      hp: window.__playtest.world?.players[0]?.hp,
      text: document.querySelector("#ui")?.textContent?.slice(0, 400),
    })),
    errors,
  );
  await p.screenshot({ path: out + "/before-pause.png" });
  await p.locator("#pause").click();
  const before = await p.evaluate(
    (k) => JSON.parse(JSON.parse(localStorage.getItem(k)).body),
    key,
  );
  await p.reload();
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#pt-resume-battle").waitFor();
  await p.screenshot({ path: out + "/resume-prompt.png" });
  await p.locator("#pt-resume-battle").click();
  await p.locator("#pt-enter").waitFor({ state: "visible" });
  const prepared = await p.evaluate(() => window.__playtest.world);
  assert.deepEqual(prepared, before.world);
  await p.locator("#pt-enter").click();
  await p.locator("#pause").click();
  const resumed = await p.evaluate(() => window.__playtest);
  assert.equal(resumed.world.run, before.world.run);
  assert(
    resumed.world.time >= before.world.time &&
      resumed.world.time < before.world.time + 2,
  );
  assert.deepEqual(resumed.save, JSON.parse(before.progress));
  await p.screenshot({ path: out + "/resumed.png" });
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify(
      {
        pass: true,
        run: before.world.run,
        savedTime: before.world.time,
        resumedTime: resumed.world.time,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("CHECKPOINT PASS");
} finally {
  await browser.close();
}
