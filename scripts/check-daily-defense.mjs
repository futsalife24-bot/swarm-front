import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const out = "dist-validation/daily-defense";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const p = await browser.newPage({
    viewport: { width: 844, height: 390 },
    serviceWorkers: "block",
  });
  p.setDefaultTimeout(60000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/api/cloud/**", async (route) => {
    const r = route.request();
    const response = await route.fetch({
      url: "http://127.0.0.1:8793" + new URL(r.url()).pathname,
      headers: {
        ...r.headers(),
        origin: "http://127.0.0.1:8793",
        host: "127.0.0.1:8793",
      },
    });
    await route.fulfill({ response });
  });
  await p.goto("http://127.0.0.1:5197");
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#solo").click();
  await p.locator("#player-name").fill("防衛検証");
  await p.locator("#player-name-form button[type=submit]").click();
  await p.locator("#pt-confirm").click();
  await p.evaluate(async () => {
    await (await import("/src/client/cloud-save.ts")).createCloudSave();
  });
  await p.locator("#pt-home").click();
  await p.locator("#pt-daily-defense").click();
  await p.locator("#pt-defense-prepare").click();
  await p.locator("#pt-enter").waitFor({ state: "visible" });
  assert.equal(
    await p.evaluate(() => window.__playtest.save.dailyDefense ?? null),
    null,
  );
  await p.locator("#pt-enter").click();
  try {
    await p.waitForFunction(
      () => window.__playtest.world?.phase === "battle",
      undefined,
      { timeout: 20000 },
    );
  } catch (error) {
    console.log(
      "ADMISSION FAILED",
      await p.locator("#pt-load-error").textContent(),
      await p.evaluate(async () =>
        (await import("/src/client/cloud-save.ts")).cloudStatus(),
      ),
      errors,
    );
    throw error;
  }
  const begun = await p.evaluate(() => ({
    ledger: window.__playtest.save.dailyDefense,
    count: window.__playtest.save.inventory.length,
    armory: window.__playtest.world.defense.armory.hp,
  }));
  assert.equal(begun.ledger.state, "active");
  assert.equal(begun.count, 4);
  assert.equal(begun.armory, 2000);
  await p.reload();
  await p.waitForFunction(
    () => window.__playtest?.save?.dailyDefense?.state === "interrupted",
  );
  assert.equal(await p.locator("#pt-resume-battle").count(), 0);
  assert.equal(
    await p.evaluate(() => window.__playtest.save.inventory.length),
    4,
  );
  assert.deepEqual(errors, []);
  await p.evaluate(async () => {
    const cloud = await import("/src/client/cloud-save.ts");
    await cloud.syncCloud();
    await cloud.deleteCloudSave();
  });
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify(
      {
        pass: true,
        checks: [
          "assets ready before admission",
          "guarantee banked before combat",
          "armory target initialized",
          "reload retains guarantee",
          "no daily battle replay",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("DAILY CORE PASS");
} finally {
  await browser.close();
}
