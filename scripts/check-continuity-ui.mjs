import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const win = process.argv.includes("--win");
const out = "dist-validation/continuity-ui" + (win ? "-win" : "");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
const errors = [],
  checks = [];
async function device(width = 844) {
  const context = await browser.newContext({
    viewport: { width, height: 390 },
    serviceWorkers: "block",
  });
  const p = await context.newPage();
  p.setDefaultTimeout(30000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/api/cloud/**", async (route) => {
    const req = route.request();
    const response = await route.fetch({
      url: "http://127.0.0.1:8793" + new URL(req.url()).pathname,
      headers: {
        ...req.headers(),
        origin: "http://127.0.0.1:8793",
        host: "127.0.0.1:8793",
      },
    });
    await route.fulfill({ response });
  });
  await p.goto("http://127.0.0.1:5197");
  if (await p.locator("#landscape-start").isVisible())
    await p.locator("#landscape-start").click();
  await p.locator("#home-settings").waitFor();
  return p;
}
const settings = async (p) => {
  await p.locator("#home-settings").click();
  await p.locator("#pt-cloud-settings").click();
};
const raw = (p) =>
  p.evaluate(() => localStorage.getItem("swarm-front-shared-progress-v3"));
try {
  const a = await device();
  await a.locator("#solo").click();
  await a.locator("#player-name").fill("継続検証");
  await a.locator("#player-name-form button[type=submit]").click();
  await a.locator("#pt-confirm").click();
  await a.locator("#pt-home").click();
  await settings(a);
  await a.locator("#pt-cloud-create").click();
  await a.locator("#pt-cloud-show").waitFor();
  assert.equal(await a.locator("#pt-cloud-code").inputValue(), "");
  await a.screenshot({ path: out + "/cloud-844.png" });
  const code = await a.evaluate(async () =>
    (await import("/src/client/cloud-save.ts")).transferCode(),
  );
  checks.push("secret hidden by default and UI creation");
  await a.locator("#pt-cloud-restore").click();
  const beforeCancel = await raw(a);
  const beforeVersion = await a.evaluate(async () => {
    const c = await import("/src/client/cloud-save.ts");
    return (await c.inspectCloud(c.transferCode())).version;
  });
  await a.locator("#pt-cloud-cancel").click();
  assert.equal(await raw(a), beforeCancel);
  assert.equal(
    await a.evaluate(async () => {
      const c = await import("/src/client/cloud-save.ts");
      return (await c.inspectCloud(c.transferCode())).version;
    }),
    beforeVersion,
  );
  checks.push("cancel changes neither local nor cloud");
  const b = await device(640);
  await settings(b);
  await b.locator("#pt-cloud-input").fill(code);
  await b.locator("#pt-cloud-connect").click();
  await b.locator("#pt-use-cloud").waitFor();
  await b.screenshot({ path: out + "/compare-640.png" });
  await b.locator("#pt-use-cloud").click();
  await b.waitForFunction(() => !!window.__playtest?.save);
  assert.equal(
    await b.evaluate(() => window.__playtest.save.coins),
    JSON.parse(await raw(a)).coins,
  );
  checks.push("UI restore initializes in-memory save on empty device");
  // Synthetic local victories exercise the real weekly transport and UI claim.
  await b.evaluate(async () => {
    const p = await import("/src/client/progression-save.ts");
    const s = p.loadProgress("normal");
    for (const id of ["ui-win-a", "ui-win-b", "ui-win-c"]) s.receipts.push(id);
    s.weeklyPending = ["ui-win-a", "ui-win-b", "ui-win-c"];
    p.persistProgress(s);
    await (await import("/src/client/cloud-save.ts")).syncCloud();
  });
  const coins = JSON.parse(await raw(b)).coins;
  await b.locator("#home-settings").click();
  await b.locator("#pt-weekly-missions").click();
  await b.locator('[data-weekly-id="campaign-3"]:enabled').click();
  await b.waitForFunction(
    () =>
      document.querySelector('[data-weekly-id="campaign-3"]')?.textContent ===
      "受取済み",
  );
  assert.equal(
    await b.evaluate(() => window.__playtest.save.coins),
    coins + 150,
  );
  await b.screenshot({ path: out + "/weekly-640.png" });
  checks.push("weekly UI reward and in-memory update");
  await b.locator("dialog .dialog-close").click();
  await b.locator("#pt-daily-defense").click();
  await b.locator("#pt-defense-prepare").click();
  await b.locator("#pt-enter").click();
  await b.waitForFunction(() => window.__playtest.world?.phase === "battle");
  await b.screenshot({ path: out + "/daily-battle.png" });
  // Controlled lethal hit checks real finish/persistence/cinematic path, not balance.
  await b.evaluate((win) => window.__playtest.completeDefenseForTest(win), win);
  await b.locator(".daily-cinematic").waitFor();
  await b.screenshot({ path: out + "/daily-destroyed.png" });
  await b.locator("#pt-daily-home").waitFor();
  assert.equal(
    await b.evaluate(() => window.__playtest.save.dailyDefense.state),
    win ? "victory" : "defeat",
  );
  assert.equal(
    await b.evaluate(() => window.__playtest.save.powder),
    win ? 0 : 5,
  );
  assert.equal(
    await b.evaluate(() => window.__playtest.save.dailyDefense.bonus),
    win ? 5 : 0,
  );
  await b.screenshot({ path: out + "/daily-result.png" });
  checks.push(
    (win ? "victory with five bonus weapons" : "defeat with powder") +
      " cinematic and reward result",
  );
  await b.locator("#pt-daily-home").click();
  await settings(b);
  await b.locator("#pt-cloud-delete").click();
  await b.locator("#pt-cloud-delete-confirm").click();
  await b.locator("#pt-cloud-create").waitFor();
  assert.ok(await raw(b));
  checks.push("explicit cloud deletion retains device save");
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    out + "/checks.json",
    JSON.stringify({ pass: true, checks, errors }, null, 2),
  );
  console.log("CONTINUITY UI PASS", checks);
} finally {
  await browser.close();
}
